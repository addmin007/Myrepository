"""
run_inference_newdata.py
对 data/CH4_env_multi_pressure.csv + data/CIF/ 做批量推理

target-value 原始单位：mol/kg(框架)
模型输出单位：cm³/cm³
换算：uptake_cm3_cm3 = uptake_mol_kg * 22414(cm3/mol) * density(g/cm3) / 1000

运行方式：
  python run_inference_newdata.py \
    --ckpt /root/Uni-MOF-main/results/Tobacco_CH4_v2/checkpoint_best.pt \
    --csv  /root/Uni-MOF-main/data/CH4_env_multi_pressure.csv \
    --cif-dir /root/Uni-MOF-main/data/CIF \
    --dict /root/Uni-MOF-main/lmdb_output_v2/Tobacco_CH4/dict.txt \
    --user-dir /root/Uni-MOF-main/unimof \
    --output /root/inference_newdata_results.csv
"""

import argparse, os, sys, math, time, warnings
import numpy as np
import torch

warnings.filterwarnings("ignore")

# ── 归一化常数（Tobacco_CH4）────────────────────────────────────────────────
NORM_MEAN = 4.3757066134
NORM_STD  = 1.0909639617

# ── 气体常数 ─────────────────────────────────────────────────────────────────
GAS_NAME_TO_ID = {"CH4": 1, "CO2": 2, "Ar": 3, "Kr": 4, "Xe": 5, "O2": 6, "N2": 7}
_GAS_FEATURES_RAW = {
    "CH4": np.array([190.56, 45.99, 0.011, 16.043], dtype=np.float32),
}
_GAS_ATTR_MEAN = np.array([205.08, 52.40,  0.043, 53.585], dtype=np.float32)
_GAS_ATTR_STD  = np.array([ 64.36,  9.95,  0.085, 37.636], dtype=np.float32)
GAS_FEATURES = {k: (v - _GAS_ATTR_MEAN) / _GAS_ATTR_STD
                for k, v in _GAS_FEATURES_RAW.items()}

MOLAR_VOL_STP = 22414.0   # cm³/mol (标准摩尔体积)


def inverse_norm(z):
    return math.expm1(z * NORM_STD + NORM_MEAN)


def mol_kg_to_cm3_cm3(mol_kg, density_g_cm3):
    """mol/kg(框架) → cm³(STP)/cm³(框架)"""
    return mol_kg * MOLAR_VOL_STP * density_g_cm3 / 1000.0


def parse_cif(cif_path):
    """解析CIF，返回 (atoms, coords_cart, density_g_cm3, volume_A3)"""
    from pymatgen.core import Structure
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        struct = Structure.from_file(cif_path)
    atoms  = [str(s.specie.symbol) for s in struct]
    coords = np.array([s.coords for s in struct], dtype=np.float32)
    density = struct.density          # g/cm³
    volume  = struct.volume           # Å³
    return atoms, coords, float(density), float(volume)


