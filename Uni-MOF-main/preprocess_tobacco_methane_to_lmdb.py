import argparse
import json
import os
import pickle
import re
from multiprocessing import Pool

import lmdb
import numpy as np
from pymatgen.core import Structure
from pymatgen.io.cif import CifParser
from pymatgen.transformations.standard_transformations import ConventionalCellTransformation
from tqdm import tqdm


def normalize_atoms(atom: str) -> str:
    return re.sub(r"\d+", "", atom)


def transform(cif_path: str):
    parser = CifParser(cif_path, occupancy_tolerance=100)
    trans = ConventionalCellTransformation()
    return trans.apply_transformation(parser.get_structures()[0])


def cif_parser(cif_path: str, primitive: bool = False):
    try:
        s = Structure.from_file(cif_path, primitive=primitive)
    except Exception:
        s = transform(cif_path)

    cif_id = os.path.basename(cif_path)[:-4]
    lattice = s.lattice
    df = s.as_dataframe()

    atoms = df["Species"].astype(str).map(normalize_atoms).tolist()
    coordinates = df[["x", "y", "z"]].values.astype(np.float32)
    abc_coordinates = df[["a", "b", "c"]].values.astype(np.float32)

    return {
        "ID": cif_id,
        "atoms": atoms,
        "coordinates": coordinates,
        "abc": lattice.abc,
        "angles": lattice.angles,
        "volume": lattice.volume,
        "lattice_matrix": lattice.matrix,
        "charge": s.charge,
        "abc_coordinates": abc_coordinates,
    }


GAS_FEATURES_RAW = {
    "CH4": np.array([190.56, 45.99, 0.011, 16.043], dtype=np.float32),
    "CO2": np.array([304.13, 73.77, 0.224, 44.01], dtype=np.float32),
    "Ar":  np.array([150.87, 48.98, -0.002, 39.948], dtype=np.float32),
    "Kr":  np.array([209.48, 55.25, 0.005, 83.798], dtype=np.float32),
    "Xe":  np.array([289.77, 58.42, 0.004, 131.293], dtype=np.float32),
    "O2":  np.array([154.58, 50.43, 0.022, 31.998], dtype=np.float32),
    "N2":  np.array([126.19, 33.96, 0.037, 28.014], dtype=np.float32),
}
# Per-feature mean and std computed across all 7 gases above.
# Normalizing here prevents the large differences in scale
# (e.g. Tc ~150-300 vs acentric factor ~0.001-0.22) from
# dominating the gradient and destabilising training.
_GAS_ATTR_MEAN = np.array([205.08, 52.40, 0.043, 53.585], dtype=np.float32)
_GAS_ATTR_STD  = np.array([ 64.36,  9.95, 0.085, 37.636], dtype=np.float32)
GAS_FEATURES = {
    k: (v - _GAS_ATTR_MEAN) / _GAS_ATTR_STD
    for k, v in GAS_FEATURES_RAW.items()
}

GAS_NAME_TO_ID = {"CH4": 1, "CO2": 2, "Ar": 3, "Kr": 4, "Xe": 5, "O2": 6, "N2": 7}

GAS_INCHIKEYS = {
    "VNWKTOKETHGBQD-UHFFFAOYSA-N": "CH4",
    "XTWYTFMLZFPYCI-UHFFFAOYSA-N": "CO2",
    "XKRFYHLGVUSROY-UHFFFAOYSA-N": "Ar",
    "DHHSSJJSIQMWGU-UHFFFAOYSA-N": "Kr",
    "FHNFHKCVQCLJFQ-UHFFFAOYSA-N": "Xe",
    "MYMOFIZXZYHOMD-UHFFFAOYSA-N": "O2",
    "IJGRMHOSHXDMSA-UHFFFAOYSA-N": "N2",
}


def get_structure_features(obj):
    lcd = float(obj.get("lcd", 0.0) or 0.0)
    pld = float(obj.get("pld", 0.0) or 0.0)
    lfpd = float(obj.get("lfpd", obj.get("pld", 0.0)) or 0.0)
    density = float(obj.get("density", 0.0) or 0.0)
    asa_m2_cm3 = float(obj.get("surface_area_m2cm3", 0.0) or 0.0)
    asa_m2_g = float(obj.get("surface_area_m2g", 0.0) or 0.0)
    vf = float(obj.get("void_fraction", 0.0) or 0.0)
    return np.array([lcd, pld, lfpd, density, asa_m2_cm3, asa_m2_g, vf], dtype=np.float32)


