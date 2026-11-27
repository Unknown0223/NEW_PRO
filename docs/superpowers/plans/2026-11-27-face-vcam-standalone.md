# Face VCam Standalone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Windows tool that loops an MP4 into a system virtual webcam (no OBS UI) so Yandex/`cactustizim` Face ID can see it.

**Architecture:** Python UI reads frames with OpenCV and sends them via `pyvirtualcam` (`backend="unitycapture"`) to the Unity Capture DirectShow filter. A PowerShell script downloads/registers that filter once (UAC). A static HTML page proves `getUserMedia` before Face ID smoke.

**Tech Stack:** Python 3.11+, OpenCV (`cv2`), NumPy, `pyvirtualcam`, tkinter, Unity Capture (`Install.bat`), PowerShell.

**Spec:** `docs/superpowers/specs/2026-11-27-face-vcam-standalone-design.md`

## Global Constraints

- Live under `tools/face-vcam/` only; do not wire into frontend/backend CI.
- Device after driver install: **`Unity Video Capture`** (Unity Capture default; UI copy may say “Face VCam”).
- Target ~30 fps wall-clock; loop MP4; default file `C:\Users\UNKNOWN\Pictures\Camera Roll\WIN_20261127_10_48_17_Pro.mp4`.
- Smoke success = (a) `test-preview.html` shows live video from Unity Video Capture + (b) Face ID preview shows same feed; liveness pass not required.
- Do not commit driver binaries or login secrets; `install-driver.ps1` fetches Unity Capture release/zip.
- Stop OBS/AlterCam VC before smoke.
- Imzosiz filter + admin UAC OK.

## Review Focus

- Missing Unity Capture → Start must show clear Uzbek/Russian error, not crash.
- Wrong/corrupt MP4 path → status error, camera not left half-open.
- Second Start while On air → no double `Camera` / NotReadableError for consumers.
- Browser still on OBS/AlterCam default → HTML lists devices; instructions say pick Unity Video Capture.
- Frame size mismatch → resize to camera width/height before `send`.

---

### Task 1: Driver install script + README

**Files:**
- Create: `tools/face-vcam/install-driver.ps1`
- Create: `tools/face-vcam/README.md`
- Create: `tools/face-vcam/requirements.txt`

**Interfaces:**
- Consumes: none
- Produces: registered DirectShow device named `Unity Video Capture` (via Unity Capture `Install.bat`); `requirements.txt` pins `opencv-python`, `numpy`, `pyvirtualcam`

- [ ] **Step 1: Write `install-driver.ps1`**

Download Unity Capture from GitHub (`schellingb/UnityCapture`) into `tools/face-vcam/.vendor/UnityCapture/` (gitignored), run `Install\Install.bat` elevated. If device already present, print OK and exit 0. Document UAC prompt.

- [ ] **Step 2: Write `requirements.txt` and `README.md`**

README: install Python deps, run driver script, start app, stop other VCs, set Yandex camera to Unity Video Capture, open `test-preview.html`, then Face ID. Note device name and (a)+(b) success bar.

- [ ] **Step 3: Add `tools/face-vcam/.gitignore`**

Ignore `.vendor/`, `.venv/`, `__pycache__/`.

- [ ] **Step 4: Commit** (only if user asked)

```bash
git add tools/face-vcam/install-driver.ps1 tools/face-vcam/README.md tools/face-vcam/requirements.txt tools/face-vcam/.gitignore
git commit -m "chore(face-vcam): driver install script and docs"
```

---

### Task 2: Frame pump (library)

**Files:**
- Create: `tools/face-vcam/face_vcam/__init__.py`
- Create: `tools/face-vcam/face_vcam/pump.py`
- Test: `tools/face-vcam/tests/test_pump.py`

