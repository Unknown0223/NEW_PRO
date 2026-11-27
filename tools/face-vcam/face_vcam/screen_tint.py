"""Pure helpers for screen flash detection and RGB tint blending."""

from __future__ import annotations

import threading
import time
from collections.abc import Callable

import cv2
import numpy as np

_SAMPLER_HZ = 12.0
_SAMPLER_INTERVAL = 1.0 / _SAMPLER_HZ


def _patch_extent(height: int, width: int) -> int:
    return max(8, min(height, width) // 20)


def _edge_patch_means(frame_bgr: np.ndarray) -> list[np.ndarray]:
    height, width = frame_bgr.shape[:2]
    ps = _patch_extent(height, width)
    top_mid_start = max(0, width // 2 - ps // 2)
    top_mid_end = min(width, top_mid_start + ps)

    side_mid_start = max(0, height // 2 - ps // 2)
    side_mid_end = min(height, side_mid_start + ps)

    patches = [
        frame_bgr[0:ps, 0:ps],
        frame_bgr[0:ps, width - ps : width],
        frame_bgr[height - ps : height, 0:ps],
        frame_bgr[height - ps : height, width - ps : width],
        frame_bgr[0:ps, top_mid_start:top_mid_end],
        frame_bgr[side_mid_start:side_mid_end, 0:ps],
        frame_bgr[side_mid_start:side_mid_end, width - ps : width],
    ]
    return [patch.mean(axis=(0, 1)) for patch in patches]


def _patch_passes_flash_gate(
    mean_bgr: np.ndarray, *, min_sat: int, min_val: int
) -> bool:
    pixel = np.clip(mean_bgr, 0, 255).astype(np.uint8).reshape(1, 1, 3)
    hsv = cv2.cvtColor(pixel, cv2.COLOR_BGR2HSV)
    sat = int(hsv[0, 0, 1])
    val = int(hsv[0, 0, 2])
    return sat >= min_sat and val >= min_val


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
    flash_means = [
        m
        for m in means
        if _patch_passes_flash_gate(m, min_sat=min_sat, min_val=min_val)
    ]
    if not flash_means:
        return None

    mean_bgr = np.median(np.stack(flash_means, axis=0), axis=0)
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


def _mss_grab_primary_bgr() -> np.ndarray:
    import mss

    with mss.mss() as sct:
        shot = sct.grab(sct.monitors[1])
        bgra = np.asarray(shot, dtype=np.uint8)
        return cv2.cvtColor(bgra, cv2.COLOR_BGRA2BGR)


class ScreenTintSampler:
    """Background ~12 Hz screen grab; publishes latest flash RGB under a lock."""

    def __init__(
        self,
        *,
        grab_bgr: Callable[[], np.ndarray] | None = None,
    ) -> None:
        self._grab_bgr = grab_bgr or _mss_grab_primary_bgr
        self._lock = threading.Lock()
        self._latest: tuple[int, int, int] | None = None
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self._thread is not None and self._thread.is_alive():
            return
        self._stop.clear()
        with self._lock:
            self._latest = None
        self._thread = threading.Thread(target=self._run, name="screen-tint-sampler", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=2.0)
            self._thread = None
        with self._lock:
            self._latest = None

    def latest_rgb(self) -> tuple[int, int, int] | None:
        with self._lock:
            return self._latest

    def _run(self) -> None:
        while not self._stop.is_set():
            t0 = time.monotonic()
            try:
                frame_bgr = self._grab_bgr()
                color = sample_flash_rgb(frame_bgr)
            except Exception:
                color = None
            if self._stop.is_set():
                break
            with self._lock:
                self._latest = color
            elapsed = time.monotonic() - t0
            wait = max(0.0, _SAMPLER_INTERVAL - elapsed)
            if self._stop.wait(wait):
                break