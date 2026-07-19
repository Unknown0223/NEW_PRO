import type { PivotConfig, PivotLayoutForm, PivotOptions } from "../types/pivot.types.js";

/** Options dan layout formani aniqlaydi (layoutForm yoki eski compactMode). */
export function resolveLayoutForm(options: PivotOptions | undefined): PivotLayoutForm {
  if (!options) return "compact";
  if (options.layoutForm === "flat" || options.layoutForm === "classic" || options.layoutForm === "compact") {
    return options.layoutForm;
  }
  return options.compactMode ? "compact" : "classic";
}

/** layoutForm ni compactMode bilan sinxronlash (eski kod uchun). */
export function withLayoutForm(
  options: PivotOptions,
  layoutForm: PivotLayoutForm
): PivotOptions {
  return {
    ...options,
    layoutForm,
    compactMode: layoutForm === "compact"
  };
}

/** Flat rejimda slice tanlanganmi (value shart emas). */
export function hasFlatSlice(config: PivotConfig): boolean {
  return (
    config.rows.length > 0 ||
    config.columns.length > 0 ||
    config.values.length > 0 ||
    config.reportFilters.length > 0
  );
}
