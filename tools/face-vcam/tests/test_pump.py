import threading
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

from face_vcam.pump import frame_to_rgb, load_video, playback_hold_frames, run_pump
from face_vcam.screen_tint import ScreenTintSampler


def test_playback_hold_frames_slows_down():
    assert playback_hold_frames(1.0) == 1
    assert playback_hold_frames(0.5) == 2
    assert playback_hold_frames(0.25) == 4
    with pytest.raises(ValueError):
        playback_hold_frames(0)


def test_frame_to_rgb_cover_has_no_black_letterbox():
    frame_bgr = np.full((720, 1600, 3), (40, 180, 220), dtype=np.uint8)
    rgb = frame_to_rgb(frame_bgr, 1280, 720, zoom=1.9)
    assert rgb.shape == (720, 1280, 3)
    assert float(rgb[0, :].mean()) > 30
    assert float(rgb[-1, :].mean()) > 30
    assert float(rgb[:, 0].mean()) > 30
    assert float(rgb[:, -1].mean()) > 30


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


@patch("face_vcam.pump.pyvirtualcam.Camera")
@patch("face_vcam.pump.load_video")
def test_run_pump_freeze_at_end_holds_last_frame(mock_load_video, mock_camera_cls):
    frames = [
        np.full((48, 64, 3), 10, dtype=np.uint8),
        np.full((48, 64, 3), 200, dtype=np.uint8),
    ]
    reads = iter([(True, frames[0]), (True, frames[1]), (False, None)])

    cap = MagicMock()
    cap.read.side_effect = lambda: next(reads)
    mock_load_video.return_value = cap

    cam = MagicMock()
    mock_camera_cls.return_value.__enter__.return_value = cam
    mock_camera_cls.return_value.__exit__.return_value = False

    stop = threading.Event()
    threading.Timer(0.08, stop.set).start()

    run_pump(
        video_path="clip.mp4",
        loop=False,
        width=64,
        height=48,
        fps=30.0,
        stop_event=stop,
        backend="unitycapture",
        speed=1.0,
        freeze_at_end=True,
    )

    assert cam.send.call_count >= 3
    last = cam.send.call_args_list[-1].args[0]
    assert int(last.mean()) >= 180


@patch("face_vcam.pump.pyvirtualcam.Camera")
@patch("face_vcam.pump.load_video")
def test_run_pump_freeze_hold_applies_screen_tint(mock_load_video, mock_camera_cls):
    frame_bgr = np.full((48, 64, 3), 80, dtype=np.uint8)
    cap = MagicMock()
    cap.read.side_effect = [(True, frame_bgr), (False, None)]
    mock_load_video.return_value = cap

    cam = MagicMock()
    mock_camera_cls.return_value.__enter__.return_value = cam
    mock_camera_cls.return_value.__exit__.return_value = False

    sampler = MagicMock(spec=ScreenTintSampler)
    sampler.latest_wipe.return_value = ((0, 255, 0), (0, 255, 0), 1.0)

    stop = threading.Event()
    threading.Timer(0.08, stop.set).start()

    run_pump(
        video_path="clip.mp4",
        loop=False,
        width=64,
        height=48,
        fps=30.0,
        stop_event=stop,
        backend="unitycapture",
        speed=1.0,
        freeze_at_end=True,
        screen_tint=True,
        tint_alpha=0.5,
        tint_sampler=sampler,
    )

    assert cam.send.call_count >= 2
    for call in cam.send.call_args_list:
        sent = call.args[0]
        assert int(sent[:, :, 1].mean()) > int(sent[:, :, 0].mean())
        assert int(sent[:, :, 1].mean()) > int(sent[:, :, 2].mean())


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


@patch("face_vcam.pump.pyvirtualcam.Camera")
@patch("face_vcam.pump.load_video")
def test_run_pump_applies_screen_tint_when_enabled(mock_load_video, mock_camera_cls):
    frame_bgr = np.full((48, 64, 3), 100, dtype=np.uint8)
    cap = MagicMock()
    cap.read.side_effect = [(True, frame_bgr), (False, None)]
    mock_load_video.return_value = cap

    cam = MagicMock()
    mock_camera_cls.return_value.__enter__.return_value = cam
    mock_camera_cls.return_value.__exit__.return_value = False

    sampler = MagicMock(spec=ScreenTintSampler)
    sampler.latest_wipe.return_value = ((255, 0, 0), (255, 0, 0), 1.0)

    stop = threading.Event()

    run_pump(
        video_path="clip.mp4",
        loop=False,
        width=64,
        height=48,
        fps=30.0,
        stop_event=stop,
        backend="unitycapture",
        speed=1.0,
        freeze_at_end=False,
        screen_tint=True,
        tint_alpha=0.5,
        tint_sampler=sampler,
    )

    assert cam.send.called
    sent = cam.send.call_args_list[0].args[0]
    assert sent.shape == (48, 64, 3)
    # HSV keep-V: red hue without washing face — R dominates G/B
    assert int(sent[:, :, 0].mean()) > int(sent[:, :, 1].mean())
    assert int(sent[:, :, 0].mean()) > int(sent[:, :, 2].mean())
    assert int(sent[:, :, 0].mean()) > 90


@patch("face_vcam.pump.pyvirtualcam.Camera")
@patch("face_vcam.pump.load_video")
def test_run_pump_skips_tint_when_no_color(mock_load_video, mock_camera_cls):
    frame_bgr = np.full((48, 64, 3), 42, dtype=np.uint8)
    cap = MagicMock()
    cap.read.side_effect = [(True, frame_bgr), (False, None)]
    mock_load_video.return_value = cap

    cam = MagicMock()
    mock_camera_cls.return_value.__enter__.return_value = cam
    mock_camera_cls.return_value.__exit__.return_value = False

    sampler = MagicMock(spec=ScreenTintSampler)
    sampler.latest_wipe.return_value = None

    stop = threading.Event()

    run_pump(
        video_path="clip.mp4",
        loop=False,
        width=64,
        height=48,
        fps=30.0,
        stop_event=stop,
        backend="unitycapture",
        speed=1.0,
        freeze_at_end=False,
        screen_tint=True,
        tint_sampler=sampler,
    )

    sent = cam.send.call_args_list[0].args[0]
    expected = frame_to_rgb(frame_bgr, 64, 48)
    np.testing.assert_array_equal(sent, expected)


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