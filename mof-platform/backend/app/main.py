"""
backend/app/main.py
FastAPI 应用入口
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api.predict import router as predict_router
from app.core.config import get_settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger("mof.main")
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """启动时初始化模型，关闭时清理。"""
    logger.info("🚀 Loading models...")
    from app.core.model_registry import ModelRegistry
    ModelRegistry.get().initialize(settings)
    logger.info("✅ Models ready")
    yield
    logger.info("👋 Shutting down")


app = FastAPI(
    title="MOF Adsorption Prediction Platform",
    description=(
        "Upload a CIF file and structural features to predict "
        "gas adsorption using UniMOF v2 + 1-bar LoRA models."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── 中间件 ────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1024)

# ── 路由 ──────────────────────────────────────────────────────────────────────
app.include_router(predict_router, prefix=settings.API_PREFIX)


@app.get("/health", tags=["system"])
def health():
    return {"status": "ok", "service": "MOF Prediction API"}


@app.get("/ready", tags=["system"])
def ready():
    from app.core.model_registry import ModelRegistry
    n = len(ModelRegistry.get()._models)
    return {"status": "ready", "models_loaded": n}
