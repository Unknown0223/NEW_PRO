# SALEC — kamchiliklarni tuzatish reja

**Kim uchun:** dasturlashni bilmaydigan odam  
**Holat (2026-08-15):** kod tomoni yopildi. Yakun: `docs/SALEC-TUZATISH-YAKUN.md`.  
**Qoida:** avval tuzatish, keyin yangi funksiya. Kod yashil — boshqa bo‘limlarni boshlash mumkin. Sizdan 3 ta ofis ishi qolgan (Private, yangi kalit, URL).

---

## Qanday o‘qish

Bu reja uy ta’miri kabi.

1. **Eshik qulfi** — kalit ko‘chada qolmasin  
2. **Signal** — xato bo‘lsa o‘zi aytib bersin  
3. **Qorovul** — tushunmasa o‘tkazmasin  
4. **Kichik teshiklar** — Excel, chipta, kamera  
5. **Keyinroq** — tezlik, katta yangilash, chiroy

Har qadamda: **nima**, **nega**, **tayyor bo‘lganda nima o‘zgaradi**, **sizdan nima kerak**.

---

## 0-qadam — 10 daqiqa (siz qilasiz)

GitHubda `Unknown0223/NEW_PRO` ni oching.

1. Tepa chapda **Private** yozuvi bormi?  
   - Agar **Public** bo‘lsa — darhol Private qiling. Kalit ochiq omborda bo‘lsa, xavf katta.  
2. Sayt / API hozir ochiladimi (oddiy brauzerda kirib ko‘ring).  
3. Shu ikki javobni ayting — 5-qadam shunga bog‘liq.

---

## 1-bosqich — 1–3 kun (to‘xtatib qilinadi)

Yangi ish yozilmaydi. Faqat qulf va signal.

### 1. Telefon ilovasining kaliti (eng muhim)

**Nima:** mijoz telefonidagi ilova “haqiqiy yangilanish” ekanini shu kalit bilan taniydi. Hozir kalit kod omborida yotibdi.

**Uy:** ko‘chadagi uy kalitini yig‘ib, yangisini seyfga qo‘yish.

**Nima qilinadi (tartib muhim):**

1. Kod omborida kalit va parol **endi kuzatilmasin** (`.gitignore`).  
2. Yangi kalit **yopiq joyda** saqlansin (GitHub Secrets / kompyuteringiz seyfı) — kodga qayta yozilmasin.  
3. Keyin: **yangi kalit bilan** yangi ilova yig‘iladi.  
4. Barcha agentlarga **majburiy yangilanish** (eski kalit bilan yozilgan soxta yangilanish ishlamasin).  
5. Eski tarixdan kalitni tozalash — alohida, ehtiyotkor ish. Avval kuzatishni to‘xtatish yetarli boshlanish.

**Sizdan:** telefon ilovasini yangilashni agentlarga aytishga tayyor bo‘ling. Bir-ikki kun OTA (avtomatik yangilanish) boshqacha ishlashi mumkin.

**Tayyor:** GitHubda `.jks` va `key.properties` ochiq ko‘rinmaydi.

**Hali qilmaymiz:** git tarixini “o‘chirib tashlash” (bu barcha nusxalarni buzishi mumkin). Avval yangi kalit, keyin alohida qaror.

---

### 2. Avtomatik nazoratni yoqish (CI)

**Nima:** har o‘zgarishda mashq, yig‘ish, xato qidirish ishlashi kerak. Hozir birinchi savol “eski asbobda teshik bormi?” yiqiladi — qolgani umuman ishlamaydi.

**Uy:** kassadagi signal “batareya past” deb do‘konni yopib qo‘ygan. Signal qolsin, do‘kon ochiq qolsin.

**Nima qilinadi:**

- Teshiklar ro‘yxati **yozilsin**, lekin shu sabab test to‘xtamasin.  
- Test, yig‘ish, sir qidirish **har safar** ishlasin.

**Sizdan:** hech narsa. Bu dasturchi ishi.

**Tayyor:** GitHub Actions yashil (yoki kamida testlar yuguradi). Qizil bo‘lsa — haqiqiy xato, “audit to‘sqinligi” emas.

**E’tibor:** CI yoqilgach, 3 ta eski mashq yana qizil ko‘rsatishi mumkin. Bu 4-qadamda yopiladi.

---

### 3. Qorovul: tushunmasa — to‘xtatsin

**Nima:** ruxsat tekshiruvi. Hozir qoida topilmasa, odamni o‘tkazib yuboradi. Asosiy dvigatel yangilanganda zakaz o‘chirish / to‘lov ochilib qolishi mumkin.

**Uy:** qorovul noma’lum mehmonni “demak mumkin” deb kiritmaydi — “kutib turing” deydi.

**Nima qilinadi:** eshik nomi aniqlanmasa **403 / yo‘q**. Eski va yangi nomni ikkalasini o‘qiydi.

**Sizdan:** hech narsa. Foydalanuvchi ko‘rinishi o‘zgarmaydi (hozirgi dvigatelda).

**Hali qilmaymiz:** butun dvigatelni (Fastify 5) yangilash. Bu alohida katta ish.

---

### 4. “Do‘kon ochiqmi?” chirog‘i

**Nima:** har 15 daqiqada tizim tirikmi deb so‘raladi. Manzil bermasangiz, soxta saytga (`api.example.com`) uriladi — doim qizil.

**Nima qilinadi:** GitHubda haqiqiy manzil (`PRODUCTION_HEALTH_URL`) qo‘yiladi. Yoki vaqtincha bu nazorat o‘chiriladi, toki manzil tayyor bo‘lguncha.

