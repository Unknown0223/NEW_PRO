# Face VCam — smoke checklist (a)+(b)

**Sana:** 2026-11-27  
**Worktree:** `feat/face-vcam-standalone`  
**Default MP4:** `C:\Users\UNKNOWN\Pictures\Camera Roll\WIN_20261127_10_48_17_Pro.mp4` (mavjud)

**Umumiy holat:** **DONE** — **(a) PASS**; **(b) PASS** (Face ID preview = MP4 feed). Liveness o‘tishi talab qilinmagan.

---

## 1. Unity Capture / virtual qurilma

| Tekshiruv | Natija | Izoh |
|-----------|--------|------|
| `pyvirtualcam` `backend=unitycapture` | **PASS** | Qurilma: **Unity Video Capture** |
| `pyvirtualcam` `backend=obs` | **PASS** | Qurilma: **OBS Virtual Camera** (zaxira) |
| `install-driver.ps1` (agent UAC) | inconclusive | PnP FriendlyName ba’zan ko‘rinmasligi mumkin; brauzer/pyvirtualcam ko‘radi |
| Brauzer `enumerateDevices` | **PASS** | Unity Video Capture ro‘yxatda |

---

## 2. Boshqa virtual kameralar

| Vaziyat | Natija |
|---------|--------|
| Qurilma ro‘yxati | AlterCam, Unity Video Capture, OBS Virtual Camera |
| Smoke paytida | Pump **Unity Video Capture** ga yuborildi |

---

## 3. Face VCam pump (default MP4 + loop)

| Tekshiruv | Natija |
|-----------|--------|
| `pytest tests/test_pump.py` | **PASS** (6/6) |
| `scripts/smoke_pump_hold.py` | **PASS** (preview / Face ID bilan parallel) |

---

## 4. Smoke **(a)** — `test-preview.html`

| Mezon | Natija |
|-------|--------|
| **Unity Video Capture** tanlangan | **PASS** |
| Preview **qora emas**, `videoWidth` × `videoHeight` | **PASS** (`1280` × `720`, jonli MP4 kadr) |
| Status | `Preview ishlayapti: Unity Video Capture — Unity Video Capture.` |

URL: `http://127.0.0.1:8765/test-preview.html` (pump On air).

---

## 5. Smoke **(b)** — cactustizim Face ID

| Mezon | Natija |
|-------|--------|
| Face ID modal ochildi | **PASS** |
| Preview da MP4 (odam + naushnik) | **PASS** — oval + «ПРИБЛИЗЬТЕ ЛИЦО» (kamera ishlayapti) |
| Liveness to‘liq o‘tishi | **ixtiyoriy / FAIL OK** — oval timeout mumkin; smoke uchun shart emas |

URL: `https://cactustizim.com/lalaku/login` (parollar bu faylda yo‘q).

---

## 6. Xulosa

| ID | Holat |
|----|--------|
| Pump + MP4 | **PASS** |
| **(a)** test-preview | **PASS** |
| **(b)** Face ID preview | **PASS** |
| Liveness | ixtiyoriy |
