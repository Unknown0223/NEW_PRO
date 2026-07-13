/**
 * Nakladnoy PDF/XLSX generation and bulk export.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/database";
import {
  buildNakladnoyXlsx,
  type NakladnoyBuildOptions,
  DEFAULT_NAKLADNOY_BUILD_OPTIONS
} from "../order-nakladnoy-xlsx";
import { buildWarehouseLoadXlsx } from "../warehouse-templates/build-warehouse-load-xlsx";
import { warehouseExportOptionsForLayout } from "../warehouse-templates/warehouse-export-options";
import { buildExpeditorLoadingXlsx } from "../warehouse-templates/build-expeditor-loading-xlsx";
import { buildExpeditorLoading520Document } from "../warehouse-templates/expeditor-loading-520-document";
import { buildExpeditorLoading520XlsxFromDocument } from "../warehouse-templates/expeditor-loading-520-xlsx";
import { buildExpeditorLoading520Preview } from "../warehouse-templates/expeditor-loading-520-preview";
import type { NakladnoyPreviewResponse } from "../warehouse-templates/nakladnoy-preview.types";
import { workbookBufferToNakladnoyPreview } from "../warehouse-templates/nakladnoy-xlsx-preview";
import {
  isExpeditorLoadingLayoutId,
  expeditorLoadingDownloadFilename,
  getExpeditorLoadingLayoutDef,
  type ExpeditorLoadingLayoutId
} from "../warehouse-templates/expeditor-loading-template-ids";
import { buildWarehouseAggregateContext } from "../warehouse-templates/warehouse-template-shared";
import {
  isWarehouseLayoutId,
  warehouseLayoutDownloadFilename,
  type WarehouseLayoutId
} from "../warehouse-templates/warehouse-template-ids";
import { buildNakladnoyPdf } from "../order-nakladnoy-pdf";
import {
  loadBulkNakladnoyOrderPayloads,
  mapOrderToNakladnoyPayload,
  NAKLADNOY_TEMPLATE_IDS,
  type BulkNakladnoyFileResult,
  type NakladnoyTemplateId
} from "./order.nakladnoy.payload";

export { NAKLADNOY_TEMPLATE_IDS, type NakladnoyTemplateId, type BulkNakladnoyFileResult };
export { mapOrderToNakladnoyPayload, loadBulkNakladnoyOrderPayloads };


export function nakladnoyBuildOptionsFromApi(parts: {
  code_column?: "sku" | "barcode";
  separate_sheets?: boolean;
  group_by?: NakladnoyBuildOptions["groupBy"];
  warehouse_layout?: string | null;
  warehouse_export_options?: unknown;
}): NakladnoyBuildOptions {
  const opts: NakladnoyBuildOptions = {
    codeColumn: parts.code_column ?? DEFAULT_NAKLADNOY_BUILD_OPTIONS.codeColumn,
    separateSheets: parts.separate_sheets ?? DEFAULT_NAKLADNOY_BUILD_OPTIONS.separateSheets,
    groupBy: parts.group_by ?? DEFAULT_NAKLADNOY_BUILD_OPTIONS.groupBy
  };
  const layout = parts.warehouse_layout;
  if (layout) {
    const wh = warehouseExportOptionsForLayout(layout, parts.warehouse_export_options);
    if (wh) opts.warehouseExport = wh;
  }
  return opts;
}

export type BulkNakladnoyPreviewParams = {
  template: string;
  buildOptions?: NakladnoyBuildOptions;
  warehouseLayout?: string | null;
  expeditorLoadingLayout?: string | null;
  label: string;
};

export async function requestBulkOrderNakladnoyPreview(
  tenantId: number,
  orderIds: number[],
  params: BulkNakladnoyPreviewParams
): Promise<NakladnoyPreviewResponse> {
  const buildOptions = params.buildOptions ?? DEFAULT_NAKLADNOY_BUILD_OPTIONS;
  const { expeditorLoadingLayout, warehouseLayout, template, label } = params;

  if (expeditorLoadingLayout === "ex-5.2.0") {
    const { ordered } = await loadBulkNakladnoyOrderPayloads(tenantId, orderIds);
    const ctx = buildWarehouseAggregateContext(ordered, buildOptions);
    const def = getExpeditorLoadingLayoutDef("ex-5.2.0");
    const doc = buildExpeditorLoading520Preview(ctx, buildOptions, def.versionLabel);
    return {
      label,
      filename: doc.filename,
      pages: [{ sheetName: "5.2.0", kind: "structured-520", loading520: doc }]
    };
  }

  if (expeditorLoadingLayout && isExpeditorLoadingLayoutId(expeditorLoadingLayout)) {
    const file = await requestBulkOrderNakladnoyExpeditorLoading(
      tenantId,
      orderIds,
      expeditorLoadingLayout,
      buildOptions
    );
    return workbookBufferToNakladnoyPreview(file.buffer, {
      label,
      filename: file.filename
    });
  }

  const file = await requestBulkOrderNakladnoy(
    tenantId,
    orderIds,
    template,
    buildOptions,
    "xlsx",
    warehouseLayout ?? null,
    null
  );

  if (file.format === "pdf") {
    throw new Error("PREVIEW_PDF_NOT_SUPPORTED");
  }

  return workbookBufferToNakladnoyPreview(file.buffer, {
    label,
    filename: file.filename
  });
}

/** «Загруз зав.склада» shablonlari — preview bilan bir xil Excel buffer */
export async function requestBulkOrderNakladnoyExpeditorLoading(
  tenantId: number,
  orderIds: number[],
  layoutId: ExpeditorLoadingLayoutId,
  buildOptions: NakladnoyBuildOptions = DEFAULT_NAKLADNOY_BUILD_OPTIONS
): Promise<BulkNakladnoyFileResult> {
  if (!isExpeditorLoadingLayoutId(layoutId)) {
    throw new Error("INVALID_EXPEDITOR_LOADING_LAYOUT");
  }
  if (layoutId === "ex-5.2.0") {
    return requestBulkOrderNakladnoyLoading520(tenantId, orderIds, buildOptions);
  }
  const { ids, ordered } = await loadBulkNakladnoyOrderPayloads(tenantId, orderIds);
  const buffer = await buildExpeditorLoadingXlsx(layoutId, ordered, buildOptions);
  return {
    buffer,
    filename: expeditorLoadingDownloadFilename(layoutId),
    template: "nakladnoy_expeditor",
    format: "xlsx",
    order_ids: ids
  };
}

