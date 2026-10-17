# Sales Doctor → SALEC: to‘liq tarix migratsiyasi rejasi

**Maqsad:** Sales Doctor (distribyutsiya) platformasida 1 yildan ortiq yig‘ilgan **barcha tarixiy operatsiyalarni** (fotootchotsiz) o‘z davridagi sanalari bilan SALEC/SalesArena bazasiga ko‘chirish.  
**Bog‘lash kaliti:** mijoz (`client`) — Sales Doctor ID ↔ SALEC `client_code` / tashqi kod (`ur_29411` uslubi) / ichki id.  
**Holat:** reja (implementatsiya oldidan).  
**Sana:** 2026-09-23

---

## 0. Muhim farq (chalkashmaslik)

| | Ichki «Tizim migratsiyasi» | **Shu loyiha** |
|--|--|--|
| Manba | SALEC → SALEC ZIP zaxira | **Sales Doctor** (tashqi platforma) |
| UI | Sozlamalar → Sistema → Tizim migratsiyasi | Yangi ETL / import pipeline |
| Format | `salec-tenant-backup` v6 ZIP | SD eksport (API/Excel/SQL dump) → SALEC mapping |
| Foto | Zaxirada bor (oxirgi kunlar) | **Ataylab olinmaydi** |

Mavjud system-migration **Sales Doctor’dan o‘qimaydi** — yangi import moduli kerak.

---

## 1. Scope — nima KIRADI / CHIQAADI

### 1.1. KIRADI (fotootchotsiz to‘liq tarix)

| # | Domеn | SALEC jadvallar (asosiy) | Nima uchun |
|---|--------|---------------------------|------------|
| A | Mijozlar (allaqachon bor yoki map) | `clients` | ID bog‘lash; yangi yaratmaslik (imkon qadar) |
| B | Buyurtmalar / nakladnoy | `orders`, `order_items`, status/change log | Savdo tarixi, tahlil |
| C | To‘lovlar | `payments`, `payment_allocations` | Kassa, qarz, balans |
| D | Qaytarishlar | `sales_returns`, `sales_return_lines` | Qaytarish + refund ledger |
| E | Mijoz balansi / boshlang‘ich qarz | `client_balances`, `client_balance_movements`, `client_opening_balance_entries` | Davriy qarz to‘g‘ri chiqishi |
| F | Ombor harakatlari (agar SD da bor) | `goods_receipts`(+lines), stock corrections / movements | Ombordagi tahlil |
| G | Rad etishlar / vizitlar (foto siz) | `client_refusals`, `agent_visits` | Agent faoliyati (ixtiyoriy, lekin «barcha tarix» bo‘lsa) |
| H | Xarajatlar (agar kerak) | `expenses` | Moliyaviy to‘liqlik |
| I | Spravochnik bog‘lanishlari | products, warehouses, users/slots, price types | FK lar uchun |

### 1.2. CHIQAADI (aniq)

| Chiqariladi | Sabab |
|-------------|--------|
| **Fotootchotlar** (`client_photo_reports`, rasmlar) | Sizning talabingiz |
| GPS pinglar to‘liq arxiv | Katta hajm; vizit summary yetarli bo‘lishi mumkin (keyin qaror) |
| SD UI sozlamalari / rollar 1:1 | SALEC RBAC/slot modeli boshqacha — map qilinadi, ko‘chirilmaydi |
| Duplikat joriy operatsiyalar | Agar SALEC da allaqachon shu davr bor — conflict policy |

### 1.3. «O‘z davriga tegishli»

Har bir yozuvda **asli SD dagi sana** saqlanadi:

- `orders.created_at` / yetkazilgan sana (SD maydonlariga map)
- `payments.paid_at` / `created_at`
- `sales_returns.created_at`
- balans harakatlari `created_at`
- Hisobotlar (`product-sales`, mijoz savdosi, KPI) shu sanalar bo‘yicha ishlaydi — **qayta hisoblash emas, tarixiy qatorlar**

Import paytida `created_at` ni `now()` bilan yozmaslik — **explicit date** yozish majburiy.

---

## 2. Mijoz ID orqali bog‘lash (asosiy kalit)

### 2.1. Moslash tartibi (priority)

1. **Tashqi kod** — SD client id → SALEC `client_code` (`ur_29411` / `xx_<id>` yoki SD dagi kod maydoni).  
2. **INN / PINF L** — agar SD da bor va SALEC da unique.  
3. **Telefon (normalized)** — ehtiyotkor (dublikat xavfi).  
4. **Nom + manzil** — faqat preview / qo‘lda tasdiq; avto-importda yo‘q.

### 2.2. Kerakli mapping jadvali (ETL ichida)

```
sd_client_id  →  salec_client_id
sd_product_id →  salec_product_id
sd_agent_id   →  salec_user_id / work_slot_id
sd_warehouse  →  salec_warehouse_id
sd_order_id   →  salec_order_id   (idempotent qayta import uchun)
```

