import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from matplotlib.patches import FancyBboxPatch
import os

plt.rcParams['font.size'] = 11
plt.rcParams['axes.titlesize'] = 14
plt.rcParams['axes.labelsize'] = 12
plt.rcParams['figure.dpi'] = 150
plt.rcParams['savefig.dpi'] = 200
plt.rcParams['savefig.bbox'] = 'tight'
plt.rcParams['font.family'] = ['Arial Unicode MS', 'Heiti TC', 'Songti SC', 'DejaVu Sans']

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'statistics_figures')
os.makedirs(OUTPUT_DIR, exist_ok=True)

BASE = os.path.join(os.path.dirname(__file__), 'paper_data', 'inference')
TRAIN_DIR = os.path.join(os.path.dirname(__file__), 'paper_data', 'training')
UNI_DIR = os.path.join(os.path.dirname(__file__), 'Uni-MOF-main')

# ============================================================
# 图1: 训练曲线 (Loss + R²)
# ============================================================
def plot_training_curve():
    df = pd.read_csv(os.path.join(TRAIN_DIR, 'training_curve.csv'))

    fig, axes = plt.subplots(1, 2, figsize=(16, 6))

    # Loss curve
    ax1 = axes[0]
    ax1.plot(df['epoch'], df['train_loss'], 'o-', color='#2196F3', label='Train Loss', markersize=5, linewidth=2)
    ax1.plot(df['epoch'], df['valid_loss'], 's-', color='#FF9800', label='Valid Loss', markersize=5, linewidth=2)
    ax1.plot(df['epoch'], df['test_loss'], '^-', color='#4CAF50', label='Test Loss', markersize=5, linewidth=2)
    ax1.set_xlabel('Epoch')
    ax1.set_ylabel('Loss (MSE)')
    ax1.set_title('UniMOFV2 Training Loss Curve\n(Tobacco CH4, 75K samples, 2×A800)', fontweight='bold')
    ax1.legend(loc='upper right')
    ax1.grid(True, alpha=0.3)
    ax1.set_ylim(bottom=0)

    # R² curve
    ax2 = axes[1]
    ax2.plot(df['epoch'], df['valid_r2'], 's-', color='#FF9800', label='Valid R²', markersize=5, linewidth=2)
    ax2.plot(df['epoch'], df['test_r2'], '^-', color='#4CAF50', label='Test R²', markersize=5, linewidth=2)
    best_epoch = df.loc[df['valid_r2'].idxmax(), 'epoch']
    best_r2 = df['valid_r2'].max()
    ax2.axhline(y=best_r2, color='red', linestyle='--', alpha=0.5, label=f'Best Valid R²={best_r2:.4f} (ep{best_epoch})')
    ax2.set_xlabel('Epoch')
    ax2.set_ylabel('R²')
    ax2.set_title('UniMOFV2 R² Score During Training', fontweight='bold')
    ax2.legend(loc='lower right')
    ax2.grid(True, alpha=0.3)
    ax2.set_ylim(0.97, 1.0)

    plt.tight_layout()
    path = os.path.join(OUTPUT_DIR, 'fig1_training_curve.png')
    plt.savefig(path)
    plt.close()
    print(f"[SAVED] {path}")

