/**
 * Excel-like pivot «умная таблица» styles.
 * Applied via CSS variables on the PivotTable host.
 */

export const PIVOT_TABLE_STYLE_STORAGE_KEY = "salec.pivot.tableStyle";

/** Factory default when localStorage is empty. */
export const DEFAULT_PIVOT_TABLE_STYLE_ID = "medium-blue";

/** Target for «Очистить» — WebDataRocks-like grey chrome. */
export const WDR_DEFAULT_TABLE_STYLE_ID = "wdr-default";

export type PivotTableStyleFamily = "light" | "medium" | "dark";

export type PivotTableStyleTokens = {
  headerBg: string;
  headerFg: string;
  flatHeaderBg: string;
  bodyBg: string;
  text: string;
  border: string;
  rowBand: string | null;
  totalBg: string;
  colTotalBg: string;
  grandTotalBg: string;
  hoverBg: string;
  gutterBg: string;
  gutterFg: string;
};

export type PivotTableStyleDef = {
  id: string;
  family: PivotTableStyleFamily;
  label: string;
  tokens: PivotTableStyleTokens;
};

function lightStyle(
  id: string,
  label: string,
  accent: string,
  band: string
): PivotTableStyleDef {
  return {
    id,
    family: "light",
    label,
    tokens: {
      headerBg: band,
      headerFg: "#111111",
      flatHeaderBg: accent,
      bodyBg: "#ffffff",
      text: "#111111",
      border: accent,
      rowBand: band,
      totalBg: band,
      colTotalBg: darken(band, 0.04),
      grandTotalBg: darken(band, 0.08),
      hoverBg: "#f7f7f7",
      gutterBg: "#f1f1f1",
      gutterFg: "#999999"
    }
  };
}

function mediumStyle(
  id: string,
  label: string,
  header: string,
  band: string,
  headerFg = "#ffffff"
): PivotTableStyleDef {
  return {
    id,
    family: "medium",
    label,
    tokens: {
      headerBg: header,
      headerFg,
      flatHeaderBg: header,
      bodyBg: "#ffffff",
      text: "#111111",
      border: "#d0d0d0",
      rowBand: band,
      totalBg: band,
      colTotalBg: darken(band, 0.06),
      grandTotalBg: darken(band, 0.12),
      hoverBg: darken(band, 0.04),
      gutterBg: "#f1f1f1",
      gutterFg: "#999999"
    }
  };
}

function darkStyle(
  id: string,
  label: string,
  header: string,
  band: string,
  body: string
): PivotTableStyleDef {
  return {
    id,
    family: "dark",
    label,
    tokens: {
      headerBg: header,
      headerFg: "#ffffff",
      flatHeaderBg: header,
      bodyBg: body,
      text: "#111111",
      border: "#c8c8c8",
      rowBand: band,
      totalBg: band,
      colTotalBg: darken(band, 0.08),
      grandTotalBg: darken(band, 0.14),
      hoverBg: darken(band, 0.05),
      gutterBg: "#e8e8e8",
      gutterFg: "#666666"
    }
  };
}

