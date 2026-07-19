import { F as n, G as l, H as T, P as c, a as v, b as R, c as p, d as D, e as L, f as k, S as _, g as m, h as C, p as h, r as f, i as F, u as W, j as w, k as A, w as H } from "./chunks/heatmapPresets-DO2sRzdC.js";
import { DEFAULT_WORKER_THRESHOLD as r, createPivotWorkerClient as t } from "@salec/pivot-engine";
function o() {
  return new Worker(new URL(
    /* @vite-ignore */
    "/assets/pivot.worker-CcTtH_KM.js",
    import.meta.url
  ), { type: "module" });
}
function a() {
  return o();
}
function i(e = r) {
  return t({
    threshold: e,
    workerFactory: a
  });
}
function E(e) {
  return () => new Worker(e, { type: "module" });
}
export {
  n as FilterEditor,
  l as GENERIC_DRILL_PREFERRED,
  T as HEATMAP_CONDITIONAL_PRESETS,
  c as PIVOT_THEMES,
  v as PivotApp,
  R as PivotBuilder,
  p as PivotChart,
  D as PivotDrillThrough,
  L as PivotTable,
  k as PivotToolbar,
  _ as SALEC_DRILL_EXCLUDED,
  m as SALEC_DRILL_PREFERRED,
  C as cn,
  i as createDefaultPivotWorkerClient,
  E as createNextWorkerFactory,
  a as createPackagePivotWorker,
  o as createVitePivotWorker,
  h as pivotThemeToPgCssVars,
  f as resolveDrillThroughColumns,
  F as resolveThemeTokens,
  W as useFocusTrap,
  w as usePivot,
  A as usePivotExport,
  H as withHeatmapPresets
};
//# sourceMappingURL=index.js.map
