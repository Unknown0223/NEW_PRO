import { api } from "@/lib/api";
import type { BulkExportTemplateDef } from "@/lib/bulk-export-templates";
import type { ExpeditorLoading520Preview } from "@/lib/expeditor-loading-520-preview";
import type { NakladnoyExportPrefs } from "@/lib/order-nakladnoy";
import { nakladnoyPrefsToApiBody } from "@/lib/order-nakladnoy";
import { getUserFacingError } from "@/lib/error-utils";

export type NakladnoyPreviewCell = {
  v: string;
  bold?: boolean;
  bg?: string;
  align?: "left" | "center" | "right";
  skip?: boolean;
  colSpan?: number;
  rowSpan?: number;
  /** Excelda katakda chegara (border) yo‘q. */
  noBorder?: boolean;
  /** Excel wrapText (sahifalangan varaqlarda). */
  wrap?: boolean;
  /** Shrift o‘lchami, pt (sahifalangan varaqlarda). */
  fs?: number;
};

export type NakladnoyPreviewPage = {
  sheetName: string;
  kind: "structured-520" | "grid";
  loading520?: ExpeditorLoading520Preview;
  grid?: {
    colCount: number;
    rows: NakladnoyPreviewCell[][];
    /** Shu indeksli qatordan keyin yangi qog‘oz (0-based). Bor bo‘lsa — varaq qog‘ozlarga bo‘lingan. */
    pageBreakAfterRows?: number[];
    colWidthsPx?: number[];
    rowHeightsPt?: number[];
  };
};

export type NakladnoyPreviewResponse = {
  label: string;
  filename: string;
  pages: NakladnoyPreviewPage[];
};

export type NakladnoyPaperChunk = {
  /** Varaqdagi birinchi qator indeksi (0-based). */
  start: number;
  rows: NakladnoyPreviewCell[][];
  rowHeightsPt?: number[];
};

/** Grid qatorlarini Excel sahifa bo‘linishlari bo‘yicha qog‘ozlarga ajratadi. */
export function splitNakladnoyGridIntoPapers(
  grid: NonNullable<NakladnoyPreviewPage["grid"]>
): NakladnoyPaperChunk[] {
  const total = grid.rows.length;
  const cuts = [...new Set(grid.pageBreakAfterRows ?? [])]
    .filter((i) => Number.isInteger(i) && i >= 0 && i < total - 1)
    .sort((a, b) => a - b);
  const chunks: NakladnoyPaperChunk[] = [];
  let start = 0;
  for (const cut of [...cuts, total - 1]) {
    const end = cut + 1;
    if (end <= start) continue;
    chunks.push({
      start,
      rows: grid.rows.slice(start, end),
      rowHeightsPt: grid.rowHeightsPt?.slice(start, end)
    });
    start = end;
  }
  return chunks;
}

export async function fetchNakladnoyPreview(args: {
  tenantSlug: string;
  orderIds: number[];
  template: BulkExportTemplateDef;
  prefs: NakladnoyExportPrefs;
  warehouseExportOptions?: Record<string, boolean>;
}): Promise<NakladnoyPreviewResponse> {
  const { tenantSlug, orderIds, template, prefs, warehouseExportOptions } = args;
  if (!template.apiTemplate) {
    throw new Error("Шаблон не связан с API.");
  }
  if (orderIds.length === 0) {
    throw new Error("Заказ не выбран.");
  }
  try {
    const { data } = await api.post<NakladnoyPreviewResponse>(
      `/api/${tenantSlug}/orders/bulk/nakladnoy/preview`,
      {
        order_ids: orderIds,
        template: template.apiTemplate,
        label: template.label,
        ...(template.warehouseLayout ? { warehouse_layout: template.warehouseLayout } : {}),
        ...(template.expeditorLoadingLayout
          ? { expeditor_loading_layout: template.expeditorLoadingLayout }
          : {}),
        ...nakladnoyPrefsToApiBody(prefs),
        ...(warehouseExportOptions
          ? { warehouse_export_options: warehouseExportOptions }
          : {})
      }
    );
    return data;
  } catch (e: unknown) {
    throw new Error(getUserFacingError(e, "Не удалось загрузить предпросмотр."));
  }
}
