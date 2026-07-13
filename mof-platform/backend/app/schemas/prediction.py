"""
backend/app/schemas/prediction.py
请求 / 响应 Pydantic 模型
"""
from __future__ import annotations

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class GasType(str, Enum):
    CH4 = "CH4"
    CO2 = "CO2"
    N2  = "N2"
    H2  = "H2"


class TaskStatus(str, Enum):
    PENDING   = "PENDING"
    STARTED   = "STARTED"
    SUCCESS   = "SUCCESS"
    FAILURE   = "FAILURE"


# ── 请求体（CIF 文件通过 multipart/form-data 上传，结构特征随表单一起传）──────
class PredictFormParams(BaseModel):
    """对应 /predict/submit 的表单参数（非 CIF 文件部分）。"""
    gas: GasType = GasType.CH4
    temperature_K: float = Field(298.0, gt=0, description="温度（K）")

    # 单点预测：提供一个压力
    pressure_bar: Optional[float] = Field(None, gt=0, description="单点压力（bar）")

    # 等温线预测：提供多个压力点（JSON 字符串 "[1,5,10,65,100]"）
    pressure_points_bar: Optional[List[float]] = Field(None, description="等温线压力点列表（bar）")

    # 7 维结构特征（来自 Zeo++ 或用户填写）
    lcd:           float = Field(..., description="最大孔径直径 LCD（Å）")
    pld:           float = Field(..., description="孔限制直径 PLD（Å）")
    lfpd:          float = Field(..., description="最大自由路径直径 LFPD（Å）")
    density:       float = Field(..., gt=0, description="晶体密度（g/cm³）")
    asa_m2cm3:     float = Field(..., ge=0, description="可及表面积（m²/cm³）")
    asa_m2g:       float = Field(..., ge=0, description="可及表面积（m²/g）")
    void_fraction: float = Field(..., ge=0, le=1, description="空隙率（0-1）")

    # 1-bar 模型专用（可选）
    pv_cm3g: Optional[float] = Field(None, ge=0, description="孔体积（cm³/g），1-bar 模型专用")

    @field_validator("pressure_points_bar")
    @classmethod
    def sort_pressures(cls, v):
        if v is not None:
            if not v:
                raise ValueError("pressure_points_bar 不能为空列表")
            return sorted(v)
        return v


# ── 任务提交响应 ───────────────────────────────────────────────────────────────
class SubmitResponse(BaseModel):
    task_id: str
    status:  TaskStatus = TaskStatus.PENDING
    message: str = "任务已提交，请轮询 /predict/status/{task_id}"


# ── 单点推理结果 ───────────────────────────────────────────────────────────────
class SingleResult(BaseModel):
    uptake_mol_kg:  float = Field(..., description="预测吸附量（mol/kg）")
    uptake_cm3_cm3: float = Field(..., description="预测吸附量（cm³/cm³，密度换算）")
    pressure_bar:   float
    temperature_K:  float
    gas:            str
    model_used:     str   # "1bar_lora" | "tobacco_v2"
    elapsed_ms:     float


# ── 等温线单点 ────────────────────────────────────────────────────────────────
class IsothermPoint(BaseModel):
    pressure_bar:   float
    uptake_mol_kg:  float
    uptake_cm3_cm3: float


# ── 等温线推理结果 ─────────────────────────────────────────────────────────────
class IsothermResult(BaseModel):
    isotherm:     List[IsothermPoint]
    gas:          str
    temperature_K: float
    model_used:   str
    elapsed_ms:   float


# ── 任务状态查询响应 ───────────────────────────────────────────────────────────
class TaskStatusResponse(BaseModel):
    task_id:  str
    status:   TaskStatus
    result:   Optional[dict] = None   # SingleResult 或 IsothermResult 的 dict
    error:    Optional[str]  = None
    progress: Optional[int]  = None   # 0-100
