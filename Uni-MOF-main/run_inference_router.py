#!/usr/bin/env python3
"""
run_inference_router.py

压力路由推理脚本：
  - 压力 <= 2 bar → UniMOF1barModel (S1_1bar_lora/checkpoint_best.pt)
  - 压力 > 2 bar  → UniMOF v2 Model  (Tobacco_CH4_v2/checkpoint_best.pt)

用法:
  python run_inference_router.py \
      --lmdb-dir ./lmdb_s1_fixed/S1_CH4_1bar_fixed \
      --split test \
      --output predictions.csv

CSV 输出字段:
  sample_id, p_physical_bar, model_used, predicted_mol_kg, target_mol_kg
"""

import argparse
import os
import sys
import math
import numpy as np
import pandas as pd
import torch
import pickle

# ── 归一化参数（与 regloss.py 一致）
ATTR_REGISTRY = {
    'S1_CH4_1bar_fixed': (2.9061722919, 0.8324204314, 'log1p_standardization'),
    'Tobacco_CH4_v2':    (4.3757066134, 1.0909639617, 'log1p_standardization'),
    'Tobacco_CH4':       (4.3757066134, 1.0909639617, 'log1p_standardization'),
}

MIN_MAX_KEY = {
    'S1_CH4_1bar_fixed': {'pressure': [-0.1, 0.1],  'temperature': [290, 310]},
    'Tobacco_CH4_v2':    {'pressure': [0, 150],      'temperature': [198, 402]},
}

PRESSURE_THRESHOLD_BAR = 2.0


def denormalize(logit, task_name):
    mean, std, norm_type = ATTR_REGISTRY[task_name]
    val = float(logit) * std + mean
    if norm_type == 'log1p_standardization':
        return math.expm1(val)
    return val


def _load_1bar_model(ckpt_path, device, user_dir, task_name):
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import unicore.utils as _u
    _u.import_user_module(argparse.Namespace(user_dir=user_dir))
    from unicore import checkpoint_utils
    from unicore.data import Dictionary
    from unimof.models.unimof_1bar import UniMOF1barModel

    state = checkpoint_utils.load_checkpoint_to_cpu(ckpt_path)
    saved_args = state['args']
    saved_args.task_name = task_name

    base_dir = os.path.dirname(os.path.abspath(__file__))
    dict_path = os.path.join(base_dir, 'lmdb_s1_fixed', 'dict.txt')
    if not os.path.exists(dict_path):
        dict_path = os.path.join(base_dir, 'examples', 'mof', 'dict.txt')
    dictionary = Dictionary.load(dict_path)

    # 对齐 vocab 大小（backbone 预训练用的 dict 可能比当前多 1 个 token）
    ckpt_vocab = state['model']['unimat.embed_tokens.weight'].shape[0]
    while len(dictionary) < ckpt_vocab:
        dictionary.add_symbol(f'[EXTRA_{len(dictionary)}]')

    model = UniMOF1barModel(saved_args, dictionary)
    model.load_state_dict(state['model'], strict=False)
    model.to(device)
    model.eval()
    print(f"[Router] 1bar model loaded from {ckpt_path}")
    return model


def _load_v2_model(ckpt_path, device, user_dir, task_name):
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import unicore.utils as _u
    _u.import_user_module(argparse.Namespace(user_dir=user_dir))
    from unicore import checkpoint_utils
    from unicore.data import Dictionary
    from unimof.models.unimof_v2 import UniMOFModel

    state = checkpoint_utils.load_checkpoint_to_cpu(ckpt_path)
    saved_args = state['args']
    saved_args.task_name = task_name

    base_dir = os.path.dirname(os.path.abspath(__file__))
    dict_path = os.path.join(base_dir, 'lmdb_s1_fixed', 'dict.txt')
    if not os.path.exists(dict_path):
        dict_path = os.path.join(base_dir, 'examples', 'mof', 'dict.txt')
    dictionary = Dictionary.load(dict_path)

    # 对齐 vocab 大小
    ckpt_vocab = state['model']['unimat.embed_tokens.weight'].shape[0]
    while len(dictionary) < ckpt_vocab:
        dictionary.add_symbol(f'[EXTRA_{len(dictionary)}]')

    model = UniMOFModel(saved_args, dictionary)
    model.load_state_dict(state['model'], strict=False)
    model.to(device)
    model.eval()
    print(f"[Router] v2 model loaded from {ckpt_path}")
    return model


@torch.no_grad()
def _run_1bar(model, sample, device):
    sf = np.array(sample['structure_features'], dtype=np.float32)
    pv = float(sample.get('pv_cm3g', 0.0))
    sf_ext = np.concatenate([sf, [pv]])

    def t(arr, dtype=torch.float32):
        return torch.tensor(np.array(arr), dtype=dtype).unsqueeze(0).to(device)

    out = model(
        gas=t(sample['gas'], torch.long),
        gas_attr=t(sample['gas_attr']),
        pressure=torch.tensor([[float(np.array(sample['pressure']).ravel()[0])]], dtype=torch.float32).to(device),
        temperature=torch.tensor([[float(np.array(sample['temperature']).ravel()[0])]], dtype=torch.float32).to(device),
        src_tokens=t(sample['src_tokens'], torch.long),
        src_distance=t(sample['src_distance']),
        src_coord=t(sample['src_coord']),
        src_edge_type=t(sample['src_edge_type'], torch.long),
        structure_features=t(sf),
        structure_features_ext=t(sf_ext),
    )
    return float(out[0].squeeze().cpu().float())


