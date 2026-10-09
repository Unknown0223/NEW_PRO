# Yuz tanib olish (server) — to‘liq reja

**Holat (2026-08-25):** A+B lokal smoke **PASS**.  
Server etalon vs selfie ni solishtiradi (descriptor + cosine; FaceNet emas). Mos kelmasa `403 FaceMismatch`.

---

## 1. Hozir nima bor (tayyor)

| Qism | Holat |
|------|--------|
| Mobil profil → selfie yuklash | ✅ |
| Rasm serverda (storage) saqlash | ✅ |
| Akkauntga bog‘lash (`ui_preferences` + storage key + descriptor) | ✅ |
| Kunlik kirishda so‘rash | ✅ (config) |
| Random buyurtma (max 5/kun) | ✅ (config) |
| SVR territoriya tekshiruvi | ✅ (config) |
| Ekspeditor yetkazish | ✅ (config) |
| Ishchi o‘rinda etalon rasm ko‘rinishi | ✅ (agar yuklangan bo‘lsa) |
| Tekshiruv jurnali (DB) | ✅ |
| **Serverda yuz solishtirish** | ✅ (lokal fingerprint; score + threshold) |
| **Vebdan etalon yuklash** | ✅ (agent / SVR / ekspeditor kartalari + staff API) |
| **Liveness / aldovdan himoya** | ❌ hali yo‘q |
| **Oylik / boshqa moliyaviy tasdiqlar** | ❌ keyinroq |

Lokal tekshiruv: `node backend/scripts/smoke-face-match.mjs` → **SMOKE PASS (A+B)**.

---

## 2. Maqsad (nima bo‘lishi kerak)

1. **Har bir xodim akkauntiga** etalon yuz rasmi biriktiriladi (agent, ekspeditor, SVR, va boshqa maydon rollari).
2. Tekshiruvda telefon **yangi selfie** oladi.
3. **Server** shu selfie ni **faqat shu akkauntning etalon rasmi** bilan solishtiradi.
4. Mos kelmasa — amal **bloklanadi**, jurnalga `rejected` yoziladi.
5. Aldov (telefon ekranidan rasm, boshqa odam) imkon qadar qiyinlashtiriladi.
6. Vebda: xodim kartasi + ishchi o‘rinida etalon rasm ko‘rinadi; admin yangilashi / o‘chirishi mumkin.

---

## 3. Rasm qayerda saqlanadi

```
Xodim akkaunti (users)
   └── face_reference_storage_key  →  storage fayl
         tenants/{tenantId}/users/{userId}/face/reference.jpg

Har bir tekshiruv
   └── face_verification_logs
         snapshot (yangi selfie) + reference (qaysi etalon bilan solishtirildi)
         + score, status, context, vaqt, qurilma
```

**Qoida:** solishtirish **faqat shu user_id ning etalon rasmi** bilan. Boshqa xodim rasmi bilan emas.

---

## 4. Kim qayerda rasm yuklaydi

| Joy | Kim | Nima |
|-----|-----|------|
| **Veb → Xodimlar / ishchi o‘rin** | Admin / moderator | Barcha xodimlarga etalon rasm qo‘yish / almashtirish |
| **Mobil → Profil** | Xodimning o‘zi | Birinchi marta yoki admin ruxsati bilan yangilash |
| **Ishchi o‘rin (work-slot)** | Avtomatik | Biriktirilgan xodim rasmi ko‘rinadi (akkaunt bog‘langanda) |

Agar akkauntda rasm **yo‘q** bo‘lsa:
- yuz tekshiruvi yoqilgan bo‘lsa — ilova **majburiy** etalon so‘raydi;
- yoki admin vebdan oldindan yuklaydi (tavsiya).

---

## 5. Qachon solishtirish ishlaydi

Config (`misc.face_verification_*`) yoqilganda:

| Holat | Rol | Amal |
|-------|-----|------|
| Har kuni ilovaga kirish | Agent / Ekspeditor / SVR | Selfie → server solishtirish |
| Random buyurtma (kuniga max 5) | Agent | Selfie → solishtirish, keyin buyurtma |
| Territoriya / mijoz tekshiruvi | SVR | Selfie → solishtirish, keyin saqlash |
| Yetkazish / to‘lov / qaytarish | Ekspeditor | Selfie → solishtirish (biometric PIN bilan birga) |
| Oylik / muhim moliyaviy tasdiq | Keyinroq | Xuddi shu mexanizm |

