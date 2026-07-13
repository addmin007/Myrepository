# ─────────────────────────────────────────────────────────────────────────────
# UniMOF v2 推理服务 Dockerfile
#
# 构建：
#   docker build -t unimof-api:latest .
#
# 运行（GPU）：
#   docker run --gpus all -p 8000:8000 \
#     -v /path/to/checkpoint_best.pt:/app/weights/checkpoint_best.pt \
#     -v /path/to/lmdb_output_v2:/app/lmdb_output_v2 \
#     -e CKPT_PATH=/app/weights/checkpoint_best.pt \
#     -e USER_DIR=/app/unimof \
#     -e DICT_PATH=/app/lmdb_output_v2/Tobacco_CH4/dict.txt \
#     unimof-api:latest
#
# 运行（CPU，仅测试）：
#   docker run -p 8000:8000 \
#     -v /path/to/checkpoint_best.pt:/app/weights/checkpoint_best.pt \
#     -v /path/to/lmdb_output_v2:/app/lmdb_output_v2 \
#     -e CKPT_PATH=/app/weights/checkpoint_best.pt \
#     -e USER_DIR=/app/unimof \
#     -e DICT_PATH=/app/lmdb_output_v2/Tobacco_CH4/dict.txt \
#     -e DEVICE=cpu -e FP16=0 \
#     unimof-api:latest
# ─────────────────────────────────────────────────────────────────────────────

FROM pytorch/pytorch:2.1.2-cuda12.1-cudnn8-runtime

# ── 系统依赖 ──────────────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
        git curl build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Python 依赖（先拷贝 requirements 利用 Docker 层缓存）───────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── 安装 unicore（非 PyPI，从 GitHub 安装）──────────────────────────────────
RUN pip install --no-cache-dir \
    "unicore @ git+https://github.com/dptech-corp/Uni-Core.git@main"

# ── 拷贝项目代码 ──────────────────────────────────────────────────────────────
COPY unimof/      ./unimof/
COPY serve/       ./serve/
# 注意：checkpoint 和 lmdb 通过 -v 挂载，不打进镜像

# ── 默认环境变量（可在 docker run -e 中覆盖）─────────────────────────────────
ENV CKPT_PATH=/app/weights/checkpoint_best.pt \
    USER_DIR=/app/unimof \
    DICT_PATH=/app/lmdb_output_v2/Tobacco_CH4/dict.txt \
    DEVICE=cuda \
    FP16=1 \
    MAX_ATOMS=512 \
    PORT=8000 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

EXPOSE 8000

# ── 健康检查 ──────────────────────────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# ── 启动命令 ──────────────────────────────────────────────────────────────────
CMD ["uvicorn", "serve.api:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "1", \
     "--log-level", "info"]
