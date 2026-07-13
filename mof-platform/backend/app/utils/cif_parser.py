"""
backend/app/utils/cif_parser.py
三层降级 CIF 解析：pymatgen → ASE → 纯正则
"""
from __future__ import annotations

import math
import re
from typing import List, Tuple

import numpy as np


def parse_cif(cif_text: str) -> Tuple[List[str], np.ndarray]:
    """
    解析 CIF 文本，返回 (原子元素列表, 笛卡尔坐标 [N,3] float32)。
    优先使用 pymatgen，退而 ASE，最后纯正则兜底。
    """
    for parser in (_parse_pymatgen, _parse_ase, _parse_minimal):
        try:
            return parser(cif_text)
        except ImportError:
            continue
        except Exception:
            continue
    raise ValueError("CIF 文件解析失败：所有解析器均无法处理该文件")


def _parse_pymatgen(cif_text: str) -> Tuple[List[str], np.ndarray]:
    from pymatgen.core import Structure
    from pymatgen.io.cif import CifParser
    import warnings, io
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        parser = CifParser(io.StringIO(cif_text))
        structure: Structure = parser.parse_structures(primitive=False)[0]
    atoms  = [str(site.specie.symbol) for site in structure]
    coords = np.array([site.coords for site in structure], dtype=np.float32)
    return atoms, coords


def _parse_ase(cif_text: str) -> Tuple[List[str], np.ndarray]:
    import tempfile, os
    import ase.io
    with tempfile.NamedTemporaryFile(suffix=".cif", mode="w", delete=False) as f:
        f.write(cif_text)
        fname = f.name
    try:
        obj = ase.io.read(fname)
    finally:
        os.unlink(fname)
    atoms  = list(obj.get_chemical_symbols())
    coords = obj.get_positions().astype(np.float32)
    return atoms, coords


def _parse_minimal(cif_text: str) -> Tuple[List[str], np.ndarray]:
    """纯 Python 正则：读取晶胞参数 + _atom_site 分数坐标 → 笛卡尔坐标。"""

    def get_val(key: str) -> float | None:
        m = re.search(rf"^\s*{re.escape(key)}\s+(\S+)", cif_text, re.MULTILINE)
        return float(m.group(1).split("(")[0]) if m else None

    a = get_val("_cell_length_a")
    b = get_val("_cell_length_b")
    c = get_val("_cell_length_c")
    if None in (a, b, c):
        raise ValueError("缺少晶胞参数")

    al = math.radians(get_val("_cell_angle_alpha") or 90.0)
    be = math.radians(get_val("_cell_angle_beta")  or 90.0)
    ga = math.radians(get_val("_cell_angle_gamma") or 90.0)

    ca, cb, cg, sg = math.cos(al), math.cos(be), math.cos(ga), math.sin(ga)
    cx = cb
    cy = (ca - cb * cg) / sg
    cz = math.sqrt(max(1 - cx**2 - cy**2, 0))
    lat = np.array([[a, 0, 0], [b*cg, b*sg, 0], [c*cx, c*cy, c*cz]], dtype=np.float64)

    # 解析 _atom_site 块
    lines = cif_text.splitlines()
    headers: List[str] = []
    atom_lines: List[str] = []
    in_loop = False

    for line in lines:
        s = line.strip()
        if s == "loop_":
            headers = []
            atom_lines = []
            in_loop = True
            continue
        if in_loop and s.startswith("_atom_site_"):
            headers.append(s)
            continue
        if in_loop and headers and s and not s.startswith(("_", "loop_", "#")):
            atom_lines.append(s)
        elif in_loop and atom_lines and (s.startswith("loop_") or s.startswith("_")):
            break

    col_sym = col_x = col_y = col_z = None
    for i, h in enumerate(headers):
        if "type_symbol" in h:         col_sym = i
        elif "label" in h and col_sym is None: col_sym = i
        elif "fract_x" in h:           col_x = i
        elif "fract_y" in h:           col_y = i
        elif "fract_z" in h:           col_z = i

    if None in (col_sym, col_x, col_y, col_z):
        raise ValueError("未找到 _atom_site 分数坐标")

    atoms, frac = [], []
    for al_line in atom_lines:
        parts = al_line.split()
        if len(parts) <= max(col_sym, col_x, col_y, col_z):
            continue
        elem = re.sub(r"[^A-Za-z]", "", parts[col_sym])[:2].capitalize()
        if not elem:
            continue
        atoms.append(elem)
        frac.append([float(parts[col_x].split("(")[0]),
                     float(parts[col_y].split("(")[0]),
                     float(parts[col_z].split("(")[0])])

    if not atoms:
        raise ValueError("未解析到任何原子")

    cart = np.array(frac, dtype=np.float64) @ lat
    return atoms, cart.astype(np.float32)
