#!/usr/bin/env bash
# Training script for Tobacco_CH4 methane adsorption prediction (v2 with physics prior)
# Optimized for 2x NVIDIA A800-SXM4-40GB
#
#   Optimizations:
#       1. bf16 instead of fp16 (A800 native BF16, no loss scaling, no overflow)
#       2. batch_size=20 (vs 16), squeezes more VRAM utilization safely
#       3. num_workers=8 (CPU has 16 cores, avoid oversubscription)
#       4. OMP_NUM_THREADS=2 (leave headroom for DDP and data workers)
#       5. LMDB readahead to warm OS page cache
#       6. total_num_update recalculated for new batch size

set -euo pipefail

data_path="./lmdb_output_v2"
save_dir="./results/Tobacco_CH4_v2"
weight_path="./weights/unimof_pretrain_best.pt"
task_name="Tobacco_CH4"
num_classes=1
n_gpu=2
MASTER_PORT=10087
lr=1e-4
batch_size=20
update_freq=1    # effective batch = 20 * 2 = 40
epoch=100
dropout=0.1
warmup=0.1

# steps_per_epoch = ceil(75471 / (20*2)) = 1887
# total_num_update = 1887 * 100 = 188700
total_num_update=188700

global_batch_size=$(( batch_size * n_gpu * update_freq ))
echo "Effective batch size: ${global_batch_size}"

mkdir -p "${save_dir}"
export TORCH_NCCL_ASYNC_ERROR_HANDLING=1
export OMP_NUM_THREADS=2
export UNICORE_SAVE_DIR="${save_dir}"

# Warm LMDB files into OS page cache to eliminate disk IO during training
vmtouch -t "${data_path}/Tobacco_CH4/train.lmdb" 2>/dev/null || \
  dd if="${data_path}/Tobacco_CH4/train.lmdb" of=/dev/null bs=4M 2>/dev/null &
wait

/home/vipuser/miniconda3/bin/torchrun \
    --nproc_per_node=${n_gpu} \
    --master_port=${MASTER_PORT} \
    /home/vipuser/miniconda3/bin/unicore-train "${data_path}" \
    --user-dir ./unimof \
    --task-name "${task_name}" \
    --train-subset train \
    --valid-subset valid,test \
    --num-workers 8 \
    --ddp-backend=c10d \
    --task unimof_v2 \
    --loss mof_v2_mse \
    --arch unimof_v2 \
    --optimizer adam \
    --adam-betas '(0.9, 0.99)' \
    --adam-eps 1e-6 \
    --clip-norm 1.0 \
    --lr-scheduler polynomial_decay \
    --lr ${lr} \
    --warmup-ratio ${warmup} \
    --total-num-update ${total_num_update} \
    --max-epoch ${epoch} \
    --batch-size ${batch_size} \
    --update-freq ${update_freq} \
    --seed 42 \
    --bf16 \
    --num-classes ${num_classes} \
    --pooler-dropout ${dropout} \
    --gas-attr-input-dim 4 \
    --mono-loss-weight 0.1 \
    --finetune-mol-model "${weight_path}" \
    --log-interval 50 \
    --log-format simple \
    --validate-interval 1 \
    --validate-interval-updates 0 \
    --remove-hydrogen \
    --save-interval 1 \
    --save-interval-updates 0 \
    --keep-interval-updates 0 \
    --keep-last-epochs 2 \
    --keep-best-checkpoints 3 \
    --save-dir "${save_dir}" \
    --best-checkpoint-metric valid_r2 \
    --maximize-best-checkpoint-metric

echo "Training finished."
