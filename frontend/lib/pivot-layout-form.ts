import type { PivotConfig, PivotOptions } from "@salec/pivot-engine";

export type PivotLayoutForm = "compact" | "classic" | "flat";

/** Options dan layout formani aniqlaydi (layoutForm yoki eski compactMode). */
export function resolveLayoutForm(options: PivotOptions | undefined): PivotLayoutForm {
  if (!options) return "compact";
  if (options.layoutForm === "flat" || options.layoutForm === "classic" || options.layoutForm === "compact") {
    return options.layoutForm;
  }
  return options.compactMode ? "compact" : "classic";
}

/** layoutForm ni compactMode bilan sinxronlash. */
export function withLayoutForm(options: PivotOptions, layoutForm: PivotLayoutForm): PivotOptions {
  return {
    ...options,
    layoutForm,
    compactMode: layoutForm === "compact"
  };
}

export function hasFlatSlice(config: PivotConfig): boolean {
  return (
    config.rows.length > 0 ||
    config.columns.length > 0 ||
    config.values.length > 0 ||
    config.reportFilters.length > 0
  );
}
