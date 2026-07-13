#!/usr/bin/env bash
# run_finetune_1bar_lora.sh
# 1-bar 专用模型训练：Frozen Backbone + LoRA + 增强结构特征 + 融合头
# 可训练参数：~510K，数据：972 train / 53 valid / 53 test

set -euo pipefail

data_path="./lmdb_s1_fixed"
save_dir="./results/S1_1bar_lora"
pretrain_ckpt="./results/Tobacco_CH4_v2/checkpoint_best.pt"
task_name="S1_CH4_1bar_fixed"
n_gpu=1
MASTER_PORT=10091

# 超参：小学习率（backbone 已冻结，主要训练新增头）
lr=1e-3          # 头部学习率，LoRA 用相同 lr 足够
batch_size=32    # 972/32 = 30 steps/epoch
update_freq=1
epoch=80         # 早停靠 valid_r2 控制
warmup=0.1       # 8 个 epoch 的 warmup
weight_decay=1e-2  # 强 L2，防止 fusion head 过拟合
pooler_dropout=0.2
lora_rank=4
lora_alpha=32.0
fusion_hidden=256
struct_dim=8
max_atoms=512

# steps_per_epoch = ceil(972/32) = 31
# total_num_update = 31 * 80 = 2480
total_num_update=2480

echo "=========================================="
echo " UniMOF 1-bar LoRA Fine-tuning"
echo "  data: ${data_path}"
echo "  pretrain: ${pretrain_ckpt}"
echo "  trainable: ~510K / 26.7M (1.9%)"
echo "  lr=${lr}, epoch=${epoch}, wd=${weight_decay}"
echo "  lora_rank=${lora_rank}, fusion_hidden=${fusion_hidden}"
echo "=========================================="

mkdir -p "${save_dir}"
export OMP_NUM_THREADS=4
export PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
export UNICORE_SAVE_DIR="${save_dir}"

/home/vipuser/miniconda3/bin/torchrun \
    --nproc_per_node=${n_gpu} \
    --master_port=${MASTER_PORT} \
    /home/vipuser/miniconda3/bin/unicore-train "${data_path}" \
    --user-dir ./unimof \
    --task-name "${task_name}" \
    --train-subset train \
    --valid-subset valid,test \
    --num-workers 4 \
    --ddp-backend=c10d \
    --task unimof_1bar \
    --loss mof_v2_mse \
    --arch unimof_1bar \
    --optimizer adam \
    --adam-betas '(0.9, 0.999)' \
    --adam-eps 1e-8 \
    --clip-norm 1.0 \
    --weight-decay ${weight_decay} \
    --lr-scheduler polynomial_decay \
    --lr ${lr} \
    --warmup-ratio ${warmup} \
    --total-num-update ${total_num_update} \
    --max-epoch ${epoch} \
    --batch-size ${batch_size} \
    --update-freq ${update_freq} \
    --seed 42 \
    --max-atoms ${max_atoms} \
    --num-classes 1 \
    --pooler-dropout ${pooler_dropout} \
    --dropout 0.0 \
    --emb-dropout 0.0 \
    --attention-dropout 0.0 \
    --activation-dropout 0.0 \
    --gas-attr-input-dim 4 \
    --mono-loss-weight 0.0 \
    --lora-rank ${lora_rank} \
    --lora-alpha ${lora_alpha} \
    --struct-dim ${struct_dim} \
    --fusion-hidden ${fusion_hidden} \
    --finetune-mol-model "${pretrain_ckpt}" \
    --fp16 \
    --log-interval 5 \
    --log-format simple \
    --validate-interval 1 \
    --validate-interval-updates 0 \
    --remove-hydrogen \
    --save-interval 1 \
    --save-interval-updates 0 \
    --keep-interval-updates 0 \
    --keep-last-epochs 3 \
    --keep-best-checkpoints 3 \
    --save-dir "${save_dir}" \
    --best-checkpoint-metric valid_r2 \
    --maximize-best-checkpoint-metric

echo "Training finished. Best model: ${save_dir}/checkpoint_best.pt"