**Interfaces:**
- Consumes: OpenCV `VideoCapture`, `pyvirtualcam.Camera`
- Produces:
  - `load_video(path: str) -> cv2.VideoCapture` (raises `FileNotFoundError` / `RuntimeError` if unreadable)
  - `frame_to_rgb(frame_bgr: np.ndarray, width: int, height: int) -> np.ndarray` RGB uint8 `height×width×3`
  - `run_pump(*, video_path: str, loop: bool, width: int, height: int, fps: float, stop_event: threading.Event, backend: str = "unitycapture") -> None` — opens virtual cam, loops frames, `send` + `sleep_until_next_frame`, exits when `stop_event` set; on missing backend, raises `RuntimeError` with message containing `Unity Capture`

- [ ] **Step 1: Write failing tests**

```python
def test_frame_to_rgb_resizes_and_is_rgb():
    # BGR 100x50 -> RGB 1280x720
    ...

def test_load_video_missing_path_raises():
    ...
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd tools/face-vcam && python -m pytest tests/test_pump.py -v`  
Expected: import/collection fail or assert fail

- [ ] **Step 3: Implement `pump.py`**

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd tools/face-vcam && python -m pytest tests/test_pump.py -v`

- [ ] **Step 5: Commit** (if user asked)

---

### Task 3: Tkinter app

**Files:**
- Create: `tools/face-vcam/face_vcam/app.py`
- Create: `tools/face-vcam/run.ps1` (venv + `python -m face_vcam.app`)

**Interfaces:**
- Consumes: `run_pump`, `load_video` from Task 2
- Produces: GUI — path entry + Browse, Loop checkbox (default on), Start / Stop, status label (`Idle` / `On air` / error text); Start spawns daemon thread calling `run_pump`; Stop sets `stop_event`; default path = spec MP4; refuse Start if already on air

- [ ] **Step 1: Implement `app.py` main window**

- [ ] **Step 2: Manual check**

Run: `powershell -File tools/face-vcam/run.ps1`  
Expected: window opens; Start without driver → status mentions Unity Capture; with driver + MP4 → status `On air`

- [ ] **Step 3: Commit** (if user asked)

---

### Task 4: Browser diagnostic page

**Files:**
- Create: `tools/face-vcam/test-preview.html`

**Interfaces:**
- Consumes: `navigator.mediaDevices.enumerateDevices` / `getUserMedia`
- Produces: device `<select>`, Start preview button, `<video>`, prefer device label containing `Unity Video Capture`

- [ ] **Step 1: Implement HTML** (vanilla JS, no build)

- [ ] **Step 2: Smoke (a)**

With Task 1 driver + Task 3 On air: open HTML in Yandex, select Unity Video Capture, Start — live MP4 frames.  
Expected: video not black; label matches Unity Video Capture

---

### Task 5: End-to-end smoke (a)+(b)

**Files:**
- Create: `tools/face-vcam/SMOKE.md` (checklist only)

- [ ] **Step 1: Run driver install if needed**

- [ ] **Step 2: Ensure OBS/AlterCam virtual cam stopped**

- [ ] **Step 3: Start Face VCam with default MP4 + loop**

- [ ] **Step 4: Prove (a) via `test-preview.html`**

- [ ] **Step 5: Prove (b)** — Yandex default camera = Unity Video Capture; `https://cactustizim.com/lalaku/login` Face ID; preview shows MP4 (liveness pass optional)

- [ ] **Step 6: Record results in `SMOKE.md`** (pass/fail + notes; no passwords)

---

## Spec coverage (self-review)

| Spec item | Task |
|-----------|------|
| MP4 + loop + Start/Stop UI | 3 |
| Virtual device without OBS UI | 1 + 2 (`unitycapture`) |
| install script, no binary in git | 1 |
| test-preview.html | 4 |
| Smoke (a)+(b), not (c) | 5 |
| Stop other VCs / conflicts | README + 5 |
| ~30 fps | 2 (`fps=30`, `sleep_until_next_frame`) |