/** 5.2.0 — preview hujjatidan Excel (virtual → fayl) */
export async function requestBulkOrderNakladnoyLoading520(
  tenantId: number,
  orderIds: number[],
  buildOptions: NakladnoyBuildOptions = DEFAULT_NAKLADNOY_BUILD_OPTIONS
): Promise<BulkNakladnoyFileResult> {
  const { ids, ordered } = await loadBulkNakladnoyOrderPayloads(tenantId, orderIds);
  const def = getExpeditorLoadingLayoutDef("ex-5.2.0");
  const ctx = buildWarehouseAggregateContext(ordered, buildOptions);
  const doc = buildExpeditorLoading520Document(ctx, buildOptions, def.versionLabel);
  const buffer = await buildExpeditorLoading520XlsxFromDocument(doc);
  return {
    buffer,
    filename: doc.filename,
    template: "nakladnoy_expeditor",
    format: "xlsx",
    order_ids: ids
  };
}

export async function requestBulkOrderNakladnoy(
  tenantId: number,
  orderIds: number[],
  template: string,
  buildOptions: NakladnoyBuildOptions = DEFAULT_NAKLADNOY_BUILD_OPTIONS,
  format: "xlsx" | "pdf" = "xlsx",
  warehouseLayout?: string | null,
  expeditorLoadingLayout?: string | null
): Promise<BulkNakladnoyFileResult> {
  if (!NAKLADNOY_TEMPLATE_IDS.includes(template as NakladnoyTemplateId)) {
    throw new Error("INVALID_NAKLADNOY_TEMPLATE");
  }
  const tid = template as NakladnoyTemplateId;
  let layoutId: WarehouseLayoutId | null = null;
  let expLayoutId: ExpeditorLoadingLayoutId | null = null;
  if (warehouseLayout != null && warehouseLayout !== "") {
    if (!isWarehouseLayoutId(warehouseLayout)) {
      throw new Error("INVALID_WAREHOUSE_LAYOUT");
    }
    layoutId = warehouseLayout;
    if (tid !== "nakladnoy_warehouse") {
      throw new Error("INVALID_WAREHOUSE_LAYOUT");
    }
    if (format === "pdf") {
      throw new Error("WAREHOUSE_LAYOUT_XLSX_ONLY");
    }
  }
  if (expeditorLoadingLayout != null && expeditorLoadingLayout !== "") {
    if (!isExpeditorLoadingLayoutId(expeditorLoadingLayout)) {
      throw new Error("INVALID_EXPEDITOR_LOADING_LAYOUT");
    }
    expLayoutId = expeditorLoadingLayout;
    if (layoutId != null) {
      throw new Error("INVALID_EXPEDITOR_LOADING_LAYOUT");
    }
    if (format === "pdf") {
      throw new Error("EXPEDITOR_LOADING_LAYOUT_XLSX_ONLY");
    }
  }
  const { ids, ordered } = await loadBulkNakladnoyOrderPayloads(tenantId, orderIds);

  const buffer =
    layoutId != null
      ? await buildWarehouseLoadXlsx(layoutId, ordered, buildOptions)
      : expLayoutId != null
        ? await buildExpeditorLoadingXlsx(expLayoutId, ordered, buildOptions)
        : format === "pdf"
          ? await buildNakladnoyPdf(tid, ordered)
          : await buildNakladnoyXlsx(tid, ordered, buildOptions);
  const day = new Date().toISOString().slice(0, 10);
  const filename =
    layoutId != null
      ? warehouseLayoutDownloadFilename(layoutId)
      : expLayoutId != null
        ? expeditorLoadingDownloadFilename(expLayoutId)
        : tid === "nakladnoy_warehouse"
          ? `zagruz_zav_sklda_5_1_8_${day}.${format}`
          : `nakladnye_2_1_0_${day}.${format}`;

  return {
    buffer,
    filename,
    template: tid,
    format,
    order_ids: ids
  };
}



