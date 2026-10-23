# Tizim migratsiyasi — bajarilgan ishlar rejasi va hisobot

**Sana:** 2026-09-04  
**Format versiyasi:** v5 → **v6**  
**Holat:** Lokal kod tayyor va round-trip test **PASS**. Production (Railway) hali **deploy qilinmagan** — shu sababli deployda «To‘liq zaxira yuklab olish» hali 500 berishi mumkin.

---

## 1. Muammo (nima uchun boshlandi)

### 1.1. Belgi

Production veb-panelda:

**Sozlamalar → Sistema → Tizim migratsiyasi** → **«To‘liq zaxira yuklab olish (.zip)»**

natija:

- brauzer: `GET /api/test1/system-migration/export.backup.zip` → **HTTP 500**
- UI: «Ошибка сервера. Можно повторить запрос.»

Inventory (ma’lumotlar jadvali) ochilardi — demak autentifikatsiya va `count` so‘rovlari ishlayotgan edi. Faqat **to‘liq ZIP eksport** yiqilardi.

### 1.2. Nima uchun inventory ishlab, eksport yiqilardi?

| Amal | Nima qiladi | Og‘irligi |
|------|-------------|-----------|
| Inventory | Har jadval uchun `COUNT(*)` | Yengil |
| To‘liq eksport (eski) | Barcha qatorlarni yuklash + **og‘ir Excel** (10k+ mijoz, qarz hisobi) + JSON ZIP **parallel** | Juda og‘ir |

Natija deployda: timeout / xotira / DB pool bosimi → **500**.

---

## 2. Maqsad (nima qilinishi kerak edi)

1. **Eksport barqaror bo‘lsin** — katta tenantda ham ZIP yuklab olinsin.
2. **Barcha yangi tizim o‘zgarishlari** zaxiraga kiritilsin (multi-ombor/kassa slotlar, bonus strategiya, bank inbox va h.k.).
3. **Import** shu yangi maydon/jadvallarni to‘g‘ri **qabul qilsin** (FK remap, bosqich tartibi).
4. **Tekshiruv:** to‘liq eksport → boshqa tenantga import → sonlar mos kelishi.

---

## 3. Qisqa xulosa (nima qilindi)

| # | Ish | Natija |
|---|-----|--------|
| A | Eksportni yengillashtirish (lite Excel, compact JSON, chunk `IN`) | Lokal ZIP ~1.5 s |
| B | Import tartibini tuzatish (slot/katalog → bonus → buyurtma → bog‘lanishlar) | FK xatolari kamaydi |
| C | Yangi maydonlar/jadvallar (v6) | Eksport + import |
| D | Lokal round-trip test `test1` → `migtest` | **PASS** (barcha asosiy sonlar 1:1) |
| E | Production deploy | **Qilinmagan** |

---

## 4. A — Eksport barqarorligi (500 tuzatish)

### 4.1. Sabab

`buildTenantBackupZip` ichida parallel:

- to‘liq `clients` / `orders` / … JSON
- `buildInitialSetupExportBuffer` — **barcha mijozlarni** og‘ir list API orqali (qarz, assignment, tag, …) Excelga yozish

10–15 ming mijozda bu deploy resursini «yeb» qo‘yardi.

### 4.2. Yechim

**Fayl:** `backend/src/modules/tenant-settings/initial-setup-export.orchestrator.ts`

- Yangi parametr: `liteForMigration: true`
- Migratsiya ZIP uchun:
  - mijozlar / work-slots Excel **o‘tkazib yuboriladi** (ular allaqachon `data/clients.json`, `data/work_slots.json` da)
  - stock-receipts Excel ham o‘tkazib yuboriladi
- Oddiy «Boshlang‘ich sozlamalar» Excel yuklab olish (settings) — **o‘zgarmagan** (to‘liq qoladi)

**Fayl:** `backend/src/modules/system-migration/system-migration.export.ts`

