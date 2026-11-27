"""Screen flash detection (split top/bottom) + RGB tint blend + file log."""

from __future__ import annotations

import logging
import threading
import time
from collections.abc import Callable
from pathlib import Path

import cv2
import numpy as np

_SAMPLER_HZ = 90.0
_SAMPLER_INTERVAL = 1.0 / _SAMPLER_HZ
# Near-zero hold — xatolik_2 showed page wipe ahead of sticky tint
_FLASH_HOLD_S = 0.02
_LOG_PATH = Path(__file__).resolve().parent.parent / "logs" / "tint.log"
# Soft enough that face structure survives; HSV keep-V does the color match
DEFAULT_TINT_ALPHA = 0.55

# Amplify freshness-canvas (F12): pure 0/255 primaries + secondaries.
# Gate still accepts near-neon samples; apply path snaps to these for 1:1.
FACE_FLASH_PALETTE: tuple[tuple[int, int, int], ...] = (
    (255, 255, 0),  # yellow
    (0, 255, 0),  # green
    (0, 255, 255),  # cyan
    (0, 0, 255),  # blue
    (255, 0, 255),  # magenta
    (255, 0, 0),  # red
)
# Max OpenCV hue distance (0..90) to accept a flash family; else treat as mud
_PALETTE_MAX_HUE_DIST = 16
_WIPE_STRIPS = 32
_WIPE_HUE_SPLIT = 10
# Neon Face ID only — Win11 Bloom wallpaper / teal chrome must not tint
_DEFAULT_MIN_SAT = 180
_DEFAULT_MIN_VAL = 200
# Peak channel + chroma: wallpaper blue (~178) fails, flash blue (229) passes
_DEFAULT_MIN_PEAK = 210
_DEFAULT_MIN_CHROMA = 170
_MIN_VIVID_STRIPS = 0.45

_logger = logging.getLogger("face_vcam.screen_tint")


def ensure_tint_logger() -> logging.Logger:
    """Idempotent file logger → tools/face-vcam/logs/tint.log."""
    if _logger.handlers:
        return _logger
    _LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    _logger.setLevel(logging.DEBUG)
    handler = logging.FileHandler(_LOG_PATH, encoding="utf-8")
    handler.setFormatter(
        logging.Formatter("%(asctime)s.%(msecs)03d %(levelname)s %(message)s", "%H:%M:%S")
    )
    _logger.addHandler(handler)
    _logger.propagate = False
    return _logger


def _band_mean_bgr(frame_bgr: np.ndarray, y0: int, y1: int) -> np.ndarray:
    height, width = frame_bgr.shape[:2]
    y0 = max(0, min(height, y0))
    y1 = max(y0 + 1, min(height, y1))
    # Prefer left/right thirds (browser content), skip far chrome if present
    x0 = width // 8
    x1 = width - width // 8
    return frame_bgr[y0:y1, x0:x1].reshape(-1, 3).mean(axis=0)


def _bgr_to_rgb_tuple(mean_bgr: np.ndarray) -> tuple[int, int, int]:
    b, g, r = mean_bgr
    return (int(round(r)), int(round(g)), int(round(b)))


def _passes_flash_gate(mean_bgr: np.ndarray, *, min_sat: int, min_val: int) -> bool:
    pixel = np.clip(mean_bgr, 0, 255).astype(np.uint8).reshape(1, 1, 3)
    hsv = cv2.cvtColor(pixel, cv2.COLOR_BGR2HSV)
    sat = int(hsv[0, 0, 1])
    val = int(hsv[0, 0, 2])
    return sat >= min_sat and val >= min_val


def _rgb_to_hsv_tuple(rgb: tuple[int, int, int]) -> tuple[int, int, int]:
    bgr = np.uint8([[[rgb[2], rgb[1], rgb[0]]]])
    h, s, v = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)[0, 0]
    return int(h), int(s), int(v)


def _hue_dist(a: int, b: int) -> int:
    """Circular distance on OpenCV hue wheel (0..179)."""
    d = abs(a - b) % 180
    return min(d, 180 - d)


