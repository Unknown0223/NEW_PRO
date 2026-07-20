/**
 * Virtual Pivot column/row sizing — parity with WebDataRocks defaults.
 *
 * WDR tokens (webdatarocks.css + live demo measure):
 * - .wdr-sheet-header: line-height 23px, padding 0 → gutter ~25×25 (row nums 25×30)
 * - .wdr-grid-row: height 30px
 * - .wdr-grid-column: width 100px (fallback / empty)
 * - min column width (Zs): 50px
 * - .wdr-cell: padding 7px 4px, font 12px Arial
 */

export const ROW_GUTTER_W = 25;
export const COL_GUTTER_H = 25;
export const DEFAULT_ROW_HEIGHT = 30;
export const DEFAULT_COL_WIDTH = 100;
/** Ko‘p ustunlarda matn o‘qilishi uchun pastki chegara. */
export const MIN_COL_WIDTH = 72;
/**
 * Klassik/kompaktda sticky qilinadigan row-dim ustunlar soni.
 * 0 = sticky yo‘q (ko‘p ustunda scroll/smear/buzilish oldini olish).
 * Sticky label + scroll qilingan raqam qatori chalkashmasin.
 */
export const MAX_STICKY_ROW_DIMS = 0;
/** Horizontal cell padding (4px + 4px) — matches .wdr-cell / .th. */
export const CELL_PAD_X = 8;
/** Left+right 1px borders under `box-sizing: border-box`. */
export const CELL_BORDER_X = 2;
/** Subpixel / antialias slack — canvas measureText often under-reads real paint. */
export const FIT_SAFETY_PAD = 8;
/**
 * Extra room for header funnel + `.thInner { padding-right: 16px }` + sort mark.
 * Must cover border-box chrome or measure captions (e.g. «Сумма») ellipsize.
 */
export const HEADER_CHROME_PAD = 28;
/** Expand +/- control + gap in row-dim labels. */
export const EXPAND_CHROME_PAD = 22;
/**
 * Residual after digit→0 tabular approximation (font-feature / kerning).
 * Main tabular width comes from `measureTextWidthTabular`.
 */
export const NUMERIC_TABULAR_PAD = 6;

const FONT = "12px Arial";

/** `false` = canvas measure unavailable (SSR / jsdom); skip retries. */
let measureCtx: CanvasRenderingContext2D | null | false = null;

