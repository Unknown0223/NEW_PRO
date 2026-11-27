# Face VCam Screen Tint Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect Face ID screen color flashes on the Windows monitor and blend those colors onto the virtual-webcam video in sync.

**Architecture:** Pure HSV sampling of monitor edge patches decides flash RGB; a background sampler (~12 Hz via `mss`) publishes the latest tint; `run_pump` applies `apply_tint` before each `cam.send`. Tk checkbox enables the sampler for the session.

**Tech Stack:** Python 3.11+, NumPy, OpenCV, `mss`, existing `pyvirtualcam` pump / tkinter app under `tools/face-vcam/` (worktree `feat-face-vcam-standalone`).

**Spec:** `docs/superpowers/specs/2026-11-27-face-vcam-screen-tint-design.md`

## Global Constraints

- Only touch `tools/face-vcam/` (and this plan/spec under `docs/superpowers/`).
- Primary monitor only; edge patches (not center oval).
- Flash = high HSV saturation **and** value; dark-green login UI must yield `None`.
- Default `tint_alpha=0.45`; face must remain visible.
- Loop / speed / zoom behavior unchanged when tint is off.
- Do not commit secrets or driver binaries.

## Review Focus

- Dark green Cactus login (no flash) → no tint applied.
- Synthetic full-frame yellow/green/magenta overlays → sample returns near that RGB.
- `alpha=0` → output equals input; `alpha=1` → solid tint color.
- Sampler stop → pump no longer tints (stale color cleared).
- `mss` missing / capture fail → status error, pump still sends untinted video.

---

### Task 1: Pure tint helpers + unit tests

**Files:**
- Create: `tools/face-vcam/face_vcam/screen_tint.py`
- Create: `tools/face-vcam/tests/test_screen_tint.py`

**Interfaces:**
- Consumes: none
- Produces:
  - `sample_flash_rgb(frame_bgr: np.ndarray, *, min_sat: int = 80, min_val: int = 80) -> tuple[int, int, int] | None` — RGB 0–255 or `None`
  - `apply_tint(frame_rgb: np.ndarray, color_rgb: tuple[int, int, int], alpha: float) -> np.ndarray` — same shape/dtype uint8

- [ ] **Step 1: Write failing tests** in `tests/test_screen_tint.py`

```python
def test_sample_flash_rgb_yellow_edges():
    # vivid yellow frame → RGB near (255, 220, 0) ±40 per channel; not None

def test_sample_flash_rgb_ignores_dark_green_ui():
    # BGR ~ (24, 66, 54) like Cactus login → None

def test_apply_tint_alpha_zero_unchanged():
def test_apply_tint_alpha_one_solid():
```

- [ ] **Step 2: Run** `cd tools/face-vcam && .venv\Scripts\python.exe -m pytest tests/test_screen_tint.py -v` — expect FAIL (import/missing)

- [ ] **Step 3: Implement** `sample_flash_rgb` and `apply_tint` in `face_vcam/screen_tint.py`  
  Sample mean of four corner + top-edge patches; convert mean to HSV; if sat/val below thresholds return `None`; else return RGB of mean. `apply_tint`: `clip((1-a)*frame + a*color)`.

- [ ] **Step 4: Re-run pytest** — expect PASS

- [ ] **Step 5: Commit** `feat(face-vcam): pure screen flash sample + tint blend`

---

### Task 2: Background sampler + pump wiring

**Files:**
- Modify: `tools/face-vcam/face_vcam/screen_tint.py` (add sampler)
- Modify: `tools/face-vcam/face_vcam/pump.py`
- Modify: `tools/face-vcam/tests/test_pump.py`
- Modify: `tools/face-vcam/requirements.txt` (add `mss`)
- Test: `tools/face-vcam/tests/test_screen_tint.py` (sampler unit with fake grab)

**Interfaces:**
- Consumes: `sample_flash_rgb`, `apply_tint`
- Produces:
  - `class ScreenTintSampler` with `start()`, `stop()`, `latest_rgb() -> tuple[int,int,int] | None`
  - `run_pump(..., screen_tint: bool = False, tint_alpha: float = 0.45, tint_sampler: ScreenTintSampler | None = None)`

- [ ] **Step 1: Failing tests** — sampler with injectable `grab_bgr()` returns flash then `None` after stop; pump mock applies tint when `latest_rgb` set (extend existing pump mock test or add thin unit on apply path)

- [ ] **Step 2: Run pytest** — FAIL

- [ ] **Step 3: Implement** `ScreenTintSampler` (~12 Hz thread, `mss` primary monitor → BGR, lock + `latest`); wire `run_pump` to call `apply_tint` when `screen_tint` and color present; on capture errors leave tint `None` and keep sending

- [ ] **Step 4: `pip install mss` into `.venv`; pytest PASS**

- [ ] **Step 5: Commit** `feat(face-vcam): screen tint sampler wired into pump`

---

### Task 3: Tk checkbox + status + smoke note

**Files:**
- Modify: `tools/face-vcam/face_vcam/app.py`
- Modify: `tools/face-vcam/SMOKE.md` (one row: Screen tint on during Face ID color flash)
- Modify: `tools/face-vcam/README.md` (Screen tint paragraph)

**Interfaces:**
- Consumes: `ScreenTintSampler`, `run_pump(..., screen_tint=..., tint_alpha=0.45)`
- Produces: UI `screen_tint_var` default `True`; status includes `tint=#RRGGBB` or `tint=off`

- [ ] **Step 1: Add** checkbox `Screen tint`, create sampler when Start + tint on, pass into `run_pump`, stop sampler on Stop/worker end; poll `latest_rgb` into status every ~500 ms while on air

- [ ] **Step 2: Manual check** — Start with tint on, no flash → status `tint=off`; (optional) solid color window on screen → `tint=#...`

- [ ] **Step 3: Update README + SMOKE.md**

- [ ] **Step 4: Commit** `feat(face-vcam): Screen tint checkbox and docs`

---

## Execution note

Work in existing worktree: `e:\sales_copiya\.worktrees\feat-face-vcam-standalone` (paths above relative to repo root / worktree root). Copy or ensure `docs/superpowers/specs/2026-11-27-face-vcam-screen-tint-design.md` is readable from that tree (main repo docs already written).