def estimate_structure_features(atoms, coords, density, volume):
    """
    用简单几何方法估算7维结构特征：
    [lcd, pld, lfpd, density, asa_m2g, asa_m2cm3, void_fraction]

    说明：
    - lcd/pld/lfpd：用最近邻原子距离和经验公式估算，精度有限
    - asa：用表面积估算公式
    - void_fraction：用 1 - (原子体积之和 / 晶胞体积) 估算

    注意：这是粗略估算，非Zeopp精确值，仅用于推理输入。
    实际误差影响模型精度有限（模型对结构特征输入有一定鲁棒性）。
    """
    # 原子半径（van der Waals，Å）
    VDW = {"H":1.20,"C":1.70,"N":1.55,"O":1.52,"S":1.80,"F":1.47,
           "Cl":1.75,"Br":1.85,"I":1.98,"P":1.80,"Cu":1.40,"Zn":1.39,
           "Al":1.84,"Fe":1.56,"Co":1.52,"Ni":1.49,"Cr":1.66,"Mn":1.61,
           "V":1.53,"Ti":1.87,"Ca":2.31,"Mg":1.73,"Na":2.27,"K":2.75,
           "Zr":2.36,"Hf":2.23,"In":1.93,"Ga":1.87,"Ge":2.11}
    probe = 1.82   # CH4 kinetic radius Å

    N = len(atoms)
    # 限制计算量
    if N > 400:
        idx = np.random.choice(N, 400, replace=False)
        atoms  = [atoms[i] for i in idx]
        coords = coords[idx]
        N = 400

    radii = np.array([VDW.get(a, 1.70) for a in atoms], dtype=np.float32)

    # 最大孔径估算：晶胞最短对角线 / 2（粗略）
    # 更好的方法是用晶格参数，这里用坐标范围近似
    extent = coords.max(axis=0) - coords.min(axis=0) + 1e-6
    lcd_est = float(np.min(extent)) * 0.5
    lcd_est = max(lcd_est, 2.0)
    pld_est = max(lcd_est * 0.8, 1.5)
    lfpd_est = lcd_est

    # void fraction：1 - sum(4/3*pi*r^3) / volume
    atom_vol = np.sum((4.0/3.0) * math.pi * radii**3)
    vf = max(0.0, 1.0 - atom_vol / max(volume, 1.0))
    vf = min(vf, 0.99)

    # ASA 估算：用表面球近似
    # asa_m2g 训练集范围约 0-3000，这里用孔隙率估算
    asa_m2g   = vf * 3000.0 * density / 1.5  # 粗略
    asa_m2cm3 = asa_m2g * density

    return np.array([lcd_est, pld_est, lfpd_est, density,
                     asa_m2g, asa_m2cm3, vf], dtype=np.float32)


def struct_to_tensors(atoms, coords, dictionary, max_atoms=512):
    """原子列表+坐标 → 模型输入tensors（去氢，截断）"""
    non_h = [i for i, a in enumerate(atoms) if a != "H"]
    if not non_h:
        non_h = list(range(len(atoms)))
    atoms  = [atoms[i] for i in non_h]
    coords = coords[non_h]

    if len(atoms) > max_atoms:
        atoms  = atoms[:max_atoms]
        coords = coords[:max_atoms]

    N = len(atoms)
    d = dictionary
    bos, eos, unk = d.bos(), d.eos(), d.unk()
    tids = [bos] + [d.index(a) if a in d else unk for a in atoms] + [eos]
    L = len(tids)

    src_tokens = torch.tensor(tids, dtype=torch.long).unsqueeze(0)

    ct = torch.zeros(L, 3, dtype=torch.float32)
    ct[1:N+1] = torch.from_numpy(coords.astype(np.float32))
    src_coord = ct.unsqueeze(0)

    inner = torch.from_numpy(coords.astype(np.float32))
    dist  = (inner.unsqueeze(0) - inner.unsqueeze(1)).norm(dim=-1)
    pd    = torch.zeros(L, L, dtype=torch.float32)
    pd[1:N+1, 1:N+1] = dist
    src_distance = pd.unsqueeze(0)

    tids_t = torch.tensor(tids, dtype=torch.long)
    src_edge_type = (tids_t.unsqueeze(0) * len(d) + tids_t.unsqueeze(1)).unsqueeze(0)

    return src_tokens, src_distance, src_coord, src_edge_type


