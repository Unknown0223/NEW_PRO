# SALEC — oddiy tildagi audit

**Kim uchun:** dasturlashni bilmaydigan odam  
**Qachon:** 2026-08-15  
**Nima:** Arena.ai to‘liq texnik hisobot yozgan. Shu faylda o‘sha hisobot **sodda qilib** tushuntiriladi. Oxirida esa: **men o‘zim kodni ochib tekshirdim — nima to‘g‘ri, nima bo‘rttirilgan.**

---

## 1. Bir jumlada

SALEC **yaxshi qurilgan savdo tizimi**. Pul hisobi, zakaz qoidalari, kompaniyalar ajratilishi — professional.

Lekin hozir **ikkita katta tashvish** bor:

1. Telefon ilovasining **imzo kaliti** kod omborida ochiq yotibdi. Kim olsa, soxta yangilanish yuborishi mumkin.
2. Avtomatik sifat nazorati (har o‘zgarishda mashq ishlatish) **ishlamayapti**, chunki birinchi qadam yiqiladi. Yozilgan testlar shu bois foyda bermayapti.

**Qisqa maslahat:** yangi funksiyani 2–3 kunga to‘xtating. Avval kalit va nazoratni tuzating. Poydevor mustahkam — bu “bino yomon” emas, “qulf ochiq”.

---

## 2. Arena nima dedi va men nima topdim

| Arena xulosasi | Men tekshirdim | Natija |
|---|---|---|
| Umumiy baho 7/10, uy yaxshi, intizom zaif | Kod tuzilishi, pul hisobi, qorovul, kalit | **Asosan to‘g‘ri** |
| Telefon kaliti + parol git’da | Fayl bor, git kuzatadi, .gitignore ataylab ruxsat bergan | **To‘g‘ri. Eng xavfli topilma.** |
| Qorovul Fastify 5 da “o‘tkazib yuboradi” | Kodda `if (!rule) return` — qoida topilmasa ruxsat. Qoidalar `:id` yozuvi bilan. Hozir Fastify 4. | **To‘g‘ri, lekin bugun emas — yangilash paytida.** |
| CI npm audit tufayli to‘xtaydi | `ci.yml` da audit high = fail, keyin test/build | **To‘g‘ri (mantiq).** “1 oy qizil”ni bu kompyuterda GitHubdan qayta ocholmadim. |
| `fast-jwt` — CRITICAL, token soxtalashtirish | CVE bor (o‘rtacha). Bu loyiha `iss` (chipta kim chiqargan) ni umuman tekshirmaydi. npm `@fastify/jwt` ni **moderate** deb belgilagan. | **Muammo bor, daraja oshirib yozilgan.** |
| Excel (`xlsx`) tuzatilmaydi | 0.18.5, ko‘p joyda, `No fix available` | **To‘g‘ri.** |
| 3 ta test yiqilgan (operator, slot kodi, dashboard) | Kod test aytgan narsaga zid | **To‘g‘ri (koddan ko‘rinadi).** Testlarni qayta ishlatmadim. |
| Kirish chiptasi localStorage + 180 kun | Tasdiqlandi | **To‘g‘ri.** |
| Tenant-audit skripti yolg‘on “OK” | Ro‘yxat eski fayllar. `clients.route.ts` faqat boshqa fayllarni chaqiradi — 0 marshrut, lekin OK | **To‘g‘ri.** |
| 2 ta baza modeli indekssiz | `Tenant.slug` allaqachon `@unique`. Ikkinchisida `@@id` bor. | **Noto‘g‘ri / chalkash.** Kesh yo‘qligi alohida (tezlik). |
| Tranzaksiyada timeout faqat 1 ta | Migratsiya va bulk’da bir nechta timeout bor | **Bo‘rttirilgan.** Ko‘pida hali yo‘q — bu qism to‘g‘ri. |
| Telefon testlari atigi 4 ta | `mobile/test` da **23 ta** Dart test fayli | **Eskirgan / noto‘g‘ri.** |
| Repo public | Oldingi GitHub rasmi **Private** edi. Hozir `gh` yo‘q — qayta tekshiring. | **Aniqlanmadi. GitHubda Private ekanini o‘zingiz ko‘ring.** |
| 1733 TypeScript xato | Qayta ishlatmadim. Arena o‘zi 494 tasi muhit chiqindisi dedi. | **Ishonchsiz raqam. Asosiy xavf emas.** |
| Uptime 4 soat qizil | Monitor manzili berilmasa `api.example.com` ga uriladi | **Fail ehtimoli monitor sozlamasi**, nafaqat “prod o‘lgan”. |

