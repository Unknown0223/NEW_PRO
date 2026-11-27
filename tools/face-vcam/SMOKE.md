# Face VCam — smoke checklist (a)+(b)

**Sana:** 2026-11-27  
**Worktree:** `feat/face-vcam-standalone`  
**Default MP4:** `C:\Users\UNKNOWN\Pictures\Camera Roll\WIN_20261127_10_48_17_Pro.mp4` (mavjud)

**Umumiy holat:** `DONE_WITH_CONCERNS` — **(a) PASS** (brauzer preview); **(b) MANUAL PENDING** (cactustizim login).

---

## 1. Unity Capture drayveri

| Tekshiruv | Natija | Izoh |
|-----------|--------|------|
| `install-driver.ps1` | **BLOCKED / inconclusive** | Agent shell: chiqish kodi **1**, «UAC rad etilgan bo‘lishi mumkin». Vendor: `.vendor/UnityCapture`. |
| PnP `FriendlyName *Unity*` | **yo‘q** | `Get-PnpDevice` da faqat **AlterCam Virtual Camera** (Image) ko‘rindi. |
| Registry CLSID (skriptdagi kalitlar) | **yo‘q** | Ikkala `Test-Path` → `False` (agent vaqtida). |
| Brauzer `enumerateDevices` | **bor** | `test-preview.html` ro‘yxatida **Unity Video Capture** mavjud. |

**Xulosa:** interaktiv UAC bilan `install-driver.ps1` ni qayta tasdiqlash tavsiya etiladi; joriy mashinada Unity brauzerga ko‘rinadi.

---

## 2. Boshqa virtual kameralar

| Vaziyat | Natija |
|---------|--------|
| `obs64` / `obs32` / `AlterCam` jarayonlari | **topilmadi** (forse-kill qilinmadi) |
| Qurilma ro‘yxati | **AlterCam Virtual Camera**, **OBS Virtual Camera**, **Unity Video Capture** — uchala ham ro‘yxatda |

**Izoh:** README bo‘yicha bir vaqtda bir nechta VC `NotReadableError` berishi mumkin; smoke (a) shu holatda ham o‘tdi.

---

## 3. Face VCam pump (default MP4 + loop)

| Tekshiruv | Natija |
|-----------|--------|
| `pytest tests/test_pump.py` | **PASS** (6/6) |
| `scripts/smoke_pump_brief.py` (`PYTHONPATH=.` ) | **PASS** (~2.5s, xatosiz) |
| `scripts/smoke_pump_hold.py --seconds 90` | **PASS** (preview bilan parallel) |

```powershell
cd tools\face-vcam
$env:PYTHONPATH = "."
.\.venv\Scripts\python.exe scripts\smoke_pump_hold.py --seconds 120
```

---

## 4. Smoke **(a)** — `test-preview.html`

| Mezon | Natija |
|-------|--------|
| **Unity Video Capture** tanlangan | **PASS** |
| Preview **qora emas**, `videoWidth` ≥ 640 | **PASS** (`1280`, jonli kadr) |
| Status matni | `Preview ishlayapti: Unity Video Capture — Unity Video Capture.` |

**Qanday tekshirildi:**

```powershell
cd tools\face-vcam
.\.venv\Scripts\python.exe -m http.server 8765 --bind 127.0.0.1
# Brauzer: http://127.0.0.1:8765/test-preview.html
# Pump hold ishga tushiring (3-bosqich), Start preview
```

**Eslatma:** agent sessiyasida Cursor ichki brauzeri (Chromium) ishlatildi. Yakuniy qabul uchun **Yandex Browser** da xuddi shu URL va default kamera **Unity Video Capture** ni qayta tasdiqlang.

---

## 5. Smoke **(b)** — cactustizim Face ID

| Mezon | Natija |
|-------|--------|
| Yandex default kamera = **Unity Video Capture** | **MANUAL PENDING** |
| Face ID preview da shu MP4 feed | **MANUAL PENDING** |
| Liveness | ixtiyoriy (smoke uchun shart emas) |

**Qo‘lda qadamlar (parollar bu faylga yozilmaydi):**

1. Boshqa VC ilovalarni yoping; `smoke_pump_hold.py` yoki UI **Start** — pump **On air**.
2. Yandex → sozlamalar → kamera default: **Unity Video Capture**.
3. `https://cactustizim.com/lalaku/login` → loyiha hisobiga kirish (login/parol — faqat xavfsiz manba).
4. Face ID bosqichida preview **qora emas** va MP4 dagi odam/kadr ko‘rinishini tasdiqlang.
5. Agar `NotReadableError` bo‘lsa — OBS/AlterCam VC ni to‘xtating, brauzerni qayta oching.

---

## 6. Xulosa

| ID | Holat |
|----|--------|
| Drayver skripti (agent) | BLOCKED / inconclusive |
| Pump + MP4 | **PASS** |
| **(a)** test-preview | **PASS** |
| **(b)** cactustizim | **MANUAL PENDING** |