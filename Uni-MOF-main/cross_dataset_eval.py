"""
Cross-dataset generalisation evaluation for UniMOF Tobacco_CH4 model.

Tests the model trained on Tobacco against CoRE MOF dataset (same JSON/CIF format).
Produces:
  1. Overall R² / MAE / RMSE on CoRE MOF
  2. Per-pressure-point breakdown
  3. Failure case analysis:
     - Worst predicted MOFs with their structure features
     - Correlation between structural features and prediction error
  4. Saved plots:
     - scatter_core.png       : predicted vs true
     - error_vs_features.png  : error vs LCD / PLD / VF / density
     - error_distribution.png : histogram of absolute errors

Usage (server):
    cd /root/Uni-MOF-main
    python cross_dataset_eval.py \
        --data-dir  "./data/MofData/CoRE-mofdb-version_<hash>" \
        --checkpoint "./results/Tobacco_CH4/checkpoint_best.pt" \
        --dict      "./lmdb_output/dict.txt" \
        --out-dir   "./results/cross_dataset" \
        --nthreads  8

Requirements:
    pip install matplotlib seaborn pandas scikit-learn
"""

import argparse
import json
import logging
import math
import os
import re
import sys
import warnings
from concurrent.futures import ProcessPoolExecutor, as_completed
from typing import Optional

import torch
import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# ── constants (must match preprocess + regloss) ───────────────────────────────
MEAN_LOG1P = 4.3757066134
STD_LOG1P  = 1.0909639617

_GAS_ATTR_MEAN = np.array([205.08, 52.40, 0.043, 53.585], dtype=np.float32)
_GAS_ATTR_STD  = np.array([ 64.36,  9.95, 0.085, 37.636], dtype=np.float32)
GAS_FEATURES_RAW = {
    "CH4": np.array([190.56, 45.99, 0.011, 16.043], dtype=np.float32),
    "CO2": np.array([304.13, 73.77, 0.224, 44.01],  dtype=np.float32),
    "N2":  np.array([126.19, 33.96, 0.037, 28.014], dtype=np.float32),
}
GAS_FEATURES   = {k: (v - _GAS_ATTR_MEAN) / _GAS_ATTR_STD for k, v in GAS_FEATURES_RAW.items()}
GAS_NAME_TO_ID = {"CH4": 1, "CO2": 2, "Ar": 3, "Kr": 4, "Xe": 5, "O2": 6, "N2": 7}
GAS_INCHIKEYS  = {
    "VNWKTOKETHGBQD-UHFFFAOYSA-N": "CH4",
    "XTWYTFMLZFPYCI-UHFFFAOYSA-N": "CO2",
    "IJGRMHOSHXDMSA-UHFFFAOYSA-N": "N2",
}


def denorm(z: float) -> float:
    return math.expm1(float(z) * STD_LOG1P + MEAN_LOG1P)


def normalize_atom(a: str) -> str:
    return re.sub(r"\d+", "", a)


# ── JSON parsing (same logic as Tobacco preprocess) ──────────────────────────

def identify_gas(adsorbate: dict) -> Optional[str]:
    formula   = adsorbate.get("formula", "")
    name      = adsorbate.get("name", "")
    inchikey  = adsorbate.get("InChIKey", "")
    if formula in GAS_NAME_TO_ID:   return formula
    if name    in GAS_NAME_TO_ID:   return name
    if inchikey in GAS_INCHIKEYS:   return GAS_INCHIKEYS[inchikey]
    for g in GAS_NAME_TO_ID:
        if g.lower() in name.lower(): return g
    return None


def get_adsorption(point: dict, gas_name: str) -> Optional[float]:
    if "total_adsorption" in point and point["total_adsorption"] is not None:
        return float(point["total_adsorption"])
    for sp in point.get("species_data", []) or []:
        sp_ik = sp.get("InChIKey", "")
        if sp.get("name") == gas_name or \
           (sp_ik in GAS_INCHIKEYS and GAS_INCHIKEYS[sp_ik] == gas_name):
            return float(sp["adsorption"])
    return None


