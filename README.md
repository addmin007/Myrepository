# Uni-MOF MOF 气体吸附预测平台

基于 [UniMOF v2](https://www.nature.com/articles/s41467-024-46276-x) 的金属有机框架（MOF）气体吸附量预测全栈系统，涵盖 **模型训练 / 微调 → 推理服务 → Web 前端** 完整链路。系统采用压力路由策略，在低压（≤ 2 bar）和高压（> 2 bar）场景下分别使用专用模型，实现全压力范围高精度预测。

---

## 目录

- [系统架构](#系统架构)
- [项目结构](#项目结构)
- [核心组件](#核心组件)
  - [模型层（Uni-MOF-main）](#模型层uni-mof-main)
  - [后端（mof-platform/backend）](#后端mof-platformbackend)
  - [前端（mof-platform/frontend）](#前端mof-platformfrontend)
- [快速启动](#快速启动)
  - [方式一：本地开发（conda + npm）](#方式一本地开发conda--npm)
  - [方式二：Docker Compose 一键部署](#方式二docker-compose-一键部署)
- [API 文档](#api-文档)
- [环境变量配置](#环境变量配置)
- [模型训练与微调](#模型训练与微调)
- [数据预处理](#数据预处理)
- [推理加速（ONNX / TensorRT）](#推理加速onnx--tensorrt)
- [已知修复的 Bug](#已知修复的-bug)
- [技术栈](#技术栈)
- [引用](#引用)
- [许可证](#许可证)

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         浏览器（用户）                                │
│                   React 19 + Vite + TailwindCSS                     │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTP /api/v1/*
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FastAPI 网关（:8000）                           │
│            Pydantic v2 校验 · CORS · GZip · CIF 解析                 │
└──────────┬──────────────────────────────┬───────────────────────────┘
           │ 提交任务                       │ 轮询状态
           ▼                                │
┌─────────────────────┐                    │
│   Redis（:6379）     │◄──────────────────┘
│  Celery Broker +     │
│  Result Backend      │
└────────┬────────────┘
         │ 消费任务
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Celery Worker（异步推理）                          │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    ModelRegistry（单例）                     │   │
│  │                                                             │   │
│  │   压力 ≤ 2 bar               压力 > 2 bar                   │   │
│  │  ┌──────────────┐           ┌──────────────┐                │   │
│  │  │ 1-bar LoRA   │           │ Tobacco v2   │                │   │
│  │  │ Frozen Backb │           │ UniMOF v2    │                │   │
│  │  │ + LoRA Adapt │           │ Full Model   │                │   │
│  │  │ + Fusion Head│           │              │                │   │
│  │  └──────────────┘           └──────────────┘                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  设备：CUDA / Apple MPS / CPU（自动检测）                            │
└─────────────────────────────────────────────────────────────────────┘
```

**核心设计——压力路由**：不同压力区间的吸附行为差异显著，单一模型难以兼顾全范围精度。系统在推理时根据压力值自动路由到最合适的模型：

| 压力范围 | 模型 | 架构 | 可训练参数 |
|---------|------|------|-----------|
| ≤ 2 bar | S1_1bar_lora | Frozen Backbone + LoRA (rank=4) + Fusion Head | ~171K / 26.7M (0.6%) |
| > 2 bar | Tobacco_CH4_v2 | UniMOF v2 完整微调 | ~26.7M |

---

## 项目结构

```
Uni-MOF-main/
├── Uni-MOF-main/                    # 模型层：训练、推理、服务
│   ├── unimof/                      # UniMOF 模型代码包
│   │   ├── models/                  #   模型定义
│   │   │   ├── unimof_v2.py         #     UniMOF v2 模型（高压）
│   │   │   ├── unimof_1bar.py       #     1-bar LoRA 模型（低压）
│   │   │   ├── unimat.py            #     UniMat 骨干网络
│   │   │   └── transformer_encoder_with_pair.py
│   │   ├── tasks/                   #   UniCore 任务定义
│   │   │   ├── unimof_v2.py
│   │   │   ├── unimof_1bar.py
│   │   │   └── unimat.py
│   │   ├── losses/                  #   损失函数
│   │   │   └── regloss.py           #     MSE + R² 评估 + 归一化注册表
│   │   └── infer.py                 #   原始推理脚本
│   ├── serve/                       # 独立推理服务（可选，不依赖 Celery）
│   │   ├── api.py                   #   FastAPI 接口（单点/等温线/CIF）
│   │   ├── mof_predictor.py         #   模型加载 + 推理核心逻辑
│   │   └── test_api.py
│   ├── serve.py                     # TensorRT/PyTorch 双后端推理服务
│   ├── weights/                     # 预训练权重
│   │   └── unimof_pretrain_best.pt  #   UniMOF 骨干预训练 checkpoint
│   ├── lmdb_s1_fixed/               # 1-bar 数据集
│   │   └── dict.txt                 #   原子词汇表（80 tokens）
│   ├── examples/                    # 示例数据
│   ├── run_inference_router.py      # 压力路由批量推理脚本
│   ├── run_inference_full.py        # 全量推理评估脚本
│   ├── run_inference_100.py         # 100-MOF 快速推理
│   ├── run_inference_newdata.py     # 新数据推理
│   ├── run_finetune_1bar_lora.sh    # 1-bar LoRA 微调脚本
│   ├── unimof_finetune_*.sh         # UniMOF v2 微调脚本（多/单系统）
│   ├── unimof_pretrain.sh           # 骨干预训练脚本
│   ├── preprocess_tobacco_methane_to_lmdb.py  # CIF → LMDB 预处理
│   ├── export_onnx.py               # 导出 ONNX
│   ├── build_trt_engine.py          # 构建 TensorRT 引擎
│   ├── Dockerfile                   # 推理服务 Docker 镜像
│   ├── requirements.txt
│   └── LICENSE
│
├── mof-platform/                    # 全栈 Web 平台
│   ├── backend/                     # 后端服务
│   │   ├── app/
│   │   │   ├── main.py              #   FastAPI 入口（lifespan 预加载模型）
│   │   │   ├── api/
│   │   │   │   └── predict.py       #   预测路由（submit / isotherm / status）
│   │   │   ├── core/
│   │   │   │   ├── config.py        #   Pydantic Settings 配置管理
│   │   │   │   └── model_registry.py#   模型注册表（双模型 + 压力路由）
│   │   │   ├── tasks/
│   │   │   │   ├── celery_app.py    #   Celery 应用（solo pool for macOS）
│   │   │   │   └── inference.py     #   异步推理任务定义
│   │   │   ├── schemas/
│   │   │   │   └── prediction.py    #   请求/响应 Pydantic 模型
│   │   │   └── utils/
│   │   │       └── cif_parser.py    #   三层降级 CIF 解析器
│   │   ├── .env                     # 环境变量（模型路径、设备等）
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   │
│   ├── frontend/                    # 前端应用
│   │   ├── src/
│   │   │   ├── App.tsx              #   应用入口
│   │   │   ├── main.tsx             #   React 挂载点
│   │   │   ├── pages/
│   │   │   │   └── PredictPage.tsx  #   主页面（左输入 / 右结果）
│   │   │   ├── components/
│   │   │   │   ├── CifUploader.tsx  #   CIF 拖拽上传组件
│   │   │   │   ├── ParamForm.tsx    #   参数表单（气体/温度/压力/结构特征）
│   │   │   │   ├── ResultPanel.tsx  #   结果展示（卡片 + Recharts 等温线图）
│   │   │   │   └── ProgressBar.tsx  #   推理进度条
│   │   │   ├── api/
│   │   │   │   └── client.ts        #   Axios API 客户端
│   │   │   ├── store/
│   │   │   │   └── predictionStore.ts #  Zustand 全局状态
│   │   │   └── hooks/
│   │   │       └── usePolling.ts    #   任务状态轮询 Hook（1.5s 间隔）
│   │   ├── vite.config.ts           # Vite 配置（proxy → :8000）
│   │   ├── nginx.conf               # 生产 Nginx 配置（SPA + API 反代）
│   │   ├── Dockerfile               # 多阶段构建（Node build → Nginx serve）
│   │   └── package.json
│   │
│   ├── infra/                       # 基础设施配置（预留）
│   ├── docker-compose.yml           # 一键编排：Redis + API + Worker + Flower + Frontend
│   └── README.md
│
├── results/                         # 训练产出
│   └── S1_1bar_lora/
│       ├── checkpoint_best.pt       #   1-bar LoRA 最佳模型
│       └── validation_results.txt
│
├── paper_data/                      # 论文相关数据
│   ├── model/
│   │   └── checkpoint_best.pt       #   Tobacco CH4 v2 最佳模型
│   ├── inference/                   #   推理结果 CSV
│   ├── training/
│   │   └── training_curve.csv       #   训练曲线数据
│   └── logs/
│
├── statistics_figures/              # 统计图表（8 张）
│   ├── fig1_training_curve.png
│   ├── fig2_v3_inference_scatter.png
│   ├── fig3_pressure_comparison.png
│   ├── fig4_v2_100mof_inference.png
│   ├── fig5_s1_1bar_lora.png
│   ├── fig6_model_comparison.png
│   ├── fig7_newdata_analysis.png
│   └── fig8_research_overview.png
│
├── generate_statistics.py           # 图表生成脚本
├── architecture_v2.tex / .pdf       # 架构文档（LaTeX）
└── README.md                        # 本文件
```

---

## 核心组件

### 模型层（Uni-MOF-main）

基于 [Uni-Core](https://github.com/dptech-corp/Uni-Core) 框架，包含两种模型架构：

#### UniMOF v2 模型（高压，> 2 bar）

- **骨干网络**：UniMat Transformer，从 631K+ MOF/COF 3D 结构预训练
- **输入**：原子 token 序列 + 距离矩阵 + 坐标 + 边类型 + 气体特征 + 环境条件（压力 log10、温度）+ 7 维结构特征
- **输出**：归一化吸附量（log1p + standardization），反归一化后得到 mol/kg
- **归一化参数**（Tobacco_CH4）：mean=4.3757, std=1.0910

#### 1-bar LoRA 模型（低压，≤ 2 bar）

- **骨干**：冻结 Tobacco v2 预训练 backbone（提取 512-dim CLS 表示）
- **LoRA 适配器**：rank=4, alpha=32.0，施加于 attention 的 in_proj & out_proj（~66K 参数）
- **结构特征 MLP**：8 维输入 [lcd, pld, lfpd, density, asa_m2cm3, asa_m2g, vf, pv] → 128 维
- **融合头**：(512 + 256 + 384 + 128) → 256 → 128 → 1
- **总可训练参数**：~171K / 26.7M（0.6%），有效防止小数据过拟合
- **训练数据**：972 train / 53 valid / 53 test（1 bar, 298 K, CH4）
- **归一化参数**（S1_CH4_1bar_fixed）：mean=2.9062, std=0.8324

#### 气体支持

| 气体 | 临界温度 (K) | 临界压力 (bar) | 偏心因子 | 摩尔质量 (g/mol) |
|------|-------------|---------------|---------|-----------------|
| CH4  | 190.56      | 45.99         | 0.011   | 16.043          |
| CO2  | 304.13      | 73.77         | 0.224   | 44.010          |
| N2   | 126.19      | 33.96         | 0.037   | 28.014          |
| H2   | 33.19       | 13.13         | -0.216  | 2.016           |

> 气体特征经 z-score 标准化后输入模型。

---

### 后端（mof-platform/backend）

| 模块 | 文件 | 职责 |
|------|------|------|
| **入口** | `app/main.py` | FastAPI 应用创建、中间件注册、lifespan 预加载模型 |
| **配置** | `app/core/config.py` | Pydantic BaseSettings，从 `.env` 读取所有配置 |
| **模型管理** | `app/core/model_registry.py` | 进程级单例，双模型加载 + 压力路由 + 单/批量推理 |
| **API 路由** | `app/api/predict.py` | 任务提交、状态查询接口 |
| **异步任务** | `app/tasks/inference.py` | Celery 任务定义（单点 + 等温线） |
| **Celery 配置** | `app/tasks/celery_app.py` | Redis broker/backend，solo pool（macOS） |
| **CIF 解析** | `app/utils/cif_parser.py` | pymatgen → ASE → 纯正则三层降级 |
| **数据模型** | `app/schemas/prediction.py` | Pydantic v2 请求/响应 schema |

**推理流程**：

```
用户上传 CIF + 参数
      │
      ▼
FastAPI 校验参数 → 解析 CIF 文本 → 提交 Celery 任务
      │
      ▼
Celery Worker 接收任务
      │
      ├─ parse_cif(cif_text) → (atoms, coords)
      │
      ├─ ModelRegistry.route(pressure) → 选择模型
      │
      ├─ handle.infer() 或 handle.infer_batch()
      │     ├─ 去氢 + 截断（max 512 atoms）
      │     ├─ 构建 token / distance / coord / edge_type tensors
      │     ├─ model.forward() → 归一化 logit
      │     └─ denormalize() → mol/kg
      │
      ├─ mol/kg → cm³/cm³（密度换算）
      │
      └─ 返回结果到 Redis
```

**单位换算**：`cm³(STP)/cm³ = mol/kg × density(g/cm³) × 22414(cm³/mol) / 1000`

---

### 前端（mof-platform/frontend）

| 文件 | 职责 |
|------|------|
| `pages/PredictPage.tsx` | 主页面：左栏输入区（模式切换 + CIF 上传 + 参数表单），右栏结果区 |
| `components/CifUploader.tsx` | 拖拽 / 点击上传 `.cif` 文件，显示文件名和大小 |
| `components/ParamForm.tsx` | 气体选择、温度、压力（单点/多点）、7 维结构特征输入 |
| `components/ResultPanel.tsx` | 单点：渐变结果卡片 + 统计信息；等温线：Recharts 折线图 + 数据表 |
| `components/ProgressBar.tsx` | 推理进度条（PENDING → STARTED → SUCCESS/FAILURE） |
| `api/client.ts` | Axios 封装，submitPredict / pollStatus |
| `store/predictionStore.ts` | Zustand 全局状态（taskId / status / progress / result / mode） |
| `hooks/usePolling.ts` | 1.5s 间隔轮询任务状态，自动更新 store |

**预测模式**：

- **单点预测**：指定一个压力值，返回该条件下的吸附量
- **等温线预测**：指定多个压力点，返回完整吸附等温线（图表 + 表格），并在 2 bar 处标注模型切换分界线

---

## 快速启动

### 前提条件

| 依赖 | 版本要求 | 说明 |
|------|---------|------|
| conda | - | 创建 `unimof` 环境 |
| Python | 3.10 | 模型推理 |
| PyTorch | 2.x | 支持 CUDA / MPS / CPU |
| Uni-Core | latest | `pip install git+https://github.com/dptech-corp/Uni-Core.git` |
| Redis | ≥ 6 | `brew install redis`（macOS） |
| Node.js | ≥ 18 | 前端构建 |
| npm | ≥ 9 | 依赖管理 |

### 方式一：本地开发（conda + npm）

#### 1. 启动 Redis

```bash
brew services start redis
redis-cli ping   # 应返回 PONG
```

#### 2. 启动 FastAPI（含模型预加载）

```bash
cd mof-platform/backend
conda activate unimof
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 验证
curl http://localhost:8000/health   # {"status":"ok","service":"MOF Prediction API"}
curl http://localhost:8000/ready    # {"status":"ready","models_loaded":2}
```

#### 3. 启动 Celery Worker

```bash
# 新终端，同一目录
cd mof-platform/backend
conda activate unimof
celery -A app.tasks.celery_app worker --loglevel=info --pool=solo
```

> **macOS 注意**：必须用 `--pool=solo`，否则 PyTorch MPS 在 fork 子进程中会死锁。Linux 生产环境可使用默认 prefork pool。

#### 4. 启动前端

```bash
cd mof-platform/frontend
npm install
npm run dev   # http://localhost:5173
```

前端 `/api/` 请求通过 Vite 代理转发到 `http://localhost:8000`。

### 方式二：Docker Compose 一键部署

```bash
cd mof-platform
docker compose up -d
```

启动以下服务：

| 服务 | 端口 | 说明 |
|------|------|------|
| Redis | 6379 | Celery broker + result backend |
| API | 8000 | FastAPI 网关 |
| Worker | - | Celery 推理 Worker |
| Flower | 5555 | Celery 任务监控 UI（可选） |
| Frontend | 5173 | Nginx 托管的 React 应用 |

Docker Compose 会自动挂载模型权重和 unimof 代码到容器中。

---

## API 文档

### 健康检查

```bash
GET /health
# → {"status":"ok","service":"MOF Prediction API"}

GET /ready
# → {"status":"ready","models_loaded":2}
```

### 单点预测

```bash
POST /api/v1/predict/submit
Content-Type: multipart/form-data

curl -X POST http://localhost:8000/api/v1/predict/submit \
  -F "cif_file=@/path/to/your.cif" \
  -F 'gas=CH4' -F 'temperature_K=298.0' -F 'pressure_bar=1.0' \
  -F 'lcd=8.0' -F 'pld=5.0' -F 'lfpd=4.0' -F 'density=0.8' \
  -F 'asa_m2cm3=300.0' -F 'asa_m2g=400.0' -F 'void_fraction=0.35' \
  -F 'pv_cm3g=0.2'

# → {"task_id":"a1b2c3d4-...","status":"PENDING","message":"任务已提交，请轮询 /predict/status/{task_id}"}
```

**表单参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| cif_file | File | 是 | MOF 结构文件（.cif） |
| gas | string | 否 | 气体：CH4 / CO2 / N2 / H2（默认 CH4） |
| temperature_K | float | 否 | 温度 K（默认 298.0） |
| pressure_bar | float | 否 | 压力 bar（默认 65.0） |
| lcd | float | 是 | 最大孔径直径 LCD（Å） |
| pld | float | 是 | 孔限制直径 PLD（Å） |
| lfpd | float | 是 | 最大自由路径直径 LFPD（Å） |
| density | float | 是 | 晶体密度（g/cm³） |
| asa_m2cm3 | float | 是 | 可及表面积（m²/cm³） |
| asa_m2g | float | 是 | 可及表面积（m²/g） |
| void_fraction | float | 是 | 空隙率（0-1） |
| pv_cm3g | float | 否 | 孔体积（cm³/g），1-bar 模型专用 |

### 等温线预测

```bash
POST /api/v1/predict/isotherm
Content-Type: multipart/form-data

curl -X POST http://localhost:8000/api/v1/predict/isotherm \
  -F "cif_file=@/path/to/your.cif" \
  -F 'gas=CH4' -F 'temperature_K=298.0' \
  -F 'pressure_points_json={"points":[0.5,1,2,5,10,20,35,65]}'
```

### 轮询任务状态

```bash
GET /api/v1/predict/status/{task_id}

# PENDING
→ {"task_id":"...","status":"PENDING"}

# STARTED（推理中）
→ {"task_id":"...","status":"STARTED","progress":60}

# SUCCESS
→ {
    "task_id":"...",
    "status":"SUCCESS",
    "result":{
      "type":"single",
      "uptake_mol_kg": 8.234,
      "uptake_cm3_cm3": 147.82,
      "pressure_bar": 65.0,
      "temperature_K": 298.0,
      "gas": "CH4",
      "model_used": "tobacco_v2",
      "elapsed_ms": 1234.5,
      "n_atoms": 324
    }
  }

# FAILURE
→ {"task_id":"...","status":"FAILURE","error":"..."}
```

### 任务历史（占位）

```bash
GET /api/v1/predict/history
# → {"message":"history endpoint - connect to DB in production"}
```

---

## 环境变量配置

后端配置通过 `mof-platform/backend/.env` 文件管理：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `APP_NAME` | MOF Prediction Platform | 服务名称 |
| `DEBUG` | true | 调试模式 |
| `CORS_ORIGINS` | ["http://localhost:5173","http://localhost:3000"] | CORS 允许来源 |
| `CKPT_1BAR` | /models/S1_1bar_lora/checkpoint_best.pt | 1-bar LoRA checkpoint 路径 |
| `CKPT_HIGHP` | /models/Tobacco_CH4_v2/checkpoint_best.pt | 高压 Tobacco v2 checkpoint 路径 |
| `DICT_PATH` | /models/dict.txt | 原子词汇表路径（80→81 token 自动补齐） |
| `UNIMOF_DIR` | /app/unimof | unimof Python 包所在目录 |
| `DEVICE` | auto | 推理设备：auto / cuda / mps / cpu |
| `FP16` | false | 半精度推理（仅 CUDA 有效） |
| `MAX_ATOMS` | 512 | 最大原子数截断 |
| `PRESSURE_THRESHOLD_BAR` | 2.0 | 模型路由压力阈值（bar） |
| `REDIS_URL` | redis://localhost:6379/0 | Celery broker/backend |
| `TASK_SOFT_TIME_LIMIT` | 120 | 任务软超时（秒） |
| `TASK_HARD_TIME_LIMIT` | 180 | 任务硬超时（秒） |
| `MAX_UPLOAD_MB` | 20 | CIF 文件上传大小限制（MB） |

---

## 模型训练与微调

### 1-bar LoRA 微调

```bash
cd Uni-MOF-main
bash run_finetune_1bar_lora.sh
```

关键超参：

| 参数 | 值 | 说明 |
|------|-----|------|
| lr | 1e-3 | 学习率（仅训练新增头 + LoRA） |
| batch_size | 32 | 批大小 |
| epoch | 80 | 最大训练轮数（早停） |
| weight_decay | 1e-2 | 强 L2 正则化 |
| lora_rank | 4 | LoRA 秩 |
| lora_alpha | 32.0 | LoRA 缩放因子 |
| fusion_hidden | 256 | 融合头隐藏层维度 |
| best_metric | valid_r2 | 以验证集 R² 选择最佳模型 |

### UniMOF v2 微调

```bash
# 多系统交叉预测（使用预训练）
bash unimof_finetune_multi-system.sh

# 多系统交叉预测（无预训练）
bash unimof_finetune_multi-system_no-pretraining.sh

# 单系统预测
bash unimof_finetune_single-system.sh
```

### 骨干预训练

```bash
bash unimof_pretrain.sh
```

> 需要 8 × V100 GPU，batch_size=128（8 × 8 × 2），100K steps。

---

## 数据预处理

将 CIF 文件批量转换为 LMDB 格式供训练使用：

```bash
cd Uni-MOF-main
python preprocess_tobacco_methane_to_lmdb.py \
    --cif-dir /path/to/cif/files \
    --output-dir ./lmdb_s1_fixed \
    --task-name S1_CH4_1bar_fixed
```

预处理流程：
1. 使用 pymatgen 解析 CIF 文件
2. 去除氢原子（`--remove-hydrogen`）
3. 构建原子 token 序列、距离矩阵、坐标、边类型
4. 计算气体特征和环境条件
5. 序列化为 LMDB（pickle protocol 5，需 Python ≥ 3.8）

---

## 推理加速（ONNX / TensorRT）

### 导出 ONNX

```bash
cd Uni-MOF-main
python export_onnx.py \
    --checkpoint ./results/Tobacco_CH4/checkpoint_best.pt \
    --dict ./lmdb_output/dict.txt \
    --output ./export/unimof_tobacco_ch4.onnx \
    --task-name Tobacco_CH4
```

### 构建 TensorRT 引擎

```bash
python build_trt_engine.py \
    --onnx ./export/unimof_tobacco_ch4.onnx \
    --engine ./export/unimof_tobacco_ch4.trt \
    --fp16 \
    --max-atoms 128
```

| 后端 | 推理延迟 | 说明 |
|------|---------|------|
| PyTorch fp32 | ~45 ms/sample | 默认，易调试 |
| TensorRT fp16 | ~8 ms/sample | ~5-6x 加速，需 NVIDIA GPU |

通过环境变量 `INFERENCE_BACKEND=tensorrt` 切换后端（仅 `serve.py` 支持）。

---

## 已知修复的 Bug

| Bug | 修复位置 | 说明 |
|-----|---------|------|
| `pressure.squeeze(-1)` 将 `[1]` 压成 0-dim 标量，导致 `pressure[:, None]` IndexError | `model_registry.py:infer()` | 确保 pressure/temperature 始终为 1D `[B]` tensor |
| MPS 在 Celery fork 子进程中死锁 | `celery_app.py`: `worker_pool="solo"` | macOS 使用 solo pool 避免 fork |
| vocab 大小不对齐（dict 80 行，ckpt embed 81 行） | `model_registry.py:_load()` | 动态 `add_symbol` 补齐词汇表 |

---

## 技术栈

### 模型层

- **[UniMOF v2](https://www.nature.com/articles/s41467-024-46276-x)** — Transformer-based 3D MOF 表征学习框架
- **[Uni-Core](https://github.com/dptech-corp/Uni-Core)** — 深度学习训练框架（分布式训练、混合精度）
- **PyTorch 2.x** — 深度学习推理引擎
- **LoRA** — 低秩适配器微调技术
- **ONNX / TensorRT** — 推理加速（可选）

### 后端

- **FastAPI** — 异步 Web 框架
- **Pydantic v2** — 数据校验与序列化
- **Celery** — 分布式任务队列
- **Redis** — 消息代理与结果存储
- **pymatgen / ASE** — 晶体结构解析
- **Docker** — 容器化部署

### 前端

- **React 19** — UI 框架
- **TypeScript** — 类型安全
- **Vite** — 构建工具与开发服务器
- **TailwindCSS v4** — 原子化 CSS
- **Zustand** — 轻量状态管理
- **React Hook Form** — 表单管理
- **Recharts** — 数据可视化（等温线图表）
- **Axios** — HTTP 客户端
- **Lucide React** — 图标库

---

## 引用

如果您使用了本项目的代码或数据，请引用原论文：

```bibtex
@article{wang2023metal,
  title={Metal-organic frameworks meet Uni-MOF: a revolutionary gas adsorption detector},
  author={Wang, Jingqi and Liu, Jiapeng and Wang, Hongshuai and Ke, Guolin and Zhang, Linfeng and Wu, Jianzhong and Gao, Zhifeng and Lu, Diannan},
  year={2023}
}
```

---

## 许可证

本项目基于 MIT 许可证开源，详见 [LICENSE](Uni-MOF-main/LICENSE)。