Saqlash: `migration_id_maps` yoki alohida `external_import_maps` (source=`sales_doctor`).

### 2.3. Mijoz topilmasa

| Policy | Harakat |
|--------|---------|
| **strict** (tavsiya 1-bosqich) | Qator skip + hisobot; buyurtma import qilinmaydi |
| **create-stub** | Minimal klient yaratish (`client_code` = SD id) — keyin to‘ldirish |
| **opening-balance-only** | Faqat qarzni `opening_balance` ga yozish (kamroq tavsiya) |

---

## 3. Sales Doctor’dan nima olish kerak (sizdan / SD dan)

Migratsiya **manbasiz** ishlamaydi. Quyidagilardan **bittasi** kerak:

### Variant A — SD API / eksport (eng yaxshi)

- Mijozlar (id, kod, inn, telefon, agent, hudud)
- Buyurtmalar + qatorlar (sana, status, ombor, agent, summalar)
- To‘lovlar + qaysi buyurtmaga bog‘langani
- Qaytarishlar + qatorlar
- Balans / qarz snapshot yoki harakatlar
- Mahsulotlar / narxlar (agar SALEC da yo‘q bo‘lsa)

### Variant B — Excel/CSV dumplar (amaliy)

Har modul uchun alohida fayl, **UTF-8**, sanalar ISO yoki `DD.MM.YYYY`:

1. `clients.csv`
2. `products.csv`
3. `orders.csv` + `order_lines.csv`
4. `payments.csv` + `payment_links.csv`
5. `returns.csv` + `return_lines.csv`
6. `balances.csv` yoki `debt_as_of.xlsx` (kesim sanasi)
7. `agents_users.csv` (SD user → SALEC login/slot)

### Variant C — SD DB read-only dump

Agar to‘g‘ridan-to‘g‘ri DB bo‘lsa — schema hujjati + sample 100 qator.

**Hozirgi SALEC kodda Sales Doctor connector yo‘q** — shu sababli avval **namuna eksport** (1 oy) bilan mapping qotiriladi, keyin 1+ yil to‘liq yuklanadi.

---

## 4. Import bosqichlari (ketma-ketlik)

```
0. Staging DB / dry-run tenant (prod emas)
1. Spravochniklar: mahsulot, ombor, kassa, agent/slot map
2. Mijoz map (SD id → SALEC id) + unmatched hisobot
3. Buyurtmalar (eski → yangi sana tartibida) + items
4. Qaytarishlar (buyurtmaga bog‘liq bo‘lsa order map dan keyin)
5. To‘lovlar + allocation
6. Balans / opening + movements qayta hisob yoki import
7. Vizit / refusal (foto siz)
8. Reconciliation (sonlar, summalar, qarz)
9. Prod import (xuddi shu skript, backup + freeze oynasi)
```

Foto moduli **umuman chaqirilmaydi**.

### 4.1. Idempotentlik

Qayta ishlatish xavfsiz bo‘lsin:

- Unique: `(tenant_id, source='sales_doctor', external_id)`
- Yoki `orders.number` = SD number prefix (`SD-…`)
- Bir xil fayl ikki marta → update/skip, dublikat yo‘q

### 4.2. Stock / ombor

Tarixiy buyurtmalar **joriy ombor qoldig‘ini buzmasligi** uchun:

| Yondashuv | Tavsif | Tavsiya |
|-----------|--------|---------|
| **A. Ledger-only** | Buyurtma/to‘lov yoziladi, stock movement yaratilmaydi | Tez; joriy stock saqlanadi |
| **B. Historical stock** | Har bir harakat stock ledger ga | Og‘ir; faqat stock 0 dan qayta ochilsa |
| **C. Hybrid** | Faqat «ochiq» davrdan keyin stock | Ko‘pincha amaliy |

**Tavsiya:** 1+ yil tarix uchun **A (ledger-only)** + joriy stock SALEC da alohida inventory.  
Savdo tahlili buyurtma/qaytarish/to‘lovlardan chiqadi.

---

## 5. Savdo tahlili — nima «o‘z-o‘zidan» ishlaydi

SALEC hisobotlari asosan `orders` / `payments` / `returns` / `clients` dan o‘qiydi.

Import to‘g‘ri bo‘lsa, quyidagilar **qo‘shimcha ETL siz** ishlashi kerak:

- Mijoz savdosi / product-sales
- Agent buyurtmalari
- Kassa / to‘lovlar
- Qaytarishlar hisoboti
- Dashboard period filtrlar (sana bo‘yicha)

Qo‘shimcha kerak bo‘lishi mumkin:

- Import qilingan buyurtmalarga `creation_channel = 'import'` yoki `legacy`
- Bonus/KPI ni **tarixiy qayta hisoblamaslik** (yoki alohida flag)
- Opening balance: import boshlangan sanadan oldingi qarz