def snap_to_flash_palette(
    rgb: tuple[int, int, int],
    *,
    max_hue_dist: int = _PALETTE_MAX_HUE_DIST,
    min_sat: int = _DEFAULT_MIN_SAT,
    min_val: int = _DEFAULT_MIN_VAL,
) -> tuple[int, int, int] | None:
    """
    Nearest palette neon (family check). Prefer accept_raw_flash_rgb for apply path.
    """
    h, s, v = _rgb_to_hsv_tuple(rgb)
    if s < min_sat or v < min_val:
        return None
    best: tuple[int, int, int] | None = None
    best_dist = 999
    for cand in FACE_FLASH_PALETTE:
        ch, _cs, _cv = _rgb_to_hsv_tuple(cand)
        dist = _hue_dist(h, ch)
        if dist < best_dist:
            best_dist = dist
            best = cand
    if best is None or best_dist > max_hue_dist:
        return None
    return best


def _is_neon_rgb(
    rgb: tuple[int, int, int],
    *,
    min_peak: int = _DEFAULT_MIN_PEAK,
    min_chroma: int = _DEFAULT_MIN_CHROMA,
) -> bool:
    r, g, b = (int(rgb[0]), int(rgb[1]), int(rgb[2]))
    peak = max(r, g, b)
    chroma = peak - min(r, g, b)
    return peak >= min_peak and chroma >= min_chroma


def accept_raw_flash_rgb(
    rgb: tuple[int, int, int],
    *,
    max_hue_dist: int = _PALETTE_MAX_HUE_DIST,
    min_sat: int = _DEFAULT_MIN_SAT,
    min_val: int = _DEFAULT_MIN_VAL,
) -> tuple[int, int, int] | None:
    """
    Face ID flash family → snap to Amplify pure canvas RGB (F12 0/255).
    """
    if not _is_neon_rgb(rgb):
        return None
    snapped = snap_to_flash_palette(
        rgb, max_hue_dist=max_hue_dist, min_sat=min_sat, min_val=min_val
    )
    if snapped is None:
        return None
    return snapped


def sample_flash_wipe(
    frame_bgr: np.ndarray,
    *,
    min_sat: int = _DEFAULT_MIN_SAT,
    min_val: int = _DEFAULT_MIN_VAL,
    strips: int = _WIPE_STRIPS,
) -> tuple[tuple[int, int, int], tuple[int, int, int], float] | None:
    """
    Detect Face ID vertical color wipe (new color slides top → bottom).

    Returns (top_rgb, bot_rgb, split) with RAW 1:1 RGB and split 0..1
    (fraction still showing the top color — hard edge like the page).
    """
    if frame_bgr.ndim != 3 or frame_bgr.shape[2] != 3:
        return None
    height = frame_bgr.shape[0]
    n = max(4, int(strips))
    raws: list[tuple[int, int, int] | None] = []
    for i in range(n):
        y0 = i * height // n
        y1 = (i + 1) * height // n
        mean = _band_mean_bgr(frame_bgr, y0, y1)
        if not _passes_flash_gate(mean, min_sat=min_sat, min_val=min_val):
            raws.append(None)
            continue
        raws.append(accept_raw_flash_rgb(_bgr_to_rgb_tuple(mean), min_sat=min_sat, min_val=min_val))

    vivid = [(i, c) for i, c in enumerate(raws) if c is not None]
    if not vivid:
        return None
    # Face ID wash covers most of the modal; wallpaper / UI accents do not
    if len(vivid) / float(n) < _MIN_VIVID_STRIPS:
        return None

    top_rgb = vivid[0][1]
    bot_rgb = vivid[-1][1]
    top_h = _rgb_to_hsv_tuple(top_rgb)[0]
    split_i = n
    for i, c in vivid:
        if _hue_dist(_rgb_to_hsv_tuple(c)[0], top_h) > _WIPE_HUE_SPLIT:
            split_i = i
            break
    split = float(split_i) / float(n)
    if _hue_dist(_rgb_to_hsv_tuple(bot_rgb)[0], top_h) <= _WIPE_HUE_SPLIT:
        split = 1.0
        bot_rgb = top_rgb
    return (top_rgb, bot_rgb, float(np.clip(split, 0.0, 1.0)))