# ============================================================
# 图2: V3推理 预测vs真实值散点图 + 误差分布
# ============================================================
def plot_v3_inference():
    df = pd.read_csv(os.path.join(BASE, 'inference_v3_test_clean.csv'))

    fig = plt.figure(figsize=(18, 12))
    gs = gridspec.GridSpec(2, 3, hspace=0.35, wspace=0.3)

    colors = {6.0: '#2196F3', 65.0: '#FF9800', 100.0: '#f44336'}
    pressures = [6.0, 65.0, 100.0]

    for i, p in enumerate(pressures):
        ax = fig.add_subplot(gs[0, i])
        sub = df[df['pressure_bar'] == p]
        ax.scatter(sub['target'], sub['pred'], alpha=0.4, s=15, c=colors[p], edgecolors='none')
        max_val = max(sub['target'].max(), sub['pred'].max())
        ax.plot([0, max_val], [0, max_val], 'k--', linewidth=1.5, alpha=0.7)
        r2 = 1 - np.sum((sub['pred'] - sub['target'])**2) / np.sum((sub['target'] - sub['target'].mean())**2)
        mae = sub['abs_error'].mean()
        rmse = np.sqrt(np.mean(sub['abs_error']**2))
        ax.set_xlabel('Target (cm³/g)')
        ax.set_ylabel('Predicted (cm³/g)')
        ax.set_title(f'{int(p)} bar  |  R²={r2:.4f}  MAE={mae:.2f}  RMSE={rmse:.2f}\n(n={len(sub)})', fontweight='bold')
        ax.grid(True, alpha=0.2)

    # Overall scatter
    ax_all = fig.add_subplot(gs[1, 0])
    ax_all.scatter(df['target'], df['pred'], alpha=0.3, s=8, c='#9C27B0', edgecolors='none')
    max_val = max(df['target'].max(), df['pred'].max())
    ax_all.plot([0, max_val], [0, max_val], 'k--', linewidth=1.5, alpha=0.7)
    r2 = 1 - np.sum((df['pred'] - df['target'])**2) / np.sum((df['target'] - df['target'].mean())**2)
    mae = df['abs_error'].mean()
    rmse = np.sqrt(np.mean(df['abs_error']**2))
    ax_all.set_xlabel('Target (cm³/g)')
    ax_all.set_ylabel('Predicted (cm³/g)')
    ax_all.set_title(f'Overall  |  R²={r2:.4f}  MAE={mae:.2f}  RMSE={rmse:.2f}\n(n={len(df)})', fontweight='bold')
    ax_all.grid(True, alpha=0.2)

    # Error distribution
    ax_err = fig.add_subplot(gs[1, 1])
    for p in pressures:
        sub = df[df['pressure_bar'] == p]
        ax_err.hist(sub['abs_error'], bins=50, alpha=0.5, label=f'{int(p)} bar', color=colors[p], range=(0, 30))
    ax_err.set_xlabel('Absolute Error (cm³/g)')
    ax_err.set_ylabel('Count')
    ax_err.set_title('Error Distribution by Pressure', fontweight='bold')
    ax_err.legend()
    ax_err.grid(True, alpha=0.2)

    # Relative error box plot
    ax_box = fig.add_subplot(gs[1, 2])
    data_box = [df[df['pressure_bar'] == p]['rel_error_pct'].values for p in pressures]
    bp = ax_box.boxplot(data_box, labels=[f'{int(p)} bar' for p in pressures], patch_artist=True, showfliers=False)
    for patch, color in zip(bp['boxes'], [colors[p] for p in pressures]):
        patch.set_facecolor(color)
        patch.set_alpha(0.6)
    ax_box.set_ylabel('Relative Error (%)')
    ax_box.set_title('Relative Error by Pressure', fontweight='bold')
    ax_box.grid(True, alpha=0.2)

    fig.suptitle('UniMOFV2 (V3) Inference Results on Tobacco CH4 Test Set\n(4015 samples, 3 pressure points, 298K)',
                 fontsize=16, fontweight='bold', y=1.02)
    plt.tight_layout()
    path = os.path.join(OUTPUT_DIR, 'fig2_v3_inference_scatter.png')
    plt.savefig(path)
    plt.close()
    print(f"[SAVED] {path}")