@torch.no_grad()
def _run_v2(model, sample, device):
    def t(arr, dtype=torch.float32):
        return torch.tensor(np.array(arr), dtype=dtype).unsqueeze(0).to(device)

    out = model(
        gas=t(sample['gas'], torch.long),
        gas_attr=t(sample['gas_attr']),
        pressure=torch.tensor([[float(np.array(sample['pressure']).ravel()[0])]], dtype=torch.float32).to(device),
        temperature=torch.tensor([[float(np.array(sample['temperature']).ravel()[0])]], dtype=torch.float32).to(device),
        src_tokens=t(sample['src_tokens'], torch.long),
        src_distance=t(sample['src_distance']),
        src_coord=t(sample['src_coord']),
        src_edge_type=t(sample['src_edge_type'], torch.long),
        structure_features=t(np.array(sample['structure_features'], dtype=np.float32)),
    )
    return float(out[0].squeeze().cpu().float())


def main():
    parser = argparse.ArgumentParser(description='UniMOF 压力路由推理')
    parser.add_argument('--lmdb-dir', required=True,
                        help='lmdb 数据目录（包含 split.lmdb）')
    parser.add_argument('--split', default='test',
                        choices=['train', 'valid', 'test'])
    parser.add_argument('--ckpt-1bar',
                        default='./results/S1_1bar_lora/checkpoint_best.pt')
    parser.add_argument('--ckpt-v2',
                        default='./results/Tobacco_CH4_v2/checkpoint_best.pt')
    parser.add_argument('--task-name-1bar', default='S1_CH4_1bar_fixed')
    parser.add_argument('--task-name-v2',   default='Tobacco_CH4_v2')
    parser.add_argument('--output', default='predictions.csv')
    # 自动选择最优设备：CUDA > MPS (Apple Silicon) > CPU
    if torch.cuda.is_available():
        _default_device = 'cuda'
    elif torch.backends.mps.is_available():
        _default_device = 'mps'
    else:
        _default_device = 'cpu'
    parser.add_argument('--device', default=_default_device)
    parser.add_argument('--user-dir', default='./unimof')
    parser.add_argument('--pressure-threshold', type=float, default=PRESSURE_THRESHOLD_BAR,
                        help='低压/高压分界（bar）')
    args = parser.parse_args()

    print(f"[Router] 压力阈值 = {args.pressure_threshold} bar")
    device = torch.device(args.device)

    import lmdb
    lmdb_path = os.path.join(args.lmdb_dir, f'{args.split}.lmdb')
    env = lmdb.open(lmdb_path, subdir=False, readonly=True, lock=False, readahead=False)
    with env.begin() as txn:
        keys = [k for k, _ in txn.cursor().iternext(keys=True, values=False)]
    n = len(keys)
    print(f"[Router] 共 {n} 条样本，设备={args.device}")

    model_1bar = None
    model_v2 = None
    results = []

    for i, key in enumerate(keys):
        with env.begin() as txn:
            sample = pickle.loads(txn.get(key))

        # 用 v2 归一化范围反算物理压力用于路由
        p_norm = float(np.array(sample['pressure']).ravel()[0])
        lo, hi = MIN_MAX_KEY['Tobacco_CH4_v2']['pressure']
        p_physical = p_norm * (hi - lo) + lo

        use_1bar = p_physical <= args.pressure_threshold

        if use_1bar:
            if model_1bar is None:
                model_1bar = _load_1bar_model(
                    args.ckpt_1bar, device, args.user_dir, args.task_name_1bar)
            logit = _run_1bar(model_1bar, sample, device)
            task_name = args.task_name_1bar
            model_used = '1bar_lora'
        else:
            if model_v2 is None:
                model_v2 = _load_v2_model(
                    args.ckpt_v2, device, args.user_dir, args.task_name_v2)
            logit = _run_v2(model_v2, sample, device)
            task_name = args.task_name_v2
            model_used = 'v2_tobacco'

        pred = denormalize(logit, task_name)
        raw_tgt = sample.get('target', None)
        if raw_tgt is not None:
            tgt = float(np.array(raw_tgt).ravel()[0])
        else:
            tgt = float('nan')

        results.append({
            'sample_id': key.decode() if isinstance(key, bytes) else str(key),
            'p_physical_bar': round(p_physical, 4),
            'model_used': model_used,
            'predicted_mol_kg': round(pred, 6),
            'target_mol_kg': round(tgt, 6) if not math.isnan(tgt) else None,
        })

        if (i + 1) % 10 == 0 or (i + 1) == n:
            print(f"  [{i+1}/{n}] p={p_physical:.2f}bar  model={model_used}  "
                  f"pred={pred:.4f}  target={tgt:.4f}")

    df = pd.DataFrame(results)
    df.to_csv(args.output, index=False)
    print(f"\n[Router] 结果已保存: {args.output}")

    valid = df['target_mol_kg'].notna()
    if valid.sum() > 0:
        try:
            from sklearn.metrics import r2_score
            r2 = r2_score(df.loc[valid, 'target_mol_kg'],
                           df.loc[valid, 'predicted_mol_kg'])
            print(f"[Router] Overall R2 = {r2:.4f}  (n={valid.sum()})")
            for mn in df['model_used'].unique():
                m = valid & (df['model_used'] == mn)
                if m.sum() > 1:
                    r2m = r2_score(df.loc[m, 'target_mol_kg'],
                                    df.loc[m, 'predicted_mol_kg'])
                    print(f"  [{mn}] R2 = {r2m:.4f}  (n={m.sum()})")
        except ImportError:
            print("[Router] sklearn 未安装，跳过 R2 计算")


if __name__ == '__main__':
    main()
