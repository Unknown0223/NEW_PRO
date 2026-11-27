import threading
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

from face_vcam.pump import frame_to_rgb, load_video, playback_hold_frames, run_pump


def test_playback_hold_frames_slows_down():
    assert playback_hold_frames(1.0) == 1
    assert playback_hold_frames(0.5) == 2
    assert playback_hold_frames(0.25) == 4
    with pytest.raises(ValueError):
        playback_hold_frames(0)


def test_frame_to_rgb_resizes_and_is_rgb():
    # BGR 100x50 -> RGB 1280x720
    frame_bgr = np.zeros((50, 100, 3), dtype=np.uint8)
    frame_bgr[:, :, 0] = 255  # blue in BGR

    rgb = frame_to_rgb(frame_bgr, 1280, 720)

    assert rgb.shape == (720, 1280, 3)
    assert rgb.dtype == np.uint8
    # BGR blue -> RGB blue channel
    assert rgb[360, 640, 2] == 255
    assert rgb[360, 640, 0] == 0


def test_load_video_missing_path_raises():
    missing = Path(__file__).parent / "no_such_video_9f3a2c1b.mp4"
    with pytest.raises(FileNotFoundError):
        load_video(str(missing))


@patch("face_vcam.pump.cv2.VideoCapture")
def test_load_video_unreadable_raises(mock_video_capture, tmp_path):
    existing = tmp_path / "unreadable.mp4"
    existing.write_bytes(b"not a real container")
    cap = MagicMock()
    cap.isOpened.return_value = False
    mock_video_capture.return_value = cap

    with pytest.raises(RuntimeError, match="Cannot read video file"):
        load_video(str(existing))

    cap.release.assert_called_once()


@patch("face_vcam.pump.pyvirtualcam.Camera")
@patch("face_vcam.pump.load_video")
def test_run_pump_sends_frames_until_stop(mock_load_video, mock_camera_cls, tmp_path):
    video = tmp_path / "clip.avi"
    # Minimal valid single-frame video via OpenCV write in pump tests only
    import cv2

    writer = cv2.VideoWriter(
        str(video),
        cv2.VideoWriter_fourcc(*"MJPG"),
        30.0,
        (64, 48),
    )
    frame = np.zeros((48, 64, 3), dtype=np.uint8)
    writer.write(frame)
    writer.release()

    cap = cv2.VideoCapture(str(video))
    assert cap.isOpened()
    mock_load_video.return_value = cap

    cam = MagicMock()
    mock_camera_cls.return_value.__enter__.return_value = cam
    mock_camera_cls.return_value.__exit__.return_value = False

    stop = threading.Event()

    def set_stop():
        stop.set()

    timer = threading.Timer(0.05, set_stop)
    timer.start()
    try:
        run_pump(
            video_path=str(video),
            loop=True,
            width=1280,
            height=720,
            fps=30.0,
            stop_event=stop,
            backend="unitycapture",
            speed=0.5,
        )
    finally:
        timer.cancel()
    cap.release()

    assert mock_camera_cls.called
    assert cam.send.call_count >= 2
    assert cam.sleep_until_next_frame.call_count >= 2


@patch("face_vcam.pump.load_video")
@patch("face_vcam.pump.pyvirtualcam.Camera")
def test_run_pump_missing_backend_raises(mock_camera_cls, mock_load_video):
    mock_load_video.return_value = MagicMock()
    mock_camera_cls.side_effect = RuntimeError("no device")
    stop = threading.Event()
    stop.set()
    with pytest.raises(RuntimeError, match="Unity Capture"):
        run_pump(
            video_path="C:\\fake\\video.mp4",
            loop=False,
            width=640,
            height=480,
            fps=30.0,
            stop_event=stop,
            backend="unitycapture",
        )


@patch("face_vcam.pump.load_video")
@patch("face_vcam.pump.pyvirtualcam.Camera")
def test_run_pump_camera_init_oserror_wrapped(mock_camera_cls, mock_load_video):
    mock_load_video.return_value = MagicMock()
    mock_camera_cls.side_effect = OSError("backend dll missing")
    stop = threading.Event()
    stop.set()
    with pytest.raises(RuntimeError, match="Unity Capture"):
        run_pump(
            video_path="C:\\fake\\video.mp4",
            loop=False,
            width=640,
            height=480,
            fps=30.0,
            stop_event=stop,
            backend="unitycapture",
        )