def identify_gas(adsorbate):
    formula = adsorbate.get("formula", "")
    name = adsorbate.get("name", "")
    inchikey = adsorbate.get("InChIKey", "")

    if formula in GAS_NAME_TO_ID:
        return formula
    if name in GAS_NAME_TO_ID:
        return name
    if inchikey in GAS_INCHIKEYS:
        return GAS_INCHIKEYS[inchikey]

    name_lower = name.lower()
    for gas_name in GAS_NAME_TO_ID:
        if gas_name.lower() in name_lower:
            return gas_name

    return None


def get_adsorption(point, gas_name):
    if "total_adsorption" in point and point["total_adsorption"] is not None:
        return float(point["total_adsorption"])

    for species in point.get("species_data", []) or []:
        sp_name = species.get("name", "")
        sp_inchikey = species.get("InChIKey", "")

        if sp_name == gas_name:
            return float(species["adsorption"])
        if sp_inchikey in GAS_INCHIKEYS and GAS_INCHIKEYS[sp_inchikey] == gas_name:
            return float(species["adsorption"])

    return None


def build_rows_from_json_folder(data_dir: str):
    """
    Parse JSON files and build row list.

    NOTE (v3 fix): Interpolation augmentation has been intentionally removed.
    The Tobacco_CH4 dataset only has 3 original pressure points: 6, 65, 100 bar.
    The gap between 6 and 65 bar is physically non-linear (Langmuir-type
    adsorption). Log-linear interpolation in this large range (log10 0.778 to
    1.813) produced a spurious pressure point at ~13.3 bar (log10=1.123) whose
    target values are linearly interpolated and do not match the true adsorption
    curve. This caused models to systematically over-predict at p=1.123 bar
    (R² = -3.9 on held-out test set vs R² ≈ 0.92 at all other pressure points).

    Using only the 3 original GCMC-simulated pressure points ensures all
    training targets are physically grounded.
    """
    rows = []

    for fname in sorted(os.listdir(data_dir)):
        if not fname.endswith(".json"):
            continue

        json_path = os.path.join(data_dir, fname)
        cif_name = fname[:-5]

        try:
            with open(json_path, "r", encoding="utf-8") as f:
                obj = json.load(f)

            structure_features = get_structure_features(obj)
            isotherms = obj.get("isotherms", []) or []

            for iso in isotherms:
                adsorbates = iso.get("adsorbates", []) or []
                iso_gases = []
                for a in adsorbates:
                    gas = identify_gas(a)
                    if gas is not None:
                        iso_gases.append(gas)
                if not iso_gases:
                    continue

                temperature = iso.get("temperature")
                if temperature is None:
                    continue
                temperature = float(temperature)

                for point in iso.get("isotherm_data", []) or []:
                    if point.get("pressure") is None:
                        continue

                    pressure = float(point["pressure"])
                    if pressure <= 0:
                        continue

                    for gas_name in iso_gases:
                        target_value = get_adsorption(point, gas_name)
                        if target_value is None:
                            continue

                        gas_id = GAS_NAME_TO_ID[gas_name]
                        gas_attr = GAS_FEATURES[gas_name]
                        task_name = f"{cif_name}#{gas_name}#{temperature}#{pressure}"

                        rows.append((
                            cif_name,
                            gas_id,
                            gas_attr,
                            temperature,
                            pressure,
                            target_value,
                            task_name,
                            structure_features,
                        ))

        except Exception:
            continue

    return rows


