"""
backend/app/tasks/inference.py
Celery 推理任务定义
"""
from __future__ import annotations

import time
import logging
from typing import List, Optional

import numpy as np

from app.tasks.celery_app import celery_app
from app.core.config import get_settings

logger = logging.getLogger(__name__)

# mol/kg → cm³/cm³: 1 mol/kg * M(g/mol) * ρ(g/cm³)⁻¹ * 22400 cm³/mol × 1/1000
# 实际换算：cm³_STP/cm³ = mol_kg * density_g_cm3 * molar_volume_cm3_mol / 1000
# 简单近似：CM3_PER_MOL_STP = 22414 cm³/mol
CM3_PER_MOL_STP = 22414.0


def _mol_kg_to_cm3_cm3(mol_kg: float, density_g_cm3: float, molar_mass: float = 16.043) -> float:
    """CH4 默认 mol/kg → cm³(STP)/cm³."""
    # uptake [cm³/cm³] = mol_kg [mol/kg] * density [g/cm³] * CM3_PER_MOL_STP [cm³/mol] / 1000
    return mol_kg * density_g_cm3 * CM3_PER_MOL_STP / 1000.0


def _get_registry():
    """懒加载 ModelRegistry（worker 进程首次调用时初始化）。"""
    from app.core.model_registry import ModelRegistry
    registry = ModelRegistry.get()
    if not registry._models:
        settings = get_settings()
        registry.initialize(settings)
    return registry


# ── 单点推理任务 ──────────────────────────────────────────────────────────────
@celery_app.task(bind=True, name="inference.predict_single")
def predict_single(
    self,
    cif_text: str,
    gas: str,
    temperature_K: float,
    pressure_bar: float,
    structure_features: List[float],   # 7-dim
    pv_cm3g: Optional[float],
    density: float,
) -> dict:
    from app.utils.cif_parser import parse_cif

    t0 = time.perf_counter()
    try:
        self.update_state(state="STARTED", meta={"progress": 10})
        atoms, coords = parse_cif(cif_text)
        self.update_state(state="STARTED", meta={"progress": 30})

        sf = np.array(structure_features, dtype=np.float32)
        registry = _get_registry()
        handle   = registry.route(pressure_bar)
        self.update_state(state="STARTED", meta={"progress": 60})

        uptake_mol_kg = handle.infer(
            atoms=atoms, coords=coords, structure_features=sf,
            gas_name=gas, temperature_K=temperature_K,
            pressure_bar=pressure_bar, pv_cm3g=pv_cm3g,
        )
        uptake_cm3_cm3 = _mol_kg_to_cm3_cm3(uptake_mol_kg, density)
        elapsed_ms = (time.perf_counter() - t0) * 1000

        model_key = "1bar_lora" if pressure_bar <= registry._threshold else "tobacco_v2"
        task_name = "S1_CH4_1bar_fixed" if pressure_bar <= registry._threshold else "Tobacco_CH4"
        return {
            "type": "single",
            "uptake_mol_kg":  round(uptake_mol_kg,  4),
            "uptake_cm3_cm3": round(uptake_cm3_cm3, 4),
            "pressure_bar":   pressure_bar,
            "temperature_K":  temperature_K,
            "gas":            gas,
            "model_used":     model_key,
            "elapsed_ms":     round(elapsed_ms, 2),
            "n_atoms":        len(atoms),
        }
    except Exception as exc:
        logger.exception("predict_single failed")
        self.update_state(state="FAILURE", meta={"error": str(exc)})
        raise


# ── 等温线推理任务 ─────────────────────────────────────────────────────────────
@celery_app.task(bind=True, name="inference.predict_isotherm")
def predict_isotherm(
    self,
    cif_text: str,
    gas: str,
    temperature_K: float,
    pressure_points_bar: List[float],
    structure_features: List[float],
    pv_cm3g: Optional[float],
    density: float,
) -> dict:
    from app.utils.cif_parser import parse_cif

    t0 = time.perf_counter()
    try:
        self.update_state(state="STARTED", meta={"progress": 10})
        atoms, coords = parse_cif(cif_text)
        sf = np.array(structure_features, dtype=np.float32)
        registry = _get_registry()

        # 按压力阈值分组
        threshold = registry._threshold
        low_p  = [p for p in pressure_points_bar if p <= threshold]
        high_p = [p for p in pressure_points_bar if p >  threshold]

        results_map: dict = {}

        self.update_state(state="STARTED", meta={"progress": 30})
        if low_p:
            handle = registry.get_model("1bar")
            vals = handle.infer_batch(atoms, coords, sf, gas, temperature_K, low_p, pv_cm3g)
            for p, v in zip(low_p, vals):
                results_map[p] = ("1bar_lora", v)

        self.update_state(state="STARTED", meta={"progress": 60})
        if high_p:
            handle = registry.get_model("highp")
            vals = handle.infer_batch(atoms, coords, sf, gas, temperature_K, high_p, pv_cm3g)
            for p, v in zip(high_p, vals):
                results_map[p] = ("tobacco_v2", v)

        isotherm = []
        for p in pressure_points_bar:
            model_used, mol_kg = results_map[p]
            cm3 = _mol_kg_to_cm3_cm3(mol_kg, density)
            isotherm.append({
                "pressure_bar":   p,
                "uptake_mol_kg":  round(mol_kg, 4),
                "uptake_cm3_cm3": round(cm3, 4),
                "model_used":     model_used,
            })

        elapsed_ms = (time.perf_counter() - t0) * 1000
        return {
            "type":        "isotherm",
            "isotherm":    isotherm,
            "gas":         gas,
            "temperature_K": temperature_K,
            "elapsed_ms":  round(elapsed_ms, 2),
            "n_atoms":     len(atoms),
        }
    except Exception as exc:
        logger.exception("predict_isotherm failed")
        self.update_state(state="FAILURE", meta={"error": str(exc)})
        raise
