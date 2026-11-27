"""Full-pass xatolik.mp4: every vivid flash RGB + unique hues for 1:1 matching."""
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

import cv2
import numpy as np

VIDEO = Path(r"C:\Users\UNKNOWN\Videos\xatolik.mp4")
OUT = Path(__file__).resolve().parents[1] / "face_vcam" / "flash_palette.json"


def main() -> None:
    cap = cv2.VideoCapture(str(VIDEO))
    assert cap.isOpened(), VIDEO
    hex_counts: Counter[str] = Counter()
    hue_counts: Counter[int] = Counter()
    samples = 0
    i = 0
    while True:
        ok, bgr = cap.read()
        if not ok:
            break
        h, w = bgr.shape[:2]
        # modal-ish center + top/bot thirds
        x0, x1 = w // 5, 4 * w // 5
        for y0, y1 in ((0, h // 4), (h // 3, 2 * h // 3), (3 * h // 4, h)):
            patch = bgr[y0:y1, x0:x1]
            mean = patch.reshape(-1, 3).mean(axis=0)
            b, g, r = [int(round(x)) for x in mean]
            hsv = cv2.cvtColor(np.uint8([[[b, g, r]]]), cv2.COLOR_BGR2HSV)[0, 0]
            hh, s, v = int(hsv[0]), int(hsv[1]), int(hsv[2])
            if s >= 90 and v >= 100:
                hx = f"#{r:02x}{g:02x}{b:02x}"
                hex_counts[hx] += 1
                hue_counts[hh] += 1
                samples += 1
        i += 1
    cap.release()

    # Cluster by hue bucket → median RGB of top samples in bucket
    buckets: dict[int, list[tuple[int, int, int, int]]] = {}
    for hx, n in hex_counts.items():
        r = int(hx[1:3], 16)
        g = int(hx[3:5], 16)
        b = int(hx[5:7], 16)
        hsv = cv2.cvtColor(np.uint8([[[b, g, r]]]), cv2.COLOR_BGR2HSV)[0, 0]
        # 10-degree buckets on OpenCV hue
        bucket = int(hsv[0]) // 5 * 5
        buckets.setdefault(bucket, []).append((n, r, g, b))

    palette = []
    for bucket, items in sorted(buckets.items(), key=lambda kv: -sum(x[0] for x in kv[1])):
        items.sort(reverse=True)
        # weighted median-ish: take highest-count sample as exemplar
        _n, r, g, b = items[0]
        total = sum(x[0] for x in items)
        if total < 8:
            continue
        palette.append(
            {
                "hue_bucket": bucket,
                "rgb": [r, g, b],
                "hex": f"#{r:02x}{g:02x}{b:02x}",
                "n": total,
            }
        )

    payload = {
        "source": str(VIDEO),
        "frames": i,
        "vivid_samples": samples,
        "unique_hex": len(hex_counts),
        "top_hex": hex_counts.most_common(40),
        "palette": palette[:20],
    }
    OUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print("frames", i, "vivid", samples, "unique", len(hex_counts))
    print("palette:")
    for p in palette[:15]:
        print(p)


if __name__ == "__main__":
    main()
