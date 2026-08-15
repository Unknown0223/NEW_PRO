# Pivot Product Roadmap

> SavdoDesk Virtual Pivot — SALEC + embeddable `@salec/pivot-engine` / `@salec/pivot-ui`.
> Clean-room vs [WebDataRocks](https://www.webdatarocks.com/demos/js/pivot-table-demo/) (functional parity, not a clone).

## Status (2026-07-19)

| Layer | Status |
|-------|--------|
| Engine compute | Ready (publishable exports `.` / `./worker` / `./export`) |
| CSV export | `exportPivotToCsv` + toolbar `csv` i18n (ru/uz) |
| Drill-through | Option `drillThrough` default **false**; SALEC Options checkbox |
| Fields aggregations | Full set in Fields modal |
| Builder DnD | Sortable zones in `@salec/pivot-ui` PivotBuilder + SALEC Fields modal |
| Charts | bar / line / **pie** |
| Themes | `PIVOT_THEMES` + SALEC gallery portable section → `--pg-*` |
| Heatmap presets | Format → Conditional → Heatmap presets |
| `@salec/pivot-ui` | Package + `PivotApp` + CDN entry + examples |
| Worker factory | `createNextWorkerFactory` wired in SALEC `usePivot` |
| WDR dependency | Removed from frontend; `/reports/builder/wdr` archives → pivot |
| Vendor sync | `frontend/scripts/sync-pivot-packages.mjs` (atomic temp build) |
| Manual QA | [PIVOT_WDR_QA_CHECKLIST.md](./PIVOT_WDR_QA_CHECKLIST.md) |

## Decisions

- **Goal C:** SALEC UX + embeddable packages.
- **Drill A:** Opt-in via Options; preferred product/bonus/amount columns.

## Deferred

- **SQL pre-aggregation API** — backend endpoint that pushes GROUP BY aggregates into the pivot engine is **out of this sprint**. Client-side worker + page window (1000/500) remain the performance path. Revisit when warehouse-scale datasets exceed in-browser compute; until then no stub route (avoids half-broken contracts).

## Sprint map

0. Packages + sync + roadmap — done  
1. Drill + aggregations — done  
2. CSV + toolbar + themes tokens — done  
3. PivotApp / worker factory / examples — done  
4. WDR cutover + checklist — done  
5. Mobile CSS + heatmap presets + a11y hooks — done  
6. DnD parity / pie / portable gallery / QA matrix — done  

## Embed quick start

```bash
npm install @salec/pivot-engine @salec/pivot-ui
```

```tsx
import { PivotApp } from "@salec/pivot-ui";
import "@salec/pivot-ui/style.css";

<PivotApp data={rows} fields={fields} options={{ drillThrough: false, locale: "ru" }} />
```

See `packages/pivot-ui/README.md` and `packages/pivot-ui/examples/` («5 daqiqada»).

## Cutover checklist

See [PIVOT_WDR_CUTOVER.md](./PIVOT_WDR_CUTOVER.md).

## Manual QA

See [PIVOT_WDR_QA_CHECKLIST.md](./PIVOT_WDR_QA_CHECKLIST.md).