def sample_flash_bands(
    frame_bgr: np.ndarray,
    *,
    min_sat: int = _DEFAULT_MIN_SAT,
    min_val: int = _DEFAULT_MIN_VAL,
) -> tuple[tuple[int, int, int], tuple[int, int, int]] | None:
    """
    Face ID flashes a horizontal split (top vs bottom). Return (top_rgb, bot_rgb)
    when at least one band is a vivid flash; else None.
    Samples are snapped to FACE_FLASH_PALETTE so random transition mixes stay clean.
    """
    wipe = sample_flash_wipe(frame_bgr, min_sat=min_sat, min_val=min_val)
    if wipe is None:
        return None
    top_rgb, bot_rgb, _split = wipe
    return (top_rgb, bot_rgb)


def sample_flash_rgb(
    frame_bgr: np.ndarray,
    *,
    min_sat: int = _DEFAULT_MIN_SAT,
    min_val: int = _DEFAULT_MIN_VAL,
) -> tuple[int, int, int] | None:
    """Average of split bands (compat); prefer sample_flash_bands for Face ID."""
    bands = sample_flash_bands(frame_bgr, min_sat=min_sat, min_val=min_val)
    if bands is None:
        return None
    top, bot = bands
    return (
        int(round((top[0] + bot[0]) / 2)),
        int(round((top[1] + bot[1]) / 2)),
        int(round((top[2] + bot[2]) / 2)),
    )


def _luma_rgb(rgb: np.ndarray) -> np.ndarray:
    """Rec.601 luma; rgb float or uint, shape (..., 3) → (...,)."""
    f = rgb.astype(np.float64)
    return 0.299 * f[..., 0] + 0.587 * f[..., 1] + 0.114 * f[..., 2]


def _colorize_preserve_luma(frame: np.ndarray, tint_map: np.ndarray) -> np.ndarray:
    """
    Match Amplify flash hue/sat while keeping face Value (detail).
    Old luma-rescale + high alpha washed the face into solid neon.
    """
    frame_u8 = np.clip(frame, 0, 255).astype(np.uint8)
    tint_u8 = np.clip(tint_map, 0, 255).astype(np.uint8)
    fh = cv2.cvtColor(frame_u8, cv2.COLOR_RGB2HSV).astype(np.float64)
    th = cv2.cvtColor(tint_u8, cv2.COLOR_RGB2HSV).astype(np.float64)
    out = fh.copy()
    out[..., 0] = th[..., 0]
    # Strong flash saturation, but never below a bit of original texture
    out[..., 1] = np.clip(np.maximum(th[..., 1], fh[..., 1] * 0.25), 0, 255)
    # Keep face brightness; tiny lift so dark sockets still show color
    out[..., 2] = np.clip(fh[..., 2] * 0.94 + 12.0, 0, 255)
    return cv2.cvtColor(out.astype(np.uint8), cv2.COLOR_HSV2RGB).astype(np.float64)


def apply_tint(
    frame_rgb: np.ndarray,
    color_rgb: tuple[int, int, int],
    alpha: float,
    *,
    preserve_luma: bool = True,
) -> np.ndarray:
    """Blend flash color onto frame; default preserves luma so the face stays readable."""
    frame = frame_rgb.astype(np.float64)
    tint = np.array(color_rgb, dtype=np.float64)
    tint_map = np.empty_like(frame)
    tint_map[...] = tint
    colored = _colorize_preserve_luma(frame, tint_map) if preserve_luma else tint_map
    blended = (1.0 - alpha) * frame + alpha * colored
    return np.clip(blended, 0, 255).astype(np.uint8)


def apply_tint_wipe(
    frame_rgb: np.ndarray,
    top_rgb: tuple[int, int, int],
    bot_rgb: tuple[int, int, int],
    split: float,
    alpha: float,
    *,
    preserve_luma: bool = True,
) -> np.ndarray:
    """
    Hard vertical wipe like the Face ID page: rows [0, split*H) = top color,
    rows [split*H, H) = bot color. split=1 → full top color.
    """
    frame = frame_rgb.astype(np.float64)
    height = frame.shape[0]
    cut = int(round(float(np.clip(split, 0.0, 1.0)) * height))
    cut = max(0, min(height, cut))
    tint_map = np.empty_like(frame)
    tint_map[:cut, :, :] = np.array(top_rgb, dtype=np.float64)
    tint_map[cut:, :, :] = np.array(bot_rgb, dtype=np.float64)
    colored = _colorize_preserve_luma(frame, tint_map) if preserve_luma else tint_map
    blended = (1.0 - alpha) * frame + alpha * colored
    return np.clip(blended, 0, 255).astype(np.uint8)


