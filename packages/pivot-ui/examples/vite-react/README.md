# 5 daqiqada — @salec/pivot-ui

## Vite + React

```bash
cd packages/pivot-ui/examples/vite-react
npm install
npm run dev
```

Brauzerda PivotApp ochiladi: maydonlar, DnD, jadval/grafik, CSV eksport.

## Vanilla (script tag)

`examples/vanilla/index.html` ni oching (yoki static server):

```bash
npx serve packages/pivot-ui/examples/vanilla
```

CDN/ESM entry: build qilingan `dist/cdn/pivot.js` → `window.SalecPivot.PivotApp`.

## Minimal kod

```tsx
import { PivotApp } from "@salec/pivot-ui";
import "@salec/pivot-ui/style.css";

<PivotApp
  data={[{ Country: "UZ", Price: 1000 }]}
  fields={[
    { id: "Country", label: "Country", dataType: "string" },
    { id: "Price", label: "Price", dataType: "currency" }
  ]}
  options={{ locale: "ru", drillThrough: false, theme: "default" }}
/>
```

Drill-through: `options.drillThrough: true`. Heatmap: `theme: "heatmap"` + conditional presets.