---

## 6. Tekshiruv (acceptance) — majburiy checklist

Har bir mijoz / oy uchun:

| Tekshiruv | Mezon |
|-----------|--------|
| Mijoz coverage | SD aktiv mijozlarining ≥99% map qilingan |
| Buyurtma soni | SD count ≈ SALEC count (source=SD) |
| Buyurtma summa | Oy kesimida farq ≤ 0.5% yoki 0 (Decimal) |
| To‘lov summa | Xuddi shunday |
| Qaytarish | Soni + summa |
| Mijoz qarz | Tanlangan 20 mijoz: SD qarz = SALEC balans |
| Sana | Min/max `created_at` = SD davri |
| Foto | `client_photo_reports` SD dan **0** yangi |
| Dublikat | Qayta import → +0 qator |

Staging da PASS → prod.

---

## 7. Texnik arxitektura (SALEC ichida)

Yangi modul (taklif):

```
backend/src/modules/sales-doctor-import/
  adapters/          # CSV | API | SQL
  mappers/           # SD → SALEC DTO
  matchers/          # client / product / agent
  writers/           # orders, payments, returns, balances
  reconcile/         # hisobotlar
  cli/               # npm run import:sales-doctor -- --file=...
```

CLI flaglar:

- `--dry-run`
- `--from=2024-01-01 --to=2025-12-31`
- `--skip-photos` (default true)
- `--stock-mode=ledger-only`
- `--unmatched-report=out/unmatched-clients.csv`

UI (ixtiyoriy 2-bosqich): Sozlamalar → «Tashqi tarix import (Sales Doctor)».

---

## 8. Ishlar rejasi (sprintlar)

| Sprint | Natija | Taxminiy |
|--------|--------|----------|
| **S0** | SD dan 1 oy namuna eksport + maydonlar lug‘ati | 2–3 kun (siz + SD admin) |
| **S1** | Client/product/agent matcher + unmatched report | 3–5 kun |
| **S2** | Orders + items (sanalar saqlanadi, dry-run) | 5–7 kun |
| **S3** | Payments + allocations | 3–5 kun |
| **S4** | Returns + balance/opening | 4–6 kun |
| **S5** | Reconciliation + staging to‘liq yil | 3–5 kun |
| **S6** | Prod oynasi: backup → import → verify | 1–2 kun |

Jami: ~3–5 hafta (namuna sifatiga bog‘liq).

---

## 9. Risklar

| Risk | Yechim |
|------|--------|
| SD da mijoz id ≠ SALEC id | `client_code` / mapping jadvali; unmatched qo‘lda |
| Statuslar farqi (`delivered` vs `yetkazilgan`) | Status map jadvali |
| Valyuta / tip farqi | Bitta valyuta qoidasi; Decimal(15,2) |
| Qayta import dublikat | external_id unique |
| Stock buzilishi | ledger-only mode |
| Katta hajm (1+ yil) | Oyma-oy chunk; background job |
| Prod ishlab turadi | Staging avval; prod da maintenance window |

---

## 10. Sizdan hozir kerak bo‘ladigan narsalar

1. **Sales Doctor’dan eksport namunasi** (kamida 1 oy): buyurtma + to‘lov + qaytarish + mijoz.  
2. **Mijoz kaliti:** SD da qaysi maydon SALEC `client_code` ga teng?  
3. **Davr:** aniq `from`–`to` (masalan 2024-01-01 → bugun).  
4. **Stock qarori:** ledger-only (tavsiya) yoki to‘liq ombor tarixi.  
5. **Vizitlar:** kerakmi yoki faqat zakaz/to‘lov/qaytarish/balans?  
6. **Staging tenant** (masalan `mig-sd`) — prodga tegmasdan sinash.

---

## 11. Qisqa xulosa

- **Ha**, 1+ yillik tarixni (fotootchotsiz) SALEC ga qo‘shish mumkin va kerak.  
- Bog‘lash **mijoz ID/kod** orqali; buyurtma/to‘lov/qaytarish/balans — asosiy yuk.  
- Sanalar **asl davrda** qoladi → savdo tahlili o‘sha oy/yilni ko‘rsatadi.  
- Bu **mavjud system-migration emas** — Sales Doctor → SALEC alohida ETL.  
- Keyingi qadam: SD namuna fayllari + maydonlar mapini qotirish, keyin S1 matcher.

---

*Alohida eslatma:* agar manba aslida boshqa SALEC/SalesDoc tenant bo‘lsa (tashqi SD emas), unda mavjud **Tizim migratsiyasi ZIP** + foto modulini o‘chirib import qilish yetarli — lekin siz «Sales Doctor distribyutsiya platformasi» deb aytdingiz, shu reja tashqi ETL uchun.
