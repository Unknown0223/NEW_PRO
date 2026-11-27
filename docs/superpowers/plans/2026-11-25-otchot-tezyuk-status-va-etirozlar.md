# Holat + e’tirozlar (2026-11-25)

Branch: `feat/tezyuk-expeditor-wave0-1`  
Maqsad: qilingan / qilinayotgan rejalarni va review e’tirozlarini bir joyda saqlash.

## Qilingan (shu wave)

| # | Reja / ish | Holat |
|---|------------|--------|
| Отчёт #5–#8 | expeditor-shipments, excel-export, inventory, photo | Done (prod `bd366220` + keyingi polish) |
| #9 tasks | Virtual Pivot + konstruktor chrome + Options + Отчёты/Сохр./Поделиться | Done |
| #10 bonuses | FlatReport polish; dublikat qidiruv olib tashlangan | Done |
| #11 universal-bonuses | Virtual Pivot (line grain) + dataset API | Done |
| #12 visits | FlatReport polish + visit seed | Done |
| #12b visits drill-down | Modal + `…/visits/detail` (SD type) | Done |
| #13 daily-visits | FlatReport polish (prefs/grid, Год/Месяц) | Done |
| #14 prices | FlatReport polish (prefs/grid, seed) | Done |
| #15 outlet-class | FlatReport + SD ustunlar (id/territory/доля категорий) | Done 2026-11-27 |
| #16+ FlatReport close-out | 13 adapter chrome batch | Done |
| TezYuk W0–1 | flavor, theme, home/visits/queue chrome | Kod bor — in progress / review |
| TezYuk W2 Ulashish | share state, routes, partners, mobile share | Kod + migration bor — WIP (deploy park qilingan edi) |
| UI katalog 1:1 | Stitch moslashuv rejasi | Reja/spec bor — qisman kod |

## Qilinayotgan / keyingi

- Отчёт FlatReport wave **yopildi** (2026-11-26). `#4` visits-2 cascade + visit-totals BAD_RANGE — Done 2026-11-27. `#3` CustomReport — deferred. Keyingi: custom workspace / sariq stub / commit-deploy.
- Tasks: server «Сохранить отчёт» / saved pivot slice — 1-wave **skip**.
- TezYuk Ulashish: **kod close-out 2026-11-26** (+ recipients nomlari, lokal smoke skript). Hali: **prod migrate/deploy**, qurilma E2E (ikkita TezYuk). Batafsil: `2026-11-26-tezyuk-closeout-otchot.md`.
- `tmp-wip-tezyuk-share/` — faqat lokal park; **repoga kirmaydi**.
- Qaytarish: misleading web-only copy tuzatildi; return foto stub (API maydoni yo‘q); BE contract testlar qo‘shildi.

## Review e’tirozlari va javob

1. **#9 FlatReport yetarli emas** → Virtual Pivot (`layoutForm: flat`) + dataset `GET .../tasks/dataset`.
2. **Toolbar konstruktor bilan bir xil bo‘lsin** → Fields / Options / Export / filter chrome; Options: Табличная / Классическая.
3. **Bo‘sh jadval (стрелка Options)** → Classic valuessiz PivotEngine 0 qator; default classic `COUNT(task_id)` + aniq empty matn. Noto‘g‘ri sana (2023) ham 0 qator — seed 2026-11.
4. **Bonuses qidiruv dublikat** → filter `kind:"search"` olib tashlandi; jadval qidiruvi qoldi.
5. **Pickerda kod** → nom-only qoida; kod faqat `searchText`.
6. **Deploy paytida share WIP tsc buzadi** → share park/stash; otchot deploy alohida; Ulashish keyin to‘liq push.
7. **Commit/deploy** → faqat so‘ralganda (shu so‘rov: to‘liq push).

## Smoke (lokal, push oldidan qayta)

- tasks: filter-options / dataset / export
- bonuses: FlatReport contract
- share: pure/unit testlar (agar stage qilinsa)
- `lint:errors` FE, `tsc --noEmit` BE, `audit:max-loc`

## Tegishli fayllar

- `docs/superpowers/plans/2026-11-24-salesdoc-otchot-parity.md`
- `docs/superpowers/plans/2026-11-25-tasks-virtual-pivot.md`
- `docs/superpowers/plans/2026-11-25-bonuses-flatreport-polish.md`
- `docs/superpowers/plans/2026-11-25-tezyuk-expeditor-wave0-1.md`
- `docs/superpowers/plans/2026-11-25-tezyuk-expeditor-wave2-ulashish.md`
- `docs/superpowers/plans/2026-11-25-tezyuk-ui-katalog-1to1.md`
- Specs: `docs/superpowers/specs/2026-11-25-*`
