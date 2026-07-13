"""
mof_predictor.py  ──  模型加载 + 单样本/批量推理核心逻辑

不依赖 unicore CLI，直接加载 checkpoint 做推理。
支持 FP16 加速（V100 / A100 推荐开启）。
"""

import os
import re
import sys
import pickle
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional

import numpy as np
import torch
import torch.nn as nn

logger = logging.getLogger(__name__)

# ── 归一化常数（Tobacco_CH4）────────────────────────────────────────────────
_NORM = {
    "Tobacco_CH4": {"mean": 4.3757066134, "std": 1.0909639617, "type": "log1p_std"},
}

# ── 气体特征表 ────────────────────────────────────────────────────────────────
_GAS_FEATURES_RAW = {
    "CH4": np.array([190.56, 45.99, 0.011, 16.043], dtype=np.float32),
    "CO2": np.array([304.13, 73.77, 0.224, 44.01],  dtype=np.float32),
    "N2":  np.array([126.19, 33.96, 0.037, 28.014], dtype=np.float32),
    "H2":  np.array([ 33.19, 13.13,-0.216,  2.016], dtype=np.float32),
}
_GAS_ATTR_MEAN = np.array([205.08, 52.40,  0.043, 53.585], dtype=np.float32)
_GAS_ATTR_STD  = np.array([ 64.36,  9.95,  0.085, 37.636], dtype=np.float32)
GAS_FEATURES = {k: (v - _GAS_ATTR_MEAN) / _GAS_ATTR_STD
                for k, v in _GAS_FEATURES_RAW.items()}
GAS_NAME_TO_ID = {"CH4": 1, "CO2": 2, "Ar": 3, "Kr": 4, "Xe": 5, "O2": 6, "N2": 7}


def _inverse_norm(z: torch.Tensor, task_name: str) -> torch.Tensor:
    """将模型输出（归一化空间）还原为原始吸附量 cm³/cm³。"""
    cfg = _NORM[task_name]
    if cfg["type"] == "log1p_std":
        return torch.expm1(z * cfg["std"] + cfg["mean"])
    return z * cfg["std"] + cfg["mean"]


