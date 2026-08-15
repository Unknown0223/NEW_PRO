/**
 * Portable theme bridge — mirrors `@salec/pivot-ui` PIVOT_THEMES for SALEC gallery.
 * Keep in sync with packages/pivot-ui/src/themes/tokens.ts (vendor sync copies package).
 */

export type PortablePivotThemeId = "portable-default" | "portable-striped" | "portable-compact" | "portable-heatmap";

export type PortablePivotTheme = {
  id: PortablePivotThemeId;
  packageThemeId: "default" | "striped" | "compact" | "heatmap";
  label: string;
  /** Combined --pivot-* + --pg-* vars */
  cssVars: Record<string, string>;
};

function toPg(
  pivotVars: Record<string, string>
): Record<string, string> {
  const surface = pivotVars["--pivot-surface"] ?? "#ffffff";
  const header = pivotVars["--pivot-header"] ?? "#f4f4f5";
  const border = pivotVars["--pivot-border"] ?? "#e4e4e7";
  const text = pivotVars["--pivot-text"] ?? "#18181b";
  const accent = pivotVars["--pivot-accent"] ?? "#2563eb";
  const rowAlt = pivotVars["--pivot-row-alt"] ?? surface;
  const rowHeight = pivotVars["--pivot-row-height"];
  return {
    ...pivotVars,
    "--pg-border": border,
    "--pg-body-bg": surface,
    "--pg-header-bg": header,
    "--pg-flat-header-bg": header,
    "--pg-header-fg": text,
    "--pg-text": text,
    "--pg-row-band": rowAlt,
    "--pg-total-bg": header,
    "--pg-col-total-bg": header,
    "--pg-grand-total-bg": border,
    "--pg-hover-bg": rowAlt,
    "--pg-gutter-bg": header,
    "--pg-gutter-fg": "#999999",
    "--pg-select-border": accent,
    ...(rowHeight ? { "--pg-row-height": rowHeight } : {})
  };
}

export const PORTABLE_PIVOT_THEMES: PortablePivotTheme[] = [
  {
    id: "portable-default",
    packageThemeId: "default",
    label: "Default",
    cssVars: toPg({
      "--pivot-border": "#e4e4e7",
      "--pivot-surface": "#ffffff",
      "--pivot-header": "#f4f4f5",
      "--pivot-accent": "#2563eb",
      "--pivot-text": "#18181b"
    })
  },
  {
    id: "portable-striped",
    packageThemeId: "striped",
    label: "Striped",
    cssVars: toPg({
      "--pivot-border": "#d4d4d8",
      "--pivot-surface": "#fafafa",
      "--pivot-header": "#e4e4e7",
      "--pivot-accent": "#0f766e",
      "--pivot-text": "#27272a",
      "--pivot-row-alt": "#f4f4f5"
    })
  },
  {
    id: "portable-compact",
    packageThemeId: "compact",
    label: "Compact",
    cssVars: toPg({
      "--pivot-border": "#e4e4e7",
      "--pivot-surface": "#ffffff",
      "--pivot-header": "#f8fafc",
      "--pivot-accent": "#334155",
      "--pivot-text": "#0f172a",
      "--pivot-row-height": "28px"
    })
  },
  {
    id: "portable-heatmap",
    packageThemeId: "heatmap",
    label: "Heatmap",
    cssVars: toPg({
      "--pivot-border": "#e2e8f0",
      "--pivot-surface": "#ffffff",
      "--pivot-header": "#f1f5f9",
      "--pivot-accent": "#dc2626",
      "--pivot-text": "#1e293b",
      "--pivot-heat-low": "#dcfce7",
      "--pivot-heat-mid": "#fef08a",
      "--pivot-heat-high": "#fecaca"
    })
  }
];

export const PORTABLE_PIVOT_THEME_BY_ID = new Map(
  PORTABLE_PIVOT_THEMES.map((t) => [t.id, t])
);

export function isPortablePivotThemeId(id: string): id is PortablePivotThemeId {
  return PORTABLE_PIVOT_THEME_BY_ID.has(id as PortablePivotThemeId);
}

export function getPortablePivotThemeCssVars(id: string): Record<string, string> | null {
  return PORTABLE_PIVOT_THEME_BY_ID.get(id as PortablePivotThemeId)?.cssVars ?? null;
}
