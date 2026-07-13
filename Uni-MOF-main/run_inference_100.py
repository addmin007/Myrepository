#!/usr/bin/env python3
"""
对 test split 中随机抽取的 100 个未见 MOF 做推理，输出预测值 vs 真实值。
用法：
    /home/vipuser/miniconda3/bin/python /root/Uni-MOF-main/run_inference_100.py \
        --ckpt /root/Uni-MOF-main/results/Tobacco_CH4_v2/checkpoint_best.pt \
        --data /root/Uni-MOF-main/lmdb_output_v2 \
        --task Tobacco_CH4 \
        --n-mofs 100 \
        --seed 42 \
        --output /root/inference_100_results.csv
"""
import argparse
import pickle
import random
import sys
import os
import csv

import lmdb
import numpy as np
import torch

# ── make sure unimof is importable ──────────────────────────────────────────
script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)

# import unicore after sys.path is set
from unicore import checkpoint_utils, tasks
from unicore.data import Dictionary


# ─────────────────────────────────────────────────────────────────────────────
def load_test_samples(data_root, task_name, n_mofs, seed):
    lmdb_path = os.path.join(data_root, task_name, "test.lmdb")
    env = lmdb.open(lmdb_path, subdir=False, readonly=True, lock=False, readahead=False)

    mof_to_samples = {}
    with env.begin() as txn:
        for k, v in txn.cursor():
            sample = pickle.loads(v)
            cif = sample["task_name"].split("#")[0]
            mof_to_samples.setdefault(cif, []).append(sample)

    all_mofs = sorted(mof_to_samples.keys())
    rng = random.Random(seed)
    chosen = rng.sample(all_mofs, min(n_mofs, len(all_mofs)))
    print(f"[INFO] Selected {len(chosen)} MOFs from test set ({len(all_mofs)} total unique MOFs)")

    selected = []
    for cif in chosen:
        samples = sorted(mof_to_samples[cif], key=lambda s: s["pressure"])
        selected.append((cif, samples))
    return selected


# ─────────────────────────────────────────────────────────────────────────────
def build_unicore_task(data_root, task_name):
    """最小化地初始化 unicore task 和 model，避免完整 CLI 解析。"""
    import argparse as _ap
    from unicore import tasks as _tasks

    # 手动构造一个 namespace，只填 unimof_v2 需要的字段
    ns = _ap.Namespace(
        # task
        task="unimof_v2",
        task_name=task_name,
        num_classes=1,
        gas_attr_input_dim=4,
        mono_loss_weight=0.1,
        remove_hydrogen=True,
        # arch / model
        arch="unimof_v2",
        encoder_layers=8,
        encoder_embed_dim=512,
        encoder_ffn_embed_dim=2048,
        encoder_attention_heads=64,
        emb_dropout=0.1,
        dropout=0.1,
        attention_dropout=0.1,
        activation_dropout=0.0,
        pooler_dropout=0.0,
        max_seq_len=1024,
        activation_fn="gelu",
        pooler_activation_fn="tanh",
        post_ln=False,
        bins=32,
        structure_feature_dim=7,
        gas_dim=128,
        env_dim=128,
        hidden_dim=128,
        mc_dropout_samples=0,
        # data
        data=data_root,
        # task args
        dict_name="dict.txt",
        max_atoms=512,
        classification_head_name="classification",
        finetune_mol_model=None,
        # misc (unicore expects these)
        seed=42,
        loss="mof_v2_mse",
        user_dir=os.path.join(script_dir, "unimof"),
    )
    # 注册 unimof 模块（任务、模型、损失）
    from unicore.utils import import_user_module
    import_user_module(ns)
    task = _tasks.setup_task(ns)
    model = task.build_model(ns)
    return task, model, ns


# ─────────────────────────────────────────────────────────────────────────────
def sample_to_tensors(sample, dictionary, device):
    """把单个 lmdb sample 转成模型 forward 所需的 tensors。"""
    atoms_raw = sample["atoms"]
    coords_raw = np.array(sample["coordinates"], dtype=np.float32)

    # 过滤氢
    non_h_idx = [i for i, a in enumerate(atoms_raw) if a != "H"]
    if not non_h_idx:
        non_h_idx = list(range(len(atoms_raw)))
    atoms  = [atoms_raw[i] for i in non_h_idx]
    coords = coords_raw[non_h_idx]          # (N, 3)

    # ── token ids，加 BOS / EOS ───────────────────────────────────────────
    bos, eos = dictionary.bos(), dictionary.eos()
    unk = dictionary.unk()
    token_ids = (
        [bos] +
        [dictionary.index(a) if a in dictionary else unk for a in atoms] +
        [eos]
    )
    L = len(token_ids)
    src_tokens = torch.tensor(token_ids, dtype=torch.long).unsqueeze(0).to(device)  # (1,L)

    # ── 坐标（含 BOS/EOS 的零行/列填充）────────────────────────────────────
    coords_t = torch.zeros(L, 3, dtype=torch.float32)
    coords_t[1:len(atoms)+1] = torch.from_numpy(coords)
    src_coord = coords_t.unsqueeze(0).to(device)  # (1,L,3)

    # ── 距离矩阵 ────────────────────────────────────────────────────────────
    inner = torch.from_numpy(coords)           # (N,3)
    diff  = inner.unsqueeze(0) - inner.unsqueeze(1)
    dist  = diff.norm(dim=-1)                  # (N,N)
    pad_dist = torch.zeros(L, L, dtype=torch.float32)
    pad_dist[1:len(atoms)+1, 1:len(atoms)+1] = dist
    src_distance = pad_dist.unsqueeze(0).to(device)  # (1,L,L)

    # ── edge type ───────────────────────────────────────────────────────────
    tids = torch.tensor(token_ids, dtype=torch.long)
    edge_type = tids.unsqueeze(0) * len(dictionary) + tids.unsqueeze(1)
    src_edge_type = edge_type.unsqueeze(0).to(device)  # (1,L,L)

    # ── gas / env / structure ───────────────────────────────────────────────
    gas_val  = int(np.array(sample["gas"]).flat[0])
    gas      = torch.tensor([gas_val], dtype=torch.long).to(device)           # (1,)
    gas_attr = torch.tensor(np.array(sample["gas_attr"], dtype=np.float32)).unsqueeze(0).to(device)   # (1,4)
    temperature = torch.tensor([float(sample["temperature"])], dtype=torch.float32).to(device)  # (1,)
    pressure    = torch.tensor([float(sample["pressure"])],    dtype=torch.float32).to(device)  # (1,)
    sf = torch.tensor(np.array(sample["structure_features"], dtype=np.float32)).unsqueeze(0).to(device)  # (1,7)

    return dict(
        src_tokens=src_tokens,
        src_distance=src_distance,
        src_coord=src_coord,
        src_edge_type=src_edge_type,
        gas=gas,
        gas_attr=gas_attr,
        temperature=temperature,
        pressure=pressure,
        structure_features=sf,
    )