# ============================================================
# 图3: 不同压力点性能对比柱状图
# ============================================================
def plot_pressure_comparison():
    summary = pd.read_csv(os.path.join(BASE, 'inference_v3_summary.csv'))
    summary = summary[summary['pressure_bar'] != 'Overall'].copy()
    summary['pressure_bar'] = summary['pressure_bar'].astype(float)

    fig, axes = plt.subplots(1, 3, figsize=(18, 6))
    colors = ['#2196F3', '#FF9800', '#f44336']

    metrics = [('MAE', 'Mean Absolute Error (cm³/g)'), ('RMSE', 'Root Mean Squared Error (cm³/g)'), ('R2', 'R² Score')]
    for ax, (col, title) in zip(axes, metrics):
        vals = summary[col].values
        bars = ax.bar([f'{int(p)} bar' for p in summary['pressure_bar']], vals, color=colors, alpha=0.8, edgecolor='black', linewidth=0.5)
        for bar, v in zip(bars, vals):
            ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.002*(max(vals)), f'{v:.4f}',
                    ha='center', va='bottom', fontweight='bold', fontsize=12)
        ax.set_ylabel(title)
        ax.set_title(title, fontweight='bold')
        ax.grid(True, alpha=0.2, axis='y')

    fig.suptitle('V3 Inference Performance Across Pressure Levels\n(Higher pressure → Larger error, Lower R²)',
                 fontsize=14, fontweight='bold')
    plt.tight_layout()
    path = os.path.join(OUTPUT_DIR, 'fig3_pressure_comparison.png')
    plt.savefig(path)
    plt.close()
    print(f"[SAVED] {path}")

# ============================================================
# 图4: V2 100-MOF推理结果 (含插值失败点)
# ============================================================
def plot_v2_100mof():
    df = pd.read_csv(os.path.join(BASE, 'inference_100_results.csv'))
    summary = pd.read_csv(os.path.join(BASE, 'inference_v2_100mof_summary.csv'))
    summary_plot = summary[summary['note'].notna()].copy() if 'note' in summary.columns else summary.copy()
    summary_plot = summary[summary['pressure_bar_real'].notna()].copy()

    fig, axes = plt.subplots(1, 2, figsize=(16, 7))

    # Scatter: colored by pressure
    ax1 = axes[0]
    pressures = sorted(df['pressure_bar'].unique())
    cmap = plt.cm.viridis
    colors_p = [cmap(i / len(pressures)) for i in range(len(pressures))]
    for i, p in enumerate(pressures):
        sub = df[df['pressure_bar'] == p]
        is_interp = abs(p - 1.1230719) < 0.001
        marker = 'X' if is_interp else 'o'
        size = 60 if is_interp else 25
        ax1.scatter(sub['target'], sub['pred'], alpha=0.6, s=size, c=[colors_p[i]],
                    marker=marker, edgecolors='black', linewidth=0.3,
                    label=f'{p:.3f} (log10 bar){" [INTERP]" if is_interp else ""}')
    max_val = max(df['target'].max(), df['pred'].max())
    ax1.plot([0, max_val], [0, max_val], 'k--', linewidth=1.5, alpha=0.7)
    ax1.set_xlabel('Target (cm³/g)')
    ax1.set_ylabel('Predicted (cm³/g)')
    ax1.set_title('V2 Inference: 100 MOFs × 7 Pressure Points\n(Interpolated point shows severe failure)', fontweight='bold')
    ax1.legend(fontsize=8, loc='upper left')
    ax1.grid(True, alpha=0.2)

    # MAE by pressure
    ax2 = axes[1]
    all_p = summary_plot['pressure_bar_real'].values
    all_mae = summary_plot['MAE'].values
    all_notes = summary_plot['note'].fillna('').values if 'note' in summary_plot.columns else [''] * len(summary_plot)
    bar_colors = ['#f44336' if 'INTERP' in str(n) else '#2196F3' for n in all_notes]
    bars = ax2.bar(range(len(all_p)), all_mae, color=bar_colors, alpha=0.8, edgecolor='black', linewidth=0.5)
    ax2.set_xticks(range(len(all_p)))
    ax2.set_xticklabels([f'{p:.1f}' for p in all_p], rotation=45)
    ax2.set_xlabel('Pressure (bar)')
    ax2.set_ylabel('MAE (cm³/g)')
    ax2.set_title('MAE by Pressure Point\n(Red = Interpolated, Blue = Original)', fontweight='bold')
    for bar, v in zip(bars, all_mae):
        ax2.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1, f'{v:.1f}',
                 ha='center', va='bottom', fontsize=9, fontweight='bold')
    ax2.grid(True, alpha=0.2, axis='y')

    plt.tight_layout()
    path = os.path.join(OUTPUT_DIR, 'fig4_v2_100mof_inference.png')
    plt.savefig(path)
    plt.close()
    print(f"[SAVED] {path}")

