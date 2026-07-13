#!/usr/bin/env python3
"""
run_inference_full.py  ──  在指定 lmdb test split 上做全量推理评估。

支持两种模式：
  1. lmdb 模式（--lmdb-dir）：直接读已有 lmdb，适合 v2/v3 test split
  2. 单 JSON 模式（--json）：解析单个 mofdb JSON 文件做推理（如 hMOF）

用法（v3 full test）：
    python run_inference_full.py \
        --ckpt /root/Uni-MOF-main/results/Tobacco_CH4_v2/checkpoint_best.pt \
        --lmdb-dir /root/Uni-MOF-main/lmdb_output_v3 \
        --task Tobacco_CH4 \
        --split test \
        --output /root/inference_v3_test_full.csv

用法（hMOF 单文件）：
    python run_inference_full.py \
        --ckpt /root/Uni-MOF-main/results/Tobacco_CH4_v2/checkpoint_best.pt \
        --json /root/Uni-MOF-main/data/MofData/hMOF-10/hMOF-0.json \
        --cif  /root/Uni-MOF-main/data/MofData/hMOF-10/hMOF-0.cif \
        --output /root/inference_hMOF.csv
"""

import argparse, csv, os, pickle, sys, json, re, time
import numpy as np
import torch
import lmdb

script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)

# ── normalisation constants for Tobacco_CH4 ──────────────────────────────────
NORM_MEAN = 4.3757066134
NORM_STD  = 1.0909639617

def inverse_norm(x: float) -> float:
    return float(np.expm1(x * NORM_STD + NORM_MEAN))

# ── build unicore task/model ─────────────────────────────────────────────────
def build_model(ckpt_path: str, data_root: str, task_name: str, device):
    import argparse as _ap
    from unicore import tasks as _tasks, checkpoint_utils
    from unicore.utils import import_user_module

    ns = _ap.Namespace(
        task="unimof_v2", task_name=task_name,
        num_classes=1, gas_attr_input_dim=4, mono_loss_weight=0.1,
        remove_hydrogen=True, dict_name="dict.txt", max_atoms=512,
        classification_head_name="classification", finetune_mol_model=None,
        arch="unimof_v2",
        encoder_layers=8, encoder_embed_dim=512, encoder_ffn_embed_dim=2048,
        encoder_attention_heads=64, emb_dropout=0.1, dropout=0.1,
        attention_dropout=0.1, activation_dropout=0.0, pooler_dropout=0.0,
        max_seq_len=1024, activation_fn="gelu", pooler_activation_fn="tanh",
        post_ln=False, gas_dim=128, env_dim=128, hidden_dim=128,
        bins=32, structure_feature_dim=7, mc_dropout_samples=0,
        data=data_root, seed=42, loss="mof_v2_mse",
        user_dir=os.path.join(script_dir, "unimof"),
    )
    import_user_module(ns)
    task  = _tasks.setup_task(ns)
    model = task.build_model(ns)

    state = checkpoint_utils.load_checkpoint_to_cpu(ckpt_path)
    missing, unexpected = model.load_state_dict(state["model"], strict=False)
    if missing:
        print(f"  [WARN] missing keys: {missing[:3]}")
    model.to(device).eval()
    print(f"[INFO] Model loaded: {sum(p.numel() for p in model.parameters()):,} params")
    return model, task.dictionary

# ── sample → tensors ─────────────────────────────────────────────────────────
def sample_to_tensors(sample: dict, dictionary, device):
    atoms_raw  = sample["atoms"]
    coords_raw = np.array(sample["coordinates"], dtype=np.float32)

    non_h = [i for i, a in enumerate(atoms_raw) if a != "H"] or list(range(len(atoms_raw)))
    atoms  = [atoms_raw[i] for i in non_h]
    coords = coords_raw[non_h]
    N = len(atoms)

    bos, eos, unk = dictionary.bos(), dictionary.eos(), dictionary.unk()
    tids = [bos] + [dictionary.index(a) if a in dictionary else unk for a in atoms] + [eos]
    L = len(tids)

    src_tokens = torch.tensor(tids, dtype=torch.long).unsqueeze(0).to(device)

    coords_t = torch.zeros(L, 3, dtype=torch.float32)
    coords_t[1:N+1] = torch.from_numpy(coords)
    src_coord = coords_t.unsqueeze(0).to(device)

    inner = torch.from_numpy(coords)
    dist  = (inner.unsqueeze(0) - inner.unsqueeze(1)).norm(dim=-1)
    pad_dist = torch.zeros(L, L, dtype=torch.float32)
    pad_dist[1:N+1, 1:N+1] = dist
    src_distance = pad_dist.unsqueeze(0).to(device)

    tids_t = torch.tensor(tids, dtype=torch.long)
    src_edge_type = (tids_t.unsqueeze(0) * len(dictionary) + tids_t.unsqueeze(1)).unsqueeze(0).to(device)

    gas      = torch.tensor([int(np.array(sample["gas"]).flat[0])], dtype=torch.long).to(device)
    gas_attr = torch.tensor(np.array(sample["gas_attr"], dtype=np.float32)).unsqueeze(0).to(device)
    temperature = torch.tensor([float(sample["temperature"])], dtype=torch.float32).to(device)
    pressure    = torch.tensor([float(sample["pressure"])],    dtype=torch.float32).to(device)
    sf = torch.tensor(np.array(sample["structure_features"], dtype=np.float32)).unsqueeze(0).to(device)

    return dict(src_tokens=src_tokens, src_distance=src_distance,
                src_coord=src_coord, src_edge_type=src_edge_type,
                gas=gas, gas_attr=gas_attr,
                temperature=temperature, pressure=pressure,
                structure_features=sf)

