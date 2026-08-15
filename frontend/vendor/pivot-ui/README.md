# @salec/pivot-ui

Embeddable React pivot UI for SavdoDesk Virtual Pivot Engine.

## Install

```bash
npm install @salec/pivot-engine @salec/pivot-ui
# peer: react, react-dom; optional: recharts
```

## Usage

```tsx
import { PivotApp } from "@salec/pivot-ui";
import "@salec/pivot-ui/style.css";

export function Report() {
  return (
    <PivotApp
      data={rows}
      fields={fields}
      options={{
        locale: "ru",
        drillThrough: false,
        theme: "default",
        useWorker: true
      }}
      onConfigChange={(config) => console.log(config)}
    />
  );
}
```

## Exports

- `PivotApp` — full shell (builder + table/chart + toolbar)
- `PivotTable`, `PivotBuilder`, `PivotToolbar`, `PivotChart`, `PivotDrillThrough`
- `usePivot`, `usePivotExport`
- `resolveDrillThroughColumns`, `SALEC_DRILL_PREFERRED`
- `PIVOT_THEMES`, `HEATMAP_CONDITIONAL_PRESETS`
- `createVitePivotWorker`, `createNextWorkerFactory`

## Build

```bash
npm run build --workspace=@salec/pivot-ui
```

Produces `dist/index.js`, `dist/index.cjs`, `dist/cdn/pivot.js`, CSS, and `.d.ts`.

## 5 daqiqada

See `examples/vite-react/README.md` and `examples/vanilla/README.md`.

## Demo

```bash
npm run pivot-demo
```
