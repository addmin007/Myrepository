"""
test_api.py  ──  本地快速冒烟测试（不需要 GPU/模型，测试 API 路由和数据验证逻辑）

用法：
    # 先启动服务（另一终端）：
    #   DEVICE=cpu FP16=0 python -m serve.api
    #
    # 再运行此脚本：
    python serve/test_api.py
"""

import json
import requests

BASE = "http://localhost:8000"

# ── 测试数据（简化版，5 个碳原子，仅用于接口验证）─────────────────────────
DUMMY_STRUCTURE = {
    "atoms":  ["C", "C", "C", "O", "N"],
    "coords": [
        [0.0, 0.0, 0.0],
        [1.5, 0.0, 0.0],
        [3.0, 0.0, 0.0],
        [4.5, 0.0, 0.0],
        [6.0, 0.0, 0.0],
    ],
    "structure_features": [8.5, 5.2, 7.1, 0.65, 1200.0, 1850.0, 0.72],
}


def test_health():
    r = requests.get(f"{BASE}/health")
    assert r.status_code == 200, r.text
    print(f"[PASS] /health → {r.json()}")


def test_predict():
    payload = {
        "structure": DUMMY_STRUCTURE,
        "gas": "CH4",
        "temperature_K": 298.0,
        "pressure_bar": 65.0,
    }
    r = requests.post(f"{BASE}/predict", json=payload)
    if r.status_code == 200:
        data = r.json()
        print(f"[PASS] /predict → uptake={data['uptake_cm3_cm3']:.3f} cm³/cm³  "
              f"({data['elapsed_ms']:.1f}ms)")
    else:
        print(f"[FAIL] /predict → {r.status_code}: {r.text[:200]}")


def test_isotherm():
    payload = {
        "structure": DUMMY_STRUCTURE,
        "gas": "CH4",
        "temperature_K": 298.0,
        "pressure_points_bar": [6.0, 65.0, 100.0],
    }
    r = requests.post(f"{BASE}/predict/isotherm", json=payload)
    if r.status_code == 200:
        data = r.json()
        pts = data["isotherm"]
        print(f"[PASS] /predict/isotherm → {len(pts)} points  "
              f"({data['elapsed_ms']:.1f}ms)")
        for pt in pts:
            print(f"       P={pt['pressure_bar']}bar → {pt['uptake_cm3_cm3']:.3f} cm³/cm³")
    else:
        print(f"[FAIL] /predict/isotherm → {r.status_code}: {r.text[:200]}")


def test_validation_error():
    """测试请求参数验证"""
    payload = {
        "structure": {
            "atoms": ["C"],
            "coords": [[0.0, 0.0]],           # 坐标应为 3 维，故意错误
            "structure_features": [1, 2, 3],  # 应为 7 维，故意错误
        },
        "gas": "CH4",
        "temperature_K": 298.0,
        "pressure_bar": 65.0,
    }
    r = requests.post(f"{BASE}/predict", json=payload)
    assert r.status_code == 422, f"Expected 422, got {r.status_code}"
    print(f"[PASS] validation error correctly returned 422")


if __name__ == "__main__":
    print("=" * 60)
    print("UniMOF v2 API Smoke Tests")
    print("=" * 60)
    test_health()
    test_validation_error()
    test_predict()
    test_isotherm()
    print("=" * 60)
    print("Done.")
