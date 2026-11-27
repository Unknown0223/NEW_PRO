# Face VCam — screen color tint sync (2026-11-27)

## Intent / why

Prod Face ID (`cactustizim`) jonlilikni **ekran rangi flash** bilan tekshiradi (sariq → yashil → pushti/ko‘k). Oddiy MP4 da yuzda shu nur yo‘q — tekshiruv yiqiladi. Zoom yordam bermaydi. Muvaffaqiyat: flash paytida virtual kamera kadrida ham shu rang ko‘rinadi.

## Goals

- Monitor ekranidan flash rangini aniqlash (chekka/zonadan sample).
- Aniqlangan RGB ni chiqish videosiga aralashtirish (tint), vaqt sinxroni avtomatik.
- UI da yoqish/o‘chirish (`Screen tint` checkbox) + statusda joriy tint.
- Mavjud loop / speed / zoom saqlanadi.

## Non-goals

- Brauzer DOM/CDP o‘qish.
- Taymerli hard-coded rang ketma-ketligi (yondashuv 2).
- Zoom/face-size muammolarini “tuzatish”.
- Asosiy SalesArena frontend/backend o‘zgarishi.

## Anti-goals

- Doimiy kuchli tint (oddiy preview ham yashil/sariq bo‘lib qolishi).
- Ekran skanida Face VCam oynasini o‘zini “flash” deb o‘qish (self-feedback).

## Constraints

- Windows; mavjud `tools/face-vcam` (worktree `feat-face-vcam-standalone`).
- Yangi dep: engil screen capture (`mss` yoki `Pillow.ImageGrab`).
- Sample: monitor chekkalaridan (markaz/oval emas) — Face ID overlay butun viewport bo‘yaladi.
- Flash faqat **yuqori saturation + yuqori value** bo‘lganda; oddiy dark-green login tint emas.
- Blend alpha ~0.35–0.55 (sozlanadigan default); yuz hali ham o‘qiladi.
- Capture ~10–15 Hz (pump fps dan mustaqil thread); pump har kadrda oxirgi tint ni qo‘llaydi.

## Approaches

| | Yondashuv | Trade-off |
|---|-----------|-----------|
| **1 (tanlangan)** | Ekran sample → tint sync | Sinxron; Windows permission / multi-monitor |
| 2 | Taymer ketma-ketlik | Oddiy; web tempo o‘zgarsa yiqiladi |
| 3 | Qo‘lda tugmalar | Nazorat; avtomatik emas |

Tanlov: **1** — foydalanuvchi `/using-superpowers 1`.

## Design (qisqa)

1. `face_vcam/screen_tint.py` — sof funksiyalar:
   - `sample_flash_rgb(bgr_or_rgb_frame) -> (r,g,b)|None` — chekka patchlar, HSV sat/val chegarasi.
   - `apply_tint(rgb, color, alpha) -> rgb` — `out = (1-a)*frame + a*color`.
2. `ScreenTintSampler` (background thread) — `mss` primary monitor, ~12 Hz, `latest: tuple|None` (lock).
3. `run_pump(..., screen_tint: bool = False, tint_alpha: float = 0.45)` — har `cam.send` oldidan `apply_tint` agar sample bor.
4. Tk `Screen tint` checkbox; status `tint=#RRGGBB` yoki `tint=off`.
5. Testlar: synthetic sariq/yashil overlay → sample RGB; oddiy dark UI → `None`; `apply_tint` arifmetikasi.

## Builder calls

- Multi-monitor: primary only.
- Self-feedback: sample faqat ekran chekkasi; Face VCam UI kichik bo‘lsa OK.
- Alpha default `0.45`.
