# TezYuk Ekspeditor — alohida dastavchik ilova + ulashish + web

**Date:** 2026-11-25  
**Status:** approved (user 2026-11-25 — «tavsiyang bilan o‘zing tanla» → **A**: Wave 0–1 birinchi ship, Wave 2 keyin)  
**Manba:** bugungi suhbat (ulashish, partnyorlar, agent↔SVR) + Stitch v2 katalog  
`stitch_modern_delivery_app_redesign (1).zip` → 24 ekran + design system

## Intent / why

Dastavchik (ekspeditor) uchun **alohida mahsulot sifatida** TezYuk mobil ilova: katalog UI, mavjud yetkazish funksiyalari, yangi **Ulashish** oqimi, webda partnyor/sozlamalar. Agent/SVR o‘rinbosar cover — keyingi bosqich, lekin shu dizaynda qoida sifatida qayd etiladi.

## Goals

- Do‘konda / qurilmada **alohida** dastavchik ilova (nom, ikonka, package id).
- Stitch v2 ekranlarini **navbat bilan** moslashtirish (bir-biriga xalaqit bermasdan).
- Bugungi kelishuvdagi **Ulashish** mantig‘i (qisman qabul, yuk+foto, qaytarish, qulf).
- Web: partnyorlar bog‘lash (har ekspeditor alohida; ombor cheklovisiz tanlash).
- Har bosqichda **testlar** (unit/contract/smoke qayerda mos).
- Mavjud backend ekspeditor API dan foydalanish; yangi API faqat ulashish/partnyor/cover uchun.

## Non-goals (hozirgi releaselar)

- Agent/SVR cover ni birinchi APK bilan birga ship qilish (dizayn qaydida, implement — keyin).
- Agent yoki supervisor UI ni TezYuk ga ko‘chirish.
- Stitch HTML ni to‘g‘ridan Flutterga paste qilish (faqat UX/reference).
- Commit/deploy — so‘ralmaguncha.

## Anti-goals

- Bir PR da 24 ekran + ulashish + cover + web hammasi aralash.
- Asosiy `expeditor_user_id` ni ulashishda o‘zgartirish.
- Ulashishda foto/GPS siz «faol» qilish.
- Partnyor ro‘yxatini tashqi `partner` roli bilan chalkashtirish.

## Constraints

- Repo: `e:\sales_copiya`; sifat: lint:errors, typecheck, `tsc --noEmit`, audit:max-loc ≤400.
- Picker yorlig‘i: faqat nom (`.cursor/rules/picker-labels.mdc`).
- Mobil: Flutter + Riverpod + go_router (mavjud stack).
- Ulashish GPS default ~150 m (konfig qilinadigan).
- Face ID / biometrik — mavjud mobile face oqimlariga bog‘lash.

## Approaches (tanlangan: 1 + 2 gibrid)

| # | Yondashuv | Trade-off |
|---|-----------|-----------|
| 1 | Yangi `mobile_expeditor/` Flutter app | Toza alohida app; dastlab nusxa/xarajat |
| 2 | `mobile/` ichida expeditor **flavor** | Tez, bitta CI; «alohida» do‘konda package id bilan |
| 3 | Avval paketlar, keyin 2 app | Eng sekin |

**Tanlov (user: «1,2»):** gibrid.

1. **Faza A (tez):** mavjud `mobile/` da `expeditor` product flavor — alohida `applicationId`, app name «TezYuk», faqat ekspeditor routing/shell (katalog UI).
2. **Faza B:** barqaror bo‘lgach umumiy qismlarni `packages/` ga ajratib, ixtiyoriy `mobile_expeditor/` standalone app (1-variant) — bir xil kod, alohida entry.

Builder Faza A ni ship qilishi mumkin; Faza B alohida plan.

## Scope bo‘linishi (navbat — xalaqit bermaslik)

### Wave 0 — Poydevor
- Flavor / app id / TezYuk theme tokenlari (design system: primary `#0A6B3D`, fon `#EDF3F7`).
- Faqat `role == expeditor` kirishi; boshqa rollar login da rad yoki redirect.
- Smoke: login → home.

### Wave 1 — Katalog asosiy ekranlar (mavjud API)
Navbat (har biri PR yoki aniq task + test):
1. Bosh (`kuryer_bosh_ekrani`)
2. Tashriflar + xarita
3. Yetkazib berish navbati
4. To‘lovlar / qarzdorlar
5. Yukxatlar
6. Mashina qoldig‘i (+ m³/kg UI agar API yetarli; yo‘q bo‘lsa builder: placeholder + ticket)
7. Mijoz / vizit tafsiloti (3 bosqich)
8. Chornoviklar
9. Tabel + Face ID / otmetka kamera
10. Profil / sozlamalar (konfig read-only + til + biometrik)
11. Qaytarishlar (po zakaz / to‘liq / qisman) — katalog
12. To‘lovni o‘zgartirish (kassir taymer)

### Wave 2 — Ulashish (yangi domen)
Backend + mobil + web partnyorlar birgalikda, lekin tasklar ichki tartibda:

**Domen qoidalari (suhbat + builder-check yopilganlari):**
- Yuboruvchi zakazlarni tanlaydi → qabulchi tanlash:
  - partnyorlar **bo‘sh** → default: **o‘z ombori** ekspeditorlari;
  - partnyorlar **bor** → ro‘yxatda **faqat** shular (boshqa ombor faqat partnyor sifatida qo‘shilganda).
