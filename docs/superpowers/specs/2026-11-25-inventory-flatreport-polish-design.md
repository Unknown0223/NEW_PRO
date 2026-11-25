# #7 По инвентарю — FlatReport polish (A)

**Date:** 2026-11-25  
**Status:** approved (user 2026-11-25)  
**SalesDoc:** `/clients/Inventorization`  
**SALEC:** `/reports/inventory` · API `inventory`

## Intent / why

Отчёт parity navbatining #7: mijoz inventari + davr savdosi sahifasini CS3/shelf-returns chrome standartiga yetkazish (filtr/ustun/export/RBAC), user review’dan keyin #8.

## Goals

- FlatReport adapter qoladi (dedicated workspace yo‘q).
- `dateTypeAsRadio` + `tablePrefsId: "report.inventory"`.
- Ustunlar: BE `address` FE’da ko‘rinsin; qolganlar saqlansin.
- `shipped_date` uchun COALESCE (`shipped_at` / `delivered_at`) — boshqa otchotlar bilan bir xil.
- Lokal review uchun `client_equipment` seed (bo‘sh jadval bo‘lmasin).
- Smoke: filter-options / report / export; contract test; sifat gate.

## Non-goals

- Dedicated workspace / status cards / matritsa.
- SalesDoc HTML to‘liq qayta yozish (probe faqat gap bo‘lsa).
- Commit/deploy (so‘ralmaguncha).

## Anti-goals

- FlatReportni buzib excel uslubidagi alohida workspace ochish.
- Picker labeliga kod qo‘shish.

## Constraints

- Fayl ≤400 LOC; lint:errors / BE tsc / audit:max-loc.
- Доступ `reports.po_inventaryu` allaqachon bor — qayta ixtiro qilinmaydi.
- Parol/secrets repoga yo‘q.

## Approaches

| | Variant | Trade-off |
|---|---------|-----------|
| **A (tanlangan)** | FlatReport polish | Tez; oila inventariga mos |
| B | Dedicated workspace | Ortacha chrome uchun ortiqcha |
| C | Avval faqat probe | Sekinroq |

**Pick:** A (user 2026-11-25).

## How (builder)

1. FE `page.tsx`: `tablePrefsId`, `dateTypeAsRadio`, `address` ustuni, `footerLeadColSpan` moslash.
2. BE `inventory.report.ts`: `shipped_date` → `COALESCE(sl.shipped_at, sl.delivered_at)`.
3. Seed: bir nechta `client_equipment` (aksit) — report `total > 0`.
4. Vitest: mavjud parse test + FlatReport config contract (ixtiyoriy qisqa).
5. Plan jadvalidagi #7 → done belgi (implement oxirida).

## Left to builder

- Aniq seed skript joyi (`scripts/` yoki one-off SQL).
- Export ustun tartibi `address` bilan sync.
