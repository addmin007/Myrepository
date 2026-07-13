#!/usr/bin/env python3
"""
parse_training_log.py  ──  把 unicore 训练日志解析成结构化 CSV + 终端汇总表。

用法：
    python parse_training_log.py /root/train_v2.log
    python parse_training_log.py /root/train_v2.log --out /root/training_curve.csv
"""
import re
import sys
import csv
import argparse
from pathlib import Path

# ── 正则匹配 ─────────────────────────────────────────────────────────────────
RE_VALID = re.compile(
    r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}).*?'
    r'epoch (\d+).*?valid on \'valid\' subset.*?'
    r'loss ([\d.]+).*?valid_r2 ([\d.]+).*?'
    r'num_updates (\d+)'
)
RE_TEST = re.compile(
    r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}).*?'
    r'epoch (\d+).*?valid on \'test\' subset.*?'
    r'loss ([\d.]+).*?test_r2 ([\d.]+)'
)
RE_TRAIN = re.compile(
    r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}).*?'
    r'train \| epoch (\d+).*?'
    r'loss ([\d.]+).*?'
    r'lr ([\d.e+-]+).*?'
    r'gnorm ([\d.]+).*?'
    r'clip ([\d.]+)'
)


def parse_log(log_path: str):
    text = Path(log_path).read_text(errors="replace")

    valid_by_epoch = {}
    for m in RE_VALID.finditer(text):
        ts, ep, loss, r2, upd = m.groups()
        valid_by_epoch[int(ep)] = {
            "epoch": int(ep),
            "timestamp": ts,
            "valid_loss": float(loss),
            "valid_r2": float(r2),
            "num_updates": int(upd),
        }

    for m in RE_TEST.finditer(text):
        ts, ep, loss, r2 = m.groups()
        ep = int(ep)
        if ep in valid_by_epoch:
            valid_by_epoch[ep]["test_loss"] = float(loss)
            valid_by_epoch[ep]["test_r2"] = float(r2)

    for m in RE_TRAIN.finditer(text):
        ts, ep, loss, lr, gnorm, clip = m.groups()
        ep = int(ep)
        if ep in valid_by_epoch:
            valid_by_epoch[ep].setdefault("train_loss", float(loss))
            valid_by_epoch[ep].setdefault("lr", float(lr))
            valid_by_epoch[ep].setdefault("grad_norm", float(gnorm))
            valid_by_epoch[ep].setdefault("grad_clip_pct", float(clip))

    return sorted(valid_by_epoch.values(), key=lambda x: x["epoch"])


COLS = ["epoch", "timestamp", "num_updates", "lr",
        "train_loss", "valid_loss", "test_loss",
        "valid_r2", "test_r2", "grad_norm", "grad_clip_pct"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("log", help="Path to train_v2.log")
    parser.add_argument("--out", default=None, help="Output CSV path (default: same dir as log)")
    args = parser.parse_args()

    rows = parse_log(args.log)
    if not rows:
        print("No epoch results found in log.")
        sys.exit(1)

    out_path = args.out or str(Path(args.log).with_suffix(".csv"))

    with open(out_path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLS, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)

    print(f"Saved {len(rows)} epochs → {out_path}\n")

    # ── 终端打印汇总表 ─────────────────────────────────────────────────────
    best_r2 = max(r["valid_r2"] for r in rows)
    header = f"{'Epoch':>6}  {'Time':>19}  {'LR':>10}  {'TrainLoss':>10}  {'ValidLoss':>10}  {'ValidR2':>9}  {'TestR2':>9}"
    sep = "-" * len(header)
    print(header)
    print(sep)
    for r in rows:
        flag = " ◀ BEST" if r["valid_r2"] == best_r2 else ""
        lr_s = f"{r.get('lr', 0):.3e}"
        tl   = f"{r.get('train_loss', float('nan')):.4f}"
        vl   = f"{r.get('valid_loss', float('nan')):.4f}"
        print(f"{r['epoch']:>6}  {r['timestamp']:>19}  {lr_s:>10}  {tl:>10}  {vl:>10}  "
              f"{r['valid_r2']:>9.4f}  {r.get('test_r2', float('nan')):>9.4f}{flag}")
    print(sep)
    print(f"Best valid_r2 = {best_r2:.6f} @ epoch {max(rows, key=lambda r: r['valid_r2'])['epoch']}")


if __name__ == "__main__":
    main()
