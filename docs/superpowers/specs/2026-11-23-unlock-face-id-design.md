# Unlock Face ID (SmoothUI) — design

**Intent:** SmoothUI `UnlockFaceId` (MIT) ko‘rinishini web Face login va Flutter kunlik Face gate ga qo‘yish — scan / success / error holatlari bir xil.

**Why:** Face ID oqimi hozir oddiy dialog / ring; brand Face ID glyph kerak.

## Approaches

1. Faqat Flutter port — mobil, web eski. Rad (3 tanlandi).
2. Faqat web + `motion` — brauzer, mobil eski. Rad.
3. **Ikkalasi** (tanlangan) — web React komponent + Flutter vizual port.

## Goals

- Web: login Face challenge da SmoothUI glyph; status real oqimga bog‘langan.
- Flutter: kunlik / verify dialogda xuddi shu glyph + holatlar.
- Controlled mode: haqiqiy kamera/verify natijasi; demo timeout bilan “success” emas.
- Reduced motion / `motion-reduce` hurmati.
- MIT izoh faylda.

## Non-goals

- Haqiqiy biometrik Face ID API o‘rniga o‘tish.
- Foto/video stitch, Telegram, lokatsiya (alohida).
- Uncontrolled scanDuration bilan auth ochish.

## Constraints

- Web: `motion` dependency; `cn` + Tailwind; brand stroke `currentColor` / mavjud primary.
- Flutter: `CustomPainter` + `AnimationController`; yangi og‘ir package shart emas.
- Webda `FaceScanIndicator` o‘rnini glyph bilan almashtirish yoki overlay — liveness preview ustida.

## How (builder)

### Web

- `frontend/components/ui/unlock-face-id.tsx` — berilgan SmoothUI kod (default export).
- `npm i motion` (frontend).
- `face-liveness-preview.tsx`: `FaceScanIndicator` o‘rniga controlled `UnlockFaceId`:
  - align/scan → `scanning`
  - server busy → `scanning`
  - outcome success → `success`
  - outcome failure → `error`
- Matnlar RU/loyihа uslubida: «Сканирование…», «Лицо подтверждено», xato mavjud xabar.
- `children` blur gate shu joyda ixtiyoriy emas (kamera preview alohida).

### Flutter

- `mobile/lib/core/face/unlock_face_id.dart` — glyph (brackets + face + scan band + check) + status.
- `FaceVerificationFlow._captureAndVerify` / daily dialog: oddiy AlertDialog o‘rniga sheet:
  1. idle → «Сканировать»
  2. scanning (kamera ochilganda / upload)
  3. success qisqa → pop true
  4. error → shake + qayta urinish
- Haqiqiy `ImagePicker` + `submitVerification` oqimi o‘zgarmaydi; faqat UI qobiq.

## Anti-goals

- Fake success without server verify.
- Purple brand majburiy (`--color-brand` fallback OK, SALEC primary ustun).

## Builder calls (settled)

- Web status map: failure→error, success→success, else busy/align/scan→scanning, boshlang‘ich idle faqat kamera oldidan.
- Flutter: bitta reusable widget; reference upload dialog ham shu glyph (ixtiyoriy bir xil).
- LOC: yangi fayllar ≤400.
