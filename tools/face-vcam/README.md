# Face VCam (Windows)

MP4 ni **virtual webcam** orqali Yandex Browser va `cactustizim` Face ID ga uzatish uchun lokal vosita. Virtual kamera drayveri — [Unity Capture](https://github.com/schellingb/UnityCapture); tizimdagi qurilma nomi: **`Unity Video Capture`**.

## Talablar

- Windows 10/11
- Python 3.11+
- Bir marta administrator (UAC) — drayverni ro‘yxatdan o‘tkazish uchun

## 1. Python kutubxonalari

```powershell
cd tools\face-vcam
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## 2. Unity Capture drayveri

```powershell
powershell -ExecutionPolicy Bypass -File .\install-driver.ps1
```

Skript Unity Capture ni **pin qilingan** GitHub arxividan `tools/face-vcam/.vendor/UnityCapture/` ga yuklab, `Install\Install.bat` ni administrator sifatida ishga tushiradi. **UAC** chiqsa — «Ha» / tasdiqlang.

| Pin | Qiymat |
|-----|--------|
| Commit | `3ed54c325e0ad71afcf4f246c07e5e17b3d7f2d2` (upstream `master`, 2026-11-27) |
| Zip SHA256 | `a688b857e6d1a9f544d8bb0d28fd10892276db2c2b9ddd537c6cb5520dd25ef7` |

Yangilash: `git ls-remote https://github.com/schellingb/UnityCapture.git refs/heads/master`, keyin `install-driver.ps1` dagi URL, papka nomi va SHA256 ni qo‘lda yangilang.

Agar qurilma allaqachon bor bo‘lsa, skript `OK` deb chiqadi (kod 0).

> Imzosiz filter: Smart App Control / Defender bloklasa — Windows xavfsizlik sozlamalarida yoki qo‘lda `Install.bat` → *Run as administrator* qiling.

## 3. Face VCam ilovasini ishga tushirish

```powershell
powershell -ExecutionPolicy Bypass -File .\run.ps1
```

Yoki venv ichida: `python -m face_vcam.app`

1. Boshqa virtual kameralarni to‘xtating (OBS Virtual Camera, AlterCam va h.k.) — bir vaqtda ikkita VC ko‘pincha `NotReadableError` beradi.
2. MP4 tanlang va **Start** (pump **On air** bo‘lganda Start tugmasi o‘chiriladi).

### Screen tint (Face ID rang chaqnashi)

Default **Screen tint** yoqiq. Face ID **yuqori/past ikki rang** flash qiladi — sampler shu splitni o‘qiydi va videoga **yumshoq luma-tint** qo‘yadi (`tint_alpha≈0.48`, yuz o‘qiladi). Status: `tint=top#…/bot#…` yoki `tint=off`. Log: `tools/face-vcam/logs/tint.log`. Tint kerak emas bo‘lsa checkboxni o‘chiring.

## 4. Brauzer: Yandex

- Yandex Browser → kamera sozlamalari → default qurilma: **`Unity Video Capture`**.
- Diagnostika: `tools/face-vcam/test-preview.html` — ro‘yxatdan **Unity Video Capture** ni tanlang, preview da video bo‘lishi kerak (pump ishlab turishi lozim).

## 5. Face ID smoke (`cactustizim`)

Face VCam **On air** bo‘lganda, Yandex default kamerasi **Unity Video Capture** bo‘lsa:

1. `https://cactustizim.com/lalaku/login` (yoki loyiha test login URL) → Face ID bosqichi.
2. Preview da shu MP4 kadrlari ko‘rinishi kerak.

### Muvaffaqiyat mezoni (a)+(b)

| Qadam | Mezon |
|-------|--------|
| **(a)** | `test-preview.html` da **Unity Video Capture** + **jonli video** (qora emas) |
| **(b)** | Face ID preview da **shu feed** (liveness o‘tishi **majburiy emas**) |

**Merge / qabul:** **(b)** hozircha **qo‘lda** — inson **cactustizim** da Yandex orqali **Unity Video Capture** tanlab Face ID preview ni tasdiqlashi kerak. Batafsil: `SMOKE.md`.

## Muammolar

| Belgi | Yechim |
|-------|--------|
| Qurilma ro‘yxatda yo‘q | `install-driver.ps1` qayta, UAC tasdiqlang; brauzerni yoping/oching |
| Qora preview | Face VCam Start, to‘g‘ri MP4, boshqa VC o‘chiq |
| NotReadableError | Faqat bitta virtual kamera + bitta pump |

## Fayl tuzilishi

| Fayl | Vazifa |
|------|--------|
| `install-driver.ps1` | Pin qilingan Unity Capture yuklash va o‘rnatish |
| `run.ps1` | venv + Tkinter UI |
| `requirements.txt` | OpenCV, NumPy, pyvirtualcam |
| `test-preview.html` | getUserMedia diagnostika |
| `SMOKE.md` | (a)+(b) smoke checklist |