/**
 * CDN entry — ESM/CJS build attaches PivotApp to `window.SalecPivot` when loaded in a browser.
 * Prefer `import { PivotApp } from '@salec/pivot-ui'` in bundlers.
 *
 * Script-tag usage (after peers on page):
 * ```html
 * <script type="module">
 *   import { PivotApp } from "https://cdn.example/@salec/pivot-ui/cdn/pivot.js";
 *   // or rely on window.SalecPivot.PivotApp after side-effect load
 * </script>
 * ```
 */
import { PivotApp } from "./PivotApp.js";
import { PIVOT_THEMES, HEATMAP_CONDITIONAL_PRESETS } from "./index.js";
export { PivotApp, PIVOT_THEMES, HEATMAP_CONDITIONAL_PRESETS };
declare global {
    interface Window {
        SalecPivot?: {
            PivotApp: typeof PivotApp;
            PIVOT_THEMES: typeof PIVOT_THEMES;
            HEATMAP_CONDITIONAL_PRESETS: typeof HEATMAP_CONDITIONAL_PRESETS;
        };
    }
}
//# sourceMappingURL=cdn.d.ts.map