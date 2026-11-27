# Face VCam — mustaqil video→virtual webcam (2026-11-27)

## Intent / why

Face ID (liveness) ni o‘z muhitida spoof/regression sinash uchun: MP4 ni Windowsda brauzer `getUserMedia` ko‘radigan **virtual webcam** sifatida chiqarish. OBS/AlterCam o‘rniga yupqa, bitta maqsadli lokal tool. Muvaffaqiyat: Yandexda qurilma ko‘rinadi, diagnostika sahifada video bor, `cactustizim` Face ID preview da shu video.

## Goals

- MP4 tanlash, loop, Start/Stop.
- Tizimda alohida virtual kamera qurilmasi (brauzer/Face ID tanlay oladi).
- OBS Studio oynasini ochmasdan ishlashi (drayver o‘rnatilgan bo‘lsa).
- Lokal diagnostika HTML + prod Face ID da agent tomonidan smoke-test.

## Non-goals

- Go‘zallik filtrlari, sahna, stream, yozib olish.
- macOS / Linux.
- Production Face ID xavfsizligini “buzish” yoki umumiy spoof qo‘llanma.
- SalesArena asosiy frontend/backend ga bog‘lash.

## Anti-goals

- Drayversiz “faqat pleyer” (getUserMedia ga tushmaydi) — bu muvaffaqiyatsizlik.
- Parol/login ni repoga yozish.
- Imzosiz kernel-mode drayver talab qilish (oddiy user-mode / DirectShow/MF filter darajasi).

## Constraints

- Windows 10/11, Yandex Browser, mavjud test MP4.
- Brauzer faqat haqiqiy kamera qurilmasini ko‘radi → virtual device majburiy.
- `sales_copiya` ichida `tools/` ostida; asosiy app CI gate ga aralashmasin.
- AlterCam/OBS bilan birga ishlatilsa conflict bo‘lishi mumkin — testda boshqa VC ni to‘xtatish.

## Approaches

| | Yondashuv | Trade-off |
|---|-----------|-----------|
| A | Yupqa UI + mavjud OBS Virtual Camera | Tez, lekin OBS o‘rnatilganiga bog‘liq |
| **B (tanlangan)** | Mustaqil paket: UI + o‘z virtual-cam qatlami/installer | OBS UI shart emas; o‘rnatish og‘irroq |
| C | Faqat brauzer diagnostikasi | Face ID ga ulanmaydi |

**Tanlov: B** — foydalanuvchi tanladi.

## Design (B)

### Nima

`tools/face-vcam/` — “Face VCam” desktop tool:

1. **UI (Python + tkinter yoki customtkinter):** fayl tanlash, Loop checkbox, Start / Stop, status (`Idle` / `On air` / xato), qurilma nomi.
2. **Playback:** OpenCV (yoki imageio) orqali kadrlar; loop; 720p yoki manba o‘lchamiga mos (brauzer uchun 1280×720 default OK).
3. **Virtual device qatlami:** o‘rnatiladigan user-mode virtual webcam (DirectShow/compatible), qurilma nomi: **`Face VCam`**. Runtime da kadrlar shu qurilmaga yoziladi (`pyvirtualcam` yoki ekvivalent API + paketlangan backend).
4. **Installer / setup:** birinchi ishga tushirishda (yoki `install-driver.ps1`) virtual kamera drayveri/filter ni ro‘yxatdan o‘tkazadi; admin kerak bo‘lsa aniq yoziladi. OBS Studio to‘liq o‘rnatish shart emas.
5. **Diagnostika:** `tools/face-vcam/test-preview.html` — getUserMedia, qurilmalar ro‘yxati, Face VCam ni tanlash, preview.
6. **Ishlatish tartibi (smoke):** boshqa VC (OBS/AlterCam) o‘chiq → Face VCam Start → Yandex default kamera = Face VCam → diagnostika OK → `cactustizim` Face ID.

### Builder ga qoldirilgan

- Aniq open-source backend tanlovi (masalan Unity Capture / obs-virtualcam standalone / boshqa Windows-compatible filter) — litsenziya + Windows 11 da ishlashiga qarab.
- Packaging: `pip` + skript vs bitta `.exe` (PyInstaller); birinchi versiyada skript + driver install yetarli.
- UI toolkit detali.

### Test (agent)

1. Driver o‘rnatilganini tekshirish.
2. Test MP4 bilan Start.
3. `test-preview.html` da Face VCam + video.
4. Imkon qadar `cactustizim` Face ID preview (2-monitor/fokus cheklovlari bo‘lsa — diagnostika natijasi asosiy evidence).

## Settled decisions (2026-11-27, foydalanuvchi: tavsiyalar bilan to‘liq)

| Savol | Qaror |
|-------|--------|
| Smoke muvaffaqiyati | **(a)+(b):** lokal `test-preview.html` da Face VCam + video; **va** `cactustizim` Face ID da preview shu videoni ko‘rsatadi. **(c) liveness o‘tishi majburiy emas** / kafolatlanmaydi. |
| Drayver imzosi | **Imzosiz** filter + bir marta UAC/admin — OK (dev PC). Imzo/Smart App Control bloklasa — yo‘riqnoma. |
| Muhit | **Toza Windows** maqsad: OBS/AlterCam shart emas; self-contained o‘rnatish. |
| Kadr tempi | Wall-clock **~30 fps** (builder call). |
| Test MP4 | Default: `C:\Users\UNKNOWN\Pictures\Camera Roll\WIN_20261127_10_48_17_Pro.mp4` (UI dan boshqa fayl ham). |
| Binary yetkazish | Katta drayver binary ni gitga qo‘ymaslik; `install-driver.ps1` yuklab o‘rnatadi yoki lokal cache (builder call). |
| cactustizim smoke | Prod URL + mavjud test login (secret repoda yo‘q); 2-monitor cheklovida (a) asosiy evidence, (b) imkon qadar. |

**Dizayn holati:** tavsiyalar qabul qilindi — tasdiqlangan deb hisoblanadi; keyingi qadam: implementation plan.

## Risks

- Windows virtual cam imzo/Smart App Control; fallback yo‘riqnoma kerak.
- Ikki VC birga — NotReadableError; hujjatda “boshqasini to‘xtat” deb yoziladi.
- Liveness yo‘nalishlari video bilan mos kelmasligi — tool faqat kamera feed beradi, liveness “o‘tish” kafolatlanmaydi.
