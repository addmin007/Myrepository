#!/usr/bin/env bash
# auto_backup.sh  ── 每 25 分钟把 checkpoint_best.pt / checkpoint_last.pt
# 拷贝到 /root/checkpoints_backup/ 并加时间戳，防止服务器到期丢失。
# 用法：screen -dmS backup bash /root/Uni-MOF-main/auto_backup.sh

SAVE_DIR="/root/Uni-MOF-main/results/Tobacco_CH4_v2"
BACKUP_DIR="/root/checkpoints_backup"
INTERVAL=1500   # 25 分钟

mkdir -p "$BACKUP_DIR"

echo "[backup] Started at $(date '+%Y-%m-%d %H:%M:%S'). Interval=${INTERVAL}s."

while true; do
    TS=$(date '+%Y%m%d_%H%M%S')

    for CKPT in checkpoint_best.pt checkpoint_last.pt; do
        SRC="${SAVE_DIR}/${CKPT}"
        if [ -f "$SRC" ]; then
            DST="${BACKUP_DIR}/${CKPT%.pt}_${TS}.pt"
            cp "$SRC" "$DST"
            SIZE=$(du -sh "$DST" | cut -f1)
            echo "[backup] ${TS}  ${CKPT} → $(basename $DST)  (${SIZE})"
        fi
    done

    # 只保留最近 6 份备份（best×6 + last×6）
    for PREFIX in checkpoint_best checkpoint_last; do
        ls -t "${BACKUP_DIR}/${PREFIX}_"*.pt 2>/dev/null | tail -n +7 | xargs -r rm -f
    done

    sleep "$INTERVAL"
done