**Xulosa:** Arena **yaxshi ishlagan**, asosiy xavflarni to‘g‘ri ko‘rsatgan. Lekin “CRITICAL” yorlig‘ini ba’zi joyda **qo‘rqitish uchun kattalashtirgan**. 7/10 baho mantiqiy.

---

## 3. Bu tizim nima (uy misoli)

Tasavvur qiling: bitta katta ofis.

- **Kompyuter paneli** — ofis xodimlari
- **Telefon ilovasi** — agentlar dalada
- **Kassa daftari** — pul, qarz, ombor

Audit = uy tekshiruvi: nafaqat qog‘oz, balki signalni bosish, mashq ishlatish, eshiklarni sanash.

---

## 4. Nima yaxshi (bunga ishonish mumkin)

**Pul aniq hisoblanadi.** Oddiy kalkulyator ba’zan 0.1 + 0.2 ni xato beradi. Bu yerda pul maxsus “aniq daftar”da. GPS aniqligi uchun bitta `Float` bor — pul emas. Bu moliyaviy jihatdan kuchli belgi.

**Boshqa kompaniyaning daftari ko‘rinmasin.** Har so‘rovda “bu qaysi ofis?” deb so‘raladi. Auditor 655 eshikdan 652 tasi yopiq dedi. 3 tasi ataylab ochiq (ilova yuklash va sayt tezligi).

**Zakaz bosqichlari qat’iy.** Posilkadek: ombordan to‘g‘ridan-to‘g‘ri “bekor”ga sakrab bo‘lmaydi. Qoida bitta joyda.

**Yolg‘on SQL buyrug‘i bilan kassani ochib bo‘lmaydi.** Xavfli “xom so‘rov” deyarli yo‘q; qolgani ichki `SAVEPOINT` (foydalanuvchi yozmagan).

**Qo‘llanma kuchli.** Qanday ishga tushirish, zaxira, xavfsizlik yozilgan. Noto‘g‘ri sozlama bilan haqiqiy ishga tushirish to‘xtatiladi (parol, baza, ruxsat).

**Shuning uchun 7 ball.** Bino yaxshi. Qulf va nazorat zaif.

---

## 5. Muammolar — uy tilida

Daraja:

- **Juda xavfli** — bugun yoki shu hafta
- **Xavfli** — 1–2 hafta
- **O‘rtacha / kichik** — keyinroq, lekin unutmang

### Juda xavfli

#### 1) Telefon ilovasining kaliti ko‘chada

**Uy:** uy kalitining nusxasini ko‘chaga osish.

**Dasturda:** `mobile/android/keystore/salesdoc-ota.jks` va `key.properties` git’ta. Parol oddiy debug so‘zi. Kalit nomi ham debug kalit. `.gitignore` da ataylab “saqla” deb yozilgan (qulaylik uchun).

**Bo‘lsa:** kimdir soxta “rasmiy yangilanish” yasab, mijoz telefoniga boshqa dastur qo‘yishi mumkin.

**Qilish:** yangi kalit. Eskisini bekor qilish. Faylni ombordan (hatto eski tarixdan) olib tashlash. Yangisini faqat yopiq seyfga (GitHub Secrets). GitHub **Private** ekanini tekshirish.

Men tasdiqladim: fayllar kuzatiladi.

---

#### 2) Qorovul kelajakda “tushunmasam — o‘tkazaman”

**Uy:** eshik nomini o‘zgartirsangiz, qorovul tushunmaydi va eshikni ochiq qoldiradi.

**Dasturda:** ruxsatlar ro‘yxati eshikning **shablon** nomiga yozilgan (`/orders/:id`). Hozir (Fastify 4) ishlaydi. Asosiy dvigatel yangilanganda shablon yo‘qoladi, haqiqiy manzil keladi (`/orders/5`) — qoida tushmaydi. Kod: qoida yo‘q → **o‘tkaz**. Zakaz o‘chirish, to‘lov tasdiqlash shu ro‘yxatda.

**Hozir:** yashirin bomba, hali portlamagan.

**Qilish:** yangi nomni o‘qisin. Topilmasa — **to‘xtatsin**, o‘tkazmasin.

