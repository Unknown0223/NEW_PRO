"""Pure helpers for screen flash detection and RGB tint blending."""

from __future__ import annotations

import cv2
import numpy as np


def _patch_extent(height: int, width: int) -> int:
    return max(8, min(height, width) // 20)


def _edge_patch_means(frame_bgr: np.ndarray) -> list[np.ndarray]:
    height, width = frame_bgr.shape[:2]
    ps = _patch_extent(height, width)
    top_mid_start = max(0, width // 2 - ps // 2)
    top_mid_end = min(width, top_mid_start + ps)

    patches = [
        frame_bgr[0:ps, 0:ps],
        frame_bgr[0:ps, width - ps : width],
        frame_bgr[height - ps : height, 0:ps],
        frame_bgr[height - ps : height, width - ps : width],
        frame_bgr[0:ps, top_mid_start:top_mid_end],
    ]
    return [patch.mean(axis=(0, 1)) for patch in patches]


def sample_flash_rgb(
    frame_bgr: np.ndarray,
    *,
    min_sat: int = 80,
    min_val: int = 80,
) -> tuple[int, int, int] | None:
    """
    Mean BGR from corner + top-edge patches; high HSV sat/val → RGB flash color.
    """
    if frame_bgr.ndim != 3 or frame_bgr.shape[2] != 3:
        return None

    means = _edge_patch_means(frame_bgr)
    mean_bgr = np.mean(means, axis=0)
    pixel = np.clip(mean_bgr, 0, 255).astype(np.uint8).reshape(1, 1, 3)
    hsv = cv2.cvtColor(pixel, cv2.COLOR_BGR2HSV)
    sat = int(hsv[0, 0, 1])
    val = int(hsv[0, 0, 2])
    if sat < min_sat or val < min_val:
        return None

    b, g, r = mean_bgr
    return (int(round(r)), int(round(g)), int(round(b)))


def apply_tint(
    frame_rgb: np.ndarray,
    color_rgb: tuple[int, int, int],
    alpha: float,
) -> np.ndarray:
    """Blend tint: out = clip((1 - alpha) * frame + alpha * color)."""
    tint = np.array(color_rgb, dtype=np.float64)
    blended = (1.0 - alpha) * frame_rgb.astype(np.float64) + alpha * tint
    return np.clip(blended, 0, 255).astype(np.uint8)