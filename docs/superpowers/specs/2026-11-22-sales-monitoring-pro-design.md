# Sales monitoring Pro UI — design (short)

**Intent:** `/dashboard/sales-monitoring` ichini NEW_PRO zip `sales.tsx` («Мониторинг продаж и планов») bilan 1:1 qilish; AppShell sidebar o‘zgarmaydi; ma’lumot mavjud sales-monitoring API dan.

**Why:** Finance Pro allaqachon shu zip usulida ulangan; keyingi navbat — sales-monitoring. Hozirgi `monitoring/*` UI shablondan farq qiladi.

## Approaches

1. **Finance usuli** (tanlangan) — `sales-monitoring/pro/*` UI + `buildSalesProUiModel` adapter mavjud snapshot dan; backend endpoint’lar saqlanadi.
2. Mock UI keyin API — rad (ikki bosqich, yolg‘on raqam).
3. Backendni shablonga qayta yozish — rad (mavjud snapshot buziladi).

## Goals

- Sahifa: KPI kartalar (plan/fact/bajarilish/AKB), kunlik dinamika chart, kategoriya donut, filial/yo‘nalish/agent jadvallari, detail dialoglar — shablon layout.
- Filtr: oy/yil + mavjud monitoring scope (filial, agent, supervayzer, …); chrome shablon ko‘rinishiga yaqin.
- Real raqamlar; API da yo‘q detail o‘lchovlar — bo‘sh holat (mock seed yo‘q).
- Export CSV shablon tugmalaridan (mavjud xlsx export ixtiyoriy saqlanadi yoki CSV ga moslashadi).

## Non-goals

- AppShell / nav qayta yozish.
- Yangi backend snapshot endpoint’lar (agar adapter yetmasa — faqat bo‘sh UI, keyin alohida reja).
- Zipdagi mock `branches`/`agents` seed ma’lumotini prod UI da ko‘rsatish.

## Constraints

- Yangi fayllar ≤400 LOC; `audit:max-loc`.
- Picker labels: faqat nom (`branchVisibleName` / staff name).
- Finance Pro scoped CSS pattern (`*-pro-theme.css`, overflow/z-index stacking).
- Lint/typecheck: `sifat-tekshiruvi` gate.

## Builder calls

- Entry: `dashboard-sales-monitoring.tsx` → Pro page (eski `monitoring-page` orchestrator filtr/query saqlashi mumkin).
- API: `fetchMonitoringSummary` / `Charts` / `Tables` (`monitoring/api.ts`).
- Adapter input: `MonitoringSnapshot` (partial merge).
- Template source: `dashboard-development-request (2).zip` → `src/sections/sales.tsx`.
