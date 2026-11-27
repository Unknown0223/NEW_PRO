"""Analyze xatolik Face ID flash: exact colors + slide/wipe direction over time."""
from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
FRAMES = ROOT / "scripts" / "_xatolik_frames2"
OUT = ROOT / "logs" / "flash_motion_report.json"

# Prefer edges of the Face ID modal viewport (skip chrome)
def band_stats(bgr: np.ndarray) -> dict:
    h, w = bgr.shape[:2]
    # center crop roughly modal area
    x0, x1 = int(w * 0.25), int(w * 0.75)
    y0, y1 = int(h * 0.15), int(h * 0.85)
    roi = bgr[y0:y1, x0:x1]
    rh, rw = roi.shape[:2]
    # 3x3 grid of mean BGR
    cells = []
    for gy in range(3):
        for gx in range(3):
            cy0 = gy * rh // 3
            cy1 = (gy + 1) * rh // 3
            cx0 = gx * rw // 3
            cx1 = (gx + 1) * rw // 3
            patch = roi[cy0:cy1, cx0:cx1]
            mean = patch.reshape(-1, 3).mean(axis=0)
            b, g, r = mean
            rgb = (int(round(r)), int(round(g)), int(round(b)))
            hsv = cv2.cvtColor(
                np.uint8([[[b, g, r]]]), cv2.COLOR_BGR2HSV
            )[0, 0]
            cells.append(
                {
                    "gy": gy,
                    "gx": gx,
                    "rgb": list(rgb),
                    "hsv": [int(hsv[0]), int(hsv[1]), int(hsv[2])],
                    "sat": int(hsv[1]),
                    "val": int(hsv[2]),
                }
            )
    # horizontal profile: left→right vivid hue
    cols = 12
    hprof = []
    for i in range(cols):
        cx0 = i * rw // cols
        cx1 = (i + 1) * rw // cols
        # top and bottom thirds separately
        for label, yy0, yy1 in (
            ("top", 0, rh // 3),
            ("bot", 2 * rh // 3, rh),
        ):
            patch = roi[yy0:yy1, cx0:cx1]
            mean = patch.reshape(-1, 3).mean(axis=0)
            b, g, r = mean
            hsv = cv2.cvtColor(
                np.uint8([[[int(b), int(g), int(r)]]]), cv2.COLOR_BGR2HSV
            )[0, 0]
            hprof.append(
                {
                    "col": i,
                    "band": label,
                    "rgb": [int(round(r)), int(round(g)), int(round(b))],
                    "h": int(hsv[0]),
                    "s": int(hsv[1]),
                    "v": int(hsv[2]),
                }
            )
    return {"cells": cells, "hprof": hprof, "roi": [x0, y0, x1, y1]}


def vivid(cells: list[dict], min_s: int = 120, min_v: int = 120) -> list[dict]:
    return [c for c in cells if c["sat"] >= min_s and c["val"] >= min_v]


def main() -> None:
    paths = sorted(FRAMES.glob("f*.jpg"))
    frames = []
    for p in paths:
        bgr = cv2.imread(str(p))
        if bgr is None:
            continue
        st = band_stats(bgr)
        vv = vivid(st["cells"])
        frames.append(
            {
                "file": p.name,
                "vivid_n": len(vv),
                "vivid": vv,
                "hprof_vivid": [
                    x for x in st["hprof"] if x["s"] >= 120 and x["v"] >= 120
                ],
            }
        )

    # Detect slide: for consecutive vivid frames, see if hue centroid moves L→R or T→B
    motions = []
    prev = None
    for fr in frames:
        if fr["vivid_n"] == 0:
            prev = None
            continue
        # centroid of vivid cells
        xs = [c["gx"] for c in fr["vivid"]]
        ys = [c["gy"] for c in fr["vivid"]]
        cx = sum(xs) / len(xs)
        cy = sum(ys) / len(ys)
        hues = [c["hsv"][0] for c in fr["vivid"]]
        entry = {
            "file": fr["file"],
            "cx": round(cx, 2),
            "cy": round(cy, 2),
            "hues": hues,
            "rgbs": [c["rgb"] for c in fr["vivid"]],
        }
        if prev is not None:
            entry["dcx"] = round(cx - prev["cx"], 2)
            entry["dcy"] = round(cy - prev["cy"], 2)
        motions.append(entry)
        prev = entry

    # Summarize dominant slide axis
    dcxs = [m["dcx"] for m in motions if "dcx" in m]
    dcys = [m["dcy"] for m in motions if "dcy" in m]
    summary = {
        "frame_count": len(frames),
        "vivid_frame_count": sum(1 for f in frames if f["vivid_n"]),
        "mean_dcx": round(float(np.mean(dcxs)), 3) if dcxs else None,
        "mean_dcy": round(float(np.mean(dcys)), 3) if dcys else None,
        "abs_mean_dcx": round(float(np.mean(np.abs(dcxs))), 3) if dcxs else None,
        "abs_mean_dcy": round(float(np.mean(np.abs(dcys))), 3) if dcys else None,
        "slide_axis_guess": (
            "horizontal"
            if dcxs and (np.mean(np.abs(dcxs)) > np.mean(np.abs(dcys)) * 1.3)
            else (
                "vertical"
                if dcys and (np.mean(np.abs(dcys)) > np.mean(np.abs(dcxs)) * 1.3)
                else "swap_or_full"
            )
        ),
        "motions": motions,
        "vivid_frames": [f for f in frames if f["vivid_n"]],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print("slide_axis_guess", summary["slide_axis_guess"])
    print("abs_mean_dcx", summary["abs_mean_dcx"], "abs_mean_dcy", summary["abs_mean_dcy"])
    print("vivid_frames", summary["vivid_frame_count"], "/", summary["frame_count"])
    for m in motions[:12]:
        print(m)


if __name__ == "__main__":
    main()