- Holatlar: `kutilmoqda` → `ko'rildi` (qabulchi ochganda) → `qisman_qabul` / `qabul_qilindi` → `yuk_kutilmoqda` → `faol` | `rad` | `bekor` | `qaytarish_kutilmoqda` | `qaytarildi` | `tugallandi`.
- `ko'rildi`: qabulchi tafsilotni ochganda avtomatik. `bekor`: faqat yuboruvchi, `kutilmoqda`/`ko'rildi` da. Timeout default: **ish kuni oxiri** (config).
- Qabulchi **qisman** tanlaydi; tanlanmaganlar avto-rad → yuboruvchiga qulf ochiladi.
- **Faol** bo‘lgach: amallar **faqat qabulchi JWT** orqali (yetkazish/to‘lov/qaytarish). Yuboruvchi amal qila olmaydi.
- Qabuldan keyin **ikkala tomon bir-biriga ~150 m** (GPS) + **foto otchyot** majburiy; aks holda `faol` emas.
- Yuboruvchida ochiq/`yuk_kutilmoqda`/`faol` so‘rovdagi zakazlar **xira**, amal yo‘q.
- Asosiy `expeditor_user_id` **o‘zgarmaydi**; belgi «Ulashilgan».
- Orqaga qaytarish: faqat qolgan (yetkazilmagan); qarshi tomon qabul + yuk/foto.
- Bildirishnomalar: `SHARE_REQUEST_NEW`, `VIEWED`, `ACCEPTED`, `REJECTED`, `CANCELLED`, `HANDOFF_NEEDED`, `PHOTO_MISSING`, `ACTIVE`, `RETURN_*`, `LOCATION_MISMATCH`, `PARTIAL_DONE`.
- Xato kodlari: `ShareNotSameWarehouse` (default ro‘yxat), `ShareOrderAlreadyLocked`, `ShareOrderNotEligible`, `ShareSenderCannotAct`, `ShareNotAcceptedYet`, `SharePhotoRequired`, `ShareNotSameLocation`, `ShareHandoffIncomplete`, `ShareReturnOnlyRemaining`, `ShareReturnNeedsAccept`, `ShareRequestExpired`.

**Stitch ekranlar:** `ulashish_*` (7 ta). Reference: `c:\Users\UNKNOWN\Downloads\stitch_modern_delivery_app_redesign_v2\` (+ Desktop `tezyuk-stitch-katalog-v2.txt`).

**Web:** Sozlamalar / Partnyorlar (ulashish) — har ekspeditor uchun ruxsat etilgan juftlar; rollar: admin, menejer/regional, logist/dispetcher, ombor mudiri. Ekspeditor webda o‘zgartirmaydi.

**UI qamrovi:** yangi TezYuk katalog UI **faqat expeditor flavor** da; eski umumiy APK ekspeditor UI Wave tugaguncha saqlanishi mumkin.

### Wave 3 — Agent ↔ SVR cover (keyin)
- Faqat agentning biriktirilgan SVR.
- Ikki tomonlama so‘rov; Face ID; marshrut xiralashuvi.
- `egasi=agent`, `bajaruvchi=SVR`; oylikda agent exclude, SVR ga agent tarkibida; belgi `SVR_COVER`.
- Qisman qabul / orqaga qaytarish — dastavchik bilan bir xil pattern.
- Aldov: bitta faol cover/kun, audit, tabel ogohlantirish (taqiq vs warn — builder default: **ogohlantirish**, config flag).

## Test strategiyasi

- **Wave 0–1:** Dart unit (policy/mapping) + mavjud ekspeditor API contract; golden/widget tanlangan shell.
- **Wave 2:** Backend Vitest (holat mashinasi, qulf, partnyor filter); mobil unit (lock matrix); API smoke ulashish create/accept/handoff.
- **Wave 3:** alohida payroll exclude testlari.
- Har wave oxirida: `lint:errors`, frontend/mobile test, backend `tsc` / `test:ci` (tegishli paket).

## Builderga qoldirilgan

- Aniq package id / keystore / store listing matnlari.
- m³/kg API yetarli emasligi → minimal UI vs backend ticket.
- Faza A ichida flavor yetarli; `mobile_expeditor/` — Faza B.
- Push provider ulashish bildirishnomalari (mavjud notification infrastrukturasi).
- Cover da agent «keldi» bo‘lsa default: **ogohlantirish** (taqiq flag orqali).

## Approval

- Yondashuv: **1+2 gibrid** (flavor → keyin ixtiyoriy `mobile_expeditor/`).
- Birinchi ship: **A** — Wave 0–1; Wave 2 (ulashish + web partnyor) keyingi releas; Wave 3 cover undan keyin.

## Success

- TezYuk APK faqat ekspeditor bilan foydali.
- Katalog asosiy oqimlar ishlaydi (mavjud API).
- Ulashish: yuborish → qisman qabul → foto/GPS → faol → qaytarish; testlar yashil.
- Web partnyor CRUD ishlaydi.
- Cover Wave 3 alohida reja bilan, Wave 2 ni buzmasdan.
