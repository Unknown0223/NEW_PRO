import type { ConditionalFormatRule } from "@salec/pivot-engine";

/** WDR heat-map demo style presets (clean-room colours). */
export const HEATMAP_CONDITIONAL_PRESETS: ConditionalFormatRule[] = [
  {
    type: "gt",
    threshold: 350_000,
    backgroundColor: "#0598df",
    textColor: "#ffffff"
  },
  {
    type: "gt",
    threshold: 1000,
    backgroundColor: "#f45328",
    textColor: "#ffffff"
  },
  {
    type: "negative",
    backgroundColor: "#fee2e2",
    textColor: "#b91c1c"
  }
];

export function withHeatmapPresets(existing: ConditionalFormatRule[] = []): ConditionalFormatRule[] {
  const stamped = HEATMAP_CONDITIONAL_PRESETS.map((rule, i) => ({
    ...rule,
    id: rule.id ?? `heatmap-preset-${i}`
  }));
  return [...stamped, ...existing];
}
