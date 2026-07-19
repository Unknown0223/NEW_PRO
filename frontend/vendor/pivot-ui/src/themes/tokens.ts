export type PivotThemeId = "default" | "striped" | "compact" | "heatmap";

export type PivotThemeTokens = {
  id: PivotThemeId;
  label: string;
  cssVars: Record<string, string>;
};

export const PIVOT_THEMES: PivotThemeTokens[] = [
  {
    id: "default",
    label: "Default",
    cssVars: {
      "--pivot-border": "#e4e4e7",
      "--pivot-surface": "#ffffff",
      "--pivot-header": "#f4f4f5",
      "--pivot-accent": "#2563eb",
      "--pivot-text": "#18181b"
    }
  },
  {
    id: "striped",
    label: "Striped",
    cssVars: {
      "--pivot-border": "#d4d4d8",
      "--pivot-surface": "#fafafa",
      "--pivot-header": "#e4e4e7",
      "--pivot-accent": "#0f766e",
      "--pivot-text": "#27272a",
      "--pivot-row-alt": "#f4f4f5"
    }
  },
  {
    id: "compact",
    label: "Compact",
    cssVars: {
      "--pivot-border": "#e4e4e7",
      "--pivot-surface": "#ffffff",
      "--pivot-header": "#f8fafc",
      "--pivot-accent": "#334155",
      "--pivot-text": "#0f172a",
      "--pivot-row-height": "28px"
    }
  },
  {
    id: "heatmap",
    label: "Heatmap",
    cssVars: {
      "--pivot-border": "#e2e8f0",
      "--pivot-surface": "#ffffff",
      "--pivot-header": "#f1f5f9",
      "--pivot-accent": "#dc2626",
      "--pivot-text": "#1e293b",
      "--pivot-heat-low": "#dcfce7",
      "--pivot-heat-mid": "#fef08a",
      "--pivot-heat-high": "#fecaca"
    }
  }
];

export function resolveThemeTokens(id: PivotThemeId): PivotThemeTokens {
  return PIVOT_THEMES.find((t) => t.id === id) ?? PIVOT_THEMES[0]!;
}

/**
 * Map portable `--pivot-*` tokens onto SALEC PivotTable `--pg-*` CSS vars
 * so the Excel-style gallery and embed themes stay aligned.
 */
export function pivotThemeToPgCssVars(theme: PivotThemeTokens): Record<string, string> {
  const v = theme.cssVars;
  const surface = v["--pivot-surface"] ?? "#ffffff";
  const header = v["--pivot-header"] ?? "#f4f4f5";
  const border = v["--pivot-border"] ?? "#e4e4e7";
  const text = v["--pivot-text"] ?? "#18181b";
  const accent = v["--pivot-accent"] ?? "#2563eb";
  const rowAlt = v["--pivot-row-alt"] ?? surface;
  const rowHeight = v["--pivot-row-height"];
  return {
    ...v,
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
