# Pivot WDR-demo parity — manual QA checklist

Clean-room functional parity vs WebDataRocks-style demo. Use SALEC Report Builder + `packages/pivot-demo` / `PivotApp`.

## Setup

- [ ] `node frontend/scripts/sync-pivot-packages.mjs`
- [ ] Dataset loads; empty sheet shows ~50×50 buffer
- [ ] Performance: display page 1000 / scroll window 500 still in effect

## Fields / DnD

- [ ] Fields modal: palette → rows / columns / values / report filters
- [ ] Reorder within a zone (sortable chips)
- [ ] Drag chip between zones
- [ ] Aggregations: SUM / COUNT / AVG / MIN / MAX / % / running total
- [ ] Calculated measure presets add/remove
- [ ] `@salec/pivot-ui` PivotBuilder: same DnD behaviours in embed demo

## Filters

- [ ] Multi-select / date / number / Top-N
- [ ] Filter dialog: Tab cycles inside panel (focus trap); Escape closes
- [ ] Clear filters from toolbar

## Table / styles

- [ ] Compact / classic / flat layouts
- [ ] Excel gallery styles (light / medium / dark)
- [ ] Portable themes section: Default / Striped / Compact / Heatmap apply `--pg-*` + `--pivot-*`
- [ ] Expand / collapse / column totals

## Charts

- [ ] Switch table ↔ chart
- [ ] Bar / Line / Pie toggles render
- [ ] Chart PNG export when in chart mode

## Export

- [ ] Excel / **CSV** (ru+uz label) / PDF / HTML
- [ ] Large-export confirm dialog

## Drill-through

- [ ] Options: drillThrough off by default
- [ ] Enable → double-click value cell → preferred product/bonus/amount columns

## Conditional / heatmap

- [ ] Format → Conditional → **Heatmap presets** applies blue/orange/negative rules
- [ ] Manual rules still editable

## Mobile (≤900px)

- [ ] Grid: horizontal scroll works; touch overscroll contained
- [ ] Fields modal fits viewport; compact field list
- [ ] PivotApp stacks builder above grid

## Embed packages

- [ ] `npm run build --workspace=@salec/pivot-ui` succeeds
- [ ] `examples/vite-react` + `examples/vanilla` README «5 daqiqada»
- [ ] CDN entry `dist/cdn/pivot.js` loads `window.SalecPivot`

## Worker

- [ ] Large dataset uses worker (Next factory / createNextWorkerFactory)

## Deferred (document only)

- [ ] SQL pre-aggregation API — see `docs/PIVOT_PRODUCT_ROADMAP.md` (not in this sprint)
