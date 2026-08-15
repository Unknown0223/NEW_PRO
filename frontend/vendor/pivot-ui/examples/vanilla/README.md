# Vanilla example

## 5 daqiqada

```bash
# 1) Engine + UI build (CDN entry ham)
npm run build --workspace=@salec/pivot-engine
npm run build --workspace=@salec/pivot-ui

# 2) Static server
npx serve packages/pivot-ui/examples/vanilla
```

Brauzerda ochiladi. `index.html` monorepo `src` dan `PivotApp` import qiladi.

CDN holatda builddan keyin:

```html
<script type="module">
  import "../../../dist/cdn/pivot.js";
  // window.SalecPivot.PivotApp
</script>
```
