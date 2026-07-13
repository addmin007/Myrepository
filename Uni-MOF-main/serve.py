"""
UniMOF inference server with TensorRT backend.

Supports two backends (set via env var INFERENCE_BACKEND):
  - "pytorch"   : original PyTorch model  (default, easier to debug)
  - "tensorrt"  : TensorRT engine         (fastest, requires tensorrt + pycuda)

Usage:
    pip install fastapi uvicorn python-multipart

    # PyTorch backend (development)
    INFERENCE_BACKEND=pytorch uvicorn serve:app --host 0.0.0.0 --port 8000

    # TensorRT backend (production)
    INFERENCE_BACKEND=tensorrt uvicorn serve:app --host 0.0.0.0 --port 8000

API:
    POST /predict
        form-data:
            cif_file : .cif file upload
            pressure : float  (bar, e.g. 65.0)
            temperature : float (K, default 298.0)
        returns:
            {
              "adsorption_cm3_per_cm3": 87.34,
              "pressure_bar": 65.0,
              "temperature_K": 298.0,
              "backend": "tensorrt",
              "latency_ms": 8.2
            }

    GET /health   → {"status": "ok", "backend": "..."}
"""

import os
import sys
import time
import math
import logging
import pickle
from typing import Optional

import numpy as np
import torch
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# ── config from environment ──────────────────────────────────────────────────
BACKEND        = os.getenv("INFERENCE_BACKEND", "pytorch")   # "pytorch" | "tensorrt"
CHECKPOINT     = os.getenv("CHECKPOINT",  "./results/Tobacco_CH4/checkpoint_best.pt")
DICT_PATH      = os.getenv("DICT_PATH",   "./lmdb_output/dict.txt")
ONNX_PATH      = os.getenv("ONNX_PATH",   "./export/unimof_tobacco_ch4.onnx")
ENGINE_PATH    = os.getenv("ENGINE_PATH", "./export/unimof_tobacco_ch4.trt")
TASK_NAME      = os.getenv("TASK_NAME",   "Tobacco_CH4")
MAX_ATOMS      = int(os.getenv("MAX_ATOMS", "512"))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── gas feature table (same as preprocess script) ────────────────────────────
_GAS_ATTR_MEAN = np.array([205.08, 52.40, 0.043, 53.585], dtype=np.float32)
_GAS_ATTR_STD  = np.array([ 64.36,  9.95, 0.085, 37.636], dtype=np.float32)
GAS_FEATURES_RAW = {
    "CH4": np.array([190.56, 45.99, 0.011, 16.043], dtype=np.float32),
}
GAS_FEATURES = {k: (v - _GAS_ATTR_MEAN) / _GAS_ATTR_STD for k, v in GAS_FEATURES_RAW.items()}
GAS_NAME_TO_ID = {"CH4": 1, "CO2": 2, "Ar": 3, "Kr": 4, "Xe": 5, "O2": 6, "N2": 7}

# ── normalisation (must match regloss.py ATTR_REGESTRY) ──────────────────────
MEAN_LOG1P = 4.3757066134
STD_LOG1P  = 1.0909639617

def denormalise(z: float) -> float:
    """Inverse of log1p-standardisation."""
    return math.expm1(z * STD_LOG1P + MEAN_LOG1P)


# ════════════════════════════════════════════════════════════════════════════
#  CIF → tensor preprocessing
# ════════════════════════════════════════════════════════════════════════════