# ============================================================
# 图5: S1_1bar LoRA微调结果
# ============================================================
def plot_s1_1bar():
    valid = pd.read_csv(os.path.join(UNI_DIR, 'infer_ep63_best_valid.csv'))
    test = pd.read_csv(os.path.join(UNI_DIR, 'infer_ep63_best_test.csv'))

    fig, axes = plt.subplots(2, 2, figsize=(16, 14))

    # Valid scatter
    ax1 = axes[0, 0]
    ax1.scatter(valid['target_mol_kg'], valid['pred_mol_kg'], alpha=0.6, s=50, c='#2196F3', edgecolors='black', linewidth=0.3)
    max_val = max(valid['target_mol_kg'].max(), valid['pred_mol_kg'].max())
    ax1.plot([0, max_val], [0, max_val], 'k--', linewidth=1.5, alpha=0.7)
    r2_v = 1 - np.sum((valid['pred_mol_kg'] - valid['target_mol_kg'])**2) / np.sum((valid['target_mol_kg'] - valid['target_mol_kg'].mean())**2)
    mae_v = valid['abs_error'].mean()
    ax1.set_xlabel('Target (mol/kg)')
    ax1.set_ylabel('Predicted (mol/kg)')
    ax1.set_title(f'Validation Set (ep63 best)\nR²={r2_v:.4f}  MAE={mae_v:.2f}  (n={len(valid)})', fontweight='bold')
    ax1.grid(True, alpha=0.2)

    # Test scatter
    ax2 = axes[0, 1]
    ax2.scatter(test['target_mol_kg'], test['pred_mol_kg'], alpha=0.6, s=50, c='#FF9800', edgecolors='black', linewidth=0.3)
    max_val = max(test['target_mol_kg'].max(), test['pred_mol_kg'].max())
    ax2.plot([0, max_val], [0, max_val], 'k--', linewidth=1.5, alpha=0.7)
    r2_t = 1 - np.sum((test['pred_mol_kg'] - test['target_mol_kg'])**2) / np.sum((test['target_mol_kg'] - test['target_mol_kg'].mean())**2)
    mae_t = test['abs_error'].mean()
    ax2.set_xlabel('Target (mol/kg)')
    ax2.set_ylabel('Predicted (mol/kg)')
    ax2.set_title(f'Test Set (ep63 best)\nR²={r2_t:.4f}  MAE={mae_t:.2f}  (n={len(test)})', fontweight='bold')
    ax2.grid(True, alpha=0.2)

    # Error distribution
    ax3 = axes[1, 0]
    ax3.hist(valid['abs_error'], bins=20, alpha=0.6, color='#2196F3', label=f'Valid (MAE={mae_v:.1f})', edgecolor='black')
    ax3.hist(test['abs_error'], bins=20, alpha=0.6, color='#FF9800', label=f'Test (MAE={mae_t:.1f})', edgecolor='black')
    ax3.set_xlabel('Absolute Error (mol/kg)')
    ax3.set_ylabel('Count')
    ax3.set_title('Error Distribution: S1_1bar LoRA', fontweight='bold')
    ax3.legend()
    ax3.grid(True, alpha=0.2)

    # Top-10 worst predictions
    ax4 = axes[1, 1]
    worst = test.nlargest(10, 'abs_error')
    short_ids = [iid[:15] for iid in worst['ID']]
    bars = ax4.barh(range(len(worst)), worst['abs_error'], color='#f44336', alpha=0.8, edgecolor='black')
    ax4.set_yticks(range(len(worst)))
    ax4.set_yticklabels(short_ids, fontsize=8)
    ax4.set_xlabel('Absolute Error (mol/kg)')
    ax4.set_title('Top-10 Worst Test Predictions', fontweight='bold')
    ax4.invert_yaxis()
    ax4.grid(True, alpha=0.2, axis='x')

    fig.suptitle('S1_1bar LoRA Fine-tuning Results\n(972 samples, rank=4, 171K trainable / 27M total)',
                 fontsize=16, fontweight='bold', y=1.01)
    plt.tight_layout()
    path = os.path.join(OUTPUT_DIR, 'fig5_s1_1bar_lora.png')
    plt.savefig(path)
    plt.close()
    print(f"[SAVED] {path}")