**Sizdan:** haqiqiy API manzili (masalan `https://..../health`). 0-qadamdagi “sayt ochiladimi” javobi.

**Tayyor:** yashil = tizim tirik. Qizil = haqiqatan uzilish.

---

## 2-bosqich — 1–2 hafta (teshiklar)

Kod tomoni **yopildi** (2026-08-15). Importni bir marta oddiy Excel bilan sinash — sizda qolgan.

### 5. Uchta mashqni moslash — tayyor

| Mashq | Oddiy savol | Qaror (siz bilan) |
|---|---|---|
| Operator konsignatsiyani ko‘radimi? | Operatorga shu ruxsat kerakmi? | Ha → test yangilanadi. Yo‘q → ruxsat olinadi. |
| Ish o‘rni kodi o‘zgarsinmi? | Kod biznesda o‘zgarmas ID | **O‘zgartirish yopiladi** (tavsiya). |
| Eski dashboard ruxsati | Eski xodimlar paneli kormasinmu? | Test yangi qoidaga moslanadi. |

**Sizdan:** hech narsa. Qaror: operator konsignatsiyani ko‘radi; ish o‘rni kodi o‘zgarmaydi.

---

### 6. Kamerani haqiqiy eshiklarga qaratish — tayyor

Skript 20 ta eski faylni o‘qib “OK” derdi. **Hozir:** 132 fayl, 572 eshik. Nol eshik = xato.

**Foydalanuvchi ko‘rmaydi.** Kelajakda teshik yashirin ochilmasin.

---

### 7. Ochiq “tezlik qutisi”ga cheklov — tayyor

Sayt tezligi haqidagi signal hozir kimdir cheksiz to‘ldirishi mumkin. Daqiqasiga cheklov + yo‘l nomlari qisqa ro‘yxat.

**Foydalanuvchi deyarli sezmaydi.**

---

### 8. Kirish chiptasini stoldan olish — tayyor

Brauzerda access + refresh 180 kun yotadi. XSS bo‘lsa — yarim yil.

**Nima:** refresh faqat yopiq cookie. Access — xotirada. 180 kun → 30 kun.

**Sizdan:** xodimlar **qayta kirishi** mumkin (bir marta). “Meni eslab qol” 6 oy emas, taxminan 1 oy.

---

### 9. Excel o‘qishni ishonchli vositaga — qisman tayyor

Eski `xlsx` tuzatilmaydi. **Hozir:** rasmiy tuzatiladigan versiya (SheetJS 0.20.3) qo‘yildi. To‘liq boshqa dasturga o‘tish — keyinroq.

**Sizdan:** import ishlashini bir marta sinash (oddiy Excel bilan).

---

## 3-bosqich — tinchroq (1 oy+)

Bular **qolganiga o‘tilgach**, yangi funksiya bilan parallel ham bo‘lishi mumkin.

- Pul yozuvlarini qulflash (ikki kassir oxirgi qoldiq) — hali  
- Kompaniya nomini qisqa xotirada saqlash — **tayyor** (60 soniya)  
- Ekran yig‘ishda xatolarga ko‘z yummaslik — hali  
- Kirish kutubxonasi + asosiy dvigatelni **birga** yangilash (alohida loyiha) — **qilinmadi** (Fastify 5)  
- Katta fayllarni bo‘lish — hali  
- Parolni qattiqlashtirish — **tayyor** (yangi xodim / parol almashtirishda 12)  

**Hali qilinmaydi (1–2-bosqichda):** Fastify 5, to‘liq TypeScript tozalash, telefon testlarini ko‘paytirish, yangi savdo moduli.

---

## Haftalik ko‘rinish

| Kun | Ish | Kim |
|---|---|---|
| 0-kun | GitHub Private? Sayt ochiqmi? | Siz |
| 1-kun | Kalit ombordan chiqsin + CI ochilsin | Dasturchi |
| 1–2-kun | Qorovul qattiq + uptime manzili | Dasturchi + siz (URL) |
| 3-kun | Tekshiruv: CI yashilmi, kalit git’da yo‘qmi | Ikkalasi |
| 4–10-kun | 3 mashq, kamera, tezlik qutisi, chipta, Excel | Dasturchi |
| 11-kun | Siz import + kirishni sinaysiz | Siz |
| Keyin | Yangi funksiya ruxsat | — |

---

## Nima “tayyor” deb hisoblanadi

1-bosqich yashil:

- [x] Kalit fayllari git’da ko‘rinmaydi (kod + `.gitignore`; **commit/push** va GitHub Private — sizda)  
- [ ] GitHub Private — **siz tekshirasiz**  
- [x] PR/push da testlar yuguradi (`npm audit` to‘xtatmaydi)  
- [x] Qorovul “noma’lum = yo‘q”  
- [x] Uptime soxta manzilga urilmaydi (haqiqiy URL bermaguncha o‘tkazib yuboradi)

Kod yashil — yangi ishga o‘tish mumkin. Qolgan 3 ta ofis ishini parallel qiling.

---

## Sizdan hozir 3 ta ish

1. GitHub **Private** ekanini ko‘z bilan tekshiring.  
2. **Yangi telefon imzo kaliti**ni seyfga qo‘ying (GitHub Secrets). Kodga yozmang.  
3. `PRODUCTION_HEALTH_URL` ni haqiqiy `/health` manziliga qo‘ying.

Batafsil: `docs/SALEC-TUZATISH-YAKUN.md`.
