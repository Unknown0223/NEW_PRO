import type { BulkExportTemplateDef } from "@/lib/bulk-export-templates";
import type { NakladnoyPreviewResponse } from "@/lib/nakladnoy-preview";

export type NakladnoyPrintLayoutProfile = {
  id: string;
  label: string;
  orientation: "portrait" | "landscape";
  /** Jadval shrifti (px) */
  tableFontPx: number;
  /** Jadvalni sahifa kengligiga sig‘dirish */
  fitTableToPage: boolean;
  /** Har bir Excel varaq — yangi qog‘oz */
  pageBreakPerSheet: boolean;
  /** Tor format (X-Printer) */
  narrowReceipt?: boolean;
};

const MATRIX_LAYOUTS = new Set([
  "ex-5.1.6",
  "ex-5.1.7",
  "ex-5.1.8",
  "ex-5.1.9",
  "ex-5.1.5"
]);

const WIDE_WAREHOUSE = new Set(["wh-7.0.0", "wh-7.0.1", "wh-7.0.3", "wh-7.0.4", "wh-6.0", "wh-6.0.1", "wh-6.0.2"]);

function maxGridCols(preview: NakladnoyPreviewResponse): number {
  let max = 0;
  for (const p of preview.pages) {
    if (p.grid?.colCount) max = Math.max(max, p.grid.colCount);
  }
  return max;
}

function hasStructured520(preview: NakladnoyPreviewResponse): boolean {
  return preview.pages.some((p) => p.kind === "structured-520");
}

/**
 * Shablon va ko‘rinish bo‘yicha chop etish profili (landscape/portrait, shrift, varaqlar).
 */
export function resolveNakladnoyPrintLayout(
  template: BulkExportTemplateDef,
  preview: NakladnoyPreviewResponse
): NakladnoyPrintLayoutProfile {
  const cols = maxGridCols(preview);

  if (template.downloadKind === "register") {
    return {
      id: "register",
      label: "Реестр",
      orientation: cols > 9 ? "landscape" : "portrait",
      tableFontPx: cols > 12 ? 8 : 9,
      fitTableToPage: true,
      pageBreakPerSheet: preview.pages.length > 1
    };
  }

  if (template.warehouseLayout === "wh-xprinter") {
    return {
      id: "receipt-80mm",
      label: "X-Printer 80мм",
      orientation: "portrait",
      tableFontPx: 8,
      fitTableToPage: true,
      pageBreakPerSheet: false,
      narrowReceipt: true
    };
  }

  if (template.id.startsWith("inv-2.1")) {
    return {
      id: "invoice-21",
      label: "Накладные 2.1.x",
      orientation: "landscape",
      tableFontPx: cols > 14 ? 6 : 7,
      fitTableToPage: true,
      pageBreakPerSheet: preview.pages.length > 1
    };
  }

  if (template.id === "inv-vat" || template.id === "inv-macro") {
    return {
      id: "invoice-formal",
      label: template.label,
      orientation: cols > 10 ? "landscape" : "portrait",
      tableFontPx: 8,
      fitTableToPage: true,
      pageBreakPerSheet: preview.pages.length > 1
    };
  }

  if (template.expeditorLoadingLayout === "ex-5.2.0" || hasStructured520(preview)) {
    return {
      id: "loading-520",
      label: "Загруз 5.2.0",
      orientation: "portrait",
      tableFontPx: 9,
      fitTableToPage: true,
      pageBreakPerSheet: false
    };
  }

  if (
    template.expeditorLoadingLayout &&
    MATRIX_LAYOUTS.has(template.expeditorLoadingLayout)
  ) {
    return {
      id: "matrix-agents",
      label: "Матрица агентов",
      orientation: "landscape",
      tableFontPx: cols > 18 ? 5 : cols > 12 ? 6 : 7,
      fitTableToPage: true,
      pageBreakPerSheet: preview.pages.length > 1
    };
  }

  if (template.warehouseLayout && WIDE_WAREHOUSE.has(template.warehouseLayout)) {
    return {
      id: "warehouse-wide",
      label: "Загруз зав.склада (широкий)",
      orientation: cols > 11 ? "landscape" : "portrait",
      tableFontPx: 8,
      fitTableToPage: true,
      pageBreakPerSheet: preview.pages.length > 1
    };
  }

  if (cols > 16) {
    return {
      id: "auto-wide",
      label: "Широкая таблица",
      orientation: "landscape",
      tableFontPx: cols > 20 ? 5 : 6,
      fitTableToPage: true,
      pageBreakPerSheet: preview.pages.length > 1
    };
  }

  if (cols > 10) {
    return {
      id: "auto-medium",
      label: "Средняя таблица",
      orientation: "landscape",
      tableFontPx: 8,
      fitTableToPage: true,
      pageBreakPerSheet: preview.pages.length > 1
    };
  }

  return {
    id: "default",
    label: "Стандарт",
    orientation: "portrait",
    tableFontPx: 9,
    fitTableToPage: true,
    pageBreakPerSheet: preview.pages.length > 1
  };
}