# ============================================================
# 图6: 模型性能综合对比
# ============================================================
def plot_model_comparison():
    models = [
        'UniMOFV2\n(V3 Test)',
        'UniMOFV2\n(V2 100-MOF)',
        'UniMOFV2\n(Train Best Valid)',
        'UniMOFV2\n(Train Best Test)',
        'S1_1bar LoRA\n(Valid ep63)',
        'S1_1bar LoRA\n(Test ep63)',
    ]
    r2_values = [0.9852, 0.8880, 0.9931, 0.9932, 0.6566, 0.3052]
    mae_values = [5.21, 12.59, None, None, None, None]
    n_samples = [4015, 700, '—', '—', 53, 53]

    colors_bar = ['#4CAF50', '#FF9800', '#2196F3', '#2196F3', '#9C27B0', '#f44336']

    fig, axes = plt.subplots(1, 2, figsize=(18, 7))

    # R² comparison
    ax1 = axes[0]
    bars = ax1.bar(range(len(models)), r2_values, color=colors_bar, alpha=0.8, edgecolor='black', linewidth=0.5)
    ax1.set_xticks(range(len(models)))
    ax1.set_xticklabels(models, fontsize=9)
    ax1.set_ylabel('R² Score')
    ax1.set_title('R² Score Comparison Across Models', fontweight='bold')
    ax1.axhline(y=0.95, color='green', linestyle='--', alpha=0.5, label='Good (0.95)')
    ax1.axhline(y=0.80, color='orange', linestyle='--', alpha=0.5, label='Acceptable (0.80)')
    for bar, v, n in zip(bars, r2_values, n_samples):
        ax1.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.01,
                 f'{v:.4f}\n(n={n})', ha='center', va='bottom', fontsize=9, fontweight='bold')
    ax1.set_ylim(0, 1.12)
    ax1.legend(loc='lower left')
    ax1.grid(True, alpha=0.2, axis='y')

    # Parameters comparison
    ax2 = axes[1]
    model_names = ['UniMatModel\n(Backbone)', 'UniMOFV2Model\n(Full Fine-tune)', 'UniMOF1barModel\n(LoRA Fine-tune)']
    total_params = [26.7, 27.4, 27.4]
    trainable_params = [26.7, 27.4, 0.171]
    x = np.arange(len(model_names))
    width = 0.35
    bars1 = ax2.bar(x - width/2, total_params, width, label='Total Params (M)', color='#607D8B', alpha=0.8, edgecolor='black')
    bars2 = ax2.bar(x + width/2, trainable_params, width, label='Trainable Params (M)', color='#4CAF50', alpha=0.8, edgecolor='black')
    ax2.set_xticks(x)
    ax2.set_xticklabels(model_names)
    ax2.set_ylabel('Parameters (Millions)')
    ax2.set_title('Model Parameters Comparison', fontweight='bold')
    for bar, v in zip(bars1, total_params):
        ax2.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5, f'{v:.1f}M', ha='center', va='bottom', fontweight='bold')
    for bar, v in zip(bars2, trainable_params):
        label = f'{v:.3f}M' if v < 1 else f'{v:.1f}M'
        ax2.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5, label, ha='center', va='bottom', fontweight='bold')
    ax2.legend()
    ax2.grid(True, alpha=0.2, axis='y')
    ax2.set_yscale('log')

    fig.suptitle('Uni-MOF Model Performance & Parameter Summary', fontsize=16, fontweight='bold')
    plt.tight_layout()
    path = os.path.join(OUTPUT_DIR, 'fig6_model_comparison.png')
    plt.savefig(path)
    plt.close()
    print(f"[SAVED] {path}")

