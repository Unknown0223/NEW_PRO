# #11 Универсальный отчет по бонусам — Virtual Pivot (A)

**Date:** 2026-11-26  
**Status:** approved (user «ha» 2026-11-26)  
**SalesDoc:** `/report/bonus` (pivot / line grain; not `/report/bonusReport`)  
**SALEC:** `/reports/universal-bonuses`  
**Доступ:** `reports.universalnyy_bonus` (view/export) — o‘zgartirilmaydi

## Intent / why

`#10 По бонусам` FlatReport agregat to‘g‘ri. Universal sahifa esa SalesDoc `/report/bonus` uslubida **Virtual Pivot** (qator grain) bo‘lishi kerak. Hozir ikkala path bir xil `getBonusesReport` agregatiga bog‘langan; FlatReport polish (#11 noto‘g‘ri) VP o‘rnini bosmaydi. Foydalanuvchi **A** tanladi (2026-11-26).

## Goals

- `/reports/universal-bonuses` → **Virtual Pivot** workspace (`layoutForm: "flat"` default).
- Yangi **`GET /api/:slug/reports/universal-bonuses/dataset`**: `oi.is_bonus = true` **line** qatorlari + `fields` metadata; cap ~5000 (tasks kabi); `truncated` + `total`.
- Filtrlar: sana + `date_type` radios, status/agent/kategoriya/mijoz kategoriyasi/territoriya — **`group_by` va filtr search dublikati yo‘q** (pivot Fields + client search emas; jadval ichida pivot filter).
- FE: yupqa workspace (tasks oilasi) — `usePivot` + `PivotTable` + shared chrome (Опции/Формат/Поля/Развер./export); Отчёты/Сохр./Поделиться `datasetId: "universal_bonuses"` (report-builder saved API, sales aralashmasin).
- Eski FlatReport adapter olib tashlanadi; contract: page VP, `FlatReportPage` yo‘q.
- `#10 bonuses` FlatReport **tegilmaydi**.
- Mavjud agregat `GET …/universal-bonuses` + xlsx export: VP wave’da **deprekat** (yoki faqat ichki); asosiy export — pivot Excel/CSV/PDF (tasks kabi). Builder call: agregat endpointni ushlab qolish mumkin (boshqa klient), UI ishlatmaydi.

## Non-goals

- Report-builder ga alohida `universal_bonuses` dataset registry (keyinroq).
- `#10` ni VP qilish.
- SalesDoc probe HTML 1:1 visual pixel parity.
- Commit/deploy so‘ralmaguncha.

## Anti-goals

- FlatReportni CSS bilan «pivot» qilish.
- To‘liq `VirtualPivotReportBuilder` fork / `orders_sales_lines` deep-link.
- Agregat `group_by` UI ni VP ichida saqlash.

## Constraints

- Fayl ≤400 LOC; lint:errors / BE `tsc --noEmit` / `audit:max-loc`.
- Picker labels: faqat nom.
- Agent scope (`buildScopedAgentExistsSql`) dataset where’da saqlanadi.
- Sana: `created_at` / `shipped_date` → `COALESCE(sl.shipped_at, sl.delivered_at)` (bonuses.dates / STATUS_CTE).

## Approaches

| | Variant | Trade-off |
|---|---------|-----------|
| **A (tanlangan)** | Dedicated VP + line dataset | Tasks parity; to‘g‘ri grain |
| B | Konstruktor deep-link | Доступ/menyu chalkash |
| C | FlatReport polish | Rad — foydalanuvchi |

**Pick:** A (user «A» 2026-11-26).

## Default flat fields (builder call — SalesDoc `/report/bonus` ustunlari aniq probe yo‘q; shu starter)

| id | label | type |
|----|-------|------|
| order_id | ID ЗАКАЗА | number |
| order_status | СТАТУС | string |
| product_name | ТОВАР | string |
| sku | АРТИКУЛ | string |
| category_name | КАТЕГОРИЯ | string |
| client_name | КЛИЕНТ | string |
| client_category | КАТ. КЛИЕНТА | string |
| agent_name | АГЕНТ | string |
| qty | КОЛ-ВО | number |
| volume_m3 | ОБЪЁМ | number |
| line_total | СУММА | number |
| created_at | ДАТА СОЗДАНИЯ | date |
| shipped_at | ДАТА ОТГРУЗКИ | date |

Classic/compact: Options orqali; qiymat zonasi default bo‘sh flat’da (tasks kabi); classic’da ≥1 value (COUNT/SUM qty) — tasks chrome qoidasi.

## How (builder)

1. BE: `universal-bonuses-report.dataset.ts` + route `…/dataset`; filter-options qayta ishlatiladi (group_by options UI’da ko‘rsatilmaydi).
2. FE: `components/reports/universal-bonuses/*` workspace/toolbar/fields/filters (tasks dan nusxa + qisqa); `page.tsx` → workspace.
3. Saved chrome: tasks pattern, `UNIVERSAL_BONUSES_PIVOT_DATASET_ID`.
4. Contract/parity docs: #11 = Virtual Pivot; FlatReport polish «done» belgisi bekor.
5. Smoke: filter-options + dataset 200; UI ochiladi.

## Open (builder call)

- Agregat `GET /universal-bonuses` va eski xlsx: **saqlash, UI o‘chiradi** (boshqa integratsiya buzilmasin).
- Default flat field ro‘yxati yuqorida — probe bo‘lmasa shu; foydalanuvchi review’da ustun qo‘shish/olib tashlash mumkin.
- Photo/reyting: yo‘q.
- Dataset `ORDER BY`: `created_at DESC`, `order_id DESC`, `oi.id DESC` (tasks chronologiyasi).
- Saved/share ruxsat: `reports.universalnyy_bonus.view` (tasks pattern; konstruktor shart emas).
- 1-wave qabul: starter 13 ustun yetarli; SalesDoc probe majburiy emas.
- АКБ / «заказов» FlatReport agregatlari 1-wave’da **yo‘q** (user «ok» 2026-11-26) — faqat line grain + pivot value zonasi.
