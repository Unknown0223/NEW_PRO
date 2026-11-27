# Cactus Face ID — texnologiya tahlili va moslashuv rejasi

Manbalar: AWS Rekognition Face Liveness docs, Amplify UI `liveness.ts` (GitHub),
cactustizim.com Nuxt bundle (`DaUPe2QS.js`), F12 canvas sampling (ego 2026-11-27),
bizning live web testlar (`unity-force` / `liveness-timeline`).

---

## 1. Bu nima?

Cactus Tizim loginidagi «Проверка Face ID» — **Amazon Rekognition Face Liveness**
(`FaceMovementAndLightChallenge`) + keyin **yuzni ro‘yxatdagi biometrik bilan solishtirish**.

Bu lokal MediaPipe emas. Brauzerda **AWS Amplify `FaceLivenessDetector`** ishlaydi;
ranglar `amplify-liveness-freshness-canvas` ustida chiziladi; video **real-time**
Rekognition streaming API ga ketadi.

---

## 2. Cactus tomonidagi API zanjiri

Login → biometriya talab qilinsa:

1. `POST .../teams/face-biometrics/verification/init-session`
   - body: `{ face_verification_init_tx }`
   - javob: AWS **liveness `sessionId`** (string)
2. Brauzerda `FaceLivenessDetector` shu `sessionId` bilan ochiladi
3. Foydalanuvchi oval + rang challenge ni o‘tadi (video stream AWS ga)
4. `onAnalysisComplete` →
   `POST .../teams/face-biometrics/verification/verify`
   - body: `{ face_verification_init_tx, liveness_session_id }`
   - backend: `GetFaceLivenessSessionResults` + (odatda) reference image ni
     enroll qilingan yuz bilan CompareFaces / o‘xshashlik
   - javob: `{ is_success, voucher, errorCode }`

Ro‘yxatga olish (alohida):
- `.../registration/init-session` → liveness → `registration?userId&livenessSessionId`

Session **~3 daqiqa** ichida tugashi kerak; bir `sessionId` qayta ishlatilmaydi.

---

## 3. AWS Face Liveness — bosqichlar (UI)

