import time

import numpy as np

from face_vcam.screen_tint import ScreenTintSampler, apply_tint, sample_flash_rgb


def _paint_yellow_edges(frame: np.ndarray) -> None:
    yellow_bgr = (0, 220, 255)  # RGB (255, 220, 0)
    h, w = frame.shape[:2]
    band = max(24, min(h, w) // 8)
    frame[0:band, :] = yellow_bgr
    frame[h - band : h, :] = yellow_bgr
    frame[:, 0:band] = yellow_bgr
    frame[:, w - band : w] = yellow_bgr


def test_sample_flash_rgb_yellow_edges():
    frame = np.full((480, 640, 3), (40, 40, 40), dtype=np.uint8)
    _paint_yellow_edges(frame)

    result = sample_flash_rgb(frame)

    assert result is not None
    r, g, b = result
    assert abs(r - 255) <= 40
    assert abs(g - 220) <= 40
    assert abs(b - 0) <= 40


def test_sample_flash_rgb_ignores_dark_green_ui():
    frame = np.zeros((720, 1280, 3), dtype=np.uint8)
    frame[:, :] = (24, 66, 54)

    assert sample_flash_rgb(frame) is None


def test_apply_tint_alpha_zero_unchanged():
    frame = np.array([[[100, 150, 200]]], dtype=np.uint8)
    out = apply_tint(frame, (255, 0, 0), 0.0)
    np.testing.assert_array_equal(out, frame)
    assert out.dtype == np.uint8


def test_apply_tint_alpha_one_solid():
    frame = np.array([[[100, 150, 200]]], dtype=np.uint8)
    color = (50, 60, 70)
    out = apply_tint(frame, color, 1.0)
    expected = np.full(frame.shape, color, dtype=np.uint8)
    np.testing.assert_array_equal(out, expected)
    assert out.dtype == np.uint8


def test_sampler_injected_grab_returns_flash_then_none_after_stop():
    frame = np.full((480, 640, 3), (40, 40, 40), dtype=np.uint8)
    _paint_yellow_edges(frame)

    sampler = ScreenTintSampler(grab_bgr=lambda: frame.copy())
    sampler.start()
    try:
        deadline = time.monotonic() + 1.0
        rgb = None
        while time.monotonic() < deadline:
            rgb = sampler.latest_rgb()
            if rgb is not None:
                break
            time.sleep(0.02)
        assert rgb is not None
        r, g, b = rgb
        assert abs(r - 255) <= 40
    finally:
        sampler.stop()

    assert sampler.latest_rgb() is None


def test_sampler_capture_error_clears_latest():
    calls = {"n": 0}

    def flaky_grab():
        calls["n"] += 1
        if calls["n"] == 1:
            frame = np.full((120, 160, 3), (40, 40, 40), dtype=np.uint8)
            _paint_yellow_edges(frame)
            return frame
        raise RuntimeError("capture failed")

    sampler = ScreenTintSampler(grab_bgr=flaky_grab)
    sampler.start()
    try:
        deadline = time.monotonic() + 1.0
        while time.monotonic() < deadline and sampler.latest_rgb() is None:
            time.sleep(0.02)
        assert sampler.latest_rgb() is not None
        deadline = time.monotonic() + 1.0
        while time.monotonic() < deadline and calls["n"] < 2:
            time.sleep(0.02)
        assert sampler.latest_rgb() is None
    finally:
        sampler.stop()