def apply_tint_bands(
    frame_rgb: np.ndarray,
    top_rgb: tuple[int, int, int],
    bot_rgb: tuple[int, int, int],
    alpha: float,
    *,
    soft_seam: bool = True,
    preserve_luma: bool = True,
    split: float | None = None,
) -> np.ndarray:
    """
    Top/bottom flash tint. Prefer hard wipe (page-accurate) when split is set;
    soft_seam kept for older call sites / tests.
    """
    if split is not None or not soft_seam:
        return apply_tint_wipe(
            frame_rgb,
            top_rgb,
            bot_rgb,
            split if split is not None else 0.5,
            alpha,
            preserve_luma=preserve_luma,
        )
    frame = frame_rgb.astype(np.float64)
    height = frame.shape[0]
    top = np.array(top_rgb, dtype=np.float64)
    bot = np.array(bot_rgb, dtype=np.float64)
    if soft_seam and height >= 8:
        y = np.linspace(0.0, 1.0, height, dtype=np.float64)[:, None, None]
        t = np.clip((y - 0.40) / 0.20, 0.0, 1.0)
        tint_map = (1.0 - t) * top + t * bot
    else:
        mid = height // 2
        tint_map = np.empty_like(frame)
        tint_map[:mid, :, :] = top
        tint_map[mid:, :, :] = bot
    colored = _colorize_preserve_luma(frame, tint_map) if preserve_luma else tint_map
    blended = (1.0 - alpha) * frame + alpha * colored
    return np.clip(blended, 0, 255).astype(np.uint8)


def crop_face_id_roi(frame_bgr: np.ndarray) -> np.ndarray:
    """
    Center crop around Face ID modal (ignores side login chrome).
    Speeds sampling and tracks the wipe that paints over the oval.
    """
    h, w = frame_bgr.shape[:2]
    x0, x1 = int(w * 0.22), int(w * 0.78)
    y0, y1 = int(h * 0.08), int(h * 0.92)
    if x1 <= x0 + 8 or y1 <= y0 + 8:
        return frame_bgr
    return frame_bgr[y0:y1, x0:x1]


class PersistentMonitorGrabber:
    """Reuse one mss handle — opening mss every tick caused color lag."""

    def __init__(self) -> None:
        import mss

        self._mss = mss.mss()
        self._best_mon: dict | None = None
        self._pin_until = 0.0

    def close(self) -> None:
        try:
            self._mss.close()
        except Exception:
            pass

    def _score_neon(self, bgr: np.ndarray) -> float:
        # Downscale for score — full-res HSV on two 1080p monitors was ~100ms/tick
        small = cv2.resize(bgr, (320, 180), interpolation=cv2.INTER_AREA)
        hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
        vivid = float(
            ((hsv[:, :, 1] > _DEFAULT_MIN_SAT) & (hsv[:, :, 2] > _DEFAULT_MIN_VAL)).mean()
        )
        return vivid * 1000.0 + float(small.mean()) * 0.01

    def _prepare(self, bgr: np.ndarray) -> np.ndarray:
        roi = crop_face_id_roi(bgr)
        h, w = roi.shape[:2]
        if w > 640:
            nh = max(1, int(round(h * (640.0 / w))))
            roi = cv2.resize(roi, (640, nh), interpolation=cv2.INTER_AREA)
        return roi

    def grab_bgr(self) -> np.ndarray:
        now = time.monotonic()
        if self._best_mon is not None and now < self._pin_until:
            shot = self._mss.grab(self._best_mon)
            bgra = np.asarray(shot, dtype=np.uint8)
            return self._prepare(cv2.cvtColor(bgra, cv2.COLOR_BGRA2BGR))

        best_bgr: np.ndarray | None = None
        best_score = -1.0
        best_mon = None
        for mon in self._mss.monitors[1:]:
            shot = self._mss.grab(mon)
            bgra = np.asarray(shot, dtype=np.uint8)
            bgr = cv2.cvtColor(bgra, cv2.COLOR_BGRA2BGR)
            score = self._score_neon(bgr)
            if score > best_score:
                best_score = score
                best_bgr = bgr
                best_mon = mon
        if best_bgr is None:
            raise RuntimeError("mss: no monitors")
        self._best_mon = best_mon
        # Re-pick every 0.75s so Face ID on the other display is found quickly
        self._pin_until = now + 0.75
        return self._prepare(best_bgr)


