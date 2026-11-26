# SalesDoc Отчёт parity (FlatReport) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SalesDoc «Отчёт» menyusidagi sariq stubdan port qilingan hisobotlarni birma-bir SalesDoc probe + SALEC fullstack parity (filtr/ustun/export/RBAC/Доступ) va FlatReport dizayn standartiga keltirish; har bir sahifa foydalanuvchi review’dan o‘tgach keyingisiga o‘tish.

**Architecture:** Thin Next.js adapters (`FlatReportPage` + `FlatReportConfig`) → `GET /api/:slug/reports/<apiPath>` (+ `filter-options`, `export`). Shared chrome: `flat-report-filters` (ixcham grid), `flat-report-table`, column prefs, date radios where applicable. Backend: parse/filters/report/export + `REPORT_PAGE_PERMISSIONS` + `PERMISSION_SECTIONS` (Доступ).

**Tech Stack:** Next.js frontend, Fastify/Prisma backend, Vitest contract tests, SalesDoc probe (`scripts/salesdoc/probe-reports.ps1`).

**Spec / probes:** `tmp/salesdoc-probe-*/SPEC.md` (local; gitignore’da `tmp/`).

## Global Constraints

- Fayl ≤400 LOC (`npm run audit:max-loc`); FlatReport split: `flat-report-page` / `filters` / `table`.
- Picker labels: faqat nom (kod `searchText`da).
- Sifat gate: `lint:errors` (FE), `tsc --noEmit` (BE), `audit:max-loc`; FlatReport contract Vitest.
- So‘ralmasa commit/deploy qilinmaydi (bu commit: 2026-11-24 push so‘rovi).
- Parol/probe secrets repoga yozilmaydi.

## Navbat (SalesDoc port tartibi — git stub → live ro‘yxat)

| # | Otchot | slug | SalesDoc | Holat |
|---|--------|------|----------|--------|
| 1 | Продажи по клиентам 3 | `client-sales-3` | `/report/customer/clientList` | [x] Done 2026-11-24 |
| 2 | Отчет по возвратам (возврат с полки) | `shelf-returns` | `/report/defect` | [x] Done 2026-11-24 |
| 3 | Отчет по количеству заказов | `order-qty` | `/report/report/type` | [x] Done 2026-11-24 |
| 4 | По Sku 3.0 | `sku-3` | `/report/volumeReport/version2` (Sku 2.0) | [x] Done 2026-11-24 |
| 5 | Отгрузки по экспедиторам | `expeditor-shipments` | `/report/expeditor` | [x] Done 2026-11-25 |
| 6 | Excel экспорт | `excel-export` | `/report/export/version1` | [x] Done 2026-11-25 |
| 7 | По инвентарю | `inventory` | `/clients/Inventorization` | [x] Done 2026-11-25 |
| 8 | Фотоотчёты | `photo` | `/report/photoReport` | [x] Done 2026-11-25 |
| 9 | Отчёт по задачам | `tasks` | `/report/tasksReport` | [x] Virtual Pivot 2026-11-25 |
| 10 | По бонусам | `bonuses` | `/report/bonusReport` | [x] Done 2026-11-25 |
| 11 | Универсальный отчет по бонусам | `universal-bonuses` | `/report/bonus` | [x] Virtual Pivot 2026-11-26 |
| 12 | По визитам | `visits` | `/report/agent/visit` | [x] Done 2026-11-26 (+ drill-down modal) |
| 13 | По дневному посещению | `daily-visits` | `/report/reportVisit` | [x] Done 2026-11-26 (FlatReport polish; flat ≠ SD matrix) |
| 14 | По ценам | `prices` | `/report/price` | [x] Done 2026-11-26 (FlatReport polish; flat ≠ SD matrix) |
| 15 | Классификация торговых точек | `outlet-class` | — | [x] Done 2026-11-26 (FlatReport polish) |
| 16+ | Qolgan FlatReport wave close-out | `expeditor-visits`…`visits-2` + `sku-3` | menyu | [x] Done 2026-11-26 (prefs/grid/search/Зона) |

Har otchot uchun bir xil sikl:

1. SalesDoc login + probe (`-PageUrl` / `-FetchSample -SaveHtml`) → SPEC (filtr/ustun/ajax).
2. SALEC FE adapter + BE parse/where/report/export solishtirish.
3. FlatReport chrome: sana radio (bor bo‘lsa), ixcham 2-qator filter grid, jadval qidiruvi, «Колонки», export RBAC.
4. Доступ: `PERMISSION_SECTIONS` + label (view/export).
5. Smoke: filter-options / report / export / FE 200; contract test.
6. Foydalanuvchi review → keyingi #.

## File map (shu commit)

### FlatReport chrome

- `frontend/components/reports/flat-report/flat-report-page.tsx` — orchestrator; need_products banner; OKB/AKB format
- `frontend/components/reports/flat-report/flat-report-filters.tsx` — **yangi** ixcham unified grid
- `frontend/components/reports/flat-report/flat-report-table.tsx` — **yangi** jadval split
- `frontend/components/reports/flat-report/multi-filter.tsx` — compact trigger
- `frontend/components/reports/flat-report/types.ts` — `tablePrefsId`, `dateTypeAsRadio`, …
- `frontend/tests/flat-report-*.ts` — contract / helpers