# ============================================================
# 图7: 新数据推理结果分析
# ============================================================
def plot_newdata_inference():
    df = pd.read_csv(os.path.join(UNI_DIR, 'inference_newdata_v2_results.csv'))

    fig, axes = plt.subplots(1, 2, figsize=(16, 7))

    # Void fraction vs error
    ax1 = axes[0]
    ok = df[df['status'] == 'ok']
    scatter = ax1.scatter(ok['sf_vf'], ok['abs_error'], c=ok['pressure_bar'], cmap='viridis',
                          alpha=0.6, s=20, edgecolors='none')
    plt.colorbar(scatter, ax=ax1, label='Pressure (bar)')
    ax1.set_xlabel('Void Fraction')
    ax1.set_ylabel('Absolute Error (cm³/cm³)')
    ax1.set_title('Error vs Void Fraction\n(New MOF Database)', fontweight='bold')
    ax1.grid(True, alpha=0.2)

    # LCD vs error
    ax2 = axes[1]
    scatter2 = ax2.scatter(ok['sf_lcd'], ok['abs_error'], c=ok['pressure_bar'], cmap='viridis',
                           alpha=0.6, s=20, edgecolors='none')
    plt.colorbar(scatter2, ax=ax2, label='Pressure (bar)')
    ax2.set_xlabel('Largest Cavity Diameter (Å)')
    ax2.set_ylabel('Absolute Error (cm³/cm³)')
    ax2.set_title('Error vs Largest Cavity Diameter\n(New MOF Database)', fontweight='bold')
    ax2.grid(True, alpha=0.2)

    fig.suptitle(f'V2 Inference on New MOF Database\n({len(ok)} samples, status={ok["status"].iloc[0]})',
                 fontsize=14, fontweight='bold')
    plt.tight_layout()
    path = os.path.join(OUTPUT_DIR, 'fig7_newdata_analysis.png')
    plt.savefig(path)
    plt.close()
    print(f"[SAVED] {path}")

