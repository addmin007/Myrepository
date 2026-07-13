"""
backend/app/api/predict.py
推理相关 API 路由
"""
from __future__ import annotations

import json
import logging
from typing import Optional

from celery.result import AsyncResult
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from app.schemas.prediction import SubmitResponse, TaskStatus, TaskStatusResponse
from app.tasks.celery_app import celery_app
from app.tasks.inference import predict_isotherm, predict_single
from app.core.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/predict", tags=["prediction"])
_settings = get_settings()


# ── 公共参数解析 ───────────────────────────────────────────────────────────────
def _parse_sf(lcd, pld, lfpd, density, asa_m2cm3, asa_m2g, void_fraction):
    return [lcd, pld, lfpd, density, asa_m2cm3, asa_m2g, void_fraction]


# ── POST /predict/submit ───────────────────────────────────────────────────────
@router.post("/submit", response_model=SubmitResponse, summary="提交单点预测任务")
async def submit_single(
    cif_file:      UploadFile = File(...,  description="MOF CIF 结构文件"),
    gas:           str        = Form("CH4"),
    temperature_K: float      = Form(298.0),
    pressure_bar:  float      = Form(65.0),
    lcd:           float      = Form(...),
    pld:           float      = Form(...),
    lfpd:          float      = Form(...),
    density:       float      = Form(...),
    asa_m2cm3:     float      = Form(...),
    asa_m2g:       float      = Form(...),
    void_fraction: float      = Form(...),
    pv_cm3g:       Optional[float] = Form(None),
):
    _validate_gas(gas)
    cif_bytes = await cif_file.read()
    if len(cif_bytes) > _settings.MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(413, f"文件超过 {_settings.MAX_UPLOAD_MB}MB 限制")

    cif_text = cif_bytes.decode("utf-8", errors="replace")
    sf = _parse_sf(lcd, pld, lfpd, density, asa_m2cm3, asa_m2g, void_fraction)

    task = predict_single.delay(
        cif_text=cif_text,
        gas=gas,
        temperature_K=temperature_K,
        pressure_bar=pressure_bar,
        structure_features=sf,
        pv_cm3g=pv_cm3g,
        density=density,
    )
    logger.info(f"Submitted single task {task.id} | gas={gas} P={pressure_bar}bar")
    return SubmitResponse(task_id=task.id)


# ── POST /predict/isotherm ─────────────────────────────────────────────────────
@router.post("/isotherm", response_model=SubmitResponse, summary="提交等温线预测任务")
async def submit_isotherm(
    cif_file:             UploadFile   = File(...),
    gas:                  str          = Form("CH4"),
    temperature_K:        float        = Form(298.0),
    pressure_points_json: str          = Form('{"points":[1,5,10,20,35,50,65,100]}'),
    lcd:                  float        = Form(...),
    pld:                  float        = Form(...),
    lfpd:                 float        = Form(...),
    density:              float        = Form(...),
    asa_m2cm3:            float        = Form(...),
    asa_m2g:              float        = Form(...),
    void_fraction:        float        = Form(...),
    pv_cm3g:              Optional[float] = Form(None),
):
    _validate_gas(gas)
    cif_bytes = await cif_file.read()
    if len(cif_bytes) > _settings.MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(413, "CIF 文件过大")

    try:
        points = json.loads(pressure_points_json).get("points", [])
        if not points:
            raise ValueError
        pressure_points = sorted([float(p) for p in points])
    except Exception:
        raise HTTPException(422, "pressure_points_json 格式错误，期望 {\"points\":[1,5,...]}")

    cif_text = cif_bytes.decode("utf-8", errors="replace")
    sf = _parse_sf(lcd, pld, lfpd, density, asa_m2cm3, asa_m2g, void_fraction)

    task = predict_isotherm.delay(
        cif_text=cif_text,
        gas=gas,
        temperature_K=temperature_K,
        pressure_points_bar=pressure_points,
        structure_features=sf,
        pv_cm3g=pv_cm3g,
        density=density,
    )
    logger.info(f"Submitted isotherm task {task.id} | {len(pressure_points)} points")
    return SubmitResponse(task_id=task.id)


# ── GET /predict/status/{task_id} ─────────────────────────────────────────────
@router.get("/status/{task_id}", response_model=TaskStatusResponse, summary="查询任务状态")
def get_status(task_id: str):
    result: AsyncResult = celery_app.AsyncResult(task_id)

    if result.state == "PENDING":
        return TaskStatusResponse(task_id=task_id, status=TaskStatus.PENDING)
    if result.state == "STARTED":
        meta = result.info or {}
        return TaskStatusResponse(
            task_id=task_id,
            status=TaskStatus.STARTED,
            progress=meta.get("progress"),
        )
    if result.state == "SUCCESS":
        return TaskStatusResponse(
            task_id=task_id,
            status=TaskStatus.SUCCESS,
            result=result.result,
        )
    # FAILURE
    return TaskStatusResponse(
        task_id=task_id,
        status=TaskStatus.FAILURE,
        error=str(result.info),
    )


# ── GET /predict/history（Demo：返回最近 5 个已完成任务）──────────────────────
@router.get("/history", summary="（Demo）最近完成任务列表")
def get_history():
    """占位接口，生产中接 PostgreSQL。"""
    return {"message": "history endpoint - connect to DB in production"}


# ── 辅助 ──────────────────────────────────────────────────────────────────────
def _validate_gas(gas: str):
    allowed = {"CH4", "CO2", "N2", "H2"}
    if gas not in allowed:
        raise HTTPException(422, f"不支持的气体 '{gas}'，可选: {allowed}")