Men tasdiqladim.

---

#### 3) Sifat nazorati o‘chiq

**Uy:** fabrikada tasmani tekshiruvchilar o‘chirilgan.

**Dasturda:** GitHub har o‘zgarishda test, yig‘ish, sir qidirishni ishlatishi kerak. Lekin birinchi qadam — “eski asboblarda teshik bormi?” — yiqiladi (`npm audit --audit-level=high`). Keyingi hammasi ishlamaydi. Men backendda shu auditni ishlatdim: **36 ta teshik, 7 high, 1 critical** — CI shu yerda to‘xtashi aniq.

**Bo‘lsa:** xato kod bemalol qo‘shiladi. Kalit ham shu bois ushlanmagan bo‘lishi mumkin.

**Qilish:** audit ogohlantirsin, lekin test/yig‘ishni to‘xtatmasin.

---

#### 4) Kirishchiptasi kutubxonasidagi teshik — **darajani pasaytirdim**

Arena buni CRITICAL dedi. Men: **o‘rtacha, lekin yopish kerak.**

Sabab: rasmiy baho Moderate. Teshik “chipta kim chiqargan” (`iss`) ni aldash. Bu loyiha chiptani faqat **sirli kalit** bilan tekshiradi, `iss` yo‘q. Ya’ni klassik hujum yo‘li bu yerda deyarli ochilmaydi.

Baribir kutubxonani yangilash yaxshi (odatda asosiy dvigatel bilan). Lekin **bugungi P0 emas** — kalit va CI muhimroq.

---

### Xavfli

#### 5) Excel o‘quvchisi tashlab ketilgan

Mijoz, xodim, bank ko‘chirmasi Excel orqali kiradi. Ishlatiladigan dastur yangilanmaydi, tuzatish yo‘q. Operator zararli fayl yuklasa, server sekinlashishi yoki ichki qoidalar buzilishi mumkin. Loyihada allaqachon yaxshiroq o‘quvchi (`exceljs`) bor — o‘sha tomonga o‘tish kerak.

Men tasdiqladim: `xlsx@0.18.5`, `No fix available`.

---

#### 6) 3 ta ichki qoida va amaliyot ajralgan

1. Operator konsignatsiyani ko‘ra oladi — test buni kutmagan. Kodda ataylab yozilgan. Qaror: ruxsat to‘g‘rimi yoki testmi.
2. Ish o‘rni kodi (`slot_code`) o‘zgartirilishi mumkin. Qoida “o‘zgarmas” edi. Kod haqiqatan yozadi. Hisobot bog‘lanishi buzilishi mumkin.
3. Eski dashboard ruxsati yangisiga to‘liq o‘tmaydi. Kod ataylab o‘zgargan, test eskirgan.

CI yoqilsa, bu 3 tasi yana qizil chiroq yoqadi.

---

#### 7) Kirish chiptasi 6 oy stol ustida

Brauzerda ochiq joyda (localStorage) saqlanadi. Yangilash chiptasi 180 kun. Serverda yopiq cookie ham bor — lekin nusxa stolda. Bitta veb-teshik = yarim yil kirish.

**Qilish:** uzun chiptani stoldan olib tashlash (faqat yopiq cookie). 180 → 30 kun.

Men tasdiqladim.

---

#### 8) Kamera “hammasi OK” deyishi yolg‘on

659 eshikdan skript eski 20 ta faylni o‘qiydi. Mijoz/zakaz/to‘lov bo‘lingach, asosiy faylda 0 marshrut — lekin “OK”. Kelajakda teshik ochilsa, hech kim sezmaydi.

Men tasdiqladim.

---

#### 9) “Do‘kon ochiqmi?” chirog‘i

Har 15 daqiqada hayot belgisi. Manzil berilmasa, `https://api.example.com/health` ga uriladi — bu soxta manzil. Shuning uchun ketma-ket qizil **monitor sozlanmagan** bo‘lishi mumkin, tizim o‘lgani emas.

**Qilish:** haqiqiy manzilni qo‘ying. Keyin sayt ochiqmi — aniqlaysiz.

---

### O‘rtacha va kichik

