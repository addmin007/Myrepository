import matplotlib.pyplot as plt
import matplotlib.patches as patches

# ========== 解决中文乱码、消除字形警告核心配置 ==========
plt.rcParams["font.family"] = ["PingFang SC"]  # Mac 苹方，Windows替换 SimHei
plt.rcParams["axes.unicode_minus"] = False     # 负号正常显示
plt.rcParams["font.size"] = 9

# 创建画布
fig, ax = plt.subplots(figsize=(16, 22), dpi=100)
ax.set_xlim(0, 100)
ax.set_ylim(0, 120)
ax.axis("off")

# 配色定义
COLOR_INPUT = "#cce5ff"
COLOR_PREPROC = "#e6f2ff"
COLOR_BACKBONE = "#d9e6ff"
COLOR_FUSION = "#e6e6ff"
COLOR_LORA = "#fff2cc"
COLOR_LOSS = "#ffdddd"
TEXT_COLOR = "#000000"

def draw_box(x0, y0, w, h, fill_color, text_list, fontsize=9):
    """绘制模块框+内部文字"""
    rect = patches.Rectangle((x0, y0), w, h, linewidth=1.2, edgecolor="black", facecolor=fill_color)
    ax.add_patch(rect)
    line_h = h / (len(text_list)+1)
    for i, txt in enumerate(text_list):
        ax.text(x0 + w/2, y0 + line_h*(i+1), txt, ha="center", va="center", fontsize=fontsize, color=TEXT_COLOR)

def draw_arrow(x1, y1, x2, y2):
    """绘制箭头连线"""
    ax.annotate("", xy=(x2, y2), xytext=(x1, y1), arrowprops=dict(arrowstyle="->", lw=1.2))

# ===================== 1. 标题 =====================
ax.text(50, 116, "Uni-MOF V2 完整模型架构", fontsize=16, ha="center", weight="bold")

# ===================== 2. 输入层 =====================
y_in = 102
# 四个输入框
draw_box(5, y_in, 18, 12, COLOR_INPUT, [
    "MOF结构", "CIF原子坐标"
])
draw_box(28, y_in, 18, 12, COLOR_INPUT, [
    "气体信息", "Gas ID+属性"
])
draw_box(51, y_in, 18, 12, COLOR_INPUT, [
    "环境工况", "压力P / 温度T"
])
draw_box(74, y_in, 18, 12, COLOR_INPUT, [
    "孔隙特征", "Void Frac / SA/Vol"
])
# 汇总箭头到预处理
draw_arrow(14, y_in, 40, 98)
draw_arrow(37, y_in, 45, 98)
draw_arrow(60, y_in, 50, 98)
draw_arrow(83, y_in, 55, 98)

# ===================== 3. 预处理流水线 =====================
y_pre = 84
pre_text = [
    "数据预处理 Pipeline",
    "1.去氢 2.截断≤512原子 3.坐标归一",
    "4.原子Token编码 5.距离矩阵",
    "6.原子对类型编码 7.CLS标记 8.Padding",
    "输出: src_tokens, src_distance, src_edge_type"
]
draw_box(20, y_pre, 60, 14, COLOR_PREPROC, pre_text)
draw_arrow(50, y_pre, 50, 78)

# ===================== 4. UniMatModel 主干网络 =====================
y_back = 62
back_text = [
    "Layer1: UniMatModel (Backbone, 26.7M)",
    "嵌入层: 原子嵌入512维 + 距离高斯偏置",
    "8层 TransformerEncoderWithPair",
    "单层: LN → 64头自注意力+距离偏置 → 残差",
    "      LN → FFN(512→2048→512) → 残差",
    "输出: CLS全局表征 [B, 512]"
]
draw_box(20, y_back, 60, 14, COLOR_BACKBONE, back_text)
draw_arrow(50, y_back, 50, 56)

# ===================== 5. UniMOFV2Model 多模态融合 =====================
y_fuse = 40
fuse_text = [
    "Layer2: UniMOFV2Model (27.4M)",
    "分支1: MOF主干特征 [B,512]",
    "分支2: GasModel → [B,256]",
    "分支3: EnvModel温压嵌入 → [B,384]",
    "分支4: 孔隙特征MLP → [B,128]",
    "Concat融合 [B,1280] → MLP回归头 → 吸附量预测"
]
draw_box(20, y_fuse, 60, 14, COLOR_FUSION, fuse_text)
draw_arrow(50, y_fuse, 50, 34)

# ===================== 6. LoRA微调分支 UniMOF1barModel =====================
y_lora = 22
lora_text = [
    "Layer3: UniMOF1barModel (LoRA微调)",
    "主干冻结, LoRA rank=4, α=32",
    "可训练参数仅171K (1.9%)",
    "新增孔隙MLP分支 + 轻量化融合预测头"
]
draw_box(20, y_lora, 60, 10, COLOR_LORA, lora_text)
draw_arrow(50, y_lora, 50, 16)

# ===================== 7. 损失函数 & 输出 =====================
y_loss = 6
loss_text = [
    "损失: MOFV2MSELoss",
    "MSE + 0.1×吸附单调性物理约束",
    "最终输出: 气体吸附容量 (cm³/g)"
]
draw_box(30, y_loss, 40, 8, COLOR_LOSS, loss_text)

plt.tight_layout()
plt.savefig("UniMOF_V2_Architecture.png", bbox_inches="tight")
plt.show()
