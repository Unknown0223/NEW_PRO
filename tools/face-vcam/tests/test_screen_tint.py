import time

import numpy as np

from face_vcam.screen_tint import (
    FACE_FLASH_PALETTE,
    ScreenTintSampler,
    accept_raw_flash_rgb,
    apply_tint,
    apply_tint_bands,
    apply_tint_wipe,
    sample_flash_bands,
    sample_flash_rgb,
    sample_flash_wipe,
    snap_to_flash_palette,
)


def _paint_yellow_flash_bands(frame: np.ndarray) -> None:
    """Face ID-style top/bottom flash (BGR yellow)."""
    yellow_bgr = (0, 220, 255)  # RGB (255, 220, 0)
    h, _w = frame.shape[:2]
    frame[0 : h // 3, :] = yellow_bgr
    frame[2 * h // 3 : h, :] = yellow_bgr


def test_sample_flash_rgb_yellow_edges():
    frame = np.full((480, 640, 3), (40, 40, 40), dtype=np.uint8)
    _paint_yellow_flash_bands(frame)

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
    out = apply_tint(frame, color, 1.0, preserve_luma=False)
    expected = np.full(frame.shape, color, dtype=np.uint8)
    np.testing.assert_array_equal(out, expected)
    assert out.dtype == np.uint8


def test_sample_flash_bands_top_yellow_bot_cyan():
    frame = np.zeros((300, 400, 3), dtype=np.uint8)
    frame[:100, :] = (0, 220, 255)  # yellow BGR
    frame[200:, :] = (255, 255, 0)  # cyan BGR
    bands = sample_flash_bands(frame)
    assert bands is not None
    top, bot = bands
    # 1:1 raw sample (not forced palette RGB), still yellow/cyan families
    assert abs(top[0] - 255) <= 40 and abs(top[1] - 220) <= 40 and top[2] <= 40
    assert bot[0] <= 40 and abs(bot[1] - 255) <= 40 and abs(bot[2] - 255) <= 40


def test_accept_raw_flash_snaps_to_amplify_pure():
    # F12 freshness-canvas uses 0/255 — near-yellow sample snaps to pure yellow
    out = accept_raw_flash_rgb((241, 248, 26))
    assert out == (255, 255, 0)
    assert accept_raw_flash_rgb((8, 2, 229)) == (0, 0, 255)
    assert accept_raw_flash_rgb((220, 5, 10)) == (255, 0, 0)


def test_snap_to_flash_palette_rejects_muddy_ui():
    assert snap_to_flash_palette((70, 90, 85)) is None
    assert snap_to_flash_palette((24, 66, 54)) is None
    assert accept_raw_flash_rgb((24, 66, 54)) is None
    # Cactus page teal chrome — not a Face ID neon
    assert accept_raw_flash_rgb((8, 105, 80)) is None
    assert accept_raw_flash_rgb((65, 141, 120)) is None
    # Win11 Bloom wallpaper blue was false-tinting the face
    assert accept_raw_flash_rgb((24, 72, 178)) is None
    assert accept_raw_flash_rgb((64, 214, 180)) is None


def test_sample_flash_bands_ignores_random_desaturated_clash():
    frame = np.zeros((300, 400, 3), dtype=np.uint8)
    frame[:100, :] = (90, 100, 80)  # muddy BGR
    frame[200:, :] = (85, 95, 88)
    assert sample_flash_bands(frame) is None


def test_sample_flash_wipe_finds_vertical_boundary():
    """Page flash slides top→bottom: new color on top, old on bottom."""
    frame = np.zeros((200, 160, 3), dtype=np.uint8)
    # BGR yellow top 40%, cyan bottom 60%
    frame[:80, :] = (19, 253, 235)
    frame[80:, :] = (218, 215, 12)
    wipe = sample_flash_wipe(frame)
    assert wipe is not None
    top, bot, split = wipe
    assert top[0] > 180 and top[2] < 60
    assert bot[2] > 180 and bot[0] < 60
    assert 0.30 <= split <= 0.50


def test_apply_tint_wipe_hard_edge_matches_split():
    frame = np.full((100, 40, 3), 128, dtype=np.uint8)
    out = apply_tint_wipe(
        frame, (255, 0, 0), (0, 0, 255), split=0.4, alpha=1.0, preserve_luma=False
    )
    assert out[20, 10, 0] > 200 and out[20, 10, 2] < 40  # red above
    assert out[70, 10, 2] > 200 and out[70, 10, 0] < 40  # blue below
    # Boundary row near 40
    assert out[39, 10, 0] > 200
    assert out[40, 10, 2] > 200


def test_apply_tint_bands_splits_vertically():
    frame = np.full((40, 20, 3), 100, dtype=np.uint8)
    out = apply_tint_bands(frame, (255, 0, 0), (0, 0, 255), 1.0, soft_seam=False, preserve_luma=False)
    assert out[0, 10, 0] > 200 and out[0, 10, 2] < 50
    assert out[39, 10, 2] > 200 and out[39, 10, 0] < 50
    assert out[10, 10, 0] > 200  # hard top half
    assert out[30, 10, 2] > 200  # hard bottom half


def test_apply_tint_bands_preserves_face_luma_at_design_alpha():
    """High alpha solid wash kills face; HSV keep-V must keep cheek vs eye."""
    frame = np.full((80, 60, 3), 160, dtype=np.uint8)
    frame[18:38, 20:40] = (200, 170, 150)  # cheek (upper half)
    frame[22:28, 28:35] = (40, 30, 25)  # eye socket
    out = apply_tint_bands(frame, (0, 255, 0), (0, 255, 0), 0.55)
    cheek = out[28, 30].astype(np.int16)
    eye = out[25, 31].astype(np.int16)
    assert int(cheek.mean()) - int(eye.mean()) >= 40
    assert int(out[28, 30, 1]) > int(out[28, 30, 0])
    assert int(out[28, 30, 1]) > int(out[28, 30, 2])


def test_flash_tint_keeps_face_edges_visible():
    """Regression: alpha 0.85 + luma lift made the face disappear into neon."""
    frame = np.full((120, 100, 3), 90, dtype=np.uint8)
    frame[30:90, 25:75] = (180, 140, 120)
    frame[48:58, 40:48] = (35, 28, 22)
    before = float(np.abs(np.diff(frame.astype(np.float64), axis=0)).mean())
    out = apply_tint_wipe(frame, (255, 0, 0), (0, 0, 255), 0.5, 0.55)
    after = float(np.abs(np.diff(out.astype(np.float64), axis=0)).mean())
    assert after >= before * 0.55
    # Not a flat solid red/blue wash — face midtones stay distinct from bg
    uniq = {tuple(int(x) for x in p) for p in out.reshape(-1, 3)[::10]}
    assert len(uniq) >= 4
    face_px = out[50, 50].astype(np.int16)
    bg_px = out[5, 5].astype(np.int16)
    assert int(face_px.mean()) - int(bg_px.mean()) >= 25


def test_apply_tint_bands_soft_seam_avoids_hard_clash_line():
    frame = np.full((100, 40, 3), 128, dtype=np.uint8)
    out = apply_tint_bands(frame, (255, 0, 0), (0, 0, 255), 0.5, soft_seam=True)
    mid_row = out[50, 20].astype(np.int16)
    # Soft seam → mixed, not pure red or pure blue
    assert 40 < int(mid_row[0]) < 220
    assert 40 < int(mid_row[2]) < 220


def test_sampler_injected_grab_returns_flash_then_none_after_stop():
    frame = np.full((480, 640, 3), (40, 40, 40), dtype=np.uint8)
    _paint_yellow_flash_bands(frame)

    sampler = ScreenTintSampler(grab_bgr=lambda: frame.copy(), log=False)
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


def test_crop_face_id_roi_centers():
    from face_vcam.screen_tint import crop_face_id_roi

    frame = np.zeros((1000, 1600, 3), dtype=np.uint8)
    frame[80:920, 352:1248] = (0, 0, 255)
    roi = crop_face_id_roi(frame)
    assert roi.shape[0] < frame.shape[0]
    assert roi.shape[1] < frame.shape[1]
    assert int(roi[:, :, 2].mean()) > 200


def test_sampler_capture_error_clears_latest():
    calls = {"n": 0}

    def flaky_grab():
        calls["n"] += 1
        if calls["n"] == 1:
            frame = np.full((120, 160, 3), (40, 40, 40), dtype=np.uint8)
            _paint_yellow_flash_bands(frame)
            return frame
        raise RuntimeError("capture failed")

    sampler = ScreenTintSampler(grab_bgr=flaky_grab, log=False)
    sampler.start()
    try:
        deadline = time.monotonic() + 1.0
        while time.monotonic() < deadline and sampler.latest_rgb() is None:
            time.sleep(0.02)
        assert sampler.latest_rgb() is not None
        deadline = time.monotonic() + 1.0
        while time.monotonic() < deadline and calls["n"] < 2:
            time.sleep(0.02)
        # Flash hold keeps last color briefly after grab errors
        deadline = time.monotonic() + 1.5
        while time.monotonic() < deadline and sampler.latest_rgb() is not None:
            time.sleep(0.05)
        assert sampler.latest_rgb() is None
    finally:
        sampler.stop()