# ── run inference on a list of samples ───────────────────────────────────────
def run_inference(samples, model, dictionary, device, desc=""):
    results = []
    errors  = 0
    t0 = time.time()
    with torch.no_grad():
        for i, s in enumerate(samples):
            try:
                tensors = sample_to_tensors(s, dictionary, device)
                out  = model(**tensors)
                pred = inverse_norm(out[0].squeeze().item())
                tgt  = float(s["target"])
                results.append({
                    "cif":          s.get("task_name","").split("#")[0] or s.get("ID","?"),
                    "pressure_bar": round(10 ** float(s["pressure"]), 3),
                    "temperature_K": float(s["temperature"]),
                    "pred":         pred,
                    "target":       tgt,
                    "abs_error":    abs(pred - tgt),
                    "rel_error_pct": abs(pred - tgt) / max(abs(tgt), 1e-6) * 100,
                })
            except Exception as e:
                errors += 1
                if errors <= 5:
                    print(f"  [WARN] {s.get('task_name','?')}: {e}")
            if (i+1) % 500 == 0:
                elapsed = time.time() - t0
                print(f"  {desc} {i+1}/{len(samples)} done  ({elapsed:.0f}s elapsed)")
    return results, errors

# ── metrics ───────────────────────────────────────────────────────────────────
def compute_metrics(results):
    if not results:
        return {}
    p = np.array([r["pred"]   for r in results])
    t = np.array([r["target"] for r in results])
    mae  = float(np.mean(np.abs(p - t)))
    rmse = float(np.sqrt(np.mean((p - t)**2)))
    ss_res = float(np.sum((p - t)**2))
    ss_tot = float(np.sum((t - t.mean())**2))
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 else float("nan")
    return {"n": len(results), "MAE": mae, "RMSE": rmse, "R2": r2,
            "pred_mean": float(p.mean()), "target_mean": float(t.mean())}

def print_metrics(label, m):
    print(f"  {label:30s}  N={m['n']:5d}  MAE={m['MAE']:7.3f}  RMSE={m['RMSE']:7.3f}  R²={m['R2']:.6f}")

# ── load lmdb samples ─────────────────────────────────────────────────────────
def load_lmdb_samples(lmdb_dir, task_name, split):
    path = os.path.join(lmdb_dir, task_name, f"{split}.lmdb")
    env  = lmdb.open(path, subdir=False, readonly=True, lock=False, readahead=False)
    samples = []
    with env.begin() as txn:
        for _, v in txn.cursor():
            samples.append(pickle.loads(v))
    print(f"[INFO] Loaded {len(samples)} samples from {path}")
    return samples

# ── parse hMOF-style JSON (single MOF) ────────────────────────────────────────
def load_json_sample(json_path, cif_path):
    import re as _re
    from unicore.data import Dictionary

    with open(json_path) as f:
        obj = json.load(f)

    GAS_NAME_TO_ID = {"CH4":1,"CO2":2,"Ar":3,"Kr":4,"Xe":5,"O2":6,"N2":7}
    GAS_FEATURES_RAW = {
        "CH4": np.array([190.56,45.99,0.011,16.043],dtype=np.float32),
    }
    _MEAN = np.array([205.08,52.40,0.043,53.585],dtype=np.float32)
    _STD  = np.array([64.36, 9.95,0.085,37.636],dtype=np.float32)
    GAS_FEATURES = {k:(v-_MEAN)/_STD for k,v in GAS_FEATURES_RAW.items()}

    from pymatgen.core import Structure
    s = Structure.from_file(cif_path)
    df = s.as_dataframe()
    atoms = df["Species"].astype(str).apply(lambda x: _re.sub(r"\d+","",x)).tolist()
    coords = df[["x","y","z"]].values.astype(np.float32)
    lat = s.lattice

    struct_feats = np.array([
        float(obj.get("lcd",0) or 0),
        float(obj.get("pld",0) or 0),
        float(obj.get("pld",0) or 0),   # lfpd fallback
        0.0,                              # density not in hMOF json
        float(obj.get("surface_area_m2cm3",0) or 0),
        float(obj.get("surface_area_m2g",  0) or 0),
        float(obj.get("void_fraction",     0) or 0),
    ], dtype=np.float32)

    samples = []
    for iso in obj.get("isotherms", []):
        gas_names = []
        for a in iso.get("adsorbates", []):
            if a.get("name") in GAS_NAME_TO_ID:
                gas_names.append(a["name"])
        if not gas_names or "CH4" not in gas_names:
            continue
        T = iso.get("temperature")
        if T is None: continue
        for pt in iso.get("isotherm_data", []):
            p_bar = float(pt["pressure"])
            q     = pt.get("total_adsorption")
            # only use cm3(STP)/cm3 units
            if iso.get("adsorptionUnits","").startswith("cm3") and q is not None and q > 0:
                samples.append({
                    "ID":   obj.get("name","hMOF"),
                    "atoms": atoms, "coordinates": coords,
                    "abc": lat.abc, "angles": lat.angles,
                    "volume": lat.volume, "lattice_matrix": lat.matrix,
                    "charge": s.charge, "abc_coordinates": coords,
                    "gas":      np.array(GAS_NAME_TO_ID["CH4"], dtype=np.int32),
                    "gas_attr": GAS_FEATURES["CH4"],
                    "temperature": np.array(float(T), dtype=np.float32),
                    "pressure":    np.array(np.log10(p_bar), dtype=np.float32),
                    "target":      float(q),
                    "task_name":   f"{obj.get('name','hMOF')}#CH4#{T}#{p_bar}",
                    "structure_features": struct_feats,
                })
    print(f"[INFO] Loaded {len(samples)} CH4 cm³/cm³ data points from {json_path}")
    return samples

