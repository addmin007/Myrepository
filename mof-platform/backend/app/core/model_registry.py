"""
backend/app/core/model_registry.py

进程级单例：在 FastAPI worker 启动时初始化模型，避免每次请求重复加载。
支持压力路由：≤ threshold → 1bar_lora；> threshold → Tobacco v2
"""
from __future__ import annotations

import logging
import math
import os
import sys
from typing import Dict, List, Optional, Tuple

import numpy as np
import torch

logger = logging.getLogger(__name__)

# ── 归一化参数（与 regloss.py 一致）─────────────────────────────────────────
NORM_PARAMS: Dict[str, Tuple[float, float]] = {
    "S1_CH4_1bar_fixed": (2.9061722919, 0.8324204314),
    "Tobacco_CH4_v2":    (4.3757066134, 1.0909639617),
    "Tobacco_CH4":       (4.3757066134, 1.0909639617),   # v2 模型实际用此键
}

# ── 气体特征 ──────────────────────────────────────────────────────────────────
_GAS_FEATURES_RAW = {
    "CH4": np.array([190.56, 45.99, 0.011, 16.043], dtype=np.float32),
    "CO2": np.array([304.13, 73.77, 0.224, 44.010], dtype=np.float32),
    "N2":  np.array([126.19, 33.96, 0.037, 28.014], dtype=np.float32),
    "H2":  np.array([ 33.19, 13.13,-0.216,  2.016], dtype=np.float32),
}
_GAS_ATTR_MEAN = np.array([205.08, 52.40,  0.043, 53.585], dtype=np.float32)
_GAS_ATTR_STD  = np.array([ 64.36,  9.95,  0.085, 37.636], dtype=np.float32)
GAS_FEATURES   = {k: (v - _GAS_ATTR_MEAN) / _GAS_ATTR_STD for k, v in _GAS_FEATURES_RAW.items()}
GAS_NAME_TO_ID = {"CH4": 1, "CO2": 2, "Ar": 3, "Kr": 4, "Xe": 5, "O2": 6, "N2": 7}


def _resolve_device(device_str: str) -> torch.device:
    if device_str == "auto":
        if torch.cuda.is_available():
            return torch.device("cuda")
        if torch.backends.mps.is_available():
            return torch.device("mps")
        return torch.device("cpu")
    return torch.device(device_str)


def _denorm(z: float, task_name: str) -> float:
    mean, std = NORM_PARAMS[task_name]
    return math.expm1(z * std + mean)