---

## 6. Server solishtirish — qanday ishlashi kerak

### 6.1 Oddiy oqim

```
1. Mobil selfie yuboradi (base64)
2. Server etalon rasmini storage dan o‘qiydi (shu user_id)
3. Agar etalon yo‘q → rejected + «rasm yuklang»
4. Yuz aniqlash (face detect) — selfie da yuz yo‘q → rejected
5. Embedding / match score hisoblash (etalon vs selfie)
6. Score ≥ threshold → approved, amal ruxsat
7. Score < threshold → rejected, amal blok
8. Hammasini face_verification_logs ga yozish
```

### 6.2 Himoya (aldovga qarshi)

| Himoya | Nima |
|--------|------|
| **Liveness** | Ko‘z qisish / bosh burish yoki 2–3 kadr ketma-ketligi |
| **Ekran/foto aldovi** | Past sifat / moiré / flat texture rad |
| **Bir etalon** | Faqat akkauntga biriktirilgan rasm |
| **Yangi selfie** | Eski faylni qayta yuborishni qiyinlashtirish (vaqt, nonce) |
| **Qurilma + vaqt** | Jurnalda device / IP / timestamp |
| **Threshold** | Tenant sozlamasi (masalan 0.75–0.85) |
| **Admin ko‘rib chiqish** | Shubhali holatlar vebda ko‘rinadi |

### 6.3 Texnika (tavsiya)

Bosqichma-bosqich:

1. **MVP solishtirish:** ochiq yoki xizmat API (masalan AWS Rekognition / Azure Face / yoki lokal face embedding kutubxonasi).
2. **Keyin:** liveness paket + anti-spoof.
3. **Keyin:** admin dashboard (rad etilganlar, score, qo‘lda tasdiq).

> Hozirgi kodda AI yo‘q — shu bo‘shliqni to‘ldirish asosiy ish.

---

## 7. Veb (rabochiy joy + xodim)

- Xodim kartasida: **etalon rasm** (ko‘rish / yuklash / o‘chirish).
- Ishchi o‘rin detallarida: biriktirilgan user bo‘lsa — shu rasm.
- Agar user bog‘lanmagan — «rasm yo‘q / xodim biriktirilmagan».
- Jurnal: oxirgi N ta tekshiruv (approved / rejected + score).

---

## 8. Bosqichlar (amalga oshirish tartibi)

### A — Rasm barcha akkauntlarga (1–3 kun)
- [x] Veb: xodim profilida etalon rasm yuklash API + UI
- [x] Mobil profil bilan bir xil storage kaliti
- [x] Ishchi o‘rin / staff ro‘yxatida rasm ko‘rinishi
- [ ] Rasm yo‘q bo‘lsa — config yoqilganda ogohlantirish

### B — Haqiqiy server solishtirish (3–7 kun)
- [x] Face detect + match service ulash (lokal descriptor)
- [x] `approved` / `rejected` score bo‘yicha
- [x] Threshold (`FACE_MATCH_THRESHOLD`, default 0.88)
- [ ] Rad etilganda mobil xabar («yuz mos kelmadi»)

### C — Himoya (1–2 hafta)
- [ ] Liveness (kamida oddiy)
- [ ] Replay / eski rasm himoyasi
- [ ] Rate limit (spam selfie)
- [ ] Admin: shubhali loglar

### D — Kengaytirish (keyin)
- [ ] Oylik / katta to‘lov tasdiqlari
- [ ] Veb jurnal filtrlari
- [ ] Qo‘lda admin override (istisno)

---

## 9. Sodda xulosa

| Savol | Javob |
|-------|--------|
| Server yuzni tanib olish **tugallanganmi**? | **Asosiy A+B — ha (lokal).** Descriptor match; liveness/FaceNet yo‘q. |
| Rasm akkauntga birikadimi? | **Ha** — mobil + veb (agent/SVR/ekspeditor) + staff API. |
| Solishtirish shu rasm bilanmi? | **Ha** — faqat shu user etaloni; mismatch → `403 FaceMismatch`. |
| Keyingi asosiy ish? | Liveness, kuchliroq model (ixtiyoriy), deploy. |

Smoke: `node backend/scripts/smoke-face-match.mjs`
