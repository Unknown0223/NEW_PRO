"""Cluster vivid flash colors from xatolik frames + tint.log → canonical palette."""
from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
FRAME_DIRS = [
    ROOT / "scripts" / "_xatolik_frames2",
    ROOT / "scripts" / "_xatolik_frames",
]
LOG = ROOT / "logs" / "tint.log"
OUT = ROOT / "face_vcam" / "flash_palette.json"


def _hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    return f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"


def _hsv_of_rgb(rgb: tuple[int, int, int]) -> tuple[int, int, int]:
    pix = np.uint8([[list(rgb[::-1])]])  # BGR for OpenCV
    h, s, v = cv2.cvtColor(pix, cv2.COLOR_BGR2HSV)[0, 0]
    return int(h), int(s), int(v)


def sample_frame_bands(path: Path) -> list[tuple[int, int, int]]:
    bgr = cv2.imread(str(path))
    if bgr is None:
        return []
    h, w = bgr.shape[:2]
    bands = []
    for y0, y1 in ((0, h // 3), (2 * h // 3, h)):
        patch = bgr[y0:y1, w // 8 : w - w // 8]
        mean = patch.reshape(-1, 3).mean(axis=0)
        b, g, r = mean
        rgb = (int(round(r)), int(round(g)), int(round(b)))
        _h, s, v = _hsv_of_rgb(rgb)
        if s >= 100 and v >= 120:
            bands.append(rgb)
    return bands


def hue_bucket(h: int) -> str:
    # OpenCV H is 0..179
    if h < 8 or h >= 170:
        return "red"
    if h < 20:
        return "orange"
    if h < 40:
        return "yellow"
    if h < 55:
        return "lime"
    if h < 85:
        return "green"
    if h < 100:
        return "cyan"
    if h < 125:
        return "blue"
    if h < 155:
        return "magenta"
    return "red"


def main() -> None:
    samples: list[tuple[int, int, int]] = []
    for d in FRAME_DIRS:
        if not d.is_dir():
            continue
        for p in sorted(d.glob("*.jpg")):
            samples.extend(sample_frame_bands(p))

    if LOG.is_file():
        text = LOG.read_text(encoding="utf-8", errors="replace")
        for m in re.finditer(r"top=#([0-9a-f]{6}) bot=#([0-9a-f]{6})", text, re.I):
            for hx in (m.group(1), m.group(2)):
                rgb = _hex_to_rgb(hx)
                _h, s, v = _hsv_of_rgb(rgb)
                if s >= 100 and v >= 120:
                    samples.append(rgb)

    by_bucket: dict[str, list[tuple[int, int, int]]] = {}
    for rgb in samples:
        h, s, v = _hsv_of_rgb(rgb)
        by_bucket.setdefault(hue_bucket(h), []).append(rgb)

    palette: dict[str, dict] = {}
    for name, rgbs in sorted(by_bucket.items()):
        arr = np.array(rgbs, dtype=np.float64)
        mean = tuple(int(round(x)) for x in arr.mean(axis=0))
        # Prefer high-sat exemplar closest to mean hue
        best = max(rgbs, key=lambda c: _hsv_of_rgb(c)[1] + _hsv_of_rgb(c)[2] * 0.25)
        h, s, v = _hsv_of_rgb(best)
        palette[name] = {
            "rgb": list(best),
            "hex": _rgb_to_hex(best),
            "mean_rgb": list(mean),
            "hsv": [h, s, v],
            "n": len(rgbs),
        }

    # Drop rare muddy buckets
    palette = {k: v for k, v in palette.items() if v["n"] >= 5 and k != "orange"}

    payload = {
        "source": "xatolik_frames + tint.log",
        "sample_count": len(samples),
        "colors": palette,
        "ordered": [palette[k]["hex"] for k in sorted(palette.keys(), key=lambda x: palette[x]["hsv"][0])],
    }
    OUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