def single_parser(args):
    cif_root, content = args
    cif_name, gas, gas_attr, temperature, pressure, target, task_name, structure_features = content
    cif_path = os.path.join(cif_root, f"{cif_name}.cif")

    if not os.path.exists(cif_path):
        print(f"[SKIP] CIF not found: {cif_path}")
        return None

    try:
        data = cif_parser(cif_path, primitive=False)
    except Exception as e:
        # Some CIF files in Tobacco are malformed (empty symmetry block,
        # fractional coords out of range, etc.). Skip them and continue
        # so one bad file does not abort the entire multiprocessing pool.
        print(f"[SKIP] Failed to parse {cif_path}: {e}")
        return None

    data["gas"] = np.array(gas, dtype=np.int32)
    data["gas_attr"] = gas_attr.astype(np.float32)
    data["temperature"] = np.array(temperature, dtype=np.float32)
    data["pressure"] = np.array(np.log10(pressure), dtype=np.float32)
    data["target"] = np.array(target, dtype=np.float32)
    data["task_name"] = task_name
    data["structure_features"] = structure_features.astype(np.float32)
    return pickle.dumps(data, protocol=-1)


def train_valid_test_split(rows, train_ratio=0.8, valid_ratio=0.1, seed=42):
    np.random.seed(seed)
    ids = sorted(set(r[0] for r in rows))
    ids = np.random.permutation(ids)

    n_train = int(len(ids) * train_ratio)
    n_valid = int(len(ids) * valid_ratio)
    train_ids = set(ids[:n_train])
    valid_ids = set(ids[n_train:n_train + n_valid])
    test_ids = set(ids[n_train + n_valid:])

    train_rows = [r for r in rows if r[0] in train_ids]
    valid_rows = [r for r in rows if r[0] in valid_ids]
    test_rows = [r for r in rows if r[0] in test_ids]
    return train_rows, valid_rows, test_rows


def dump_lmdb(output_file: str, content, cif_root: str, nthreads: int):
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    if os.path.exists(output_file):
        os.remove(output_file)

    env = lmdb.open(
        output_file,
        subdir=False,
        readonly=False,
        lock=False,
        readahead=False,
        meminit=False,
        max_readers=1,
        map_size=int(100e9),
    )

    txn = env.begin(write=True)
    n_ok = 0
    n_skip = 0
    with Pool(nthreads) as pool:
        for out in tqdm(pool.imap(single_parser, [(cif_root, x) for x in content]), total=len(content)):
            if out is None:
                n_skip += 1
                continue
            txn.put(f"{n_ok}".encode("ascii"), out)
            n_ok += 1
            if n_ok % 1000 == 0:
                txn.commit()
                txn = env.begin(write=True)

    txn.commit()
    env.close()
    print(f"{output_file}: {n_ok} samples written, {n_skip} skipped")


def main():
    parser = argparse.ArgumentParser(description="Convert Tobacco MOF dataset to Uni-MOF LMDB format (v3: no interpolation)")
    parser.add_argument("--data_dir", type=str, required=True, help="Folder containing paired .cif/.json files")
    parser.add_argument("--out_dir", type=str, required=True, help="Output root directory (lmdb files go into out_dir/task_name/)")
    parser.add_argument("--task_name", type=str, default="Tobacco_CH4", help="Task name used for subdirectory and training")
    parser.add_argument("--nthreads", type=int, default=8)
    args = parser.parse_args()

    rows = build_rows_from_json_folder(args.data_dir)
    print(f"total usable rows: {len(rows)}")
    if len(rows) == 0:
        raise RuntimeError("No valid rows parsed from json files. Please check data content.")

    targets = np.array([r[5] for r in rows])
    value_log1p = np.log1p(targets)
    _mean, _std = value_log1p.mean(), value_log1p.std()
    print(f"mean and std of target values (log1p) are: {_mean}, {_std}")
    print(f"Please add the following to ATTR_REGESTRY in regloss.py:")
    print(f"  '{args.task_name}': [{_mean}, {_std}, 'log1p_standardization'],")

    train_rows, valid_rows, test_rows = train_valid_test_split(rows)
    print(f"train/valid/test = {len(train_rows)}/{len(valid_rows)}/{len(test_rows)}")

    task_dir = os.path.join(args.out_dir, args.task_name)
    os.makedirs(task_dir, exist_ok=True)

    dump_lmdb(os.path.join(task_dir, "train.lmdb"), train_rows, args.data_dir, args.nthreads)
    dump_lmdb(os.path.join(task_dir, "valid.lmdb"), valid_rows, args.data_dir, args.nthreads)
    dump_lmdb(os.path.join(task_dir, "test.lmdb"), test_rows, args.data_dir, args.nthreads)


if __name__ == "__main__":
    main()