# ============================================================
# 图8: 研究进展全景图
# ============================================================
def plot_research_overview():
    fig, ax = plt.subplots(figsize=(22, 14))
    ax.set_xlim(0, 22)
    ax.set_ylim(0, 14)
    ax.axis('off')
    ax.set_title('Uni-MOF 研究进展全景图', fontsize=20, fontweight='bold', pad=20)

    def draw_box(x, y, w, h, text, color, fontsize=10, alpha=0.85):
        rect = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.15",
                               facecolor=color, edgecolor='black', linewidth=1.5, alpha=alpha)
        ax.add_patch(rect)
        ax.text(x + w/2, y + h/2, text, ha='center', va='center', fontsize=fontsize,
                fontweight='bold', wrap=True)

    def draw_arrow(x1, y1, x2, y2):
        ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(arrowstyle='->', color='black', lw=2))

    # Phase 1: Pretrain
    draw_box(0.5, 10.5, 4, 2.5, 'Phase 1: 预训练\nUniMatModel\n26.7M params\n8-layer Transformer\n64 heads, dim=512',
             '#E3F2FD', fontsize=10)

    # Phase 2: V2 Full Fine-tune
    draw_box(6, 10.5, 5, 2.5, 'Phase 2: V2 全量微调\nTobacco CH4 (75K samples)\nBest R²=0.9931 (valid)\nBest R²=0.9932 (test)\nEpoch 37/100',
             '#E8F5E9', fontsize=10)

    # Phase 3: V3 Inference
    draw_box(12.5, 10.5, 4.5, 2.5, 'Phase 3: V3 大规模推理\n4015 samples (3 pressures)\nR²=0.9852  MAE=5.21\nRMSE=9.36\n24/4056 CUDA OOM',
             '#FFF3E0', fontsize=10)

    # Phase 4: LoRA
    draw_box(18, 10.5, 3.5, 2.5, 'Phase 4: LoRA微调\nS1_1bar (972 samples)\n171K trainable (1.9%)\nValid R²=0.6566\nTest R²=0.3052',
             '#F3E5F5', fontsize=10)

    draw_arrow(4.5, 11.75, 6, 11.75)
    draw_arrow(11, 11.75, 12.5, 11.75)
    draw_arrow(17, 11.75, 18, 11.75)

    # Performance summary
    draw_box(0.5, 7, 6.5, 2.8,
             '性能指标总结\n━━━━━━━━━━━━━━━\nV2训练最佳: R²=0.9932\nV3推理: R²=0.9852, MAE=5.21\nV2 100-MOF: R²=0.888 (插值失败)\nLoRA 1bar: R²=0.31 (test)',
             '#FFF9C4', fontsize=10)

    # Key findings
    draw_box(8, 7, 6.5, 2.8,
             '关键发现\n━━━━━━━━━━━━━━━\n✓ 高压(100bar)误差 > 低压(6bar)\n✓ 插值压力点严重失败(MAE=50)\n✓ LoRA小数据过拟合(train<<valid)\n✓ 新数据库推理误差极大\n✓ 空间结构特征影响显著',
             '#FFCDD2', fontsize=10)

    # Challenges
    draw_box(15.5, 7, 6, 2.8,
             '当前挑战\n━━━━━━━━━━━━━━━\n✗ 泛化能力不足(跨库推理)\n✗ 插值压力点预测崩溃\n✗ LoRA微调效果有限\n✗ 小样本场景欠拟合\n✗ 仅支持CH4单一气体',
             '#FFCDD2', fontsize=10)

    # Future directions
    draw_box(0.5, 3.5, 5, 3,
             '方向1: 多气体扩展\n━━━━━━━━━━━━\n• CO2, N2, H2等气体\n• 统一Gas Embedding\n• 跨气体迁移学习\n• 气体物理属性融合',
             '#C8E6C9', fontsize=9)

    draw_box(6, 3.5, 5, 3,
             '方向2: 压力连续化\n━━━━━━━━━━━━\n• 压力作为连续输入\n• 替代离散embedding\n• 解决插值问题\n• 等温线全曲线预测',
             '#C8E6C9', fontsize=9)

    draw_box(11.5, 3.5, 5, 3,
             '方向3: 跨库泛化\n━━━━━━━━━━━━\n• 多MOF数据库训练\n• Domain Adaptation\n• 结构特征增强\n• 预训练数据扩充',
             '#C8E6C9', fontsize=9)

    draw_box(17, 3.5, 4.5, 3,
             '方向4: 模型优化\n━━━━━━━━━━━━\n• 更大backbone\n• 对比学习预训练\n• 物理约束增强\n• Active Learning',
             '#C8E6C9', fontsize=9)

    draw_arrow(3, 7, 3, 6.5)
    draw_arrow(11, 7, 8.5, 6.5)
    draw_arrow(18, 7, 18, 6.5)

    # Timeline
    draw_box(3, 0.5, 16, 2,
             '研究路线图:  预训练(V1) → 全量微调(V2, R²=0.993) → 大规模验证(V3, R²=0.985) → LoRA高效微调(S1, R²=0.31) → '
             '多气体+连续压力+跨库泛化(Next)',
             '#E0E0E0', fontsize=11)

    path = os.path.join(OUTPUT_DIR, 'fig8_research_overview.png')
    plt.savefig(path, facecolor='white')
    plt.close()
    print(f"[SAVED] {path}")

# ============================================================
# 主函数
# ============================================================
if __name__ == '__main__':
    print("=" * 60)
    print("Uni-MOF 统计图表生成")
    print("=" * 60)
    plot_training_curve()
    plot_v3_inference()
    plot_pressure_comparison()
    plot_v2_100mof()
    plot_s1_1bar()
    plot_model_comparison()
    plot_newdata_inference()
    plot_research_overview()
    print("=" * 60)
    print(f"所有图表已保存到: {OUTPUT_DIR}")
    print("=" * 60)
