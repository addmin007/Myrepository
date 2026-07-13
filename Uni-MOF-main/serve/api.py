"""
api.py  ──  MOF 吸附量预测 FastAPI 服务

启动方式（开发）：
    uvicorn serve.api:app --host 0.0.0.0 --port 8000 --reload

环境变量（必填）：
    CKPT_PATH   : checkpoint_best.pt 的绝对路径
    USER_DIR    : unimof 目录的绝对路径（含 models/tasks 等）
    DICT_PATH   : dict.txt 的绝对路径
    DEVICE      : cuda 或 cpu（默认 cuda）
    FP16        : 1 或 0（默认 1）
    MAX_ATOMS   : 截断原子数上限（默认 512）

接口：
    GET  /health              → 健康检查
    POST /predict             → 单点预测（单 MOF + 单压力）
    POST /predict/isotherm    → 等温线预测（单 MOF + 多压力点）
    POST /predict/cif         → 从 CIF 文件推理（multipart/form-data）
"""

import io
import os
import time
import logging
import traceback
from pathlib import Path
from typing import List, Optional

import numpy as np
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger("mof_api")

# ── 全局 Predictor（懒加载，首次请求时初始化）────────────────────────────────
_predictor = None


def get_predictor():
    global _predictor
    if _predictor is None:
        from serve.mof_predictor import MofPredictor

        ckpt   = os.environ.get("CKPT_PATH", "results/Tobacco_CH4_v2/checkpoint_best.pt")
        udir   = os.environ.get("USER_DIR",  "unimof")
        dpath  = os.environ.get("DICT_PATH", "lmdb_output_v2/Tobacco_CH4/dict.txt")
        device = os.environ.get("DEVICE",    "cuda")
        fp16   = os.environ.get("FP16",      "1") == "1"
        maxatm = int(os.environ.get("MAX_ATOMS", "512"))

        logger.info(f"Initializing MofPredictor | ckpt={ckpt} | device={device} | fp16={fp16}")
        _predictor = MofPredictor(
            ckpt_path=ckpt,
            user_dir=udir,
            dict_path=dpath,
            device=device,
            fp16=fp16,
            max_atoms=maxatm,
        )
        logger.info("MofPredictor ready")
    return _predictor


# ── FastAPI App ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="UniMOF v2 Prediction API",
    description="Predict gas adsorption in MOF materials using UniMOF v2 model.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic 数据模型 ─────────────────────────────────────────────────────────

class StructureInput(BaseModel):
    """MOF 结构输入（原子列表 + 坐标）"""
    atoms: List[str] = Field(..., description="元素符号列表，如 ['C','H','O',...]")
    coords: List[List[float]] = Field(
        ..., description="笛卡尔坐标列表（Å），shape=(N,3)"
    )
    structure_features: List[float] = Field(
        ...,
        description=(
            "7 维结构特征：[lcd(Å), pld(Å), lfpd(Å), "
            "density(g/cm³), asa_m2cm3, asa_m2g, void_fraction]"
        ),
    )

    @validator("coords")
    def check_coords_shape(cls, v, values):
        if "atoms" in values and len(v) != len(values["atoms"]):
            raise ValueError("coords 行数必须与 atoms 长度相同")
        for row in v:
            if len(row) != 3:
                raise ValueError("每个坐标必须是 3 维")
        return v

    @validator("structure_features")
    def check_sf_dim(cls, v):
        if len(v) != 7:
            raise ValueError("structure_features 必须是 7 维")
        return v


class PredictRequest(BaseModel):
    structure: StructureInput
    gas: str = Field("CH4", description="气体名称：CH4 / CO2 / N2 / H2")
    temperature_K: float = Field(298.0, gt=0, description="温度（K）")
    pressure_bar: float = Field(65.0, gt=0, description="压力（bar）")


class PredictResponse(BaseModel):
    uptake_cm3_cm3: float = Field(..., description="预测吸附量（cm³/cm³）")
    gas: str
    temperature_K: float
    pressure_bar: float
    elapsed_ms: float


class IsothermRequest(BaseModel):
    structure: StructureInput
    gas: str = Field("CH4", description="气体名称")
    temperature_K: float = Field(298.0, gt=0)
    pressure_points_bar: List[float] = Field(
        [1.0, 5.0, 10.0, 20.0, 35.0, 50.0, 65.0, 80.0, 100.0],
        description="压力点列表（bar）",
    )

    @validator("pressure_points_bar")
    def check_pressures(cls, v):
        if not v:
            raise ValueError("至少提供 1 个压力点")
        if any(p <= 0 for p in v):
            raise ValueError("所有压力值必须大于 0")
        return sorted(v)


class IsothermPoint(BaseModel):
    pressure_bar: float
    uptake_cm3_cm3: float


class IsothermResponse(BaseModel):
    isotherm: List[IsothermPoint]
    gas: str
    temperature_K: float
    elapsed_ms: float


# ── 路由 ──────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    """健康检查（不触发模型加载）。"""
    return {"status": "ok", "service": "UniMOF v2 API"}