class MofPredictor:
    """
    封装完整推理流程：
      1. 加载 checkpoint（FP16 可选）
      2. CIF 结构 → atom tokens + distance matrix
      3. 条件特征编码（气体、温度、压力、MOF 结构特征）
      4. 模型 forward → 反归一化 → 返回 cm³/cm³
    """

    def __init__(
        self,
        ckpt_path: str,
        user_dir: str,           # /path/to/Uni-MOF-main/unimof
        dict_path: str,          # /path/to/lmdb_output_v2/dict.txt
        task_name: str = "Tobacco_CH4",
        device: str = "cuda",
        fp16: bool = True,
        max_atoms: int = 512,
    ):
        self.task_name = task_name
        self.device = torch.device(device if torch.cuda.is_available() else "cpu")
        self.fp16 = fp16 and self.device.type == "cuda"
        self.max_atoms = max_atoms

        # ── 注册 unimof 模块 ──────────────────────────────────────────────
        sys.path.insert(0, str(Path(user_dir).parent))
        import argparse
        from unicore.utils import import_user_module
        import_user_module(argparse.Namespace(user_dir=user_dir))

        # ── 加载字典 ──────────────────────────────────────────────────────
        from unicore.data import Dictionary
        self.dictionary = Dictionary.load(dict_path)

        # ── 构建模型 ──────────────────────────────────────────────────────
        model = self._build_model(user_dir, dict_path, task_name)

        # ── 加载权重 ──────────────────────────────────────────────────────
        from unicore import checkpoint_utils
        state = checkpoint_utils.load_checkpoint_to_cpu(ckpt_path)
        missing, unexpected = model.load_state_dict(state["model"], strict=False)
        if missing:
            logger.warning(f"Missing keys: {missing[:3]}")

        # ── FP16 + 推理模式 ───────────────────────────────────────────────
        if self.fp16:
            model = model.half()
        model.to(self.device).eval()

        # ── TorchScript 编译（可选，约提速 10-20%）───────────────────────
        # self.model = torch.jit.script(model)  # 若有动态控制流可能失败
        self.model = model

        n_params = sum(p.numel() for p in model.parameters())
        logger.info(
            f"MofPredictor ready | device={self.device} | fp16={self.fp16} "
            f"| params={n_params:,} | task={task_name}"
        )

    # ── 内部：构建模型 namespace ──────────────────────────────────────────
    def _build_model(self, user_dir, dict_path, task_name):
        import argparse as _ap
        from unicore import tasks as _tasks

        data_root = str(Path(dict_path).parent)
        ns = _ap.Namespace(
            task="unimof_v2", task_name=task_name,
            num_classes=1, gas_attr_input_dim=4, mono_loss_weight=0.1,
            remove_hydrogen=True, dict_name="dict.txt", max_atoms=self.max_atoms,
            classification_head_name="classification", finetune_mol_model=None,
            arch="unimof_v2",
            encoder_layers=8, encoder_embed_dim=512, encoder_ffn_embed_dim=2048,
            encoder_attention_heads=64, emb_dropout=0.0, dropout=0.0,
            attention_dropout=0.0, activation_dropout=0.0, pooler_dropout=0.0,
            max_seq_len=1024, activation_fn="gelu", pooler_activation_fn="tanh",
            post_ln=False, gas_dim=128, env_dim=128, hidden_dim=128,
            bins=32, structure_feature_dim=7, mc_dropout_samples=0,
            data=data_root, seed=42, loss="mof_v2_mse",
            user_dir=user_dir,
        )
        task = _tasks.setup_task(ns)
        return task.build_model(ns)

    # ── 内部：原子序列 → tensors ──────────────────────────────────────────
    def _struct_to_tensors(self, atoms: List[str], coords: np.ndarray):
        """去氢 → tokenize → 距离矩阵 → edge_type。"""
        non_h = [i for i, a in enumerate(atoms) if a != "H"] or list(range(len(atoms)))
        atoms  = [atoms[i] for i in non_h]
        coords = coords[non_h]

        # 截断超长序列
        if len(atoms) > self.max_atoms:
            logger.warning(f"Truncating {len(atoms)} atoms → {self.max_atoms}")
            atoms  = atoms[:self.max_atoms]
            coords = coords[:self.max_atoms]

        N   = len(atoms)
        d   = self.dictionary
        bos, eos, unk = d.bos(), d.eos(), d.unk()
        tids = [bos] + [d.index(a) if a in d else unk for a in atoms] + [eos]
        L = len(tids)

        src_tokens = torch.tensor(tids, dtype=torch.long).unsqueeze(0)

        ct = torch.zeros(L, 3, dtype=torch.float32)
        ct[1:N+1] = torch.from_numpy(coords.astype(np.float32))
        src_coord = ct.unsqueeze(0)

        inner = torch.from_numpy(coords.astype(np.float32))
        dist  = (inner.unsqueeze(0) - inner.unsqueeze(1)).norm(dim=-1)
        pd = torch.zeros(L, L, dtype=torch.float32)
        pd[1:N+1, 1:N+1] = dist
        src_distance = pd.unsqueeze(0)

        tids_t = torch.tensor(tids, dtype=torch.long)
        src_edge_type = (tids_t.unsqueeze(0) * len(d) + tids_t.unsqueeze(1)).unsqueeze(0)

        return src_tokens, src_distance, src_coord, src_edge_type

    # ── 公开接口：单条推理 ────────────────────────────────────────────────
    @torch.no_grad()
    def predict(
        self,
        atoms: List[str],
        coords: np.ndarray,
        structure_features: np.ndarray,   # [lcd, pld, lfpd, density, asa_m2cm3, asa_m2g, vf]
        gas_name: str,                    # "CH4", "CO2", etc.
        temperature_K: float,
        pressure_bar: float,
    ) -> float:
        """返回预测吸附量（cm³/cm³）。"""
        src_tokens, src_distance, src_coord, src_edge_type = self._struct_to_tensors(atoms, coords)

        gas      = torch.tensor([GAS_NAME_TO_ID[gas_name]], dtype=torch.long)
        gas_attr = torch.tensor(GAS_FEATURES[gas_name], dtype=torch.float32).unsqueeze(0)
        temperature = torch.tensor([temperature_K], dtype=torch.float32)
        pressure    = torch.tensor([float(np.log10(pressure_bar))], dtype=torch.float32)
        sf = torch.tensor(structure_features, dtype=torch.float32).unsqueeze(0)

        # 统一移到设备 + fp16
        def to_dev(t, dtype=None):
            t = t.to(self.device)
            if dtype:
                t = t.to(dtype)
            return t

        fp = torch.float16 if self.fp16 else torch.float32

        out = self.model(
            gas=to_dev(gas),
            gas_attr=to_dev(gas_attr, fp),
            pressure=to_dev(pressure, fp),
            temperature=to_dev(temperature, fp),
            src_tokens=to_dev(src_tokens),
            src_distance=to_dev(src_distance, fp),
            src_coord=to_dev(src_coord, fp),
            src_edge_type=to_dev(src_edge_type),
            structure_features=to_dev(sf, fp),
        )
        logit = out[0].float()
        result = _inverse_norm(logit, self.task_name)
        return float(result.squeeze())

    # ── 公开接口：批量推理（同一 MOF，多压力点）──────────────────────────
    @torch.no_grad()
    def predict_isotherm(
        self,
        atoms: List[str],
        coords: np.ndarray,
        structure_features: np.ndarray,
        gas_name: str,
        temperature_K: float,
        pressure_points_bar: List[float],
    ) -> List[float]:
        """给定多个压力点，一次性返回完整等温线预测（批量 forward）。"""
        src_tokens, src_distance, src_coord, src_edge_type = self._struct_to_tensors(atoms, coords)
        B = len(pressure_points_bar)

        # 扩展结构 tensors 到 batch
        src_tokens    = src_tokens.expand(B, -1)
        src_distance  = src_distance.expand(B, -1, -1)
        src_coord     = src_coord.expand(B, -1, -1)
        src_edge_type = src_edge_type.expand(B, -1, -1)

        gas      = torch.tensor([GAS_NAME_TO_ID[gas_name]] * B, dtype=torch.long)
        gas_attr = torch.tensor(GAS_FEATURES[gas_name], dtype=torch.float32).unsqueeze(0).expand(B, -1)
        temperature = torch.full((B,), temperature_K, dtype=torch.float32)
        pressure    = torch.tensor([np.log10(p) for p in pressure_points_bar], dtype=torch.float32)
        sf = torch.tensor(structure_features, dtype=torch.float32).unsqueeze(0).expand(B, -1)

        fp = torch.float16 if self.fp16 else torch.float32

        def to_dev(t, dtype=None):
            t = t.to(self.device)
            return t.to(dtype) if dtype else t

        out = self.model(
            gas=to_dev(gas),
            gas_attr=to_dev(gas_attr, fp),
            pressure=to_dev(pressure, fp),
            temperature=to_dev(temperature, fp),
            src_tokens=to_dev(src_tokens),
            src_distance=to_dev(src_distance, fp),
            src_coord=to_dev(src_coord, fp),
            src_edge_type=to_dev(src_edge_type),
            structure_features=to_dev(sf, fp),
        )
        logits = out[0].float()
        results = _inverse_norm(logits, self.task_name)
        return results.squeeze(-1).tolist()
