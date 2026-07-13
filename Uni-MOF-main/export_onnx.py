"""
Export UniMOF v2 checkpoint to ONNX format.

Usage:
    python export_onnx.py \
        --checkpoint ./results/Tobacco_CH4/checkpoint_best.pt \
        --dict     ./lmdb_output/dict.txt \
        --output   ./export/unimof_tobacco_ch4.onnx \
        --task-name Tobacco_CH4
"""

import argparse
import os
import sys
import torch
import numpy as np

# ── make sure the project unimof package is importable ──────────────────────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def build_dummy_inputs(max_atoms: int = 64, device: torch.device = torch.device("cpu")):
    """
    Build a minimal dummy batch that matches the forward() signature of
    UniMOFV2Model. All values are random but type/shape-correct.

    Returns a dict ready to be unpacked as **model(**inputs).
    """
    B = 1  # batch size = 1 for export

    # gas token id (int, shape [B])
    gas = torch.tensor([1], dtype=torch.long, device=device)

    # gas attributes: 4-dim normalised physical properties [B, 4]
    gas_attr = torch.randn(B, 4, dtype=torch.float32, device=device)

    # pressure  (log10 bar), shape [B]
    pressure = torch.tensor([1.813], dtype=torch.float32, device=device)

    # temperature (K), shape [B]
    temperature = torch.tensor([298.0], dtype=torch.float32, device=device)

    # atom token ids, shape [B, max_atoms]  (0 = padding)
    src_tokens = torch.randint(1, 100, (B, max_atoms), dtype=torch.long, device=device)

    # pairwise distances, shape [B, max_atoms, max_atoms]
    src_distance = torch.rand(B, max_atoms, max_atoms, dtype=torch.float32, device=device)

    # 3-D coordinates, shape [B, max_atoms, 3]
    src_coord = torch.randn(B, max_atoms, 3, dtype=torch.float32, device=device)

    # edge type ids, shape [B, max_atoms, max_atoms]
    src_edge_type = torch.randint(0, 10, (B, max_atoms, max_atoms), dtype=torch.long, device=device)

    # structure features: [lcd, pld, lfpd, density, asa_m2cm3, asa_m2g, vf]
    structure_features = torch.randn(B, 7, dtype=torch.float32, device=device)

    return {
        "gas": gas,
        "gas_attr": gas_attr,
        "pressure": pressure,
        "temperature": temperature,
        "src_tokens": src_tokens,
        "src_distance": src_distance,
        "src_coord": src_coord,
        "src_edge_type": src_edge_type,
        "structure_features": structure_features,
    }


def load_model(checkpoint_path: str, dict_path: str, task_name: str):
    """Load UniMOF v2 model from a fine-tuned checkpoint."""
    from unicore import checkpoint_utils
    from unicore.data import Dictionary
    import unimof  # registers tasks / models / losses via __init__

    print(f"Loading dictionary from {dict_path}")
    dictionary = Dictionary.load(dict_path)

    print(f"Loading checkpoint from {checkpoint_path}")
    state = checkpoint_utils.load_checkpoint_to_cpu(checkpoint_path)
    args = state["args"]

    # Make sure task_name is set correctly
    args.task_name = task_name

    from unicore import tasks, models
    task = tasks.setup_task(args)
    model = task.build_model(args)

    # Load weights (strict=False to allow missing classification head keys)
    missing, unexpected = model.load_state_dict(state["model"], strict=False)
    if missing:
        print(f"[WARN] Missing keys ({len(missing)}): {missing[:5]} ...")
    if unexpected:
        print(f"[WARN] Unexpected keys ({len(unexpected)}): {unexpected[:5]} ...")

    model.eval()
    return model, args


def export_onnx(model, dummy_inputs: dict, output_path: str, opset: int = 17):
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    input_names = list(dummy_inputs.keys())
    # The model returns [logits]; logits shape is [B, num_classes]
    output_names = ["logits"]

    # Dynamic axes: batch dimension is axis 0 for most tensors;
    # sequence dimension (max_atoms) is axis 1 for token / distance tensors.
    dynamic_axes = {}
    seq_tensors = {"src_tokens", "src_distance", "src_coord", "src_edge_type"}
    for name in input_names:
        axes = {0: "batch"}
        if name in seq_tensors:
            axes[1] = "max_atoms"
        dynamic_axes[name] = axes
    dynamic_axes["logits"] = {0: "batch"}

    args_tuple = tuple(dummy_inputs[k] for k in input_names)

    print(f"Exporting ONNX (opset {opset}) → {output_path}")
    with torch.no_grad():
        torch.onnx.export(
            model,
            args_tuple,
            output_path,
            input_names=input_names,
            output_names=output_names,
            dynamic_axes=dynamic_axes,
            opset_version=opset,
            do_constant_folding=True,
            export_params=True,
        )
    print("ONNX export done.")

    # Quick sanity check with onnxruntime
    try:
        import onnxruntime as ort
        sess = ort.InferenceSession(output_path, providers=["CPUExecutionProvider"])
        feed = {k: v.numpy() for k, v in dummy_inputs.items()}
        out = sess.run(None, feed)
        print(f"ONNXRuntime sanity check passed. Output shape: {out[0].shape}")
    except ImportError:
        print("[SKIP] onnxruntime not installed, skipping sanity check.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--dict",       required=True)
    parser.add_argument("--output",     default="./export/unimof_tobacco_ch4.onnx")
    parser.add_argument("--task-name",  default="Tobacco_CH4")
    parser.add_argument("--max-atoms",  type=int, default=64)
    parser.add_argument("--opset",      type=int, default=17)
    args = parser.parse_args()

    device = torch.device("cpu")  # export on CPU for portability
    model, _ = load_model(args.checkpoint, args.dict, args.task_name)
    model = model.to(device)

    dummy = build_dummy_inputs(max_atoms=args.max_atoms, device=device)
    export_onnx(model, dummy, args.output, opset=args.opset)


if __name__ == "__main__":
    main()
