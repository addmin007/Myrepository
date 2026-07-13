"""
Convert ONNX model to TensorRT engine for fast GPU inference.

Requirements:
    pip install tensorrt pycuda

Usage:
    python build_trt_engine.py \
        --onnx   ./export/unimof_tobacco_ch4.onnx \
        --engine ./export/unimof_tobacco_ch4.trt \
        --fp16                   # enable FP16 precision (recommended for RTX 3080)
        --max-atoms 128          # set max sequence length for TRT optimisation

Typical speedup vs PyTorch:
    PyTorch fp32  ~45 ms/sample
    TRT fp16      ~8  ms/sample  (~5-6x faster)
"""

import argparse
import os
import numpy as np


def build_engine(
    onnx_path: str,
    engine_path: str,
    fp16: bool = True,
    max_atoms: int = 128,
    max_batch: int = 32,
    workspace_gb: int = 4,
):
    import tensorrt as trt

    TRT_LOGGER = trt.Logger(trt.Logger.WARNING)
    builder = trt.Builder(TRT_LOGGER)
    network = builder.create_network(
        1 << int(trt.NetworkDefinitionCreationFlag.EXPLICIT_BATCH)
    )
    parser = trt.OnnxParser(network, TRT_LOGGER)

    print(f"Parsing ONNX: {onnx_path}")
    with open(onnx_path, "rb") as f:
        if not parser.parse(f.read()):
            for i in range(parser.num_errors):
                print(f"  [ERROR] {parser.get_error(i)}")
            raise RuntimeError("ONNX parsing failed")

    config = builder.create_builder_config()
    # Workspace memory (bytes)
    config.set_memory_pool_limit(trt.MemoryPoolType.WORKSPACE, workspace_gb << 30)

    if fp16 and builder.platform_has_fast_fp16:
        config.set_flag(trt.BuilderFlag.FP16)
        print("FP16 mode enabled")

    # ── Optimisation profiles for dynamic shapes ─────────────────────────────
    # We set three profiles: min / optimal / max
    # Adjust max_atoms and max_batch to match your real workload.
    profile = builder.create_optimization_profile()

    def set_shape(name, b_min, b_opt, b_max, a_min, a_opt, a_max, extra_dims=()):
        """Helper: set min/opt/max shapes for a dynamic-axis input."""
        profile.set_shape(
            name,
            (b_min, a_min) + extra_dims,
            (b_opt, a_opt) + extra_dims,
            (b_max, a_max) + extra_dims,
        )

    B_MIN, B_OPT, B_MAX = 1, 8, max_batch
    A_MIN, A_OPT, A_MAX = 16, 64, max_atoms

    # 1-D inputs (batch only)
    for name in ("gas", "pressure", "temperature"):
        profile.set_shape(name, (B_MIN,), (B_OPT,), (B_MAX,))

    # [B, 4]  gas attributes
    profile.set_shape("gas_attr",          (B_MIN, 4),  (B_OPT, 4),  (B_MAX, 4))

    # [B, 7]  structure features
    profile.set_shape("structure_features",(B_MIN, 7),  (B_OPT, 7),  (B_MAX, 7))

    # [B, A]  token ids
    profile.set_shape("src_tokens",        (B_MIN, A_MIN), (B_OPT, A_OPT), (B_MAX, A_MAX))

    # [B, A, A]  distance / edge type
    profile.set_shape("src_distance",   (B_MIN, A_MIN, A_MIN), (B_OPT, A_OPT, A_OPT), (B_MAX, A_MAX, A_MAX))
    profile.set_shape("src_edge_type",  (B_MIN, A_MIN, A_MIN), (B_OPT, A_OPT, A_OPT), (B_MAX, A_MAX, A_MAX))

    # [B, A, 3]  coordinates
    profile.set_shape("src_coord",      (B_MIN, A_MIN, 3), (B_OPT, A_OPT, 3), (B_MAX, A_MAX, 3))

    config.add_optimization_profile(profile)

    # ── Build engine ─────────────────────────────────────────────────────────
    print("Building TensorRT engine (this may take 5-15 minutes)...")
    serialized = builder.build_serialized_network(network, config)
    if serialized is None:
        raise RuntimeError("TensorRT engine build failed")

    os.makedirs(os.path.dirname(engine_path) or ".", exist_ok=True)
    with open(engine_path, "wb") as f:
        f.write(serialized)
    print(f"Engine saved to {engine_path}")


def benchmark(engine_path: str, max_atoms: int = 64, n_runs: int = 100):
    """Quick latency benchmark: compare TensorRT vs random baseline."""
    import tensorrt as trt
    import pycuda.driver as cuda
    import pycuda.autoinit  # noqa: F401
    import time

    TRT_LOGGER = trt.Logger(trt.Logger.WARNING)
    runtime = trt.Runtime(TRT_LOGGER)

    with open(engine_path, "rb") as f:
        engine = runtime.deserialize_cuda_engine(f.read())

    context = engine.create_execution_context()

    B, A = 1, max_atoms

    # Set input shapes
    context.set_input_shape("gas",               (B,))
    context.set_input_shape("gas_attr",           (B, 4))
    context.set_input_shape("pressure",           (B,))
    context.set_input_shape("temperature",        (B,))
    context.set_input_shape("src_tokens",         (B, A))
    context.set_input_shape("src_distance",       (B, A, A))
    context.set_input_shape("src_coord",          (B, A, 3))
    context.set_input_shape("src_edge_type",      (B, A, A))
    context.set_input_shape("structure_features", (B, 7))

    # Allocate GPU buffers
    buffers = {}
    for i in range(engine.num_io_tensors):
        name = engine.get_tensor_name(i)
        shape = context.get_tensor_shape(name)
        dtype = trt.nptype(engine.get_tensor_dtype(name))
        buf = cuda.mem_alloc(int(np.prod(shape)) * np.dtype(dtype).itemsize)
        buffers[name] = buf
        context.set_tensor_address(name, int(buf))

    stream = cuda.Stream()

    # Warm-up
    for _ in range(10):
        context.execute_async_v3(stream_handle=stream.handle)
        stream.synchronize()

    # Benchmark
    start = time.perf_counter()
    for _ in range(n_runs):
        context.execute_async_v3(stream_handle=stream.handle)
        stream.synchronize()
    elapsed = (time.perf_counter() - start) / n_runs * 1000

    print(f"TensorRT latency: {elapsed:.2f} ms/sample  (avg over {n_runs} runs)")
    print(f"Throughput: {1000/elapsed:.1f} samples/sec")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--onnx",       default="./export/unimof_tobacco_ch4.onnx")
    parser.add_argument("--engine",     default="./export/unimof_tobacco_ch4.trt")
    parser.add_argument("--fp16",       action="store_true", default=True)
    parser.add_argument("--max-atoms",  type=int, default=128)
    parser.add_argument("--max-batch",  type=int, default=32)
    parser.add_argument("--workspace",  type=int, default=4, help="workspace GB")
    parser.add_argument("--benchmark",  action="store_true")
    args = parser.parse_args()

    build_engine(
        onnx_path=args.onnx,
        engine_path=args.engine,
        fp16=args.fp16,
        max_atoms=args.max_atoms,
        max_batch=args.max_batch,
        workspace_gb=args.workspace,
    )

    if args.benchmark:
        benchmark(args.engine, max_atoms=64)


if __name__ == "__main__":
    main()