def get_structure_features(obj: dict) -> np.ndarray:
    lcd       = float(obj.get("lcd",              0.0) or 0.0)
    pld       = float(obj.get("pld",              0.0) or 0.0)
    lfpd      = float(obj.get("lfpd",             0.0) or 0.0)
    density   = float(obj.get("density",          0.0) or 0.0)
    asa_cm3   = float(obj.get("surface_area_m2cm3", 0.0) or 0.0)
    asa_g     = float(obj.get("surface_area_m2g",   0.0) or 0.0)
    vf        = float(obj.get("void_fraction",    0.0) or 0.0)
    return np.array([lcd, pld, lfpd, density, asa_cm3, asa_g, vf], dtype=np.float32)


def parse_json_folder(data_dir: str, target_gas: str = "CH4") -> pd.DataFrame:
    """Read all JSON files and return a flat DataFrame of adsorption rows."""
    rows = []
    files = sorted(f for f in os.listdir(data_dir) if f.endswith(".json"))
    logger.info(f"Found {len(files)} JSON files in {data_dir}")

    for fname in files:
        cif_name = fname[:-5]
        try:
            with open(os.path.join(data_dir, fname), "r", encoding="utf-8") as f:
                obj = json.load(f)
        except Exception:
            continue

        sf = get_structure_features(obj)
        for iso in obj.get("isotherms", []) or []:
            adsorbates = iso.get("adsorbates", []) or []
            iso_gases  = [identify_gas(a) for a in adsorbates]
            iso_gases  = [g for g in iso_gases if g is not None]
            if target_gas not in iso_gases:
                continue

            temp = iso.get("temperature")
            if temp is None:
                continue
            temp = float(temp)

            for pt in iso.get("isotherm_data", []) or []:
                p = pt.get("pressure")
                if p is None or float(p) <= 0:
                    continue
                p = float(p)
                val = get_adsorption(pt, target_gas)
                if val is None or val <= 0:
                    continue

                rows.append(dict(
                    cif_name          = cif_name,
                    temperature       = temp,
                    pressure_bar      = p,
                    pressure_log10    = math.log10(p),
                    adsorption        = val,
                    lcd               = float(sf[0]),
                    pld               = float(sf[1]),
                    lfpd              = float(sf[2]),
                    density           = float(sf[3]),
                    asa_m2cm3         = float(sf[4]),
                    asa_m2g           = float(sf[5]),
                    vf                = float(sf[6]),
                ))

    df = pd.DataFrame(rows)
    logger.info(f"Parsed {len(df)} adsorption data points for {target_gas}")
    return df


# ── CIF → model tensor ───────────────────────────────────────────────────────

def cif_to_data(args_tuple):
    """Worker function: parse one CIF file. Returns dict or None."""
    cif_path, cif_name = args_tuple
    if not os.path.exists(cif_path):
        return cif_name, None

    try:
        from pymatgen.core import Structure
        s  = Structure.from_file(cif_path, primitive=False)
        df = s.as_dataframe()

        atoms       = df["Species"].astype(str).map(normalize_atom).tolist()
        coords      = df[["x", "y", "z"]].values.astype(np.float32)
        abc_coords  = df[["a", "b", "c"]].values.astype(np.float32)

        # Remove hydrogen
        keep        = [i for i, a in enumerate(atoms) if a != "H"]
        atoms       = [atoms[i] for i in keep]
        coords      = coords[keep]
        abc_coords  = abc_coords[keep]

        lmat        = s.lattice.matrix.astype(np.float32)
        cart        = abc_coords @ lmat
        diff        = cart[:, None, :] - cart[None, :, :]
        dist        = np.sqrt((diff**2).sum(-1)).astype(np.float32)

        return cif_name, {"atoms": atoms, "coordinates": coords, "dist": dist}
    except Exception as e:
        return cif_name, None


# ── Model inference ───────────────────────────────────────────────────────────

def load_model(checkpoint: str, dict_path: str):
    import torch
    import unimof  # noqa – registers tasks/models
    from unicore import checkpoint_utils
    from unicore.data import Dictionary
    from unicore import tasks

    dictionary = Dictionary.load(dict_path)
    state      = checkpoint_utils.load_checkpoint_to_cpu(checkpoint)
    args       = state["args"]
    args.task_name = "Tobacco_CH4"

    task  = tasks.setup_task(args)
    model = task.build_model(args)
    model.load_state_dict(state["model"], strict=False)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model  = model.to(device).eval()
    return model, dictionary, device