export function measureTextWidth(text: string, font = FONT): number {
  if (!text) return 0;
  if (typeof document === "undefined") {
    return text.length * 7;
  }
  if (measureCtx === false) return text.length * 7;
  if (!measureCtx) {
    try {
      const canvas = document.createElement("canvas");
      measureCtx = canvas.getContext("2d") ?? false;
    } catch {
      measureCtx = false;
    }
  }
  if (!measureCtx) return text.length * 7;
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

/**
 * Approximate CSS `font-variant-numeric: tabular-nums`: every digit is as wide as `0`.
 * Proportional canvas measure under-reads money strings («11 057 200 soʻm» → ellipsis).
 */
export function measureTextWidthTabular(text: string, font = FONT): number {
  if (!text) return 0;
  return measureTextWidth(text.replace(/\d/g, "0"), font);
}

export function contentWidthForText(
  text: string,
  opts?: { headerChrome?: boolean; expandChrome?: boolean; tabularNums?: boolean }
): number {
  const textW = opts?.tabularNums ? measureTextWidthTabular(text) : measureTextWidth(text);
  const chrome =
    (opts?.headerChrome ? HEADER_CHROME_PAD : 0) +
    (opts?.expandChrome ? EXPAND_CHROME_PAD : 0) +
    (opts?.tabularNums ? NUMERIC_TABULAR_PAD : 0);
  return Math.ceil(textW + CELL_PAD_X + CELL_BORDER_X + FIT_SAFETY_PAD + chrome);
}

function bump(map: Map<string, number>, key: string, w: number) {
  const prev = map.get(key) ?? MIN_COL_WIDTH;
  if (w > prev) map.set(key, w);
}

function parseRowDimIndex(key: string): number | null {
  const m = /^__row_dim_(\d+)__$/.exec(key);
  return m ? Number(m[1]) : null;
}

export type HeaderLevelItem = {
  key: string;
  label: string;
  colspan: number;
  isValue?: boolean;
};

/**
 * Compute content-fitted widths per leaf column, then equally stretch so
 * columns fill `containerWidth` when underfull. Gutter width is excluded.
 */
export function computePivotColumnWidths(args: {
  columnKeys: string[];
  containerWidth: number;
  columnWidthOverrides?: Record<string, number>;
  defaultColumnWidth?: number;
  rowDimLabels?: string[];
  rowDimSamples?: string[][];
  rowLabelHeader?: string;
  rowLabelSamples?: string[];
  headerLevels?: HeaderLevelItem[][];
  bodySamplesByKey: Map<string, string[]>;
  rowDimHasExpand?: boolean;
  /**
   * When true (default), underfull data columns stretch to fill the viewport.
   * When false, keep content-fitted widths — empty sheet buffer fills the rest (Excel/WDR).
   */
  stretchToFill?: boolean;
}): Record<string, number> {
  const {
    columnKeys,
    containerWidth,
    columnWidthOverrides,
    defaultColumnWidth = DEFAULT_COL_WIDTH,
    rowDimLabels = [],
    rowDimSamples = [],
    rowLabelHeader,
    rowLabelSamples = [],
    headerLevels = [],
    bodySamplesByKey,
    rowDimHasExpand = false,
    stretchToFill = true
  } = args;

  const fitted = new Map<string, number>();
  for (const key of columnKeys) {
    fitted.set(key, MIN_COL_WIDTH);
  }

  for (const key of columnKeys) {
    const dimIdx = parseRowDimIndex(key);
    if (dimIdx != null) {
      const header = rowDimLabels[dimIdx] ?? "";
      if (header) bump(fitted, key, contentWidthForText(header, { headerChrome: true }));
      for (const sample of rowDimSamples[dimIdx] ?? []) {
        bump(
          fitted,
          key,
          contentWidthForText(sample, {
            expandChrome: rowDimHasExpand && Boolean(sample)
          })
        );
      }
      continue;
    }

    if (key === "__row_label__") {
      if (rowLabelHeader) {
        bump(fitted, key, contentWidthForText(rowLabelHeader, { headerChrome: true }));
      }
      for (const sample of rowLabelSamples) {
        bump(fitted, key, contentWidthForText(sample, { expandChrome: rowDimHasExpand }));
      }
      continue;
    }

    const samples = bodySamplesByKey.get(key) ?? [];
    if (samples.length === 0) {
      bump(fitted, key, defaultColumnWidth);
    } else {
      for (const sample of samples) {
        // Value/metric columns render with tabular-nums (.tdNumeric).
        let w = contentWidthForText(sample, { tabularNums: true });
        // Money suffixes (soʻm / UZS) need a hard floor — canvas still under-reads some glyphs.
        if (/so[ʻʼ']?m|\bUZS\b|сум/i.test(sample)) {
          w = Math.max(w, 148);
        }
        bump(fitted, key, w);
      }
    }
  }

  // Spanning parent headers: ensure leaf-group sum can fit the parent label.
  const firstValueIdx = columnKeys.findIndex(
    (k) => parseRowDimIndex(k) == null && k !== "__row_label__"
  );

  for (const level of headerLevels) {
    let leafCursor = firstValueIdx >= 0 ? firstValueIdx : columnKeys.length;
    for (const h of level) {
      if (h.key === "__row_label__" || h.key === "__row_label__2") continue;
      const span = Math.max(1, h.colspan || 1);
      const start = leafCursor;
      const end = Math.min(columnKeys.length, start + span);
      leafCursor = end;
      if (start >= columnKeys.length) break;

      const labelW = contentWidthForText(h.label || "", { headerChrome: true });
      if (span === 1) {
        bump(fitted, columnKeys[start]!, labelW);
        continue;
      }

      let sum = 0;
      for (let i = start; i < end; i++) sum += fitted.get(columnKeys[i]!)!;
      if (labelW > sum) {
        const extra = labelW - sum;
        const base = Math.floor(extra / span);
        let rem = extra - base * span;
        for (let i = start; i < end; i++) {
          const key = columnKeys[i]!;
          const add = base + (rem > 0 ? 1 : 0);
          if (rem > 0) rem--;
          fitted.set(key, (fitted.get(key) ?? MIN_COL_WIDTH) + add);
        }
      }
    }
  }

  if (columnWidthOverrides) {
    for (const key of columnKeys) {
      const o = columnWidthOverrides[key];
      if (typeof o === "number" && o > 0) bump(fitted, key, o);
    }
  }

  // Content-fitted mins — never crush below these (Excel-like).
  const contentWidths = columnKeys.map((k) =>
    Math.max(MIN_COL_WIDTH, fitted.get(k) ?? defaultColumnWidth)
  );

  if (!stretchToFill) {
    const out: Record<string, number> = {};
    columnKeys.forEach((k, i) => {
      out[k] = contentWidths[i]!;
    });
    return out;
  }

  const available = Math.max(0, Math.floor(containerWidth) - ROW_GUTTER_W);
  // Underfull → stretch to fill; overfull → keep content widths (caller scrolls).
  const stretched = distributeColumnStretch(contentWidths, available);

  const out: Record<string, number> = {};
  columnKeys.forEach((k, i) => {
    out[k] = Math.max(contentWidths[i]!, stretched[i]!);
  });
  return out;
}

/**
 * When content sum < available (scrollport minus gutter), distribute ALL leftover
 * equally across every data column so the table fills width — no single spacer
 * column absorbs the abyss. When overfull, return content widths unchanged.
 */
export function distributeColumnStretch(
  contentWidths: number[],
  availableWidth: number,
  mode: "equal" | "proportional" = "equal"
): number[] {
  if (contentWidths.length === 0) return [];
  const contentSum = contentWidths.reduce((a, b) => a + b, 0);
  if (!(availableWidth > contentSum && contentSum > 0)) {
    return contentWidths.slice();
  }

  const extra = availableWidth - contentSum;
  if (mode === "proportional") {
    let distributed = 0;
    return contentWidths.map((w, i) => {
      if (i === contentWidths.length - 1) return w + (extra - distributed);
      const add = Math.floor((extra * w) / contentSum);
      distributed += add;
      return w + add;
    });
  }

  // Equal: every data column grows by the same share (remainder to the last).
  const n = contentWidths.length;
  const base = Math.floor(extra / n);
  let rem = extra - base * n;
  return contentWidths.map((w) => {
    const add = base + (rem > 0 ? 1 : 0);
    if (rem > 0) rem--;
    return w + add;
  });
}

export function computeRowDimLefts(
  columnKeys: string[],
  widths: Record<string, number>,
  maxSticky = MAX_STICKY_ROW_DIMS
): number[] {
  const lefts: number[] = [];
  let x = ROW_GUTTER_W;
  let stickyCount = 0;
  for (const key of columnKeys) {
    if (parseRowDimIndex(key) == null && key !== "__row_label__") break;
    if (stickyCount < maxSticky) {
      lefts.push(x);
      stickyCount += 1;
    } else {
      // Non-sticky row dims — placeholder so index alignment stays stable
      lefts.push(-1);
    }
    x += widths[key] ?? DEFAULT_COL_WIDTH;
  }
  if (lefts.length === 0) lefts.push(ROW_GUTTER_W);
  return lefts;
}

/** Ustun sticky bo‘ladimi (left >= 0). */
export function isStickyRowDimLeft(left: number | undefined): boolean {
  return typeof left === "number" && left >= 0;
}