@app.get("/ready")
def ready():
    """就绪检查（触发模型初始化，若失败返回 503）。"""
    try:
        get_predictor()
        return {"status": "ready"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    """
    单点预测：给定 MOF 结构 + 气体条件，返回吸附量（cm³/cm³）。
    """
    predictor = get_predictor()
    t0 = time.perf_counter()

    atoms  = req.structure.atoms
    coords = np.array(req.structure.coords, dtype=np.float32)
    sf     = np.array(req.structure.structure_features, dtype=np.float32)

    try:
        uptake = predictor.predict(
            atoms=atoms,
            coords=coords,
            structure_features=sf,
            gas_name=req.gas,
            temperature_K=req.temperature_K,
            pressure_bar=req.pressure_bar,
        )
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Inference error: {e}")

    elapsed_ms = (time.perf_counter() - t0) * 1000
    logger.info(
        f"/predict | gas={req.gas} T={req.temperature_K}K P={req.pressure_bar}bar "
        f"| uptake={uptake:.3f} cm³/cm³ | {elapsed_ms:.1f}ms"
    )
    return PredictResponse(
        uptake_cm3_cm3=uptake,
        gas=req.gas,
        temperature_K=req.temperature_K,
        pressure_bar=req.pressure_bar,
        elapsed_ms=elapsed_ms,
    )


@app.post("/predict/isotherm", response_model=IsothermResponse)
def predict_isotherm(req: IsothermRequest):
    """
    等温线预测：给定多个压力点，批量返回完整等温线。
    """
    predictor = get_predictor()
    t0 = time.perf_counter()

    atoms  = req.structure.atoms
    coords = np.array(req.structure.coords, dtype=np.float32)
    sf     = np.array(req.structure.structure_features, dtype=np.float32)

    try:
        uptakes = predictor.predict_isotherm(
            atoms=atoms,
            coords=coords,
            structure_features=sf,
            gas_name=req.gas,
            temperature_K=req.temperature_K,
            pressure_points_bar=req.pressure_points_bar,
        )
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Inference error: {e}")

    elapsed_ms = (time.perf_counter() - t0) * 1000
    isotherm = [
        IsothermPoint(pressure_bar=p, uptake_cm3_cm3=u)
        for p, u in zip(req.pressure_points_bar, uptakes)
    ]
    logger.info(
        f"/predict/isotherm | gas={req.gas} T={req.temperature_K}K "
        f"| {len(isotherm)} points | {elapsed_ms:.1f}ms"
    )
    return IsothermResponse(
        isotherm=isotherm,
        gas=req.gas,
        temperature_K=req.temperature_K,
        elapsed_ms=elapsed_ms,
    )


@app.post("/predict/cif")
async def predict_cif(
    cif_file: UploadFile = File(..., description="CIF 格式的晶体结构文件"),
    gas: str = Form("CH4"),
    temperature_K: float = Form(298.0),
    pressure_bar: float = Form(65.0),
    lcd: float = Form(..., description="最大孔径（Å）"),
    pld: float = Form(..., description="孔限制直径（Å）"),
    lfpd: float = Form(..., description="最大自由路径（Å）"),
    density: float = Form(..., description="晶体密度（g/cm³）"),
    asa_m2cm3: float = Form(..., description="可及表面积（m²/cm³）"),
    asa_m2g: float = Form(..., description="可及表面积（m²/g）"),
    void_fraction: float = Form(..., description="空隙率（0-1）"),
):
    """
    从 CIF 文件推理（multipart/form-data）。
    结构特征需单独通过表单字段提供（Zeo++ 等工具计算）。

    示例（curl）：
        curl -X POST http://localhost:8000/predict/cif \\
          -F "cif_file=@mymof.cif" \\
          -F "gas=CH4" -F "temperature_K=298" -F "pressure_bar=65" \\
          -F "lcd=8.5" -F "pld=5.2" -F "lfpd=7.1" \\
          -F "density=0.65" -F "asa_m2cm3=1200" -F "asa_m2g=1850" \\
          -F "void_fraction=0.72"
    """
    # ── 解析 CIF ──────────────────────────────────────────────────────────
    try:
        cif_content = await cif_file.read()
        atoms, coords = _parse_cif(cif_content.decode("utf-8", errors="replace"))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CIF 解析失败: {e}")

    sf = np.array([lcd, pld, lfpd, density, asa_m2cm3, asa_m2g, void_fraction],
                  dtype=np.float32)

    predictor = get_predictor()
    t0 = time.perf_counter()
    try:
        uptake = predictor.predict(
            atoms=atoms,
            coords=coords,
            structure_features=sf,
            gas_name=gas,
            temperature_K=temperature_K,
            pressure_bar=pressure_bar,
        )
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Inference error: {e}")

    elapsed_ms = (time.perf_counter() - t0) * 1000
    return {
        "filename": cif_file.filename,
        "n_atoms_raw": len(atoms),
        "uptake_cm3_cm3": uptake,
        "gas": gas,
        "temperature_K": temperature_K,
        "pressure_bar": pressure_bar,
        "elapsed_ms": elapsed_ms,
    }


# ── CIF 解析工具 ──────────────────────────────────────────────────────────────

def _parse_cif(cif_text: str):
    """
    轻量级 CIF 解析器（无需 pymatgen / ase），仅支持标准 P1 CIF。
    返回 (atoms: List[str], coords: np.ndarray) 笛卡尔坐标（Å）。

    若环境中安装了 pymatgen，优先使用（更鲁棒）。
    """
    try:
        return _parse_cif_pymatgen(cif_text)
    except ImportError:
        pass
    try:
        return _parse_cif_ase(cif_text)
    except ImportError:
        pass
    return _parse_cif_minimal(cif_text)


def _parse_cif_pymatgen(cif_text: str):
    from pymatgen.core import Structure
    from pymatgen.io.cif import CifParser
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        parser = CifParser.from_str(cif_text)
        structure = parser.parse_structures(primitive=False)[0]
    atoms  = [str(site.specie.symbol) for site in structure]
    coords = np.array([site.coords for site in structure], dtype=np.float32)
    return atoms, coords


def _parse_cif_ase(cif_text: str):
    import tempfile, ase.io
    with tempfile.NamedTemporaryFile(suffix=".cif", mode="w", delete=False) as f:
        f.write(cif_text)
        fname = f.name
    atoms_obj = ase.io.read(fname)
    os.unlink(fname)
    atoms  = list(atoms_obj.get_chemical_symbols())
    coords = atoms_obj.get_positions().astype(np.float32)
    return atoms, coords


def _parse_cif_minimal(cif_text: str):
    """
    最简 CIF 解析：读取 _cell_* 参数 + _atom_site_* 分数坐标 → 转为笛卡尔。
    仅支持标准格式，不处理对称操作。
    """
    import math, re

    def get_val(key, text):
        m = re.search(rf"^\s*{re.escape(key)}\s+(\S+)", text, re.MULTILINE)
        return float(m.group(1).split("(")[0]) if m else None

    a = get_val("_cell_length_a", cif_text)
    b = get_val("_cell_length_b", cif_text)
    c = get_val("_cell_length_c", cif_text)
    al = math.radians(get_val("_cell_angle_alpha", cif_text) or 90.0)
    be = math.radians(get_val("_cell_angle_beta",  cif_text) or 90.0)
    ga = math.radians(get_val("_cell_angle_gamma", cif_text) or 90.0)

    if None in (a, b, c):
        raise ValueError("无法从 CIF 中读取晶胞参数")

    # 构建晶格矩阵（转置形式，行=晶格向量）
    ca, cb, cg = math.cos(al), math.cos(be), math.cos(ga)
    sg = math.sin(ga)
    cx = cb
    cy = (ca - cb * cg) / sg
    cz = math.sqrt(max(1 - cx**2 - cy**2, 0))
    lat = np.array([
        [a,       0,    0],
        [b * cg,  b*sg, 0],
        [c * cx,  c*cy, c*cz],
    ], dtype=np.float64)

    # 解析原子坐标块
    lines = cif_text.splitlines()
    col_label = col_sym = col_x = col_y = col_z = None
    headers = []
    atom_lines = []
    in_loop = False
    for line in lines:
        s = line.strip()
        if s.startswith("loop_"):
            headers = []
            in_loop = True
            continue
        if in_loop and s.startswith("_atom_site_"):
            headers.append(s)
            continue
        if in_loop and headers and s and not s.startswith("_") and not s.startswith("loop_"):
            atom_lines.append(s)
            continue
        if in_loop and (s.startswith("loop_") or s.startswith("_") or not s):
            if atom_lines:
                in_loop = False

    # 识别列顺序
    for i, h in enumerate(headers):
        if "type_symbol" in h:
            col_sym = i
        elif "label" in h and col_sym is None:
            col_label = i
        elif "fract_x" in h:
            col_x = i
        elif "fract_y" in h:
            col_y = i
        elif "fract_z" in h:
            col_z = i

    elem_col = col_sym if col_sym is not None else col_label
    if None in (elem_col, col_x, col_y, col_z):
        raise ValueError("CIF 中找不到原子分数坐标列")

    atoms, frac = [], []
    for al_line in atom_lines:
        parts = al_line.split()
        if len(parts) <= max(elem_col, col_x, col_y, col_z):
            continue
        elem = re.sub(r"[^A-Za-z]", "", parts[elem_col])[:2].capitalize()
        if not elem:
            continue
        fx = float(parts[col_x].split("(")[0])
        fy = float(parts[col_y].split("(")[0])
        fz = float(parts[col_z].split("(")[0])
        atoms.append(elem)
        frac.append([fx, fy, fz])

    if not atoms:
        raise ValueError("CIF 中未找到任何原子")

    frac_arr = np.array(frac, dtype=np.float64)
    cart = frac_arr @ lat
    return atoms, cart.astype(np.float32)


# ── 全局异常处理 ──────────────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {type(exc).__name__}: {exc}"},
    )


# ── 开发启动入口 ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "serve.api:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 8000)),
        reload=False,
        log_level="info",
    )
