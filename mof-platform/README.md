# MOF Adsorption Prediction Platform

基于 UniMOF v2 + 1-bar LoRA 的 MOF 气体吸附预测 Web 平台。

## 架构

```
FastAPI  ←→  Redis  ←→  Celery Worker
   ↑                          ↓
 前端 (React/Vite)        ModelRegistry
                        ┌──────────────┐
                        │ 1bar LoRA    │  pressure ≤ 2 bar
                        │ Tobacco v2   │  pressure > 2 bar
                        └──────────────┘
```

## 本地快速启动（conda 环境 `unimof`）

### 前提

| 依赖 | 版本 |
|------|------|
| conda env `unimof` | Python 3.10 |
| PyTorch | 2.13.0 |
| unicore | 0.0.1 |
| Redis | ≥ 6（`brew install redis`） |
| Node.js | ≥ 18 |

### 1. 启动 Redis

```bash
brew services start redis
redis-cli ping   # 应返回 PONG
```

### 2. 启动 FastAPI（含模型预加载）

```bash
cd mof-platform/backend
conda activate unimof
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 验证
curl http://localhost:8000/health   # {"status":"ok"}
curl http://localhost:8000/ready    # {"models_loaded":2}
```

### 3. 启动 Celery Worker

```bash
# 新终端，同一目录
cd mof-platform/backend
conda activate unimof
celery -A app.tasks.celery_app worker --loglevel=info --pool=solo
```

> **macOS 注意**：必须用 `--pool=solo`，否则 PyTorch MPS 在 fork 子进程中会死锁。
> Linux 生产环境可使用默认 prefork pool（去掉此参数）。

### 4. 启动前端

```bash
cd mof-platform/frontend
npm install
npm run dev   # http://localhost:5173
```

前端 `/api/` 请求通过 Vite 代理转发到 `http://localhost:8000`。

---

## API 快速测试

### 单点预测

```bash
curl -X POST http://localhost:8000/api/v1/predict/submit \
  -F "cif_file=@/path/to/your.cif" \
  -F 'gas=CH4' -F 'temperature_K=298.0' -F 'pressure_bar=1.0' \
  -F 'lcd=8.0' -F 'pld=5.0' -F 'lfpd=4.0' -F 'density=0.8' \
  -F 'asa_m2cm3=300.0' -F 'asa_m2g=400.0' -F 'void_fraction=0.35' \
  -F 'pv_cm3g=0.2'
# 返回 {"task_id":"..."}
```

### 轮询结果

```bash
curl http://localhost:8000/api/v1/predict/status/<task_id>
```

### 等温线预测

```bash
curl -X POST http://localhost:8000/api/v1/predict/isotherm \
  -F "cif_file=@/path/to/your.cif" \
  -F 'gas=CH4' -F 'temperature_K=298.0' \
  -F 'pressure_points_json={"points":[0.5,1,2,5,10,20,35,65]}' \
  -F 'lcd=8.0' -F 'pld=5.0' -F 'lfpd=4.0' -F 'density=0.8' \
  -F 'asa_m2cm3=300.0' -F 'asa_m2g=400.0' -F 'void_fraction=0.35'
```

---

## 环境变量（backend/.env）

| 变量 | 说明 |
|------|------|
| `CKPT_1BAR` | 1-bar LoRA checkpoint 路径 |
| `CKPT_HIGHP` | 高压 Tobacco v2 checkpoint 路径 |
| `DICT_PATH` | dict.txt 路径（80→81 token 自动补齐）|
| `UNIMOF_DIR` | unimof Python 包所在目录 |
| `DEVICE` | `auto` / `cuda` / `mps` / `cpu` |
| `PRESSURE_THRESHOLD_BAR` | 模型路由阈值，默认 `2.0` |
| `REDIS_URL` | Celery broker/backend，本地 `redis://localhost:6379/0` |

---

## 已知修复的 Bug

| Bug | 修复位置 |
|-----|---------|
| `pressure.squeeze(-1)` 将 `[1]` 压成 0-dim 标量，导致 `pressure[:, None]` IndexError | `model_registry.py:infer()` |
| MPS 在 Celery fork 子进程中死锁 | `celery_app.py`: `worker_pool="solo"` |
| vocab 大小不对齐（dict 80 行，ckpt embed 81 行）| `model_registry.py:_load()` 动态 `add_symbol` |
