from __future__ import annotations

import threading
from pathlib import Path

import cv2
import numpy as np
import pyvirtualcam

from face_vcam.screen_tint import ScreenTintSampler, apply_tint


def load_video(path: str) -> cv2.VideoCapture:
    video_path = Path(path)
    if not video_path.is_file():
        raise FileNotFoundError(path)

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        cap.release()
        raise RuntimeError(f"Cannot read video file: {path}")
    return cap


def frame_to_rgb(
    frame_bgr: np.ndarray,
    width: int,
    height: int,
    zoom: float = 1.0,
) -> np.ndarray:
    """Center-crop (optional zoom) then resize to virtual-cam size as RGB."""
    src = frame_bgr
    z = float(zoom)
    if z > 1.0:
        h, w = src.shape[:2]
        crop_w = max(1, int(round(w / z)))
        crop_h = max(1, int(round(h / z)))
        x0 = max(0, (w - crop_w) // 2)
        # Bias upward: webcam faces sit in the upper half of many clips
        y0 = max(0, (h - crop_h) // 2 - crop_h // 6)
        if y0 + crop_h > h:
            y0 = max(0, h - crop_h)
        src = src[y0 : y0 + crop_h, x0 : x0 + crop_w]
    resized = cv2.resize(src, (width, height), interpolation=cv2.INTER_LINEAR)
    rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
    return np.asarray(rgb, dtype=np.uint8)


def _rgb_for_send(
    frame_rgb: np.ndarray,
    *,
    screen_tint: bool,
    tint_alpha: float,
    tint_sampler: ScreenTintSampler | None,
) -> np.ndarray:
    if not screen_tint or tint_sampler is None:
        return frame_rgb
    color = tint_sampler.latest_rgb()
    if color is None:
        return frame_rgb
    return apply_tint(frame_rgb, color, tint_alpha)


def playback_hold_frames(speed: float) -> int:
    """How many virtual-cam ticks to hold each source frame (speed 1.0 → 1)."""
    if speed <= 0:
        raise ValueError("speed must be > 0")
    return max(1, int(round(1.0 / float(speed))))


def run_pump(
    *,
    video_path: str,
    loop: bool,
    width: int,
    height: int,
    fps: float,
    stop_event: threading.Event,
    backend: str = "unitycapture",
    speed: float = 0.5,
    freeze_at_end: bool = False,
    zoom: float = 1.75,
    screen_tint: bool = False,
    tint_alpha: float = 0.45,
    tint_sampler: ScreenTintSampler | None = None,
) -> None:
    """Stream MP4 into a virtual webcam.

    Default: loop live video with mild center zoom so Face ID «ПРИБЛИЗЬТЕ»
    passes on distant selfie clips. freeze_at_end holds last frame instead.
    """
    if zoom < 1.0:
        raise ValueError("zoom must be >= 1.0")
    hold = playback_hold_frames(speed)
    cap = load_video(video_path)
    try:
        try:
            cam_ctx = pyvirtualcam.Camera(
                width=width,
                height=height,
                fps=fps,
                backend=backend,
            )
        except Exception as exc:
            raise RuntimeError(
                f"Unity Capture virtual camera is not available ({backend}): {exc}"
            ) from exc

        with cam_ctx as cam:
            last_rgb: np.ndarray | None = None
            while not stop_event.is_set():
                ok, frame = cap.read()
                if not ok:
                    if loop:
                        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                        continue
                    if freeze_at_end and last_rgb is not None:
                        while not stop_event.is_set():
                            out_rgb = _rgb_for_send(
                                last_rgb,
                                screen_tint=screen_tint,
                                tint_alpha=tint_alpha,
                                tint_sampler=tint_sampler,
                            )
                            cam.send(out_rgb)
                            cam.sleep_until_next_frame()
                    break

                last_rgb = frame_to_rgb(frame, width, height, zoom=zoom)
                for _ in range(hold):
                    if stop_event.is_set():
                        break
                    out_rgb = _rgb_for_send(
                        last_rgb,
                        screen_tint=screen_tint,
                        tint_alpha=tint_alpha,
                        tint_sampler=tint_sampler,
                    )
                    cam.send(out_rgb)
                    cam.sleep_until_next_frame()
    finally:
        cap.release()