# ── save CSV ──────────────────────────────────────────────────────────────────
def save_csv(results, path):
    if not results: return
    with open(path,"w",newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(results[0].keys()))
        w.writeheader(); w.writerows(results)
    print(f"[INFO] Saved {len(results)} rows → {path}")

# ── main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ckpt",     required=True)
    parser.add_argument("--lmdb-dir", default=None, help="lmdb root dir (contains task_name/split.lmdb)")
    parser.add_argument("--task",     default="Tobacco_CH4")
    parser.add_argument("--split",    default="test")
    parser.add_argument("--json",     default=None, help="single mofdb JSON for hMOF-style inference")
    parser.add_argument("--cif",      default=None, help="corresponding CIF file")
    parser.add_argument("--output",   required=True)
    args = parser.parse_args()

    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
    print(f"[INFO] Device: {device}")
    if torch.cuda.is_available():
        print(f"[INFO] GPU: {torch.cuda.get_device_name(0)}  "
              f"({torch.cuda.get_device_properties(0).total_memory//1024**3} GB)")

    # data_root for dict.txt lookup — always use lmdb_output_v2 which has dict.txt
    # (dict.txt is shared across v2/v3 as the atom vocabulary is identical)
    data_root = os.path.join(script_dir, "lmdb_output_v2")

    model, dictionary = build_model(args.ckpt, data_root, args.task, device)

    # ── load samples ──
    if args.json:
        samples = load_json_sample(args.json, args.cif)
    elif args.lmdb_dir:
        samples = load_lmdb_samples(args.lmdb_dir, args.task, args.split)
    else:
        parser.error("Must provide --lmdb-dir or --json")

    if not samples:
        print("[ERROR] No samples loaded."); sys.exit(1)

    # ── inference ──
    print(f"\n[INFO] Running inference on {len(samples)} samples...")
    results, errors = run_inference(samples, model, dictionary, device, desc=args.split)
    print(f"[INFO] Done. success={len(results)}, errors={errors}")

    # ── overall metrics ──
    m_all = compute_metrics(results)
    print(f"\n{'='*65}")
    print(f"  Dataset : {args.lmdb_dir or args.json}")
    print(f"  Split   : {args.split}")
    print(f"  Checkpoint: {os.path.basename(args.ckpt)}")
    print(f"{'='*65}")
    print_metrics("Overall", m_all)

    # ── per-pressure metrics ──
    from collections import defaultdict
    by_p = defaultdict(list)
    for r in results:
        by_p[r["pressure_bar"]].append(r)

    if len(by_p) > 1:
        print(f"\n  {'Pressure(bar)':>14}  {'N':>5}  {'MAE':>7}  {'RMSE':>7}  {'R²':>9}")
        print(f"  {'-'*50}")
        for p in sorted(by_p.keys()):
            m = compute_metrics(by_p[p])
            print(f"  {p:>14.2f}  {m['n']:>5}  {m['MAE']:>7.3f}  {m['RMSE']:>7.3f}  {m['R2']:>9.6f}")

    # ── worst predictions ──
    sorted_res = sorted(results, key=lambda x: x["abs_error"], reverse=True)
    print(f"\n  Top-10 worst predictions:")
    print(f"  {'CIF':<22} {'P(bar)':>7} {'Pred':>8} {'True':>8} {'|Err|':>8} {'Err%':>7}")
    for r in sorted_res[:10]:
        print(f"  {r['cif']:<22} {r['pressure_bar']:>7.1f} "
              f"{r['pred']:>8.2f} {r['target']:>8.2f} "
              f"{r['abs_error']:>8.2f} {r['rel_error_pct']:>6.1f}%")

    print(f"\n{'='*65}")
    save_csv(results, args.output)

if __name__ == "__main__":
    main()