def make_input(struct: dict, pressure_log10: float, temperature: float,
               gas_name: str, dictionary, device):
    import torch

    atoms = struct["atoms"]
    dist  = struct["dist"]
    N     = len(atoms)

    # Token ids
    tids = np.array(
        [dictionary.bos()] + [dictionary.index(a) for a in atoms] + [dictionary.eos()],
        dtype=np.int64
    )
    pad = N + 2

    dist_pad = np.zeros((pad, pad), dtype=np.float32)
    dist_pad[1:N+1, 1:N+1] = dist

    vocab = len(dictionary)
    etype = np.zeros((pad, pad), dtype=np.int64)
    for i, ai in enumerate(atoms):
        for j, aj in enumerate(atoms):
            etype[i+1, j+1] = dictionary.index(ai) * vocab + dictionary.index(aj)

    coord_pad = np.zeros((pad, 3), dtype=np.float32)
    coord_pad[1:N+1] = struct["coordinates"]

    gas_id   = GAS_NAME_TO_ID[gas_name]
    gas_attr = GAS_FEATURES[gas_name]
    sf       = np.zeros(7, dtype=np.float32)

    return {
        "gas":                torch.tensor([gas_id],                   device=device),
        "gas_attr":           torch.tensor(gas_attr[None],             device=device),
        "pressure":           torch.tensor([pressure_log10],           device=device, dtype=torch.float32),
        "temperature":        torch.tensor([temperature],              device=device, dtype=torch.float32),
        "src_tokens":         torch.tensor(tids[None],                 device=device),
        "src_distance":       torch.tensor(dist_pad[None],             device=device),
        "src_coord":          torch.tensor(coord_pad[None],            device=device),
        "src_edge_type":      torch.tensor(etype[None],                device=device),
        "structure_features": torch.tensor(sf[None],                   device=device),
    }


@torch.no_grad()
def run_inference(df: pd.DataFrame, data_dir: str, checkpoint: str,
                  dict_path: str, nthreads: int = 4) -> pd.DataFrame:
    model, dictionary, device = load_model(checkpoint, dict_path)

    unique_cifs = df["cif_name"].unique().tolist()
    logger.info(f"Parsing {len(unique_cifs)} CIF files (serial to save memory)...")

    # 串行解析 CIF，避免多进程同时占用大量内存
    struct_cache = {}
    n_ok = 0
    n_skip = 0
    for i, cif_name in enumerate(unique_cifs):
        cif_path = os.path.join(data_dir, f"{cif_name}.cif")
        _, result = cif_to_data((cif_path, cif_name))
        struct_cache[cif_name] = result
        if result is not None:
            n_ok += 1
        else:
            n_skip += 1
        if (i + 1) % 500 == 0:
            logger.info(f"  Parsed {i+1}/{len(unique_cifs)}, ok={n_ok}, skip={n_skip}")

    logger.info(f"CIF parsed: {n_ok} ok, {n_skip} failed")

    # Run inference row by row
    preds = []
    for _, row in df.iterrows():
        struct = struct_cache.get(row["cif_name"])
        if struct is None:
            preds.append(np.nan)
            continue
        try:
            inp  = make_input(struct, row["pressure_log10"], row["temperature"],
                              "CH4", dictionary, device)
            z    = float(model(**inp, features_only=True)[0].squeeze().cpu())
            pred = denorm(z)
            preds.append(pred)
        except Exception as e:
            preds.append(np.nan)

    df = df.copy()
    df["predicted"] = preds
    df = df.dropna(subset=["predicted"])
    return df


# ── Metrics & analysis ────────────────────────────────────────────────────────

def compute_metrics(true: np.ndarray, pred: np.ndarray) -> dict:
    from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
    return {
        "R2":   r2_score(true, pred),
        "MAE":  mean_absolute_error(true, pred),
        "RMSE": math.sqrt(mean_squared_error(true, pred)),
        "N":    len(true),
    }


def print_metrics(label: str, m: dict):
    print(f"\n{'='*50}")
    print(f"  {label}")
    print(f"{'='*50}")
    print(f"  N     = {m['N']}")
    print(f"  R²    = {m['R2']:.4f}")
    print(f"  MAE   = {m['MAE']:.3f}  cm³(STP)/cm³")
    print(f"  RMSE  = {m['RMSE']:.3f} cm³(STP)/cm³")