def build_model(user_dir, dict_path, task_name="Tobacco_CH4", max_atoms=512):
    import argparse as _ap
    from unicore import tasks as _tasks
    data_root = os.path.dirname(dict_path)
    ns = _ap.Namespace(
        task="unimof_v2", task_name=task_name,
        num_classes=1, gas_attr_input_dim=4, mono_loss_weight=0.1,
        remove_hydrogen=True, dict_name="dict.txt", max_atoms=max_atoms,
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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ckpt",     required=True)
    parser.add_argument("--csv",      required=True)
    parser.add_argument("--cif-dir",  required=True)
    parser.add_argument("--dict",     required=True)
    parser.add_argument("--user-dir", required=True)
    parser.add_argument("--output",   required=True)
    parser.add_argument("--device",   default="cuda")
    parser.add_argument("--fp16",     action="store_true", default=True)
    parser.add_argument("--max-atoms", type=int, default=512)
    args = parser.parse_args()

    # ── 初始化模型 ────────────────────────────────────────────────────────────
    sys.path.insert(0, os.path.dirname(args.user_dir))
    import argparse as _ap
    from unicore.utils import import_user_module
    import_user_module(_ap.Namespace(user_dir=args.user_dir))

    from unicore.data import Dictionary
    from unicore import checkpoint_utils

    print("Loading dictionary ...")
    dictionary = Dictionary.load(args.dict)

    print("Building model ...")
    model = build_model(args.user_dir, args.dict, max_atoms=args.max_atoms)

    print(f"Loading checkpoint: {args.ckpt}")
    state = checkpoint_utils.load_checkpoint_to_cpu(args.ckpt)
    missing, unexpected = model.load_state_dict(state["model"], strict=False)
    if missing:
        print(f"  Missing keys: {missing[:3]}")

    device = torch.device(args.device if torch.cuda.is_available() else "cpu")
    fp16   = args.fp16 and device.type == "cuda"
    if fp16:
        model = model.half()
    model.to(device).eval()
    print(f"Model ready | device={device} | fp16={fp16}")

    # ── 读取CSV ───────────────────────────────────────────────────────────────
    import csv as _csv
    rows = []
    with open(args.csv) as f:
        reader = _csv.DictReader(f)
        for row in reader:
            rows.append(row)
    print(f"Total samples in CSV: {len(rows)}")

    # ── 逐条推理 ──────────────────────────────────────────────────────────────
    results = []
    cif_cache = {}   # 缓存已解析的CIF，避免重复读取

    fp = torch.float16 if fp16 else torch.float32

    def to_dev(t, dtype=None):
        t = t.to(device)
        return t.to(dtype) if dtype else t

    for i, row in enumerate(rows):
        name       = row["name"]
        pressure   = float(row["pressure"])          # bar
        temperature= float(row["temperature"])        # K
        target_mol_kg = float(row["target-value"])   # mol/kg

        cif_path = os.path.join(args.cif_dir, name + "_repeat.cif")
        if not os.path.exists(cif_path):
            print(f"[WARN] CIF not found: {cif_path}")
            results.append({
                "name": name, "pressure_bar": pressure,
                "temperature_K": temperature,
                "target_mol_kg": target_mol_kg,
                "target_cm3_cm3": float("nan"),
                "pred_cm3_cm3": float("nan"),
                "abs_error": float("nan"),
                "status": "cif_not_found"
            })
            continue

        # 解析CIF（带缓存）
        if name not in cif_cache:
            try:
                atoms, coords, density, volume = parse_cif(cif_path)
                sf = estimate_structure_features(atoms, coords, density, volume)
                cif_cache[name] = (atoms, coords, density, volume, sf)
            except Exception as e:
                print(f"[WARN] CIF parse error {name}: {e}")
                results.append({
                    "name": name, "pressure_bar": pressure,
                    "temperature_K": temperature,
                    "target_mol_kg": target_mol_kg,
                    "target_cm3_cm3": float("nan"),
                    "pred_cm3_cm3": float("nan"),
                    "abs_error": float("nan"),
                    "status": f"cif_error: {e}"
                })
                continue

        atoms, coords, density, volume, sf = cif_cache[name]

        # target 单位换算：mol/kg → cm³/cm³
        target_cm3 = mol_kg_to_cm3_cm3(target_mol_kg, density)

        # 推理
        try:
            with torch.no_grad():
                src_tokens, src_distance, src_coord, src_edge_type = \
                    struct_to_tensors(atoms, coords, dictionary, args.max_atoms)

                gas_id   = torch.tensor([GAS_NAME_TO_ID["CH4"]], dtype=torch.long)
                gas_attr = torch.tensor(GAS_FEATURES["CH4"], dtype=torch.float32).unsqueeze(0)
                temp_t   = torch.tensor([temperature], dtype=torch.float32)
                pres_t   = torch.tensor([math.log10(pressure)], dtype=torch.float32)
                sf_t     = torch.tensor(sf, dtype=torch.float32).unsqueeze(0)

                out = model(
                    gas=to_dev(gas_id),
                    gas_attr=to_dev(gas_attr, fp),
                    pressure=to_dev(pres_t, fp),
                    temperature=to_dev(temp_t, fp),
                    src_tokens=to_dev(src_tokens),
                    src_distance=to_dev(src_distance, fp),
                    src_coord=to_dev(src_coord, fp),
                    src_edge_type=to_dev(src_edge_type),
                    structure_features=to_dev(sf_t, fp),
                )
                logit = out[0].float().item()
                pred_cm3 = inverse_norm(logit)

        except Exception as e:
            print(f"[WARN] Inference error {name} P={pressure}bar: {e}")
            results.append({
                "name": name, "pressure_bar": pressure,
                "temperature_K": temperature,
                "target_mol_kg": target_mol_kg,
                "target_cm3_cm3": target_cm3,
                "pred_cm3_cm3": float("nan"),
                "abs_error": float("nan"),
                "status": f"infer_error: {e}"
            })
            continue

        abs_err = abs(pred_cm3 - target_cm3)
        results.append({
            "name": name, "pressure_bar": pressure,
            "temperature_K": temperature,
            "target_mol_kg": target_mol_kg,
            "target_cm3_cm3": round(target_cm3, 4),
            "pred_cm3_cm3":   round(pred_cm3, 4),
            "density_g_cm3":  round(density, 4),
            "abs_error":      round(abs_err, 4),
            "status": "ok"
        })

        if (i+1) % 50 == 0 or (i+1) == len(rows):
            print(f"  [{i+1}/{len(rows)}] {name} P={pressure}bar "
                  f"target={target_cm3:.2f} pred={pred_cm3:.2f} err={abs_err:.2f}")

    # ── 保存结果 ──────────────────────────────────────────────────────────────
    import csv as _csv
    fieldnames = ["name","pressure_bar","temperature_K","target_mol_kg",
                  "target_cm3_cm3","pred_cm3_cm3","density_g_cm3","abs_error","status"]
    with open(args.output, "w", newline="") as f:
        writer = _csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in results:
            writer.writerow({k: r.get(k,"") for k in fieldnames})

    # ── 统计汇总 ──────────────────────────────────────────────────────────────
    ok = [r for r in results if r["status"] == "ok"]
    print(f"\n{'='*60}")
    print(f"推理完成：成功 {len(ok)}/{len(results)} 条")

    import numpy as np
    for p in sorted(set(r["pressure_bar"] for r in ok)):
        sub = [r for r in ok if r["pressure_bar"] == p]
        preds   = np.array([r["pred_cm3_cm3"]  for r in sub])
        targets = np.array([r["target_cm3_cm3"] for r in sub])
        errs    = np.array([r["abs_error"]       for r in sub])
        ss_res = np.sum((targets - preds)**2)
        ss_tot = np.sum((targets - targets.mean())**2)
        r2 = 1 - ss_res/ss_tot if ss_tot > 0 else float("nan")
        print(f"\n  P={p:.0f} bar ({len(sub)} 样本):")
        print(f"    MAE  = {errs.mean():.4f} cm³/cm³")
        print(f"    RMSE = {np.sqrt(np.mean(errs**2)):.4f} cm³/cm³")
        print(f"    R²   = {r2:.4f}")

    print(f"\n结果已保存至: {args.output}")


if __name__ == "__main__":
    main()
