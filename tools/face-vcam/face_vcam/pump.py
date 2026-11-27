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


def frame_to_rgb(frame_bgr: np.ndarray, width: int, height: int) -> np.ndarray:
    resized = cv2.resize(frame_bgr, (width, height), interpolation=cv2.INTER_AREA)
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
    freeze_at_end: bool = True,
    screen_tint: bool = False,
    tint_alpha: float = 0.45,
    tint_sampler: ScreenTintSampler | None = None,
) -> None:
    """Stream MP4 into a virtual webcam.

    Face ID: prefer loop=False + freeze_at_end=True so the clip does not
    rewind (rewind resets oval / «НЕ ДВИГАЙТЕСЬ» and looks like a cycle).
    """
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

                last_rgb = frame_to_rgb(frame, width, height)
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