- XLSX `liteForMigration` bilan chaqiriladi
- XLSX xato bersa — stub Excel + ogohlantirish (ZIP baribir yig‘iladi)
- Katta `IN (...)` so‘rovlar **4000** lik chunklarga bo‘linadi
- Avval yengil meta (inventory/profile/xlsx), keyin og‘ir jadvallar — pool cho‘qqisi pastroq

**Fayl:** `backend/src/modules/system-migration/system-migration.serialize.ts`

- JSON **compact** (pretty-print yo‘q) — kamroq RAM/CPU
- Decimal / Buffer uchun chidamli serialize

**Fayl:** `frontend/lib/system-migration/api.ts`

- Download timeout: **10 daqiqa** (katta ZIP uchun)

**Fayl:** `backend/src/modules/system-migration/system-migration.route.ts`

- Eksport xatosi loglanadi; foydalanuvchiga aniqroq 500 xabar

### 4.3. Schema drift (jadval/ustun yo‘q)

Agar prod DBda hali migrate bo‘lmagan jadval bo‘lsa (`price_matrix` kabi):

- `safeFindMany` → `P2021` / `P2022` → bo‘sh massiv, eksport **yiqilmaydi**
- Lokal testda `price_matrix` yo‘qligi shunday skip qilindi

---

## 5. B — Import tartibi (nima uchun muhim)

### 5.1. Eski tartib (muammo)

```
references → bonus → transactional(orders) → extended(work_slots, …)
```

Natija:

- buyurtmadagi `work_slot_id` import paytida map **bo‘sh** → null yoki P2003
- KPI target `work_slot_id` yo‘qoladi
- goods receipt `supplier_id` majburan `null` (supplier hali yo‘q edi)

### 5.2. Yangi tartib (v6)

```
1. Profil + settings
2. Spravochniklar (ombor, user, kassa, mijoz, mahsulot, stock)
3. Early catalog (extended phase 1–2): supplier, territory, work_slots, roles, narxlar…
4. Bonus / KPI / strategiyalar
5. Operatsion (orders, payments, …)  ← endi work_slot / bonus_rule map tayyor
6. Extended phase 3–4: RBAC linklar, balans, bank inbox…
7. Fotootchyotlar (oxirgi 30 kun)
```

**Fayl:** `backend/src/modules/system-migration/system-migration.import.ts`

---

## 6. C — Yangi yangilanishlar (to‘liq qamrov, format v6)

### 6.1. WorkSlot (ish o‘rinlari) — eng muhim

Yaqinda qo‘shilgan maydonlar:

| Maydon | Ma’nosi | Eksport | Import |
|--------|---------|---------|--------|
| `branch_codes` | Bir nechta filial | Ha | String[] — remap shart emas |
| `territories` | Bir nechta hudud | Ha | String[] |
| `warehouse_ids` | Multi-ombor | Ha | `intArrayFk` + second-pass |
| `cash_desk_ids` | Multi-kassa | Ha | `intArrayFk` + second-pass |
| `supervisee_agent_slot_ids` | SVR → agent slotlar | Ha | second-pass (slot→slot) |
| `return_warehouse_id` | Qaytarish ombori | Ha | FK remap |
| `supervisor_user_id` | Supervizor | Ha | FK remap |

**Fayllar:**

- `system-migration.extended-specs.phases-0-2.ts` — FK / intArrayFk
- `system-migration.extended.import.ts` — `secondPassWorkSlotArrayFks`

### 6.2. Buyurtma (Order)

| Maydon | Import |
|--------|--------|
| `creation_channel` | Saqlanadi (string) |
| `payment_method_ref` | Saqlanadi (string) |
| `work_slot_id` | Remap (early catalog dan keyin) |
| `applied_auto_bonus_rule_ids` | Remap (bonus dan keyin) |
| `consignment_moved_at` / `_by_user_id` | Hydrate + remap |
| `warehouse_block_id` | Avval `null`, extended dan keyin second-pass |

**Fayl:** `system-migration.import.transactional.ts` + `secondPassOrderWarehouseBlocks`

### 6.3. Mijoz / User

