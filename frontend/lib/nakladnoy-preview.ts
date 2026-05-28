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
};

export type NakladnoyPreviewPage = {
  sheetName: string;
  kind: "structured-520" | "grid";
  loading520?: ExpeditorLoading520Preview;
  grid?: {
    colCount: number;
    rows: NakladnoyPreviewCell[][];
  };
};

export type NakladnoyPreviewResponse = {
  label: string;
  filename: string;
  pages: NakladnoyPreviewPage[];
};

export async function fetchNakladnoyPreview(args: {
  tenantSlug: string;
  orderIds: number[];
  template: BulkExportTemplateDef;
  prefs: NakladnoyExportPrefs;
  warehouseExportOptions?: Record<string, boolean>;
}): Promise<NakladnoyPreviewResponse> {
  const { tenantSlug, orderIds, template, prefs, warehouseExportOptions } = args;
  if (!template.apiTemplate) {
    throw new Error("Shablon API bilan bog‘lanmagan.");
  }
  if (orderIds.length === 0) {
    throw new Error("Zakaz tanlanmagan.");
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
    throw new Error(getUserFacingError(e, "Ko‘rinishni yuklab bo‘lmadi."));
  }
}