class _ModelHandle:
    """封装单个 checkpoint 的加载与单样本推理。"""

    def __init__(self, ckpt_path: str, task_name: str, dict_path: str,
                 unimof_dir: str, device: torch.device, max_atoms: int):
        self.task_name  = task_name
        self.device     = device
        self.max_atoms  = max_atoms
        self._load(ckpt_path, dict_path, unimof_dir)

    def _load(self, ckpt_path: str, dict_path: str, unimof_dir: str):
        # 注册 unimof 模块路径
        parent = os.path.dirname(unimof_dir)
        if parent not in sys.path:
            sys.path.insert(0, parent)
        import unimof.models, unimof.tasks, unimof.losses  # noqa: registers models

        from unicore import checkpoint_utils
        from unicore.data import Dictionary

        state = checkpoint_utils.load_checkpoint_to_cpu(ckpt_path)
        self.saved_args = state["args"]
        self.saved_args.task_name = self.task_name

        dictionary = Dictionary.load(dict_path)

        # vocab 大小对齐（backbone 预训练 dict 可能多 1 个 token）
        ckpt_vocab = state["model"]["unimat.embed_tokens.weight"].shape[0]
        while len(dictionary) < ckpt_vocab:
            dictionary.add_symbol(f"[EXTRA_{len(dictionary)}]")
        self.dictionary = dictionary

        # 按 arch 构建模型
        arch = getattr(self.saved_args, "arch", "unimof_v2")
        if arch == "unimof_1bar":
            from unimof.models.unimof_1bar import UniMOF1barModel
            model = UniMOF1barModel(self.saved_args, dictionary)
        else:
            from unimof.models.unimof_v2 import UniMOFV2Model
            model = UniMOFV2Model(self.saved_args, dictionary)

        model.load_state_dict(state["model"], strict=False)
        model.to(self.device).eval()
        self.model = model

        n_params = sum(p.numel() for p in model.parameters())
        logger.info(f"[ModelHandle] {self.task_name} loaded | arch={arch} "
                    f"| device={self.device} | params={n_params:,}")

    def _struct_to_tensors(self, atoms: List[str], coords: np.ndarray):
        """原子列表 + 坐标 → (src_tokens, src_distance, src_coord, src_edge_type)"""
        # 去氢
        non_h = [i for i, a in enumerate(atoms) if a != "H"] or list(range(len(atoms)))
        atoms  = [atoms[i]  for i in non_h]
        coords = coords[non_h]

        if len(atoms) > self.max_atoms:
            atoms  = atoms[:self.max_atoms]
            coords = coords[:self.max_atoms]

        d = self.dictionary
        bos, eos, unk = d.bos(), d.eos(), d.unk()
        tids = [bos] + [d.index(a) if a in d else unk for a in atoms] + [eos]
        L, N = len(tids), len(atoms)

        src_tokens = torch.tensor(tids, dtype=torch.long).unsqueeze(0)

        ct = torch.zeros(L, 3, dtype=torch.float32)
        ct[1:N+1] = torch.from_numpy(coords.astype(np.float32))
        src_coord = ct.unsqueeze(0)

        inner = torch.from_numpy(coords.astype(np.float32))
        dist  = (inner.unsqueeze(0) - inner.unsqueeze(1)).norm(dim=-1)
        pd    = torch.zeros(L, L, dtype=torch.float32)
        pd[1:N+1, 1:N+1] = dist
        src_distance = pd.unsqueeze(0)

        tids_t        = torch.tensor(tids, dtype=torch.long)
        src_edge_type = (tids_t.unsqueeze(0) * len(d) + tids_t.unsqueeze(1)).unsqueeze(0)

        return src_tokens, src_distance, src_coord, src_edge_type

    @torch.no_grad()
    def infer(
        self,
        atoms: List[str],
        coords: np.ndarray,
        structure_features: np.ndarray,    # 7-dim
        gas_name: str,
        temperature_K: float,
        pressure_bar: float,
        pv_cm3g: Optional[float] = None,   # 1bar 模型专用
    ) -> float:
        src_tokens, src_distance, src_coord, src_edge_type = self._struct_to_tensors(atoms, coords)

        gas      = torch.tensor([GAS_NAME_TO_ID[gas_name]], dtype=torch.long)
        gas_attr = torch.tensor(GAS_FEATURES[gas_name], dtype=torch.float32).unsqueeze(0)
        # pressure / temperature 必须是 1D [B] tensor，不能 squeeze 成标量
        temperature = torch.tensor([temperature_K], dtype=torch.float32)          # shape [1]
        pressure    = torch.tensor([float(np.log10(max(pressure_bar, 1e-6)))],
                                   dtype=torch.float32)                            # shape [1]
        sf = torch.tensor(structure_features, dtype=torch.float32).unsqueeze(0)

        def td(t): return t.to(self.device)

        arch = getattr(self.saved_args, "arch", "unimof_v2")
        if arch == "unimof_1bar":
            pv = float(pv_cm3g) if pv_cm3g is not None else 0.0
            sf_ext = np.append(structure_features, pv).astype(np.float32)
            out = self.model(
                gas=td(gas), gas_attr=td(gas_attr),
                pressure=td(pressure), temperature=td(temperature),
                src_tokens=td(src_tokens), src_distance=td(src_distance),
                src_coord=td(src_coord), src_edge_type=td(src_edge_type),
                structure_features=td(sf),
                structure_features_ext=td(torch.tensor(sf_ext).unsqueeze(0)),
            )
        else:
            out = self.model(
                gas=td(gas), gas_attr=td(gas_attr),
                pressure=td(pressure), temperature=td(temperature),
                src_tokens=td(src_tokens), src_distance=td(src_distance),
                src_coord=td(src_coord), src_edge_type=td(src_edge_type),
                structure_features=td(sf),
            )

        logit = float(out[0].squeeze().cpu().float())
        return _denorm(logit, self.task_name)

    @torch.no_grad()
    def infer_batch(
        self,
        atoms: List[str],
        coords: np.ndarray,
        structure_features: np.ndarray,
        gas_name: str,
        temperature_K: float,
        pressure_points_bar: List[float],
        pv_cm3g: Optional[float] = None,
    ) -> List[float]:
        """批量推理（同一 MOF，多压力点）。"""
        src_tokens, src_distance, src_coord, src_edge_type = self._struct_to_tensors(atoms, coords)
        B = len(pressure_points_bar)

        src_tokens    = src_tokens.expand(B, -1)
        src_distance  = src_distance.expand(B, -1, -1)
        src_coord     = src_coord.expand(B, -1, -1)
        src_edge_type = src_edge_type.expand(B, -1, -1)

        gas      = torch.tensor([GAS_NAME_TO_ID[gas_name]] * B, dtype=torch.long)
        gas_attr = torch.tensor(GAS_FEATURES[gas_name], dtype=torch.float32).unsqueeze(0).expand(B, -1)
        temperature = torch.full((B,), temperature_K, dtype=torch.float32)
        pressure    = torch.tensor([np.log10(max(p, 1e-6)) for p in pressure_points_bar], dtype=torch.float32)
        sf = torch.tensor(structure_features, dtype=torch.float32).unsqueeze(0).expand(B, -1)

        def td(t): return t.to(self.device)

        arch = getattr(self.saved_args, "arch", "unimof_v2")
        if arch == "unimof_1bar":
            pv = float(pv_cm3g) if pv_cm3g is not None else 0.0
            sf_ext = np.append(structure_features, pv).astype(np.float32)
            sf_ext_t = torch.tensor(sf_ext).unsqueeze(0).expand(B, -1)
            out = self.model(
                gas=td(gas), gas_attr=td(gas_attr),
                pressure=td(pressure), temperature=td(temperature),
                src_tokens=td(src_tokens), src_distance=td(src_distance),
                src_coord=td(src_coord), src_edge_type=td(src_edge_type),
                structure_features=td(sf),
                structure_features_ext=td(sf_ext_t),
            )
        else:
            out = self.model(
                gas=td(gas), gas_attr=td(gas_attr),
                pressure=td(pressure), temperature=td(temperature),
                src_tokens=td(src_tokens), src_distance=td(src_distance),
                src_coord=td(src_coord), src_edge_type=td(src_edge_type),
                structure_features=td(sf),
            )

        logits = out[0].squeeze(-1).cpu().float().tolist()
        return [_denorm(z, self.task_name) for z in logits]