def cif_to_tensors(cif_bytes: bytes, pressure_bar: float, temperature_k: float,
                   gas_name: str = "CH4", remove_hydrogen: bool = True):
    """
    Parse a CIF file and return a dict of tensors ready for model inference.
    Mirrors the logic in preprocess_tobacco_methane_to_lmdb.py.
    """
    import tempfile, re
    from pymatgen.core import Structure

    def normalize_atom(a: str) -> str:
        return re.sub(r"\d+", "", a)

    # Write bytes to a temp file so pymatgen can read it
    with tempfile.NamedTemporaryFile(suffix=".cif", delete=False) as tmp:
        tmp.write(cif_bytes)
        tmp_path = tmp.name

    try:
        s = Structure.from_file(tmp_path, primitive=False)
    finally:
        os.unlink(tmp_path)

    df = s.as_dataframe()
    atoms = df["Species"].astype(str).map(normalize_atom).tolist()

    if remove_hydrogen:
        keep = [i for i, a in enumerate(atoms) if a != "H"]
        atoms = [atoms[i] for i in keep]
        coords = df[["x", "y", "z"]].values[keep].astype(np.float32)
        abc_coords = df[["a", "b", "c"]].values[keep].astype(np.float32)
    else:
        coords = df[["x", "y", "z"]].values.astype(np.float32)
        abc_coords = df[["a", "b", "c"]].values.astype(np.float32)

    # Build distance matrix from fractional → cartesian coords
    lattice_matrix = s.lattice.matrix.astype(np.float32)
    cart_coords = abc_coords @ lattice_matrix           # [N, 3]
    diff = cart_coords[:, None, :] - cart_coords[None, :, :]  # [N, N, 3]
    dist = np.sqrt((diff ** 2).sum(-1))                 # [N, N]

    return {
        "atoms": atoms,
        "coordinates": coords,
        "src_distance": dist,
        "lattice_matrix": lattice_matrix,
        "gas_name": gas_name,
        "pressure_log10": float(np.log10(pressure_bar)),
        "temperature": float(temperature_k),
    }


def tensors_to_model_input(parsed: dict, dictionary, gas_name: str = "CH4",
                            device=torch.device("cpu")):
    """
    Convert parsed CIF data into model-ready tensors.
    Token ids come from the unicore Dictionary (same as training).
    Edge types are atom-pair type ids (atom_i * vocab + atom_j).
    """
    atoms   = parsed["atoms"]
    dist    = parsed["src_distance"]          # [N, N]
    N = len(atoms)

    # Token ids
    token_ids = np.array(
        [dictionary.bos()] +
        [dictionary.index(a) for a in atoms] +
        [dictionary.eos()],
        dtype=np.int64
    )                                          # [N+2]

    # Pad distance to [N+2, N+2] (add bos/eos rows/cols of zeros)
    pad = N + 2
    dist_pad = np.zeros((pad, pad), dtype=np.float32)
    dist_pad[1:N+1, 1:N+1] = dist

    # Edge type: simple atom-pair type encoding
    vocab = len(dictionary)
    edge_type = np.zeros((pad, pad), dtype=np.int64)
    for i, ai in enumerate(atoms):
        for j, aj in enumerate(atoms):
            ti = dictionary.index(ai)
            tj = dictionary.index(aj)
            edge_type[i+1, j+1] = ti * vocab + tj

    # Coordinates (add bos/eos as zero rows)
    coords = parsed["coordinates"]            # [N, 3]
    coord_pad = np.zeros((pad, 3), dtype=np.float32)
    coord_pad[1:N+1] = coords

    gas_id   = GAS_NAME_TO_ID[gas_name]
    gas_attr = GAS_FEATURES[gas_name]

    # Structure features: all zeros if not available from JSON
    structure_features = np.zeros(7, dtype=np.float32)

    return {
        "gas":               torch.tensor([gas_id],                    device=device),
        "gas_attr":          torch.tensor(gas_attr[None],              device=device),
        "pressure":          torch.tensor([parsed["pressure_log10"]], device=device),
        "temperature":       torch.tensor([parsed["temperature"]],    device=device),
        "src_tokens":        torch.tensor(token_ids[None],            device=device),
        "src_distance":      torch.tensor(dist_pad[None],             device=device),
        "src_coord":         torch.tensor(coord_pad[None],            device=device),
        "src_edge_type":     torch.tensor(edge_type[None],            device=device),
        "structure_features":torch.tensor(structure_features[None],   device=device),
    }


# ════════════════════════════════════════════════════════════════════════════
#  Backend implementations
# ════════════════════════════════════════════════════════════════════════════

class PyTorchBackend:
    def __init__(self):
        from unicore import checkpoint_utils
        from unicore.data import Dictionary
        import unimof  # register tasks/models

        logger.info(f"Loading dictionary from {DICT_PATH}")
        self.dictionary = Dictionary.load(DICT_PATH)

        logger.info(f"Loading checkpoint from {CHECKPOINT}")
        state = checkpoint_utils.load_checkpoint_to_cpu(CHECKPOINT)
        args  = state["args"]
        args.task_name = TASK_NAME

        from unicore import tasks
        task  = tasks.setup_task(args)
        self.model = task.build_model(args)
        self.model.load_state_dict(state["model"], strict=False)

        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model  = self.model.to(self.device).eval()
        logger.info(f"PyTorch backend ready on {self.device}")

    def predict(self, inputs: dict) -> float:
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        with torch.no_grad():
            logits = self.model(**inputs, features_only=True)[0]
        return float(logits.squeeze().cpu())