Rasmiy oqim ([face-liveness.html](https://docs.aws.amazon.com/rekognition/latest/dg/face-liveness.html),
[diagrams](https://docs.aws.amazon.com/rekognition/latest/dg/face-liveness-diagrams.html)):

| # | UI / hint (RU) | Nima tekshiriladi |
|---|----------------|-------------------|
| 1 | Kamera ruxsati | `getUserMedia` |
| 2 | Countdown / Подключение | stream + session |
| 3 | ОТОДВИНЬТЕСЬ / ПРИБЛИЗЬТЕ | yuz ovalga mos o‘lcham |
| 4 | ПОМЕСТИТЕ ЛИЦО… | yuz markazda, bitta yuz |
| 5 | НЕ ДВИГАЙТЕСЬ | barqarorlik |
| 6 | Rang flash (freshness) | ekran ranglari ↔ videodagi yuz javobi |
| 7 | ПРОВЕРКА… | AWS score + Cactus verify |
| 8 | OK / не подтверждена | threshold + face match |

Challenge turi: **FaceMovementAndLightChallenge** (oval + rang ketma-ketligi).
Faqat harakatli `FaceMovementChallenge` bu saytda ko‘rinmaydi — F12 da rang canvas bor.

---

## 4. Freshness (rang) qanday chiziladi — F12 + Amplify kod

### 4.1 Server beradi

Session challenge ichida `ColorSequences[]`:

- `FreshnessColor.RGB` — `[R,G,B]` (0–255)
- `DownscrollDuration` — yangi rang yuqoridan pastga “silib” tushish vaqti
- `FlatDisplayDuration` — to‘liq ekran shu rangda turish vaqti

Amplify: `getColorsSequencesFromSessionInformation()` →
`rgb(r,g,b)` + duration’lar
([liveness.ts](https://github.com/aws-amplify/amplify-ui/blob/main/packages/react-liveness/src/components/FaceLivenessDetector/service/utils/liveness.ts)).

### 4.2 Canvas chizish (wipe)

`fillFractionalContext`:

1. `nextColor` → `[0 .. height * fraction]`
2. `prevColor` → `[height * fraction .. height]`

Bu **vertikal wipe** (yuqoridan pastga). `heightFraction` 0→1.

### 4.3 Oval ustidagi alpha (UI overlay)

`fillOverlayCanvasFractional`:

- Avval butun canvas to‘ldiriladi
- Keyin `globalAlpha = INITIAL_ALPHA` (**0.9**)
- Oval clip ichida `globalAlpha = SECONDARY_ALPHA` (**0.75**)

Muhim: bu **ekran overlay**. Kameraga tushadigan narsa — (haqiqiy odamda)
ekran nuri yuzga qaytishi; (virtual camda) — **biz tint qilgan video kadr**.

### 4.4 F12 da o‘lchangan sof ranglar (2026-11-27)

`amplify-liveness` / oval canvas namunasi (929×928):

| tick | top | mid | bot |
|------|-----|-----|-----|
| 1 | 255,0,255 | 255,0,0 | 255,0,0 |
| 2 | 0,255,255 | 0,255,255 | 255,0,255 |
| 3 | 255,0,0 | 255,255,0 | 255,255,0 |
| 4 | 0,0,255 | 0,0,255 | 255,0,0 |
| 5+ | 0,255,0 | 0,255,0 | 0,0,255 |

Xulosa: challenge **sof primary/secondary** (`0` yoki `255`) — sariq/yashil/cyan/ko‘k/magenta/qizil.
Ekrandan mss o‘rtacha olganda `#e6ea04` kabi “loyqa” chiqadi; apply da **sof palettega snap** qilish kerak.

---

## 5. AWS nima “PASS” deb hisoblaydi?

1. **Oval / harakat**: yuz to‘g‘ri o‘lcham va joyda, bir necha kadr barqaror
2. **Freshness**: videodagi yuz ranglari challenge ketma-ketligiga mos “javob” beradi
   (spoof: rasm, monitor replay, ba’zi digital injection)
3. **Confidence 0–100**; Cactus backend threshold qo‘yadi
4. **Reference image** → enroll qilingan yuz bilan match (verify bosqichi)
5. Past score da **feedback codes** (qayta urinish yo‘riqnomasi)

Virtual kamera / injection hujumlari alohida model qatlami bilan pasaytiriladi
([AI service card](https://docs.aws.amazon.com/ai/responsible-ai/rekognition-face-liveness/overview.html)).
Shu bois faqat “rang mos” yetarli bo‘lmasligi mumkin — lekin rang+yuz ko‘rinishi
asosiy freshness signal.

---

## 6. Bizning live test natijalari (qisqa)

| Test | Natija |
|------|--------|
| Default kamera | `Lanseyaoji` — Face ID yuz topmaydi / noto‘g‘ri |
| Force `Unity Video Capture` | 1920×1080 OK |
| Guide ketma-ketligi | ОТОДВИНЬТЕСЬ → ПРИБЛИЗЬТЕ → НЕ ДВИГАЙТЕСЬ → ПРОВЕРКА |
| Yakun | Ko‘pincha **Проверка не подтверждена** |
| ПРОВЕРКА paytida video sample | Teri rangi qolgan — flash yuzga tushmagan (tint lag / ego monitor) |
| Eski tint alpha 0.85 | Yuz “yo‘qoladi” (solid neon) |
| Yangi HSV keep-V + alpha 0.55 + sof snap | Yuz saqlanadi, rang oilasi to‘g‘ri |

---

## 7. Moslashuv spetsifikatsiyasi (shu texnologiyaga yarasha)

### 7.1 Rang (freshness) — majburiy

| Talab | Qanday qilamiz |
|-------|----------------|
| Sof RGB challenge | Sample oilasini `FACE_FLASH_PALETTE` ga snap: R/G/B/C/M/Y |
| Vertikal wipe | `split` = `heightFraction` (yuqori = next, past = prev) |
| Tempo | `DownscrollDuration` ga yaqin: hold ≈0, sampler ≥60–90 Hz, grab kechikishi ↓ |
| Overlay alpha ~0.75–0.9 UI | Virtual “aks” uchun tint **alpha ≈ 0.50–0.65** (0.85 yuzni o‘chiradi) |
| Yuz detail | HSV: H/S flashdan, **V yuzdan** (hozirgi `_colorize_preserve_luma`) |
| Monitor | Face ID ochiq monitor (DISPLAY2); wallpaper false-positive yo‘q |

Ideal (keyingi bosqich): freshness canvas pikselini to‘g‘ridan-to‘g‘ri o‘qish
(CDP / extension) yoki `ColorSequences` ni session’dan olish — mss o‘rtachasidan aniqroq.

### 7.2 Oval / zoom

| Hint | Ma’no | Pump |
|------|-------|------|
| ПРИБЛИЗЬТЕ | yuz kichik | zoom ↑ (~1.15–1.25) |
| ОТОДВИНЬТЕСЬ | yuz katta | zoom ↓ (~1.0–1.1) |
| НЕ ДВИГАЙТЕСЬ | barqaror | loop/freeze, jitter yo‘q |

Manba video o‘zi yaqin — **zoom 1.18** kompromis; dinamik zoom (hint bo‘yicha)
keyingi yaxshilash.

### 7.3 Kamera

Brauzer default — birinchi USB cam. **Majburiy**: `Unity Video Capture`.
(ego da `getUserMedia` patch; foydalanuvchi Chrome da qo‘lda tanlaydi.)

### 7.4 Verify (yuz match)

Liveness o‘tgach ham `verify` enroll rasmiga qarab rad etishi mumkin.
MP4 dagi odam = enroll qilingan user bo‘lishi shart (`unknown` biometrikasi).

### 7.5 Nima “yetarli emas”

- Faqat ekran rangini ko‘rsatib, yuzni solid bo‘yash
- Tint lag (sahifa oldinda, video orqada)
- Noto‘g‘ri kamera
- Wallpaper / UI ni flash deb olish
- Bitta sessionId ni qayta ishlatish

---

## 8. Hozirgi kod holati (face-vcam)

- `screen_tint.py`: sof palette snap, neon gate, modal ROI, pin-mss, 90 Hz target
- Tint: HSV keep-V, `DEFAULT_TINT_ALPHA = 0.55`
- Wipe: hard `split`
- Pump: Unity Capture 1920×1080, zoom `1.18`
- Testlar: 29 passed

---

## 9. Keyingi moslashuv navbati (prioritet)

1. **Freshness sync**: canvas ROI yoki CDP orqali sof wipe o‘qish (mss emas)
2. **Alpha kalibr**: 0.55 ↔ 0.75 oralig‘ida live PASS rate
3. **Dinamik zoom** hint matniga qarab
4. **Chrome default cam** = Unity (yoki start scriptda eslatma)
5. **E2E**: liveness PASS + verify `is_success` (to‘g‘ri enroll yuzli video)

---

## 10. Qisqa xulosa

Tizim = **AWS Face Liveness (harakat + yorug‘lik/rang)** + **Cactus biometrik match**.
Ranglar server `FreshnessColor.RGB` dan keladi, UI da vertikal wipe + alpha 0.9/0.75.
Kameraga tushadigan videoda yuz shu ranglarga “javob” berishi va baribir
taniladigan bo‘lishi kerak. Shu sabab moslashuv: **sof rang + tez wipe + yuzni
saqlovchi tint + to‘g‘ri oval/zoom + Unity cam**.
