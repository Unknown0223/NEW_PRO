import numpy as np

from face_vcam.screen_tint import apply_tint, sample_flash_rgb


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