class ModelRegistry:
    """进程级单例，持有全部已加载模型。"""
    _instance: Optional["ModelRegistry"] = None

    def __init__(self):
        self._models: Dict[str, _ModelHandle] = {}
        self._threshold: float = 2.0
        self._device: torch.device = torch.device("cpu")

    @classmethod
    def get(cls) -> "ModelRegistry":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def initialize(self, settings) -> None:
        """在 FastAPI lifespan 里调用一次。"""
        self._threshold = settings.PRESSURE_THRESHOLD_BAR
        self._device    = _resolve_device(settings.DEVICE)

        self._models["1bar"] = _ModelHandle(
            ckpt_path=settings.CKPT_1BAR,
            task_name="S1_CH4_1bar_fixed",
            dict_path=settings.DICT_PATH,
            unimof_dir=settings.UNIMOF_DIR,
            device=self._device,
            max_atoms=settings.MAX_ATOMS,
        )
        self._models["highp"] = _ModelHandle(
            ckpt_path=settings.CKPT_HIGHP,
            task_name="Tobacco_CH4",       # MIN_MAX_KEY 里的实际键名
            dict_path=settings.DICT_PATH,
            unimof_dir=settings.UNIMOF_DIR,
            device=self._device,
            max_atoms=settings.MAX_ATOMS,
        )
        logger.info("ModelRegistry initialized with 2 models (1bar + highp)")

    def route(self, pressure_bar: float) -> _ModelHandle:
        """根据压力选择模型。"""
        key = "1bar" if pressure_bar <= self._threshold else "highp"
        return self._models[key]

    def get_model(self, key: str) -> _ModelHandle:
        return self._models[key]