| Narsa | O‘zgarish |
|-------|-----------|
| Client `warehouse_id`, `cash_desk_id` | Kassalar avval import, keyin mijozda remap |
| User `supervisor_user_id`, `trade_direction_id` | **Har doim** second-pass (`keep` ham, `replace` ham) |

**Fayl:** `system-migration.import.references.ts`

### 6.4. Bonus / KPI

| Narsa | O‘zgarish |
|-------|-----------|
| `BonusStrategy` + `BonusStrategyMember` | Yangi eksport + import |
| `BonusRule.product_category_ids` | Endi remap (avval `[]` edi) |
| `KpiGroupAgent.work_slot_id` | Endi yoziladi |
| `SalesKpiPlanTarget.work_slot_id` | Early catalog tufayli to‘g‘ri remap |

**Fayllar:** `system-migration.export.ts`, `system-migration.import.bonus-plans.ts`

### 6.5. Bank o‘tkazmalar inbox

Yangi extended jadvallar:

- `bank_transfer_inbox`
- `bank_transfer_inbox_events`
- `match_candidates` JSON ichidagi `client_id` / `warehouse_id` remap

**Fayl:** `system-migration.extended-specs.phases-3-4.ts`

### 6.6. Boshqa

| Narsa | Holat |
|-------|--------|
| `AgentRouteDay.work_slot_id` | FK remap |
| `GoodsReceipt.supplier_id` | Remap (supplier early catalog da) |
| Face verification / ErrorEvent / DeviceToken | **Ataylab kiritilmagan** (ops/sessiya; biznes zaxira emas) |

### 6.7. Format versiyasi

- `BACKUP_FORMAT_VERSION = 6`
- Preview: v1–v6 arxivlar qabul qilinadi
- Inventory UI: bonus strategiya + bank inbox sonlari ko‘rinadi

---

## 7. D — Test natijalari

### 7.1. Lokal round-trip (bajarildi)

**Skript:** `backend/scripts/migration-roundtrip-test.ts`

```text
SOURCE = test1
TARGET = migtest (yaratildi / tozalandi)
```

| Bosqich | Natija |
|---------|--------|
| Source counts | 12227 clients, 132 slots, 28 bank inbox, … |
| Export ZIP | ~1.54 MB, ~1.5 s |
| Import | ~96 s, 51 fayl qo‘llandi |
| Compare | **PASS** — barcha tekshirilgan sonlar 1:1 |

Tekshirilgan maydonlar: clients, products, users, warehouses, cashDesks, stock, orders, payments, workSlots, bonusRules, bonusStrategies, bankInbox, clientAssignments, roles.

ZIP joyi: `backend/tmp/salec-backup-test1-roundtrip.zip`

### 7.2. Production (deploy) tekshiruvi

| Amal | Natija |
|------|--------|
| `GET /health` | OK |
| Admin login | OK |
| `GET …/export.backup.zip` | **HTTP 500** — serverda eski kod |

**Xulosa:** lokal tuzatish ishlaydi; productionga chiqmaguncha UI dan «To‘liq zaxira» deployda ishlamaydi.

---

## 8. E — Deploy holati

| Element | Holat |
|---------|--------|
| Lokal kod o‘zgarishlari | Bor (git working tree) |
| Railway / production deploy | **Qilinmagan** |
| Frontend timeout o‘zgarishi | Deploy bilan birga chiqishi kerak |

### Deploy qilish (keyingi qadam)

Faqat veb+API (mobil APKsiz):

```powershell
cd "D:\SALEC — копия"
.\deploy-prod.cmd -SkipMobile
```

Yoki loyihadagi odatdagi `deploy-all` / Railway backend+frontend up.

Deploydan keyin:

1. https://sales-arena.up.railway.app/settings/system-migration  
2. «To‘liq zaxira yuklab olish»  
3. Bo‘sh/yangi tenantga import (yoki lokal `migtest` ga `apply-backup-zip-once.ts`)

---

## 9. O‘zgargan asosiy fayllar (navigatsiya)