| Oddiy tilda | Nima bo‘ladi | Qachon |
|---|---|---|
| Ikki kassir bir vaqtda oxirgi qoldiqni “sotishi” mumkin | Konsignatsiya limiti oshishi mumkin | Yuklama oshganda |
| Katta import 5 soniyada uzilishi mumkin | Operator “nima bo‘ldi?” | Import/hisobot |
| Ekran yig‘ilganda xatolarga ko‘z yumiladi | Yoriqlar yig‘iladi. Arena “CI da tekshiriladi” deydi — CI esa o‘chiq | CI yoqilgach |
| Ochiq “sayt tezligi” qutisi cheklovsiz | Nazorat paneli xotirasi to‘lishi mumkin | Tez |
| Har eshikda “qaysi kompaniya?” deb bazaga yugurish | Sekinlik | Foydalanuvchi ko‘paysa |
| Ishlar bittalab qilinadigan joylar bor | Ro‘yxat sekin | Vaqt topilganda |
| Parol “qovurilishi” 10 — 2026 uchun 12 yaxshiroq | Sekinroq taxmin | Reja |
| Kirish chiptasi 24 soat | O‘g‘irlansa uzoq yashaydi | Reja |
| Shaxsiy ma’lumotni qancha saqlash — qoralama | Qonun savoli | Reja |

**Arena xatosi:** “2 ta model indekssiz” — `Tenant` da `slug` allaqachon unikal (indeks bor). Telefon testlari “4 ta” emas, kamida 23 fayl.

---

## 6. Ballar (Arena, men ham rozi)

| Yo‘nalish | Ball | Oddiy ma’nosi |
|---|---|---|
| Hujjat | 9.0 | Qo‘llanma kuchli |
| Uy tuzilishi / baza / server | 8.5 | Bino va daftar yaxshi |
| API | 8.0 | Eshiklar tartibli |
| Kod, tezlik, o‘sish | 7.5 | Yaxshi, teshiklar bor |
| Test | 7.0 | Mashq yozilgan, avtomatik ishlamayapti |
| Ekran | 6.5 | Ishlaydi, yig‘ishda ko‘z yumiladi |
| Xavfsizlik | 4.0 | Ichki qoida yaxshi, tashqi qulf zaif. Men 4.5 deyishim mumkin (jwt uncha critic emas), lekin kalit tufayli 4 yaqin. |
| Ishlatish (CI, monitor) | 3.5 | Signal o‘chiq |

**Umumiy: 7 / 10** — qulf va nazorat tuzalsa, 8.5 ga chiqishi mumkin.

---

## 7. Nima qilish kerak

### 1–3 kun (to‘xtatib qiling)

1. Telefon kalitini ombordan oling, yangisini yopiq seyfga qo‘ying.
2. GitHub ombori **Private** ekanini ko‘z bilan tekshiring.
3. CI da `npm audit` ni to‘xtatmasin — test va yig‘ish ishlasin.
4. Qorovul: “tushunmasam — to‘xtayman”.
5. Uptime manzilini haqiqiy saytga qo‘ying.

### 1–2 hafta

6. 3 ta yiqilgan mashqni hal qiling (kod yoki test — qaror).
7. Excel o‘qishni `exceljs` ga ko‘chiring.
8. Chiptani stoldan oling; 180 kunni 30 qiling.
9. Kamera skriptini barcha eshiklarga qaratib, 0 = xato qiling.
10. Sayt tezligi qutisiga cheklov.
11. Kirish kutubxonasini (qulay paytda) yangilang.

### 1–3 oy

Pul yozuvlarini qulflash. Kompaniya nomini qisqa xotirada saqlash. Ekran yig‘ishdagi “ko‘z yumish”ni olib tashlash. Katta fayllarni bo‘lish. Parolni qattiqlashtirish. Saqlash siyosatini yozish.

---

## 8. Oxirgi gap

**Ishoning:** kalit ochiq; qorovul yangilashda yumshoq; CI auditga yiqiladi; Excel tashlab ketilgan; chipta stolda; kamera yolg‘on OK.

**Shubha qiling:** “jwt tufayli hozir hamma kirishi mumkin”; “2 model indekssiz”; “telefon testlari 4 ta”; “1733 type xato asosiy fojia”; “uptime = prod o‘lgan”.

**Asosiy tavsiya o‘zgarmaydi:** yangi savdo usulini yozishdan oldin 3 kun kalit va nazorat.

---

*Arena.ai hisoboti asos, 2026-08-15. Qayta tekshiruv: loyiha kodi + `npm audit` (backend, ishga tushirish qismi). GitHub Actions tarixini bu muhitda ochib bo‘lmadi.*
