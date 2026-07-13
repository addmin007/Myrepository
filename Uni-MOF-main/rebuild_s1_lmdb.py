"""
rebuild_s1_lmdb.py
修复 S1 lmdb 中 structure_features[3] (density) = 0 的 bug。
- 从 xlsx 读取真实 density
- 更新 structure_features = [lcd, pld, lfpd, density, asa_m2cm3, asa_m2g, vf]
- structure_feature_dim 从 7 保持不变（density 填入正确值）
- target 保持不变（已经是正确的 cm3/cm3）
- 同时新增 pv_cm3g 字段供后续使用
- 输出到 lmdb_s1_fixed/S1_CH4_1bar/
"""
import os, pickle, lmdb, shutil
import numpy as np
import pandas as pd

SRC_DIR  = '/root/Uni-MOF-main/lmdb_s1_1bar/S1_CH4_1bar'
DST_DIR  = '/root/Uni-MOF-main/lmdb_s1_fixed/S1_CH4_1bar'
XLSX_PATH = '/root/Uni-MOF-main/data/Data/S1.xlsx'

os.makedirs('/root/Uni-MOF-main/lmdb_s1_fixed', exist_ok=True)
os.makedirs(DST_DIR, exist_ok=True)

# 读取 xlsx，建立 MOF_name -> row 的映射
df = pd.read_excel(XLSX_PATH)
xlsx_map = {}
for _, row in df.iterrows():
    xlsx_map[row['MOF']] = row
print(f"xlsx: {len(df)} rows loaded")

def read_lmdb(path):
    env = lmdb.open(path, subdir=False, readonly=True, lock=False)
    samples = []
    with env.begin() as txn:
        n = int(txn.stat()['entries'])
        for i in range(n):
            samples.append(pickle.loads(txn.get(str(i).encode())))
    env.close()
    return samples

def write_lmdb(path, samples):
    if os.path.exists(path):
        os.remove(path)
    env = lmdb.open(path, subdir=False, readonly=False, lock=False,
                    readahead=False, meminit=False, max_readers=1,
                    map_size=int(20e9))
    with env.begin(write=True) as txn:
        for i, s in enumerate(samples):
            txn.put(str(i).encode(), pickle.dumps(s, protocol=-1))
    env.close()
    print(f"  Written {len(samples)} samples -> {path}")

def fix_sample(s, xlsx_map):
    """修复 structure_features[3] = density，其余不变。"""
    mof_id = s['ID']
    if mof_id in xlsx_map:
        row = xlsx_map[mof_id]
        density = float(row['Density (g/cm3)'])
        pv      = float(row['PV (cm3/g)'])
    else:
        # 找不到就保留 0（少数情况）
        density = 0.0
        pv      = 0.0
        print(f"  WARNING: {mof_id} not in xlsx, density stays 0")

    sf = s['structure_features'].copy()
    sf[3] = np.float32(density)   # 修复 density
    s = dict(s)
    s['structure_features'] = sf
    s['pv_cm3g'] = np.float32(pv)  # 额外存储 PV
    return s

fixed_count = 0
missing_count = 0

for split in ['train', 'valid', 'test']:
    src_path = os.path.join(SRC_DIR, f'{split}.lmdb')
    dst_path = os.path.join(DST_DIR, f'{split}.lmdb')
    print(f"\nProcessing {split}...")
    samples = read_lmdb(src_path)

    fixed = []
    for s in samples:
        fs = fix_sample(s, xlsx_map)
        if fs['structure_features'][3] > 0:
            fixed_count += 1
        else:
            missing_count += 1
        fixed.append(fs)

    write_lmdb(dst_path, fixed)

    # 验证
    env = lmdb.open(dst_path, subdir=False, readonly=True, lock=False)
    with env.begin() as txn:
        s0 = pickle.loads(txn.get(b'0'))
        print(f"  Verify: sf[3] (density) = {s0['structure_features'][3]:.4f}")
        print(f"  Verify: target = {s0['target']:.4f} cm3/cm3")
    env.close()

# 复制 dict.txt
shutil.copy(
    os.path.join(SRC_DIR, '../dict.txt'),
    '/root/Uni-MOF-main/lmdb_s1_fixed/dict.txt'
)

print(f"\n=== Done ===")
print(f"Fixed density: {fixed_count}")
print(f"Missing (density=0): {missing_count}")

# 计算 S1 自己的 log1p 归一化参数
env = lmdb.open(os.path.join(DST_DIR, 'train.lmdb'), subdir=False, readonly=True, lock=False)
with env.begin() as txn:
    n = int(txn.stat()['entries'])
    targets = [float(pickle.loads(txn.get(str(i).encode()))['target']) for i in range(n)]
env.close()
log1p_vals = np.log1p(targets)
print(f"\nS1 ATTR_REGESTRY entry:")
print(f"  'S1_CH4_1bar_fixed': [{log1p_vals.mean():.10f}, {log1p_vals.std():.10f}, 'log1p_standardization'],")
