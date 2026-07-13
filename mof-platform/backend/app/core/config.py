"""
backend/app/core/config.py
统一配置管理（从环境变量读取，Pydantic BaseSettings）
"""
from functools import lru_cache
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # ── 服务基础 ──────────────────────────────────────────────────────────
    APP_NAME: str = "MOF Prediction Platform"
    API_PREFIX: str = "/api/v1"
    DEBUG: bool = False
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    # ── 模型路径（容器内路径，docker-compose 挂载）────────────────────────
    # 1-bar 低压模型
    CKPT_1BAR: str = "/models/S1_1bar_lora/checkpoint_best.pt"
    # 高压 Tobacco 模型
    CKPT_HIGHP: str = "/models/Tobacco_CH4_v2/checkpoint_best.pt"
    DICT_PATH: str  = "/models/dict.txt"
    UNIMOF_DIR: str = "/app/unimof"          # unimof Python 包目录

    # 压力路由阈值（bar）：低于此值用 1bar 专用模型
    PRESSURE_THRESHOLD_BAR: float = 2.0

    # ── 推理设备 ──────────────────────────────────────────────────────────
    DEVICE: str = "auto"   # auto | cuda | mps | cpu
    FP16: bool  = False    # 仅 CUDA 下有效
    MAX_ATOMS: int = 512

    # ── Redis（Celery broker + backend）──────────────────────────────────
    REDIS_URL: str = "redis://redis:6379/0"

    # ── 任务超时 ──────────────────────────────────────────────────────────
    TASK_SOFT_TIME_LIMIT: int = 120   # 秒
    TASK_HARD_TIME_LIMIT: int = 180

    # ── 文件上传 ──────────────────────────────────────────────────────────
    MAX_UPLOAD_MB: int = 20
    UPLOAD_DIR: str = "/tmp/mof_uploads"


@lru_cache
def get_settings() -> Settings:
    return Settings()
