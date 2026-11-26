# #12b По визитам — drill-down modal (A)

**Date:** 2026-11-26  
**Status:** approved (user «ha» 2026-11-26)  
**SalesDoc:** `/report/agent/visit` → click `modal-detail-plan-visit` →  
`POST /agents/agent/ajaxPlannedNewVisits/?report=visit&type=&agentId=`  
**SALEC:** `/reports/visits` + `GET /api/:slug/reports/visits/detail`  
**Доступ:** `reports.po_vizitam.view` (export alohida; detail view bilan)

## Intent / why

SalesDoc skrinida ko‘k metrikalar modalda mijozlar jadvalini ochadi. SALEC FlatReport hozir faqat raqam — click yo‘q. Foydalanuvchi **A** tanladi (2026-11-26).

## Goals

- Bosiladigan metrikalar (SD `type` bilan):
  | Cell | `type` | SALEC column key |
  |------|--------|------------------|
  | ОКБ | `""` / `okb` | `okb` |
  | АКБ кол. | `only_order` | `akb` |
  | Отказы кол. | `rejected` | `refusals` |
  | Фотоотчёты кол. | `only_photo` | `photo_reports` |
  | Непосещенные кол. | `not_visited` | `not_visited` |
  | Посещённые кол. | `visited` | `visited` |
- Click → **modal** (sahifa navigatsiya emas) + ichki jadval.
- Modal ustunlar (SD DataTable): клиент, время, сумма заказа, отказ, фото, инвентарь (bor bo‘lsa), последний закуп, дата последнего закупа.
- BE: `GET …/visits/detail?from&to&agent_id&type=` (+ filtrlar: statuses, visit_kinds, territories, …) — qatorlar ro‘yxati; cap ~2000.
- 0 qiymatda link yo‘q (yoki disabled) — SD bo‘shda ham link bo‘lishi mumkin; SALEC: `> 0` bo‘lsa clickable.
- Smoke + contract; picker labels nom-only.

## Non-goals

- Dual-header АКБ Кол/% / Отказы % … (keyingi wave; mavjud `visit_pct` qoladi).
- Buyurtma «Кол./Сумма» ni click qilish (SD probe’da ko‘pincha oddiy matn).
- Agent nomi click → profil.
- Product/currency filtrlari.
- Virtual Pivot.
- Commit/deploy so‘ralmaguncha.

## Anti-goals

- Har metrika uchun boshqa sahifaga `router.push` (B variant).
- Modalda kodni yorliq qilib ko‘rsatish.

## Constraints

- ≤400 LOC / fayl; FlatReport tablega yupqa `onMetricClick` yoki visits-only wrapper.
- lint:errors / BE tsc / audit:max-loc.
- Доступ `reports.po_vizitam` o‘zgartirilmaydi (faqat view).

## Approaches

| | Variant | Trade-off |
|---|---------|-----------|
| **A (tanlangan)** | Modal + detail API | SD 1:1 UX |
| B | Boshqa report sahifalariga filter | Tez; modal emas |
| C | Faqat dual-header | Click yo‘q |

**Pick:** A. Dual-header — **keyinroq** (shu wave’da emas).

## How (builder)

1. BE `visits-report.detail.ts` — type bo‘yicha client rows (CAA / visits / refusals / photos / orders join).
2. Route `GET …/visits/detail`.
3. FE: visits page yoki thin workspace — clickable cells + `VisitsDetailModal` (Dialog + jadval).
4. Contract + lokal smoke (seed agent).