```
backend/src/modules/system-migration/
  system-migration.constants.ts          ← v6, modul izohlari
  system-migration.export.ts             ← lite xlsx, chunk, strategiya eksport
  system-migration.serialize.ts          ← compact JSON
  system-migration.route.ts              ← eksport xato log
  system-migration.import.ts             ← early catalog tartib
  system-migration.import.references.ts  ← kassa→mijoz, user supervisor
  system-migration.import.transactional.ts ← order/receipt FK
  system-migration.import.bonus-plans.ts ← strategiya, category, kpi slot
  system-migration.import.purge.ts       ← strategiya purge
  system-migration.import.preview.ts     ← v5 qabul
  system-migration.inventory.ts          ← yangi countlar
  system-migration.id-maps.ts            ← bonusStrategy, bankTransfer*
  system-migration.extended-specs.phases-0-2.ts  ← WorkSlot FK
  system-migration.extended-specs.phases-3-4.ts  ← bank inbox, route slot
  system-migration.extended.import.ts    ← second-pass slot/order/block

backend/src/modules/tenant-settings/
  initial-setup-export.orchestrator.ts   ← liteForMigration
  initial-setup-export.clients.ts        ← workSlot P202x skip

frontend/lib/system-migration/api.ts     ← 10 min timeout

backend/scripts/migration-roundtrip-test.ts  ← test skript
backend/scripts/apply-backup-zip-once.ts     ← ZIP → tenant (mavjud)
```

---

## 10. Foydalanish bo‘yicha qisqa yo‘riqnoma

### 10.1. Lokalda qayta test

```powershell
cd "D:\SALEC — копия\backend"
npx tsx scripts/migration-roundtrip-test.ts
# SOURCE_SLUG=test1 TARGET_SLUG=migtest
```

### 10.2. Tayyor ZIP ni tenantga qo‘llash

```powershell
cd "D:\SALEC — копия\backend"
$env:IMPORT_TENANT_SLUG="migtest"
npx tsx scripts/apply-backup-zip-once.ts ".\tmp\salec-backup-test1-roundtrip.zip"
```

### 10.3. UI orqali

1. Admin bilan kiring  
2. **Nastroyki → Sistema → Tizim migratsiyasi**  
3. Eksport: «To‘liq zaxira yuklab olish»  
4. Import: ZIP tanlash → preview → to‘liq import (`replace` = toza restore)

---

## 11. Hali qilinmagan / ixtiyoriy

| Band | Izoh |
|------|------|
| Production deploy | Majburiy, aks holda deploy 500 qoladi |
| Face verification jadvallari | Biznes restore uchun odatda kerak emas |
| ErrorEvent / JobLog / DeviceToken | Ops/sessiya — odatda skip |
| Deploydan → lokal to‘liq nusxa | Deploy yangilangach: ZIP yuklab → lokal import |
| Git commit | Hali so‘ralmagan — working tree da o‘zgarishlar bor |

---

## 12. Atamalar lug‘ati

| Atama | Oddiy tushuncha |
|-------|-----------------|
| **Eksport / zaxira** | Tenant ma’lumotlarini bitta ZIP ga yig‘ish |
| **Import** | ZIP ni boshqa (yoki bo‘sh) tenantga qo‘llash |
| **FK remap** | Eski ID → yangi tenant ID ga almashtirish |
| **Second-pass** | Birinchi yozib bo‘lgach, bog‘lanishlarni qayta yangilash |
| **Early catalog** | Buyurtma/bonusdan oldin slot/katalogni yuklash |
| **liteForMigration** | Migratsiya ZIP da og‘ir Excelni o‘tkazib yuborish |
| **conflict_policy=replace** | Dublikatda arxiv qiymati yoziladi (to‘liq restore) |
| **conflict_policy=keep** | Dublikatda mavjud yozuv saqlanadi (merge) |

---

## 13. Bir qatorlik xulosa

> Migratsiya eksporti katta ma’lumotda barqaror qilindi; yangi slot/bonus/bank maydonlari v6 da eksport+importga qo‘shildi; lokalda to‘liq round-trip **PASS**; productionga **hali deploy qilinmagan** — shu qadamdan keyin deploydan ham to‘liq zaxira ishlashi kerak.
