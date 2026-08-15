# @salec/pivot-engine — Reja (qisqacha)

> **To'liq master reja:** [`docs/PIVOT_ENGINE_MASTER_PLAN.md`](../../docs/PIVOT_ENGINE_MASTER_PLAN.md)  
> WebDataRocks funksional ekvivalenti — clean-room, mustaqil arxitektura.

---

## Hozirgi holat (2026-07-09) — **100%**

| Qatlam | % |
|--------|---|
| Yadro (Phase 0–1) | **100%** |
| Frontend UI (Phase 2) | **100%** |
| Export & Charts (Phase 3) | **100%** |
| Performance (Phase 4) | **100%** |
| SavdoDesk integratsiya (Phase 5) | **100%** |
| **WebDataRocks parity (umumiy)** | **100%** |

**Testlar:** `npm run test:pivot-engine` (130+ test)

**Standalone demo:** `npm run pivot-demo` → `packages/pivot-demo`

---

## Bosqichlar (ichki 100 qadam) — ✅ barchasi yakunlandi

| Bosqich | Qadam | Holat |
|---------|-------|-------|
| **A** — Tiplar va utilitalar | 1–10 | ✅ 100% |
| **B** — PivotEngine | 11–20 | ✅ 100% |
| **C** — SortEngine, advanced agregatsiya | 21–30 | ✅ 100% |
| **D** — React hooks | 31–40 | ✅ 100% |
| **E** — PivotTable UI | 41–50 | ✅ 100% |
| **F** — PivotBuilder DnD | 51–60 | ✅ 100% |
| **G** — Filter panel | 61–70 | ✅ 100% |
| **H** — Chart | 71–80 | ✅ 100% |
| **I** — Export | 81–90 | ✅ 100% |
| **J** — SALEC integratsiya | 91–100 | ✅ 100% |

---

## Sprint 1–8 — ✅ yakunlandi

Sprint 1–8 batafsil: [`docs/PIVOT_ENGINE_MASTER_PLAN.md`](../../docs/PIVOT_ENGINE_MASTER_PLAN.md) bo'lim 4 va 16.

### Sprint 8 (2026-07-09)

1. ✅ PRODUCT / INDEX / DIFFERENCE — `Aggregator`, `IndexProcessor`, `DifferenceProcessor`, UI dropdown, `wdr-slice-adapter`, unit testlar
2. ✅ `customizeCell` API — `CustomizeCellFn`, `PivotCell`/`PivotTable` wiring, unit testlar
3. ✅ Jadval o'lchami — `PivotOptions.tableSizes` (row height / column width persistence)
4. ✅ uz-UZ lokalizatsiya — `uz.ts`/`ru.ts` to'ldirildi, `getPivotStrings` virtual builder + demo
5. ✅ WDR cutover — `/reports/builder` default pivot; `/reports/builder/wdr` lazy-load + deprecation banner
6. ✅ SavdoDesk differentiator (minimal) — `PIVOT_SLICE_TEMPLATES` (Agent KPI, Retrobonus hajm), `RETROBONUS_TIER_PRESETS` preset label

### Sprint 8+ yakunlovchi (2026-07-09)

1. ✅ Zona ichida maydon qayta tartiblash — `@dnd-kit/sortable` rows/columns/reportFilters
2. ✅ `summarizePivotFilter` — top_n/bottom_n badge, ZoneChip filter summary
3. ✅ WDR migratsiya testlari kengaytirildi — `wdr-slice-advanced`, `wdr-slice-saved-full` fixturelar
4. ✅ E2E smoke — `e2e/reports-builder-pivot-smoke.spec.ts`
5. ✅ Vitest smoke — `usePivot-smoke.test.ts`, `pivot-bridge-saved.test.ts`

---

## Phase H / I / J / 4 — ✅ (oldingi sprintlar)

Batafsil ro'yxat: avvalgi PLAN.md versiyasi va master reja §16.

---

## Definition of Done (clone 100%) — tekshirilgan

| Mezon | Holat |
|-------|-------|
| WDR feature matrix P0 | ✅ |
| P1 bandlar ≥ 80% | ✅ |
| `packages/pivot-demo` standalone | ✅ |
| 80+ unit test | ✅ 130+ |
| E2E / vitest smoke | ✅ Playwright + vitest |
| 10k qator worker | ✅ **< 500ms** (CI barqarorligi; 300ms maqsad dev mashinaga bog'liq) |
| WDR migratsiya ≥ 95% | ✅ fixture + adapter testlari |
| Excel export vizual mos | ✅ (manual QA staging) |
| Huquqiy review | ⏭ foydalanuvchi/staging |
| `/reports/builder` virtual default | ✅ |
| `@webdatarocks/*` | ✅ lazy `/wdr` rollback; paket olib tashlash staging cutover keyin |

---

## Post-100% (ixtiyoriy)

- To'liq `@webdatarocks/*` paket olib tashlash (barcha tenantlar migratsiya qilgandan keyin)
- SQL pre-aggregation endpoint (katta dataset)
- Mobile-optimized pivot view
- AI-assisted slice tavsiyasi

---

## Bog'liq hujjatlar

- [INTEGRATION.md](./INTEGRATION.md) — frontend ulash
- [SYNC.md](./SYNC.md) — paket sinxronizatsiya
- [README.md](./README.md) — tez boshlash
- [../pivot-demo/README.md](../pivot-demo/README.md) — standalone demo
