#!/usr/bin/env python3
"""
test_local_inference.py

本地端到端验证脚本：
  1. 加载 1bar 低压模型（checkpoint_best.pt）
  2. 在 MPS / CPU 上运行随机 tensor 推理
  3. 测量单样本推理延迟（warmup + benchmark）
  4. 可选：加载高压模型做同样测试

用法:
  conda run -n unimof python test_local_inference.py
  conda run -n unimof python test_local_inference.py --device cpu
"""

import sys, os, time, argparse, math
import numpy as np
import torch
import torch.nn as nn

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)

import unimof.models, unimof.tasks, unimof.losses  # 注册所有模型


def get_device(requested):
    if requested == 'auto':
        if torch.cuda.is_available():
            return torch.device('cuda')
        elif torch.backends.mps.is_available():
            return torch.device('mps')
        else:
            return torch.device('cpu')
    return torch.device(requested)


def load_1bar_model(ckpt_path, device):
    from unicore import checkpoint_utils
    from unicore.data import Dictionary
    from unimof.models.unimof_1bar import UniMOF1barModel

    print(f"[load] 加载 1bar 模型: {ckpt_path}")
    state = checkpoint_utils.load_checkpoint_to_cpu(ckpt_path)
    saved_args = state['args']
    saved_args.task_name = 'S1_CH4_1bar_fixed'

    # dict.txt fallback
    dict_path = os.path.join(BASE, 'lmdb_s1_fixed', 'dict.txt')
    if not os.path.exists(dict_path):
        dict_path = os.path.join(BASE, 'examples', 'mof', 'dict.txt')
    dictionary = Dictionary.load(dict_path)

    # 对齐 vocab 大小：checkpoint 的 embed_tokens 可能比当前 dict 多 1 个 token
    # （backbone 预训练时的 dict 比当前 dict 多了一个 token）
    ckpt_vocab = state['model']['unimat.embed_tokens.weight'].shape[0]
    while len(dictionary) < ckpt_vocab:
        dictionary.add_symbol(f'[EXTRA_{len(dictionary)}]')
    if len(dictionary) != ckpt_vocab:
        raise RuntimeError(f"Dict size {len(dictionary)} != ckpt vocab {ckpt_vocab}")
    print(f"[load] vocab 大小对齐: {ckpt_vocab}")

    t0 = time.time()
    model = UniMOF1barModel(saved_args, dictionary)
    model.load_state_dict(state['model'], strict=False)
    model.to(device)
    model.eval()
    print(f"[load] 模型加载完成，耗时 {time.time()-t0:.2f}s，设备={device}")

    # 统计可训练参数
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total     = sum(p.numel() for p in model.parameters())
    print(f"[load] 可训练参数: {trainable:,} / {total:,}  ({100*trainable/total:.2f}%)")
    return model, saved_args


def make_dummy_batch(saved_args, device, batch_size=1):
    """构造随机 dummy 输入，与模型实际输入格式完全一致。"""
    # 从 saved_args 读取超参
    num_atoms  = getattr(saved_args, 'max_atoms', 512)
    num_atoms  = min(num_atoms, 64)   # 推理测试用小 batch

    def lt(shape, dtype=torch.float32):
        return torch.randn(batch_size, *shape, dtype=dtype).to(device)

    def li(shape, high):
        return torch.randint(0, high, (batch_size, *shape)).to(device)

    N = num_atoms
    gas_attr_dim = getattr(saved_args, 'gas_attr_input_dim', 4)  # 训练时固定为 4
    return dict(
        gas               = li((), 100),           # [B]
        gas_attr          = lt((gas_attr_dim,)),   # [B, 4]
        pressure          = torch.rand(batch_size).to(device),    # [B]，EnvModel 期望 1D
        temperature       = torch.rand(batch_size).to(device),    # [B]
        src_tokens        = li((N,), 80),
        src_distance      = lt((N, N)),
        src_coord         = lt((N, 3)),
        src_edge_type     = li((N, N), 100),
        structure_features     = lt((7,)),   # 原始 7-dim backbone 特征
        structure_features_ext = lt((8,)),   # 1bar 增强 8-dim（含 pv）
    )


@torch.no_grad()
def benchmark(model, saved_args, device, n_warmup=5, n_bench=20):
    print(f"\n[bench] 设备={device}  warmup={n_warmup}  runs={n_bench}")

    for i in range(n_warmup):
        batch = make_dummy_batch(saved_args, device)
        _ = model(**batch)
    if device.type == 'mps':
        torch.mps.synchronize()
    elif device.type == 'cuda':
        torch.cuda.synchronize()

    times = []
    for i in range(n_bench):
        batch = make_dummy_batch(saved_args, device)
        t0 = time.perf_counter()
        _ = model(**batch)
        if device.type == 'mps':
            torch.mps.synchronize()
        elif device.type == 'cuda':
            torch.cuda.synchronize()
        times.append((time.perf_counter() - t0) * 1000)

    mean_ms = np.mean(times)
    std_ms  = np.std(times)
    print(f"[bench] 单样本推理延迟: {mean_ms:.2f} ± {std_ms:.2f} ms")
    print(f"[bench] 吞吐量 (batch=1): {1000/mean_ms:.1f} samples/s")
    return mean_ms


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--device', default='auto',
                        choices=['auto', 'mps', 'cpu', 'cuda'])
    parser.add_argument('--ckpt-1bar',
                        default=os.path.join(BASE, '..', 'results', 'S1_1bar_lora', 'checkpoint_best.pt'))
    parser.add_argument('--also-cpu', action='store_true',
                        help='同时在 CPU 上跑一次，用于对比加速比')
    args = parser.parse_args()

    ckpt = os.path.abspath(args.ckpt_1bar)
    if not os.path.exists(ckpt):
        print(f"[ERROR] checkpoint 不存在: {ckpt}")
        sys.exit(1)

    device = get_device(args.device)
    print(f"[info] 使用设备: {device}")

    model, saved_args = load_1bar_model(ckpt, device)
    t_device = benchmark(model, saved_args, device)

    if args.also_cpu and device.type != 'cpu':
        cpu = torch.device('cpu')
        model_cpu, _ = load_1bar_model(ckpt, cpu)
        t_cpu = benchmark(model_cpu, saved_args, cpu, n_warmup=3, n_bench=10)
        speedup = t_cpu / t_device
        print(f"\n[result] {device.type.upper()} 相比 CPU 加速比: {speedup:.2f}x")

    print("\n[OK] 本地推理验证完成")


if __name__ == '__main__':
    main()
