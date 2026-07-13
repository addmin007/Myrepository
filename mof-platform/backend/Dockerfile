# backend/Dockerfile
FROM python:3.10-slim

WORKDIR /app

# 系统依赖（pymatgen 需要 gcc）
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ git curl \
    && rm -rf /var/lib/apt/lists/*

# Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 安装 unicore（无 CUDA）
RUN pip install --no-cache-dir --no-build-isolation \
    git+https://github.com/dptech-corp/Uni-Core.git

# 复制应用代码
COPY app/ ./app/

# 默认启动 FastAPI
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