# ─────────────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ckpt",   required=True)
    parser.add_argument("--data",   required=True)
    parser.add_argument("--task",   default="Tobacco_CH4")
    parser.add_argument("--n-mofs", type=int, default=100)
    parser.add_argument("--seed",   type=int, default=42)
    parser.add_argument("--output", default="/root/inference_100_results.csv")
    args = parser.parse_args()

    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
    print(f"[INFO] Device: {device}")

    # ── dictionary ──────────────────────────────────────────────────────────
    dict_path = os.path.join(args.data, "dict.txt")
    dictionary = Dictionary.load(dict_path)
    print(f"[INFO] Dictionary size: {len(dictionary)}")

    # ── model ───────────────────────────────────────────────────────────────
    _, model, ns = build_unicore_task(args.data, args.task)
    print(f"[INFO] Loading checkpoint: {args.ckpt}")
    state = checkpoint_utils.load_checkpoint_to_cpu(args.ckpt)
    missing, unexpected = model.load_state_dict(state["model"], strict=False)
    if missing:
        print(f"  [WARN] Missing keys: {missing[:5]}")
    model.to(device)
    model.eval()
    total_params = sum(p.numel() for p in model.parameters())
    print(f"[INFO] Model params: {total_params:,}")

    # ── data ────────────────────────────────────────────────────────────────
    selected = load_test_samples(args.data, args.task, args.n_mofs, args.seed)

    # ── inference ────────────────────────────────────────────────────────────
    all_preds, all_targets, all_meta = [], [], []
    errors = 0

    with torch.no_grad():
        for cif, samples in selected:
            for s in samples:
                try:
                    tensors = sample_to_tensors(s, dictionary, device)
                    out = model(**tensors)
                    pred_norm = out[0].squeeze().item()
                    # inverse transform: log1p_standardization
                    # forward:  (log1p(x) - mean) / std
                    # inverse:  expm1(pred * std + mean)
                    MEAN, STD = 4.3757066134, 1.0909639617
                    pred = float(np.expm1(pred_norm * STD + MEAN))
                    tgt  = float(s["target"])
                    all_preds.append(pred)
                    all_targets.append(tgt)
                    all_meta.append({
                        "cif":         cif,
                        "pressure_bar": s["pressure"],
                        "temperature_K": s["temperature"],
                        "pred":         pred,
                        "target":       tgt,
                        "abs_error":    abs(pred - tgt),
                    })
                except Exception as e:
                    errors += 1
                    print(f"  [WARN] {cif} p={s['pressure']:.3f}: {e}")

    print(f"\n[INFO] Done. Samples={len(all_preds)}, Errors={errors}")

    # ── metrics ─────────────────────────────────────────────────────────────
    p = np.array(all_preds)
    t = np.array(all_targets)
    mae  = float(np.mean(np.abs(p - t)))
    rmse = float(np.sqrt(np.mean((p - t) ** 2)))
    ss_res = float(np.sum((p - t) ** 2))
    ss_tot = float(np.sum((t - t.mean()) ** 2))
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 else float("nan")

    print(f"\n{'='*52}")
    print(f"  MOFs evaluated   : {len(selected)}")
    print(f"  Total datapoints : {len(all_preds)}")
    print(f"  MAE              : {mae:.4f} cm³/cm³")
    print(f"  RMSE             : {rmse:.4f} cm³/cm³")
    print(f"  R²               : {r2:.6f}")
    print(f"{'='*52}")

    # worst 10
    sorted_meta = sorted(all_meta, key=lambda x: x["abs_error"], reverse=True)
    print("\nTop-10 worst predictions:")
    print(f"  {'CIF':<20} {'P(bar)':>8} {'Pred':>8} {'True':>8} {'|Err|':>8}")
    for m in sorted_meta[:10]:
        print(f"  {m['cif']:<20} {m['pressure_bar']:>8.2f} {m['pred']:>8.2f} {m['target']:>8.2f} {m['abs_error']:>8.2f}")

    # ── save CSV ─────────────────────────────────────────────────────────────
    with open(args.output, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(all_meta[0].keys()))
        writer.writeheader()
        writer.writerows(all_meta)
    print(f"\n[INFO] Results → {args.output}")


if __name__ == "__main__":
    main()