def failure_analysis(df: pd.DataFrame, out_dir: str, top_n: int = 20):
    """
    Analyse worst-predicted MOFs:
      - List top_n highest absolute-error cases
      - Correlation between structural features and |error|
      - Plots
    """
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import seaborn as sns
    from scipy.stats import pearsonr

    os.makedirs(out_dir, exist_ok=True)

    df = df.copy()
    df["abs_error"] = (df["predicted"] - df["adsorption"]).abs()
    df["rel_error"] = df["abs_error"] / (df["adsorption"].abs() + 1e-6)

    # ── 1. Scatter plot ───────────────────────────────────────────────────────
    fig, ax = plt.subplots(figsize=(6, 6))
    vmax = max(df["adsorption"].max(), df["predicted"].max())
    ax.scatter(df["adsorption"], df["predicted"], alpha=0.3, s=10, rasterized=True)
    ax.plot([0, vmax], [0, vmax], "r--", lw=1)
    m = compute_metrics(df["adsorption"].values, df["predicted"].values)
    ax.set_title(f"CoRE MOF (zero-shot)\nR²={m['R2']:.4f}  MAE={m['MAE']:.2f}  RMSE={m['RMSE']:.2f}")
    ax.set_xlabel("True adsorption [cm³(STP)/cm³]")
    ax.set_ylabel("Predicted adsorption")
    plt.tight_layout()
    plt.savefig(os.path.join(out_dir, "scatter_core.png"), dpi=150)
    plt.close()
    logger.info("Saved scatter_core.png")

    # ── 2. Error vs structural features ──────────────────────────────────────
    feat_cols = ["lcd", "pld", "density", "vf", "asa_m2cm3"]
    feat_labels = {
        "lcd":      "LCD (Å)",
        "pld":      "PLD (Å)",
        "density":  "Density (g/cm³)",
        "vf":       "Void Fraction",
        "asa_m2cm3":"ASA (m²/cm³)",
    }
    fig, axes = plt.subplots(1, len(feat_cols), figsize=(4 * len(feat_cols), 4))
    correlations = {}
    for ax, col in zip(axes, feat_cols):
        sub = df[df[col] > 0]  # skip zeros (missing data)
        if len(sub) < 10:
            continue
        r, p = pearsonr(sub[col], sub["abs_error"])
        correlations[col] = (r, p)
        ax.scatter(sub[col], sub["abs_error"], alpha=0.3, s=8, rasterized=True)
        ax.set_xlabel(feat_labels.get(col, col))
        ax.set_ylabel("|Error|")
        ax.set_title(f"r={r:.3f} (p={p:.2e})")
    plt.suptitle("Prediction Error vs Structural Features (CoRE MOF)", fontsize=11)
    plt.tight_layout()
    plt.savefig(os.path.join(out_dir, "error_vs_features.png"), dpi=150)
    plt.close()
    logger.info("Saved error_vs_features.png")

    # ── 3. Error distribution ─────────────────────────────────────────────────
    fig, ax = plt.subplots(figsize=(6, 4))
    ax.hist(df["abs_error"], bins=60, edgecolor="white", linewidth=0.3)
    ax.axvline(df["abs_error"].median(), color="r", linestyle="--",
               label=f"Median={df['abs_error'].median():.2f}")
    ax.set_xlabel("|Error| [cm³(STP)/cm³]")
    ax.set_ylabel("Count")
    ax.set_title("Absolute Error Distribution on CoRE MOF")
    ax.legend()
    plt.tight_layout()
    plt.savefig(os.path.join(out_dir, "error_distribution.png"), dpi=150)
    plt.close()
    logger.info("Saved error_distribution.png")

    # ── 4. Top failure cases ──────────────────────────────────────────────────
    worst = (df.sort_values("abs_error", ascending=False)
               .drop_duplicates("cif_name")
               .head(top_n)
               [["cif_name", "adsorption", "predicted", "abs_error",
                 "lcd", "pld", "density", "vf", "pressure_bar", "temperature"]])

    worst_path = os.path.join(out_dir, "worst_cases.csv")
    worst.to_csv(worst_path, index=False, float_format="%.4f")
    logger.info(f"Saved worst {top_n} cases → {worst_path}")

    print("\n── Top failure cases ──────────────────────────────────────────")
    print(worst.to_string(index=False))

    # ── 5. Correlation summary ────────────────────────────────────────────────
    print("\n── Pearson r between structural features and |error| ──────────")
    for col, (r, p) in sorted(correlations.items(), key=lambda x: -abs(x[1][0])):
        sig = "***" if p < 0.001 else ("**" if p < 0.01 else ("*" if p < 0.05 else ""))
        print(f"  {feat_labels.get(col, col):25s}  r={r:+.3f}  p={p:.2e}  {sig}")

    return correlations


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir",   required=True,
                        help="CoRE MOF data folder (contains .cif + .json pairs)")
    parser.add_argument("--checkpoint", default="./results/Tobacco_CH4/checkpoint_best.pt")
    parser.add_argument("--dict",       default="./lmdb_output/dict.txt")
    parser.add_argument("--out-dir",    default="./results/cross_dataset")
    parser.add_argument("--gas",        default="CH4")
    parser.add_argument("--nthreads",   type=int, default=4)
    parser.add_argument("--max-samples",type=int, default=0,
                        help="Limit samples for quick testing (0 = all)")
    args = parser.parse_args()

    # ── Parse JSON metadata ───────────────────────────────────────────────────
    df = parse_json_folder(args.data_dir, target_gas=args.gas)

    if len(df) == 0:
        raise RuntimeError("No valid data found. Check --data-dir and target gas.")

    if args.max_samples > 0:
        # Sample by unique MOFs to avoid data leakage
        mofs = df["cif_name"].unique()
        np.random.seed(42)
        mofs = np.random.choice(mofs, min(args.max_samples, len(mofs)), replace=False)
        df   = df[df["cif_name"].isin(mofs)].reset_index(drop=True)
        logger.info(f"Subsampled to {len(df)} rows ({len(mofs)} MOFs)")

    # ── Overall stats ─────────────────────────────────────────────────────────
    print(f"\nDataset summary:")
    print(f"  MOFs:         {df['cif_name'].nunique()}")
    print(f"  Data points:  {len(df)}")
    print(f"  Pressures:    {sorted(df['pressure_bar'].unique())}")
    print(f"  Temperatures: {sorted(df['temperature'].unique())}")
    print(f"  Adsorption:   min={df['adsorption'].min():.2f}  "
          f"max={df['adsorption'].max():.2f}  mean={df['adsorption'].mean():.2f}")

    # ── Run inference ─────────────────────────────────────────────────────────
    df = run_inference(df, args.data_dir, args.checkpoint, args.dict, args.nthreads)

    os.makedirs(args.out_dir, exist_ok=True)
    df.to_csv(os.path.join(args.out_dir, "predictions.csv"), index=False, float_format="%.4f")
    logger.info(f"Saved all predictions → {args.out_dir}/predictions.csv")

    # ── Overall metrics ───────────────────────────────────────────────────────
    m_all = compute_metrics(df["adsorption"].values, df["predicted"].values)
    print_metrics("CoRE MOF — Overall (zero-shot transfer from Tobacco)", m_all)

    # ── Per-pressure metrics ──────────────────────────────────────────────────
    print("\n── Per-pressure breakdown ─────────────────────────────────────")
    for p, sub in df.groupby("pressure_bar"):
        m = compute_metrics(sub["adsorption"].values, sub["predicted"].values)
        print(f"  P={p:8.2f} bar  N={m['N']:5d}  R²={m['R2']:.4f}  "
              f"MAE={m['MAE']:.3f}  RMSE={m['RMSE']:.3f}")

    # ── Per-temperature metrics ───────────────────────────────────────────────
    if df["temperature"].nunique() > 1:
        print("\n── Per-temperature breakdown ──────────────────────────────────")
        for t, sub in df.groupby("temperature"):
            m = compute_metrics(sub["adsorption"].values, sub["predicted"].values)
            print(f"  T={t:6.1f} K  N={m['N']:5d}  R²={m['R2']:.4f}  "
                  f"MAE={m['MAE']:.3f}  RMSE={m['RMSE']:.3f}")

    # ── Failure case analysis ─────────────────────────────────────────────────
    failure_analysis(df, args.out_dir)

    print(f"\nAll outputs saved to: {args.out_dir}/")


if __name__ == "__main__":
    main()
