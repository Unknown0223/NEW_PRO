# Face VCam — smoke checklist (a)+(b)

**Sana:** 2026-11-27  
**Worktree:** `feat/face-vcam-standalone`  
**Default MP4:** `C:\Users\UNKNOWN\Videos\2026-11-27 11-51-28.mp4` (mavjud, 1920×1080)

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
| `pytest tests/test_pump.py` | **PASS** (11/11) |
| `scripts/smoke_pump_hold.py` | **PASS** (preview / Face ID bilan parallel) |
| Screen tint yoqiq, Face ID rang chaqnashi | **manual** — status `tint=top#…/bot#…`; `logs/tint.log`; flash yo‘q → `tint=off` |

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

### Stack eslatma (2026-11-27)

Cactus **Nuxt** (`/_nuxt/…`), bu repo Face ID emas:
- UI: «Проверка Face ID» + rang flash + «ПРИБЛИЗЬТЕ» (MediaPipe «Поверните голову» emas)
- Route: `/:tenant/auth/face-liveness` (masalan `/lalaku/auth/face-liveness`)
- API base: `/api/web/` — Face verify:
  - `teams/face-biometrics/verification/init-session`
  - `teams/face-biometrics/verification/verify`
- «Слишком много неудачных попыток» = **parol** lockout (Face mismatch emas)
- Screen tint: Amplify freshness-canvas **pure 0/255** (F12); HSV keep-V (yuz ko‘rinadi);
  `alpha≈0.55`; hold `0.02s`; sampler `90Hz` + pin-mss + modal ROI; wipe `split`; zoom `1.18`;
  chiqish `1920×1080`

---

## 6. Xulosa

| ID | Holat |
|----|--------|
| Pump + MP4 | **PASS** |
| **(a)** test-preview | **PASS** |
| **(b)** Face ID preview | **PASS** |
| Liveness | ixtiyoriy |