/** Very light mix toward black — enough for totals hierarchy. */
function darken(hex: string, amount: number): string {
  const n = hex.replace("#", "");
  if (n.length !== 6) return hex;
  const r = Math.max(0, Math.round(parseInt(n.slice(0, 2), 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(n.slice(2, 4), 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(n.slice(4, 6), 16) * (1 - amount)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

const WDR_DEFAULT: PivotTableStyleDef = {
  id: WDR_DEFAULT_TABLE_STYLE_ID,
  family: "light",
  label: "По умолчанию (WDR)",
  tokens: {
    headerBg: "#f1f1f1",
    headerFg: "#111111",
    flatHeaderBg: "#dbdbdb",
    bodyBg: "#ffffff",
    text: "#111111",
    border: "#dbdbdb",
    rowBand: null,
    totalBg: "#f6f6f6",
    colTotalBg: "#eeeeee",
    grandTotalBg: "#e8e8e8",
    hoverBg: "#fafafa",
    gutterBg: "#f1f1f1",
    gutterFg: "#999999"
  }
};

/** Gallery styles — Excel Light / Medium / Dark families (approx. colors). */
export const PIVOT_TABLE_STYLES: readonly PivotTableStyleDef[] = [
  WDR_DEFAULT,
  // Светлые
  lightStyle("light-blue", "Светлый синий", "#5b9bd5", "#ddebf7"),
  lightStyle("light-orange", "Светлый оранжевый", "#ed7d31", "#fce4d6"),
  lightStyle("light-gray", "Светлый серый", "#a5a5a5", "#ededed"),
  lightStyle("light-gold", "Светлый золотой", "#ffc000", "#fff2cc"),
  lightStyle("light-blue2", "Светлый голубой", "#4472c4", "#d6dce5"),
  lightStyle("light-green", "Светлый зелёный", "#70ad47", "#e2efda"),
  lightStyle("light-teal", "Светлый бирюзовый", "#00b0f0", "#ddebf7"),
  lightStyle("light-purple", "Светлый фиолетовый", "#7030a0", "#e2d5f1"),
  // Средние
  mediumStyle("medium-blue", "Средний синий", "#5b9bd5", "#ddebf7"),
  mediumStyle("medium-orange", "Средний оранжевый", "#ed7d31", "#fce4d6"),
  mediumStyle("medium-gray", "Средний серый", "#a5a5a5", "#ededed"),
  mediumStyle("medium-gold", "Средний золотой", "#ffc000", "#fff2cc", "#111111"),
  mediumStyle("medium-blue2", "Средний голубой", "#4472c4", "#d6dce5"),
  mediumStyle("medium-green", "Средний зелёный", "#70ad47", "#e2efda"),
  mediumStyle("medium-teal", "Средний бирюзовый", "#00b0f0", "#ddebf7"),
  mediumStyle("medium-purple", "Средний фиолетовый", "#7030a0", "#e2d5f1"),
  mediumStyle("medium-red", "Средний красный", "#c00000", "#f4cccc"),
  // Тёмные
  darkStyle("dark-blue", "Тёмный синий", "#1f4e79", "#bdd7ee", "#9bc2e6"),
  darkStyle("dark-green", "Тёмный зелёный", "#385723", "#c6e0b4", "#a9d08e"),
  darkStyle("dark-red", "Тёмный красный", "#833c0c", "#f8cbad", "#f4b183"),
  darkStyle("dark-purple", "Тёмный фиолетовый", "#5b2c6f", "#d5a6e6", "#c39bd3"),
  darkStyle("dark-teal", "Тёмный бирюзовый", "#0e6275", "#9dd9eb", "#5b9ea6"),
  darkStyle("dark-gray", "Тёмный серый", "#404040", "#d0d0d0", "#b0b0b0")
];

export const PIVOT_TABLE_STYLE_BY_ID: ReadonlyMap<string, PivotTableStyleDef> = new Map(
  PIVOT_TABLE_STYLES.map((s) => [s.id, s])
);

export function getPivotTableStyle(id: string | null | undefined): PivotTableStyleDef {
  if (id && PIVOT_TABLE_STYLE_BY_ID.has(id)) {
    return PIVOT_TABLE_STYLE_BY_ID.get(id)!;
  }
  return PIVOT_TABLE_STYLE_BY_ID.get(DEFAULT_PIVOT_TABLE_STYLE_ID) ?? WDR_DEFAULT;
}

export function stylesByFamily(family: PivotTableStyleFamily): PivotTableStyleDef[] {
  return PIVOT_TABLE_STYLES.filter((s) => s.family === family && s.id !== WDR_DEFAULT_TABLE_STYLE_ID);
}

export function loadPivotTableStyleId(): string {
  if (typeof window === "undefined") return DEFAULT_PIVOT_TABLE_STYLE_ID;
  try {
    const raw = window.localStorage.getItem(PIVOT_TABLE_STYLE_STORAGE_KEY);
    if (!raw) return DEFAULT_PIVOT_TABLE_STYLE_ID;
    if (PIVOT_TABLE_STYLE_BY_ID.has(raw)) return raw;
    if (raw.startsWith("portable-")) return raw;
  } catch {
    /* ignore quota / private mode */
  }
  return DEFAULT_PIVOT_TABLE_STYLE_ID;
}

export function persistPivotTableStyleId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PIVOT_TABLE_STYLE_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

/** Parse #RRGGBB → rgba() for selection tints. */
export function hexToRgba(hex: string, alpha: number): string {
  const n = hex.replace("#", "").trim();
  if (n.length !== 6) return `rgba(66, 133, 244, ${alpha})`;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return `rgba(66, 133, 244, ${alpha})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Accent used for selection fill/border — matches the table-style header/accent
 * (not hardcoded Google-blue), except WDR grey chrome which keeps classic blue.
 */
export function pivotSelectionAccent(style: PivotTableStyleDef): string {
  if (style.id === WDR_DEFAULT_TABLE_STYLE_ID) return "#4285f4";
  // Light family stores accent in flatHeaderBg; medium/dark use headerBg.
  return style.family === "light" ? style.tokens.flatHeaderBg : style.tokens.headerBg;
}

/** CSS custom properties for PivotTable host. */
export function pivotTableStyleCssVars(style: PivotTableStyleDef): Record<string, string> {
  const t = style.tokens;
  const accent = pivotSelectionAccent(style);
  return {
    "--pg-header-bg": t.headerBg,
    "--pg-header-fg": t.headerFg,
    "--pg-flat-header-bg": t.flatHeaderBg,
    "--pg-body-bg": t.bodyBg,
    "--pg-text": t.text,
    "--pg-border": t.border,
    "--pg-row-band": t.rowBand ?? t.bodyBg,
    "--pg-total-bg": t.totalBg,
    "--pg-col-total-bg": t.colTotalBg,
    "--pg-grand-total-bg": t.grandTotalBg,
    "--pg-hover-bg": t.hoverBg,
    "--pg-gutter-bg": t.gutterBg,
    "--pg-gutter-fg": t.gutterFg,
    "--pg-select-border": accent,
    "--pg-select-bg": hexToRgba(accent, 0.18),
    "--pg-select-focus-bg": hexToRgba(accent, 0.28),
    "--pg-select-hover-bg": hexToRgba(accent, 0.22)
  };
}
