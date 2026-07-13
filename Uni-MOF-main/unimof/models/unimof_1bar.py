"""
unimof/models/unimof_1bar.py

1-bar 专用 MOF 吸附量预测模型。

架构：
  Frozen UniMOF Backbone (Tobacco 预训练, 提取 512-dim CLS)
    + LoRA Adapter on in_proj & out_proj (rank=4, ~66K 可训练参数)
    + 修复后的 Structure Feature MLP (8-dim → 128-dim)
      [lcd, pld, lfpd, density, asa_m2cm3, asa_m2g, vf, pv]
    + Gas/Env Embed (继承原始, 冻结)
    + Fusion Head: (512+256+384+128) → 256 → 128 → 1

总可训练参数 ≈ 66K (LoRA) + 5K (struct MLP) + 100K (fusion head) ≈ 171K
远少于 972 × 200 = 194K 安全上限，足以防止过拟合。
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F
from unicore import utils
from unicore.models import BaseUnicoreModel, register_model, register_model_architecture
from .unimof_v2 import (
    UniMatModel, GasModel, EnvModel, StructureFeatureModel,
    ClassificationHead, NonLinearHead, MIN_MAX_KEY, base_architecture
)


# ─────────────────────────────────────────────────────────────────────
# LoRA 层：在已有 Linear 旁边并联一个低秩分支
# ─────────────────────────────────────────────────────────────────────
class LoRALinear(nn.Module):
    """
    替换或包裹一个 nn.Linear，增加 LoRA 分支。
    out = W0 @ x + scale * B @ A @ x
    A: [rank, in_features]  B: [out_features, rank]
    """
    def __init__(self, original_linear: nn.Linear, rank: int = 4, alpha: float = 32.0):
        super().__init__()
        self.original = original_linear   # 原始权重，将被冻结
        in_features  = original_linear.weight.shape[1]
        out_features = original_linear.weight.shape[0]
        self.rank  = rank
        self.scale = alpha / rank
        # LoRA 矩阵
        self.lora_A = nn.Parameter(torch.zeros(rank, in_features))
        self.lora_B = nn.Parameter(torch.zeros(out_features, rank))
        # A 用 kaiming 初始化，B 初始化为 0（确保训练开始时 LoRA 输出为 0）
        nn.init.kaiming_uniform_(self.lora_A, a=math.sqrt(5))
        nn.init.zeros_(self.lora_B)
        # 冻结原始权重
        self.original.weight.requires_grad_(False)
        if self.original.bias is not None:
            self.original.bias.requires_grad_(False)

    def forward(self, x):
        base_out = self.original(x)
        lora_out = (x @ self.lora_A.T) @ self.lora_B.T
        return base_out + self.scale * lora_out


def apply_lora_to_attention(model, rank=4, alpha=32.0):
    """
    对 UniMOF encoder 所有 attention 层的 in_proj 和 out_proj 加 LoRA。
    in_proj: Linear(512 -> 1536) Q+K+V merged
    out_proj: Linear(512 -> 512)
    """
    replaced = 0
    for layer_idx in range(len(model.unimat.encoder.layers)):
        layer = model.unimat.encoder.layers[layer_idx]
        attn = layer.self_attn
        attn.in_proj  = LoRALinear(attn.in_proj,  rank=rank, alpha=alpha)
        attn.out_proj = LoRALinear(attn.out_proj, rank=rank, alpha=alpha)
        replaced += 2

    trainable = sum(p.numel() for name, p in model.named_parameters()
                    if 'lora_A' in name or 'lora_B' in name)
    print("[LoRA] Applied to %d attention projections, trainable LoRA params: %d" % (replaced, trainable))
    return trainable


# ─────────────────────────────────────────────────────────────────────
# 增强版 Structure Feature MLP：8-dim 输入（含 density 和 PV）
# ─────────────────────────────────────────────────────────────────────
class StructureFeatureMLP(nn.Module):
    """
    输入 8 维结构特征：[lcd, pld, lfpd, density, asa_m2cm3, asa_m2g, vf, pv_cm3g]
    输出 hidden_dim 维嵌入。
    使用 LayerNorm（对 fp16 友好，小 batch 下比 BatchNorm 稳定）。
    """
    def __init__(self, input_dim=8, hidden_dim=128):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.LayerNorm(hidden_dim),
            nn.GELU(),
            nn.Dropout(0.1),
            nn.Linear(hidden_dim, hidden_dim),
            nn.LayerNorm(hidden_dim),
            nn.GELU(),
        )

    def forward(self, x):
        return self.net(x)


# ─────────────────────────────────────────────────────────────────────
# 融合头：Dropout → Linear → GELU → Dropout → Linear → 1
# ─────────────────────────────────────────────────────────────────────
class FusionHead(nn.Module):
    def __init__(self, input_dim, hidden_dim=256, pooler_dropout=0.2):
        super().__init__()
        self.net = nn.Sequential(
            nn.Dropout(pooler_dropout),
            nn.Linear(input_dim, hidden_dim),
            nn.GELU(),
            nn.Dropout(pooler_dropout),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.GELU(),
            nn.Dropout(pooler_dropout * 0.5),
            nn.Linear(hidden_dim // 2, 1),
        )

    def forward(self, x):
        return self.net(x)


# ─────────────────────────────────────────────────────────────────────
# 主模型
# ─────────────────────────────────────────────────────────────────────
@register_model("unimof_1bar")
class UniMOF1barModel(BaseUnicoreModel):
    """
    1-bar 专用 MOF 吸附量预测模型。
    Frozen UniMOF backbone + LoRA adapter + 增强结构特征 + 融合回归头。
    """

    @staticmethod
    def add_args(parser):
        parser.add_argument("--lora-rank",     type=int,   default=4)
        parser.add_argument("--lora-alpha",    type=float, default=32.0)
        parser.add_argument("--struct-dim",    type=int,   default=8,
                            help="structure feature dim (8 when density+PV are included)")
        parser.add_argument("--fusion-hidden", type=int,   default=256)
        parser.add_argument("--pooler-dropout", type=float, default=0.2)
        # 继承 backbone args
        parser.add_argument("--encoder-layers",        type=int,   default=8)
        parser.add_argument("--encoder-embed-dim",     type=int,   default=512)
        parser.add_argument("--encoder-ffn-embed-dim", type=int,   default=2048)
        parser.add_argument("--encoder-attention-heads", type=int, default=64)
        parser.add_argument("--dropout",           type=float, default=0.0)
        parser.add_argument("--emb-dropout",       type=float, default=0.0)
        parser.add_argument("--attention-dropout", type=float, default=0.0)
        parser.add_argument("--activation-dropout",type=float, default=0.0)
        parser.add_argument("--max-seq-len",       type=int,   default=1024)
        parser.add_argument("--activation-fn",     type=str,   default="gelu")
        parser.add_argument("--post-ln",           action="store_true", default=False)
        parser.add_argument("--masked-token-loss", type=float, default=-1.)
        parser.add_argument("--masked-coord-loss", type=float, default=-1.)
        parser.add_argument("--masked-dist-loss",  type=float, default=-1.)
        parser.add_argument("--x-norm-loss",       type=float, default=-1.)
        parser.add_argument("--delta-pair-repr-norm-loss", type=float, default=-1.)
        parser.add_argument("--lattice-loss",      type=float, default=-1.)
        parser.add_argument("--gas-attr-input-dim",type=int,   default=4)
        parser.add_argument("--hidden-dim",        type=int,   default=128)
        parser.add_argument("--bins",              type=int,   default=32)
        parser.add_argument("--gas-dim",           type=int,   default=128)
        parser.add_argument("--pooler-activation-fn", type=str, default="tanh")
        parser.add_argument("--num-classes",       type=int,   default=1)
        parser.add_argument("--max-atoms",         type=int,   default=512)
        parser.add_argument("--remove-hydrogen",   action="store_true", default=False)
        parser.add_argument("--mono-loss-weight",  type=float, default=0.0)
        parser.add_argument("--mc-dropout-samples", type=int,  default=0)
        parser.add_argument("--structure-feature-dim", type=int, default=8)
        parser.add_argument("--classification-head-name", type=str, default="classification")
        parser.add_argument("--finetune-mol-model", type=str,  default=None)
        parser.add_argument("--l2sp-weight",       type=float, default=0.0)
        parser.add_argument("--l2sp-anchor-ckpt",  type=str,   default=None)

    def __init__(self, args, dictionary):
        super().__init__()
        self.args = args
        self.args.structure_feature_dim = 7  # backbone 仍用 7 维（兼容预训练权重）

        # ── Backbone（全部冻结，除 LoRA 权重）─────────────────────────
        self.unimat         = UniMatModel(args, dictionary)
        self.min_max_key    = MIN_MAX_KEY[args.task_name]
        self.gas_embed      = GasModel(args.gas_attr_input_dim, args.hidden_dim)
        self.env_embed      = EnvModel(args.hidden_dim, args.bins, self.min_max_key)
        self.structure_embed = StructureFeatureModel(7, args.hidden_dim)  # 原始 7 维

        # ── 新增：增强结构特征 MLP（8 维含 density+PV）───────────────
        struct_dim = getattr(args, 'struct_dim', 8)
        self.struct_mlp = StructureFeatureMLP(struct_dim, args.hidden_dim)

        # ── 融合回归头─────────────────────────────────────────────────
        # 输入: cls(512) + gas(256) + env(384) + struct_orig(128) + struct_new(128) = 1408
        backbone_dim = (args.encoder_embed_dim
                        + args.hidden_dim * 2    # gas
                        + args.hidden_dim * 3    # env
                        + args.hidden_dim        # struct_orig
                        + args.hidden_dim)       # struct_new
        fusion_hidden = getattr(args, 'fusion_hidden', 256)
        pooler_dropout = getattr(args, 'pooler_dropout', 0.2)
        self.fusion_head = FusionHead(backbone_dim, fusion_hidden, pooler_dropout)

        # ── 冻结所有 backbone 参数 ────────────────────────────────────
        self._freeze_backbone()

        # ── 应用 LoRA ─────────────────────────────────────────────────
        lora_rank  = getattr(args, 'lora_rank', 4)
        lora_alpha = getattr(args, 'lora_alpha', 32.0)
        apply_lora_to_attention(self, rank=lora_rank, alpha=lora_alpha)

        # 统计
        total     = sum(p.numel() for p in self.parameters())
        trainable = sum(p.numel() for p in self.parameters() if p.requires_grad)
        print(f"[UniMOF1bar] Total params: {total:,} | Trainable: {trainable:,} "
              f"({100*trainable/total:.1f}%)")

    def _freeze_backbone(self):
        """冻结 backbone（unimat, gas_embed, env_embed, structure_embed）。
        fusion_head, struct_mlp 和 LoRA 权重保持可训练。"""
        for name, param in self.named_parameters():
            if any(m in name for m in ['fusion_head', 'struct_mlp', 'lora_A', 'lora_B']):
                param.requires_grad_(True)
            else:
                param.requires_grad_(False)

    @classmethod
    def build_model(cls, args, task):
        model = cls(args, task.dictionary)
        # 加载预训练权重
        pretrain_path = getattr(args, 'finetune_mol_model', None)
        if pretrain_path:
            from unicore import checkpoint_utils
            state = checkpoint_utils.load_checkpoint_to_cpu(pretrain_path)
            model_state = state.get('model', state)
            missing, unexpected = model.load_state_dict(model_state, strict=False)
            # 只报告 backbone 部分的 missing keys
            backbone_missing = [k for k in missing if not any(
                m in k for m in ['fusion_head', 'struct_mlp', 'lora_A', 'lora_B'])]
            print(f"[UniMOF1bar] Loaded pretrain from {pretrain_path}")
            print(f"  backbone missing: {len(backbone_missing)}, unexpected: {len(unexpected)}")
            # 重新冻结（load_state_dict 会重置 requires_grad）
            model._freeze_backbone()
            # LoRA 权重重新应用（已在 __init__ 中初始化，这里不需要重复）
        return model

    def forward(
        self,
        gas,
        gas_attr,
        pressure,
        temperature,
        src_tokens,
        src_distance,
        src_coord,
        src_edge_type,
        structure_features=None,   # 7-dim（原始格式，含 density 已修复）
        structure_features_ext=None,  # 8-dim（含 pv_cm3g，可选）
        encoder_masked_tokens=None,
        **kwargs
    ):
        # ── Backbone forward（含 LoRA）────────────────────────────────
        def get_dist_features(dist, et):
            n_node = dist.size(-1)
            gbf_feature = self.unimat.gbf(dist, et)
            gbf_result  = self.unimat.gbf_proj(gbf_feature)
            graph_attn_bias = gbf_result.permute(0, 3, 1, 2).contiguous()
            graph_attn_bias = graph_attn_bias.view(-1, n_node, n_node)
            return graph_attn_bias

        padding_mask   = src_tokens.eq(self.unimat.padding_idx)
        mol_x          = self.unimat.embed_tokens(src_tokens)
        graph_attn_bias = get_dist_features(src_distance, src_edge_type)
        encoder_outputs = self.unimat.encoder(mol_x, padding_mask=padding_mask,
                                               attn_mask=graph_attn_bias)
        cls_repr = encoder_outputs[0][:, 0, :]   # [B, 512]

        gas_embed   = self.gas_embed(gas, gas_attr)      # [B, 256]
        env_embed   = self.env_embed(pressure, temperature)  # [B, 384]
        struct_orig = self.structure_embed(structure_features)  # [B, 128]

        # ── 增强结构特征（type_as 自动匹配模型 dtype，避免 fp16/fp32 冲突）─
        ref_weight = self.struct_mlp.net[0].weight  # 参考权重，用于 type_as
        if structure_features_ext is not None:
            struct_ext = self.struct_mlp(
                structure_features_ext.type_as(ref_weight))   # [B, 128]
        else:
            sf_ext = torch.cat([structure_features,
                                 structure_features[:, 3:4]], dim=-1)
            struct_ext = self.struct_mlp(sf_ext.type_as(ref_weight))

        # ── 融合 ──────────────────────────────────────────────────────
        rep    = torch.cat([cls_repr, gas_embed, env_embed, struct_orig, struct_ext], dim=-1)
        logits = self.fusion_head(rep)

        return [logits]

    def set_num_updates(self, num_updates):
        self._num_updates = num_updates

    def get_num_updates(self):
        return self._num_updates


@register_model_architecture("unimof_1bar", "unimof_1bar")
def unimof_1bar_architecture(args):
    base_architecture(args)
    args.lora_rank      = getattr(args, "lora_rank",      4)
    args.lora_alpha     = getattr(args, "lora_alpha",     32.0)
    args.struct_dim     = getattr(args, "struct_dim",     8)
    args.fusion_hidden  = getattr(args, "fusion_hidden",  256)
    args.pooler_dropout = getattr(args, "pooler_dropout", 0.2)
    args.structure_feature_dim = 8  # 新模型使用 8 维