class TensorRTBackend:
    def __init__(self):
        import tensorrt as trt
        import pycuda.driver as cuda
        import pycuda.autoinit  # noqa: F401

        from unicore.data import Dictionary
        self.dictionary = Dictionary.load(DICT_PATH)

        TRT_LOGGER = trt.Logger(trt.Logger.WARNING)
        runtime    = trt.Runtime(TRT_LOGGER)
        with open(ENGINE_PATH, "rb") as f:
            self.engine = runtime.deserialize_cuda_engine(f.read())
        self.context = self.engine.create_execution_context()
        self.cuda    = cuda
        self.stream  = cuda.Stream()
        logger.info("TensorRT backend ready")

    def predict(self, inputs: dict) -> float:
        import pycuda.driver as cuda

        context = self.context
        stream  = self.stream

        # Set dynamic shapes
        for name, tensor in inputs.items():
            arr = tensor.squeeze(0).numpy() if tensor.dim() > 1 else tensor.numpy()
            context.set_input_shape(name, arr.shape if arr.ndim > 1 else (arr.size,))

        # Allocate + copy inputs
        gpu_buffers = {}
        for name, tensor in inputs.items():
            arr = tensor.numpy().astype(np.float32) if tensor.dtype == torch.float32 \
                  else tensor.numpy().astype(np.int64)
            gpu_buf = cuda.mem_alloc(arr.nbytes)
            cuda.memcpy_htod_async(gpu_buf, arr, stream)
            gpu_buffers[name] = (gpu_buf, arr)
            context.set_tensor_address(name, int(gpu_buf))

        # Output buffer
        out_shape = (1, 1)
        out_buf   = cuda.mem_alloc(4)   # float32
        out_host  = np.empty(out_shape, dtype=np.float32)
        context.set_tensor_address("logits", int(out_buf))

        context.execute_async_v3(stream_handle=stream.handle)
        cuda.memcpy_dtoh_async(out_host, out_buf, stream)
        stream.synchronize()

        return float(out_host.flatten()[0])


# ════════════════════════════════════════════════════════════════════════════
#  FastAPI app
# ════════════════════════════════════════════════════════════════════════════

app = FastAPI(title="UniMOF Inference API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lazy-load backend on first request
_backend = None

def get_backend():
    global _backend
    if _backend is None:
        if BACKEND == "tensorrt":
            _backend = TensorRTBackend()
        else:
            _backend = PyTorchBackend()
    return _backend


@app.get("/health")
def health():
    return {"status": "ok", "backend": BACKEND}


@app.post("/predict")
async def predict(
    cif_file:    UploadFile = File(..., description="MOF structure in CIF format"),
    pressure:    float      = Form(65.0,  description="Pressure in bar"),
    temperature: float      = Form(298.0, description="Temperature in K"),
    gas:         str        = Form("CH4", description="Gas name"),
):
    if gas not in GAS_NAME_TO_ID:
        raise HTTPException(400, f"Unsupported gas '{gas}'. Choose from {list(GAS_NAME_TO_ID)}")
    if pressure <= 0:
        raise HTTPException(400, "Pressure must be > 0 bar")

    try:
        cif_bytes = await cif_file.read()
    except Exception as e:
        raise HTTPException(400, f"Failed to read CIF file: {e}")

    try:
        t0     = time.perf_counter()
        parsed = cif_to_tensors(cif_bytes, pressure, temperature, gas)
        backend = get_backend()
        inputs  = tensors_to_model_input(parsed, backend.dictionary, gas)
        z       = backend.predict(inputs)                  # normalised output
        value   = denormalise(z)                           # cm3(STP)/cm3
        latency = (time.perf_counter() - t0) * 1000
    except Exception as e:
        logger.exception("Inference failed")
        raise HTTPException(500, f"Inference error: {e}")

    return {
        "adsorption_cm3_per_cm3": round(value, 4),
        "pressure_bar":           pressure,
        "temperature_K":          temperature,
        "gas":                    gas,
        "backend":                BACKEND,
        "latency_ms":             round(latency, 2),
    }
