# Bank Transfer Inbox — kassir uchun qisqa SOP

**Sahifa:** `/bank-transfers` (Перечисления / банк)  
**Maqsad:** o‘tkazmalarni mijozga bog‘lash va to‘lovni tasdiqlash.  
**Indeks:** [bank-transfer-inbox-README.md](./bank-transfer-inbox-README.md)

---

## 0. Ikki rejim (oddiy)

| Rejim (UI) | Qachon | Nima qilasiz |
|------------|--------|--------------|
| **Вручную** | Bank bayonnomasi yo‘q, lekin перечисление bor | Summa + mijoz + sana + izoh → **Создать вручную** → keyin to‘lovni **подтвердить** |
| **Банк / 1С** | Excel/CSV yoki 1C/bankdan kelgan | Import → mijozni biriktirish → pending → **подтвердить** |

Ikkala rejimda ham balans faqat **tasdiqlashdan** keyin o‘zgaradi.

---

## 1. Kunlik ish tartibi

1. SALEC ga kiring (kassir / operator huquqi).
2. Menyudan **Перечисления (банк)** ni oching.
3. Yuqorida kanalni tanlang: **Вручную** yoki **Банк / 1С**.
4. Status tablarni ko‘ring:
   - **Новые (матч)** — tizim o‘zi topgan (aniq match) — asosan Банк/1С
   - **Спорные** — bir nechta mijoz (ambiguous)
   - **Без клиента** — mijoz topilmadi
   - **Ожидают подтверждения** — to‘lov yaratilgan, tasdiq kutadi
   - **Готово** — yakunlangan

---

## 2a. Вручную (qo‘lda)

1. Kanal: **Вручную**.
2. Formani to‘ldiring: **Сумма**, **Клиент**, **Дата**, **Комментарий**.
3. **Создать вручную** — inbox + pending to‘lov (`source=manual`, `channel=manual`).
4. **К подтверждению** orqali to‘lovni tasdiqlang.

**Mobile:** kanal filtri + «Вручную» badge bor; yangi qo‘lda yozuv — web dan.

---

## 2b. Import (Excel / CSV) — Банк / 1С, faqat web

1. Kanal: **Банк / 1С**.
2. Chapda **Импорт CSV / Excel (.xlsx)** ni oching.
3. Bankdan olgan `.xlsx` / `.xls` yoki `.csv` faylni tanlang **yoki** Excel dan nusxa qilib pastga joylashtiring.
4. **Загрузить** bosing.
5. Hisobotni o‘qing: yaratildi / dublikat / xato qatorlar.

**Majburiy ustun:** `сумма` / `amount`  
**Foydali ustunlar:** ИНН, счёт, PINFL, код клиента, плательщик, дата, назначение  

**Mobil:** CSV/Excel import **yo‘q** (DoD: faqat web).

---

## 3. Mijozni biriktirish (assign) — asosan Банк / 1С

1. Chapdagi jadvaldan qatorni tanlang.
2. O‘ngda **Клиент** qidiruvi orqali mijozni toping (ism, kod, ИНН, ID).
3. Agar **Кандидаты** ro‘yxati bo‘lsa — to‘g‘ri mijozni bosing (avtomatik tanlanadi).
4. **Комментарий** yozing (kamida 3 belgi) — majburiy.
5. **Назначить + создать оплату** bosing.
6. To‘lov ochilsa — **К подтверждению** (web) yoki mobil **Подтвердить оплату**.

**Matched** (mijoz allaqachon topilgan, to‘lov yo‘q): **Создать оплату** tugmasi.

---

## 4. Noto‘g‘ri mijoz (reassign / redirect)

1. Qatorni oching.
2. Yangi mijozni qidiruvdan tanlang.
3. Sabab bilan **комментарий** yozing (majburiy).
4. **Перенаправить** bosing.
5. Kerak bo‘lsa yangi to‘lovni yana tasdiqlang.

---

## 5. Nima qilmaslik

- Nom bo‘yicha «taxminan o‘xshash» deb biriktirish — **taqiqlangan** (avto-match ham nom bo‘yicha ishlamaydi).
- ИНН / hisob raqami bo‘sh yoki dublikat bo‘lsa — avval katalogni tuzating (IT / admin), keyin qayta import.
- **Игнорировать** faqat aniq keraksiz / xato yozuvlar uchun.
- Bank bayonnomasidagi yozuvni «Вручную» deb ikki marta kiritmang — dublikat xavfi.

---

## 6. Muammo bo‘lsa

| Holat | Harakat |
|--------|---------|
| Спорные (ambiguous) | Qo‘lda to‘g‘ri mijozni tanlang + izoh |
| Без клиента | INN/счёт/kod bo‘yicha qidiring; yo‘q bo‘lsa mijoz kartasini to‘ldiring |
| Import xatosi | Ustun nomlarini tekshiring (`сумма` majburiy) |
| To‘lov yo‘q | matched qatorda **Создать оплату** |
| Qo‘lda kiritish | Kanal **Вручную** + forma |

---

## 7. Go-live oldidan (qisqa)

| Hujjat | Havola |
|--------|--------|
| Checklist | [go-live-checklist.md](./bank-transfer-inbox-go-live-checklist.md) |
| Prod readiness | [prod-readiness.md](./bank-transfer-inbox-prod-readiness.md) |
| Adapter / fake | [adapter-contract.md](./bank-transfer-inbox-adapter-contract.md) |
| UAT shablon | [uat-results.md](./bank-transfer-inbox-uat-results.md) |
