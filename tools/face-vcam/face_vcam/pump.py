from __future__ import annotations

import threading
from pathlib import Path

import cv2
import numpy as np
import pyvirtualcam


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
) -> None:
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
            while not stop_event.is_set():
                ok, frame = cap.read()
                if not ok:
                    if loop:
                        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                        continue
                    break

                rgb = frame_to_rgb(frame, width, height)
                for _ in range(hold):
                    if stop_event.is_set():
                        break
                    cam.send(rgb)
                    cam.sleep_until_next_frame()
    finally:
        cap.release()