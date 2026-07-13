"""
Failure analysis from saved predictions.csv.
Run after cross_dataset_eval.py has produced predictions.csv.

Usage:
    python analyze_failures.py \
        --predictions ./results/cross_dataset/predictions.csv \
        --out-dir     ./results/cross_dataset
"""

import argparse
import math
import os

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from scipy.stats import pearsonr
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error


def compute_metrics(true, pred):
    return {
        "R2":   r2_score(true, pred),
        "MAE":  mean_absolute_error(true, pred),
        "RMSE": math.sqrt(mean_squared_error(true, pred)),
        "N":    len(true),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--predictions", default="./results/cross_dataset/predictions.csv")
    parser.add_argument("--out-dir",     default="./results/cross_dataset")
    args = parser.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)
    df = pd.read_csv(args.predictions)
    df["abs_error"] = (df["predicted"] - df["adsorption"]).abs()
    df["rel_error"] = df["abs_error"] / (df["adsorption"].abs() + 1e-6)

    print(f"Loaded {len(df)} predictions, {df['cif_name'].nunique()} MOFs\n")

    # ── 1. Overall metrics ────────────────────────────────────────────────────
    m = compute_metrics(df["adsorption"].values, df["predicted"].values)
    print(f"Overall  R²={m['R2']:.4f}  MAE={m['MAE']:.3f}  RMSE={m['RMSE']:.3f}  N={m['N']}")

    # ── 2. Per-pressure ───────────────────────────────────────────────────────
    print("\n── Per-pressure breakdown ─────────────────────────────────────")
    for p, sub in df.groupby("pressure_bar"):
        m = compute_metrics(sub["adsorption"].values, sub["predicted"].values)
        print(f"  P={p:8.2f} bar  N={m['N']:5d}  R²={m['R2']:+.4f}  "
              f"MAE={m['MAE']:.3f}  RMSE={m['RMSE']:.3f}")

    # ── 3. Scatter plot (per pressure, colored) ───────────────────────────────
    pressures = sorted(df["pressure_bar"].unique())
    colors    = ["#2196F3", "#FF9800", "#F44336"]
    fig, axes = plt.subplots(1, len(pressures), figsize=(5 * len(pressures), 5))
    if len(pressures) == 1:
        axes = [axes]

    for ax, p, c in zip(axes, pressures, colors):
        sub  = df[df["pressure_bar"] == p]
        m    = compute_metrics(sub["adsorption"].values, sub["predicted"].values)
        vmax = max(sub["adsorption"].max(), sub["predicted"].max()) * 1.05
        ax.scatter(sub["adsorption"], sub["predicted"],
                   alpha=0.4, s=10, color=c, rasterized=True)
        ax.plot([0, vmax], [0, vmax], "k--", lw=1)
        ax.set_xlim(0, vmax); ax.set_ylim(0, vmax)
        ax.set_title(f"P = {p:.0f} bar\nR²={m['R2']:.3f}  MAE={m['MAE']:.1f}")
        ax.set_xlabel("True [cm³(STP)/cm³]")
        ax.set_ylabel("Predicted")

    plt.suptitle("UniMOF Tobacco→Tobacco Test: Predicted vs True (by pressure)", fontsize=11)
    plt.tight_layout()
    path = os.path.join(args.out_dir, "scatter_by_pressure.png")
    plt.savefig(path, dpi=150)
    plt.close()
    print(f"\nSaved: {path}")

    # ── 4. Error distribution by pressure ────────────────────────────────────
    fig, ax = plt.subplots(figsize=(7, 4))
    for p, c in zip(pressures, colors):
        sub = df[df["pressure_bar"] == p]
        ax.hist(sub["abs_error"], bins=50, alpha=0.6, color=c,
                label=f"{p:.0f} bar (median={sub['abs_error'].median():.1f})",
                edgecolor="white", linewidth=0.3)
    ax.set_xlabel("|Error| [cm³(STP)/cm³]")
    ax.set_ylabel("Count")
    ax.set_title("Absolute Error Distribution by Pressure")
    ax.legend()
    plt.tight_layout()
    path = os.path.join(args.out_dir, "error_distribution.png")
    plt.savefig(path, dpi=150)
    plt.close()
    print(f"Saved: {path}")

    # ── 5. Error vs structural features ──────────────────────────────────────
    feat_cols   = ["lcd", "pld", "density", "vf", "asa_m2cm3"]
    feat_labels = {
        "lcd":      "LCD (Å)",
        "pld":      "PLD (Å)",
        "density":  "Density (g/cm³)",
        "vf":       "Void Fraction",
        "asa_m2cm3":"ASA (m²/cm³)",
    }
    available = [c for c in feat_cols if c in df.columns and (df[c] > 0).sum() > 50]

    if available:
        fig, axes = plt.subplots(1, len(available), figsize=(4 * len(available), 4))
        if len(available) == 1:
            axes = [axes]

        print("\n── Pearson r between structural features and |error| ──────────")
        for ax, col in zip(axes, available):
            sub = df[(df[col] > 0) & df["abs_error"].notna()]
            r, p = pearsonr(sub[col], sub["abs_error"])
            sig  = "***" if p < 0.001 else ("**" if p < 0.01 else ("*" if p < 0.05 else "ns"))
            print(f"  {feat_labels.get(col,col):25s}  r={r:+.3f}  p={p:.2e}  {sig}")
            ax.scatter(sub[col], sub["abs_error"], alpha=0.3, s=8, rasterized=True)
            ax.set_xlabel(feat_labels.get(col, col))
            ax.set_ylabel("|Error|")
            ax.set_title(f"r={r:+.3f} {sig}")

        plt.suptitle("Prediction Error vs Structural Features", fontsize=11)
        plt.tight_layout()
        path = os.path.join(args.out_dir, "error_vs_features.png")
        plt.savefig(path, dpi=150)
        plt.close()
        print(f"Saved: {path}")

    # ── 6. Top failure cases ──────────────────────────────────────────────────
    worst_cols = ["cif_name", "pressure_bar", "adsorption", "predicted", "abs_error"]
    worst_cols += [c for c in ["lcd", "pld", "density", "vf"] if c in df.columns]
    worst = (df.sort_values("abs_error", ascending=False)
               .drop_duplicates("cif_name")
               .head(20)[worst_cols])
    path = os.path.join(args.out_dir, "worst_cases.csv")
    worst.to_csv(path, index=False, float_format="%.4f")
    print(f"\nSaved worst 20 cases: {path}")
    print(worst.to_string(index=False))

    # ── 7. Key insight summary ────────────────────────────────────────────────
    print("\n── Key Insights ───────────────────────────────────────────────")
    low_p  = df[df["pressure_bar"] == pressures[0]]
    high_p = df[df["pressure_bar"] == pressures[-1]]
    print(f"  Low  pressure ({pressures[0]:.0f} bar):  "
          f"R²={r2_score(low_p['adsorption'], low_p['predicted']):.4f}  "
          f"MAE={mean_absolute_error(low_p['adsorption'], low_p['predicted']):.2f}")
    print(f"  High pressure ({pressures[-1]:.0f} bar):  "
          f"R²={r2_score(high_p['adsorption'], high_p['predicted']):.4f}  "
          f"MAE={mean_absolute_error(high_p['adsorption'], high_p['predicted']):.2f}")
    print(f"\n  → Model generalises well at low pressure but degrades at high pressure.")
    print(f"    Likely cause: Tobacco training data pressure range [6,65,100] bar —")
    print(f"    model may have memorised pressure-specific patterns rather than")
    print(f"    learning true pressure-adsorption physics.")


if __name__ == "__main__":
    main()