### Adapters

- `frontend/app/(dashboard)/reports/client-sales-3/page.tsx`
- `frontend/app/(dashboard)/reports/shelf-returns/page.tsx`
- `frontend/app/(dashboard)/reports/order-qty/page.tsx`
- `frontend/app/(dashboard)/reports/sku-3/page.tsx`

### Backend

- `backend/src/modules/reports/client-sales-2.{types,parse,where,filters,report}.ts` (+ CS3 share)
- `backend/src/modules/reports/client-sales-3.report.ts`
- `backend/src/modules/reports/shelf-returns.report.ts` — COALESCE ship/deliver date
- `backend/src/modules/reports/order-qty.report.ts` — exclude `cancelled`
- `backend/src/modules/access/permission-model.ts` — barcha `REPORT_PAGE_PERMISSIONS` → Доступ daraxti

## Task 1: FlatReport chrome (CS3 uslubi) — DONE

- [x] Filters + table split (≤400 LOC)
- [x] Unified select+multiSelect grid (`xl:grid-cols-9`)
- [x] Column prefs + client table search
- [x] Contract tests yangilash

## Task 2: client-sales-3 — DONE

- [x] SalesDoc clientList probe
- [x] FE: date radios, activity/inventory/last_days, to‘liq ustunlar
- [x] BE: shared CS2 filters/where; shipped COALESCE

## Task 3: shelf-returns — DONE

- [x] SalesDoc `/report/defect` probe (getJson lines)
- [x] FE: 30 ustun, compact filters, table prefs
- [x] BE: date COALESCE; Доступ `vozvrat_s_polki`

## Task 4: order-qty — DONE

- [x] SalesDoc `/report/report/type` (AjaxType)
- [x] FE: Т.Т./Т.П. ustunlar; compact filters
- [x] BE: exclude cancelled; Доступ `kolichestvo_zakazov`

## Task 5: sku-3 — DONE

- [x] SalesDoc Sku 2.0 probe
- [x] FE: product matrix cols; need_products banner; OKB/AKB number format
- [x] Доступ `po_sku_3` (PERMISSION_SECTIONS sync)

## Task 6: Доступ sync — DONE

- [x] `PERMISSION_SECTIONS` = barcha `REPORT_PAGE_PERMISSIONS` + konstruktor/KPI

## Task 7: Keyingi otchotlar — TODO

- [x] #5 `expeditor-shipments` — probe `/report/expeditor`; dedicated matrix (dual header + category tree + invoice footer); date radios + COALESCE; Доступ already
- [x] #6 `excel-export` — Version1 columns + date radios/table prefs/client search; COALESCE dates; Доступ already
- [x] #7 `inventory` — FlatReport polish (date radios, prefs, address, shipped COALESCE, seed) 2026-11-25
- [x] #8 `photo` — mosaic + table workspace, thumb_url content proxy, seed 2026-11-25
- [x] #9 `tasks` — Virtual Pivot rewrite + konstruktor chrome; classic Options fix 2026-11-25 (FlatReport polish superseded)
- [x] #10 `bonuses` — FlatReport polish (date radios, prefs, shipped COALESCE, seed; search dublikat olib tashlandi) 2026-11-25
- [x] #9 follow-up — tasks Отчёты/Сохр./Поделиться (`tasks_report` datasetId) 2026-11-26
- [x] #11 `universal-bonuses` — Virtual Pivot line dataset (`oi.is_bonus`) + workspace 2026-11-26
- [x] #12 `visits` — FlatReport polish (prefs/grid/Зона–Город, search dublikat olib tashlandi, seed) 2026-11-26
- [x] #12b `visits` drill-down modal — `GET …/visits/detail` + metric click 2026-11-26
- [x] #13 `daily-visits` — FlatReport polish (prefs/grid, Год/Месяц, oy RU) 2026-11-26
- [x] #14 `prices` — FlatReport polish (prefs/grid, search dublikat olib tashlandi, seed) 2026-11-26
- [x] #15 `outlet-class` — FlatReport polish (prefs/grid, Зона–Город, search olib tashlandi) 2026-11-26
- [x] #16+ FlatReport wave close-out — 13 adapter (prefs/grid 9, search drop, Зона–Город) 2026-11-26
- [ ] Custom / non-FlatReport (staff-attendance, excel-export workspace, photo, VP) — alohida
- [ ] Sariq stublar (tare/feedback/nr) — deferred
- Holat/e’tirozlar: `docs/superpowers/plans/2026-11-25-otchot-tezyuk-status-va-etirozlar.md`

## Verification (har task oxiri)

```bash
npm run lint:errors --prefix frontend
cd backend && npx tsc -p tsconfig.json --noEmit
npm run audit:max-loc
cd frontend && npx vitest run tests/flat-report-page.m1.1.contract.test.ts
# Live: filter-options + report + export 200; tokensiz 401
```

## Deploy eslatma

Lokal smoke ≠ prod. Push’dan keyin Hetzner deploy alohida so‘raladi (`scripts/hetzner/deploy.ps1`).