def _mss_grab_primary_bgr() -> np.ndarray:
    """One-shot grab (tests / fallback). Prefer PersistentMonitorGrabber live."""
    g = PersistentMonitorGrabber()
    try:
        return g.grab_bgr()
    finally:
        g.close()


WipeState = tuple[tuple[int, int, int], tuple[int, int, int], float]


class ScreenTintSampler:
    """Background ~90 Hz screen grab; publishes raw 1:1 vertical wipe."""

    def __init__(
        self,
        *,
        grab_bgr: Callable[[], np.ndarray] | None = None,
        log: bool = True,
    ) -> None:
        self._grab_bgr = grab_bgr
        self._persistent: PersistentMonitorGrabber | None = None
        self._lock = threading.Lock()
        self._latest: WipeState | None = None
        self._held: WipeState | None = None
        self._hold_until = 0.0
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._log = log
        self._last_logged: str | None = None
        if log:
            ensure_tint_logger()

    def _grab(self) -> np.ndarray:
        if self._grab_bgr is not None:
            return self._grab_bgr()
        if self._persistent is None:
            self._persistent = PersistentMonitorGrabber()
        return self._persistent.grab_bgr()

    def start(self) -> None:
        if self._thread is not None and self._thread.is_alive():
            return
        self._stop.clear()
        with self._lock:
            self._latest = None
            self._held = None
            self._hold_until = 0.0
        self._last_logged = None
        if self._log:
            _logger.info("sampler start → %s", _LOG_PATH)
        self._thread = threading.Thread(
            target=self._run, name="screen-tint-sampler", daemon=True
        )
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=2.0)
            self._thread = None
        if self._persistent is not None:
            self._persistent.close()
            self._persistent = None
        with self._lock:
            self._latest = None
            self._held = None
            self._hold_until = 0.0
        if self._log:
            _logger.info("sampler stop")

    def latest_wipe(self) -> WipeState | None:
        with self._lock:
            return self._latest

    def latest_bands(
        self,
    ) -> tuple[tuple[int, int, int], tuple[int, int, int]] | None:
        wipe = self.latest_wipe()
        if wipe is None:
            return None
        return (wipe[0], wipe[1])

    def latest_rgb(self) -> tuple[int, int, int] | None:
        bands = self.latest_bands()
        if bands is None:
            return None
        top, bot = bands
        return (
            int(round((top[0] + bot[0]) / 2)),
            int(round((top[1] + bot[1]) / 2)),
            int(round((top[2] + bot[2]) / 2)),
        )

    def _emit(self, wipe: WipeState | None) -> None:
        if not self._log:
            return
        if wipe is None:
            key = "off"
            if key != self._last_logged:
                _logger.info("tint=off")
                self._last_logged = key
            return
        top, bot, split = wipe
        key = (
            f"top=#{top[0]:02x}{top[1]:02x}{top[2]:02x} "
            f"bot=#{bot[0]:02x}{bot[1]:02x}{bot[2]:02x} "
            f"split={split:.2f}"
        )
        if key != self._last_logged:
            _logger.info("tint %s", key)
            self._last_logged = key

    def _run(self) -> None:
        while not self._stop.is_set():
            t0 = time.monotonic()
            try:
                frame_bgr = self._grab()
                wipe = sample_flash_wipe(frame_bgr)
            except Exception as exc:
                wipe = None
                if self._log:
                    _logger.warning("grab/sample failed: %s", exc)
            if self._stop.is_set():
                break
            now = time.monotonic()
            with self._lock:
                if wipe is not None:
                    # Always prefer fresh wipe — never stick to an older color
                    self._held = wipe
                    self._hold_until = now + _FLASH_HOLD_S
                    self._latest = wipe
                elif self._held is not None and now < self._hold_until:
                    # Only bridge a 1-frame miss; do not lag behind page
                    self._latest = self._held
                    wipe = self._held
                else:
                    self._held = None
                    self._latest = None
                    wipe = None
            self._emit(wipe)
            elapsed = time.monotonic() - t0
            wait = max(0.0, _SAMPLER_INTERVAL - elapsed)
            if self._stop.wait(wait):
                break
