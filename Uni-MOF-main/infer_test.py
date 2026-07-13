#!/usr/bin/env python3
"""
对 lmdb test/valid split 做推理，输出 R2、MAE、RMSE 及逐样本 CSV。
"""
import sys, os, math, argparse, pickle
import numpy as np
import torch
import lmdb

sys.path.insert(0, '/root/Uni-MOF-main')
os.chdir('/root/Uni-MOF-main')

NORM = (2.9061722919, 0.8324204314)

def denorm(x):
    return math.expm1(float(x) * NORM[1] + NORM[0])

def load_model(ckpt_path, device):
    import unicore.utils as _u
    _u.import_user_module(argparse.Namespace(user_dir='./unimof'))
    from unicore import checkpoint_utils
    from unicore.data import Dictionary
    from unimof.models.unimof_1bar import UniMOF1barModel

    state = checkpoint_utils.load_checkpoint_to_cpu(ckpt_path)
    ckpt_args = state['args']
    ckpt_args.task_name = 'S1_CH4_1bar_fixed'

    # 用 checkpoint 对应的 dict_name + data 路径重建 Dictionary
    dict_path = os.path.join(ckpt_args.data, ckpt_args.dict_name)
    dictionary = Dictionary.load(dict_path)
    # 与训练时一致：加 MASK token
    dictionary.add_symbol('[MASK]', is_special=True)
    print(f'  Dictionary size: {len(dictionary)} (path: {dict_path})')

    model = UniMOF1barModel(ckpt_args, dictionary)

    # 手动过滤 shape 不匹配的 key（不应有，但保险起见）
    model_state = model.state_dict()
    filtered = {k: v for k, v in state['model'].items()
                if k in model_state and v.shape == model_state[k].shape}
    skipped = [k for k in state['model'] if k not in filtered]
    if skipped:
        print(f'  Skipped mismatched keys: {skipped}')
    model.load_state_dict(filtered, strict=False)
    missing = [k for k in model_state if k not in filtered]
    print(f'  Missing keys (will use random init): {len(missing)}')

    model.to(device).eval()
    print(f'  Loaded checkpoint: {ckpt_path}')
    return model

@torch.no_grad()
def run_sample(model, sample, device):
    def t(arr, dtype=torch.float32):
        return torch.tensor(np.array(arr), dtype=dtype).unsqueeze(0).to(device)

    sf = np.array(sample['structure_features'], dtype=np.float32)
    pv = float(sample.get('pv_cm3g', 0.0))
    sf_ext = np.concatenate([sf, [pv]])

    # pressure/temperature: EnvModel expects [batch] shape (1D)
    p_val = float(np.array(sample['pressure']).ravel()[0])
    t_val = float(np.array(sample['temperature']).ravel()[0])
    out = model(
        gas=t(sample['gas'], torch.long),
        gas_attr=t(sample['gas_attr']),
        pressure=torch.tensor([p_val], dtype=torch.float32).to(device),
        temperature=torch.tensor([t_val], dtype=torch.float32).to(device),
        src_tokens=t(sample['src_tokens'], torch.long),
        src_distance=t(sample['src_distance']),
        src_coord=t(sample['src_coord']),
        src_edge_type=t(sample['src_edge_type'], torch.long),
        structure_features=t(sf),
        structure_features_ext=t(sf_ext),
    )
    return float(out[0].squeeze().cpu().float())

def infer_lmdb(model, lmdb_path, device, label):
    env = lmdb.open(lmdb_path, subdir=False, readonly=True, lock=False, readahead=False)
    with env.begin() as txn:
        keys = [k for k in txn.cursor().iternext(values=False)]

    preds, targets, ids = [], [], []
    for key in keys:
        with env.begin() as txn:
            sample = pickle.loads(txn.get(key))
        logit = run_sample(model, sample, device)
        pred  = denorm(logit)
        tgt   = float(np.array(sample['target']).ravel()[0])
        sid   = sample.get('ID', key.decode() if isinstance(key, bytes) else str(key))
        preds.append(pred)
        targets.append(tgt)
        ids.append(sid)

    preds   = np.array(preds)
    targets = np.array(targets)

    ss_res = np.sum((targets - preds) ** 2)
    ss_tot = np.sum((targets - targets.mean()) ** 2)
    r2   = 1 - ss_res / ss_tot
    mae  = np.mean(np.abs(targets - preds))
    rmse = np.sqrt(np.mean((targets - preds) ** 2))

    print(f'\n{"="*60}')
    print(f' [{label}]  split: {lmdb_path.split("/")[-2]}/{lmdb_path.split("/")[-1]}')
    print(f'{"="*60}')
    print(f'  Samples : {len(keys)}')
    print(f'  R2      : {r2:.4f}')
    print(f'  MAE     : {mae:.4f} mol/kg')
    print(f'  RMSE    : {rmse:.4f} mol/kg')
    print(f'  Target  : {targets.min():.2f} ~ {targets.max():.2f} mol/kg  (mean={targets.mean():.2f})')
    print(f'  Pred    : {preds.min():.2f} ~ {preds.max():.2f} mol/kg  (mean={preds.mean():.2f})')

    print(f'\n  Worst 10 predictions (largest absolute error):')
    errs = np.abs(targets - preds)
    idx  = np.argsort(errs)[::-1][:10]
    print(f'  {"ID":38s}  {"target":>8}  {"pred":>8}  {"err":>8}')
    for i in idx:
        print(f'  {str(ids[i]):38s}  {targets[i]:8.3f}  {preds[i]:8.3f}  {errs[i]:8.3f}')

    out_csv = f'infer_{label}_{lmdb_path.split("/")[-1].replace(".lmdb","")}.csv'
    import csv
    with open(out_csv, 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['ID', 'target_mol_kg', 'pred_mol_kg', 'abs_error'])
        for i in range(len(ids)):
            w.writerow([ids[i], round(targets[i],6), round(preds[i],6),
                        round(abs(targets[i]-preds[i]),6)])
    print(f'\n  CSV saved: {out_csv}')
    return r2, mae, rmse

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--ckpt',  required=True)
    parser.add_argument('--label', default='model')
    parser.add_argument('--splits', default='test', help='comma-separated: test,valid')
    parser.add_argument('--device', default='cuda' if torch.cuda.is_available() else 'cpu')
    args = parser.parse_args()

    device = torch.device(args.device)
    print(f'\n[Inference] Device: {device}')
    model = load_model(args.ckpt, device)

    for split in args.splits.split(','):
        lmdb_path = f'./lmdb_s1_fixed/S1_CH4_1bar_fixed/{split.strip()}.lmdb'
        infer_lmdb(model, lmdb_path, device, args.label)

if __name__ == '__main__':
    main()
