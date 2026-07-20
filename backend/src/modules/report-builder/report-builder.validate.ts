import { ORDER_TYPES } from "../orders/order-status";

export class ReportBuilderHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
import {
  REPORT_BUILDER_MAX_COL_FIELDS,
  REPORT_BUILDER_MAX_DIMENSIONS,
  REPORT_BUILDER_MAX_FILTER_IDS,
  REPORT_BUILDER_MAX_ROW_FIELDS,
  DATASET_ORDERS_SALES_LINES
} from "./report-builder.constants";
import { fieldAllowsCol, fieldAllowsRow, isReportBuilderFieldId } from "./report-builder.metadata";
import type {
  ReportBuilderConfigPayload,
  ReportBuilderDateMode,
  ReportBuilderDatasetId,
  ReportBuilderDatasetRequest,
  ReportBuilderExtraFilters
} from "./report-builder.types";

const DATE_MODES = new Set<ReportBuilderDateMode>(["order_date", "shipped_date", "delivered_date", "created_date"]);
const ORDER_TYPE_ALLOW = new Set<string>(ORDER_TYPES as unknown as string[]);

function uniq(ids: string[]): string[] {
  return [...new Set(ids)];
}

function uniqNums(ids: number[]): number[] {
  return [...new Set(ids)];
}

function parseNumFilterArr(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return uniqNums(
    (v as unknown[]).map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
  ).slice(0, REPORT_BUILDER_MAX_FILTER_IDS);
}

function parseStrFilterArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return uniq((v as unknown[]).map((x) => String(x).trim()).filter(Boolean)).slice(0, REPORT_BUILDER_MAX_FILTER_IDS);
}

function parseExtraFilters(b: Record<string, unknown>): ReportBuilderExtraFilters {
  return {
    warehouseIds: parseNumFilterArr(b.warehouseIds),
    productIds: parseNumFilterArr(b.productIds),
    categoryIds: parseNumFilterArr(b.categoryIds),
    productGroupIds: parseNumFilterArr(b.productGroupIds),
    brandIds: parseNumFilterArr(b.brandIds),
    expeditorUserIds: parseNumFilterArr(b.expeditorUserIds),
    supervisorUserIds: parseNumFilterArr(b.supervisorUserIds),
    tradeDirectionIds: parseNumFilterArr(b.tradeDirectionIds),
    kpiGroupIds: parseNumFilterArr(b.kpiGroupIds),
    clientIds: parseNumFilterArr(b.clientIds),
    paymentMethodRefs: parseStrFilterArr(b.paymentMethodRefs),
    priceTypeRefs: parseStrFilterArr(b.priceTypeRefs),
    branchValues: parseStrFilterArr(b.branchValues),
    clientCategoryValues: parseStrFilterArr(b.clientCategoryValues),
    territoryLevel1Values: parseStrFilterArr(b.territoryLevel1Values),
    territoryLevel2Values: parseStrFilterArr(b.territoryLevel2Values),
    territoryLevel3Values: parseStrFilterArr(b.territoryLevel3Values)
  };
}

export function validateReportBuilderConfig(
  body: unknown,
  _opts?: { exportMode?: boolean }
): { ok: true; config: ReportBuilderConfigPayload } | { ok: false; error: string; status: number } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "INVALID_BODY", status: 400 };
  }
  const b = body as Record<string, unknown>;

  const datasetId = String(b.datasetId ?? "").trim() as ReportBuilderDatasetId;
  if (datasetId !== DATASET_ORDERS_SALES_LINES) {
    return { ok: false, error: "UNKNOWN_DATASET", status: 400 };
  }

  const dateMode = String(b.dateMode ?? "order_date").trim() as ReportBuilderDateMode;
  if (!DATE_MODES.has(dateMode)) {
    return { ok: false, error: "INVALID_DATE_MODE", status: 400 };
  }

  const dateFrom = String(b.dateFrom ?? "").trim().slice(0, 10);
  const dateTo = String(b.dateTo ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    return { ok: false, error: "INVALID_DATE_RANGE", status: 400 };
  }
  if (dateFrom > dateTo) {
    return { ok: false, error: "DATE_FROM_AFTER_TO", status: 400 };
  }

  const agentIds = Array.isArray(b.agentIds)
    ? (b.agentIds as unknown[]).map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
    : [];
  const statuses = Array.isArray(b.statuses)
    ? uniq((b.statuses as unknown[]).map((x) => String(x).trim().toLowerCase()).filter(Boolean))
    : [];
  const orderTypes = Array.isArray(b.orderTypes)
    ? uniq((b.orderTypes as unknown[]).map((x) => String(x).trim()).filter((t) => ORDER_TYPE_ALLOW.has(t)))
    : [];

  const extra = parseExtraFilters(b);

  const rowFieldIds = Array.isArray(b.rowFieldIds)
    ? uniq((b.rowFieldIds as unknown[]).map((x) => String(x).trim()).filter(Boolean))
    : [];
  const colFieldIds = Array.isArray(b.colFieldIds)
    ? uniq((b.colFieldIds as unknown[]).map((x) => String(x).trim()).filter(Boolean))
    : [];

  if (rowFieldIds.length > REPORT_BUILDER_MAX_ROW_FIELDS) {
    return { ok: false, error: "TOO_MANY_ROW_FIELDS", status: 400 };
  }
  if (colFieldIds.length > REPORT_BUILDER_MAX_COL_FIELDS) {
    return { ok: false, error: "TOO_MANY_COL_FIELDS", status: 400 };
  }
  if (rowFieldIds.length + colFieldIds.length > REPORT_BUILDER_MAX_DIMENSIONS) {
    return { ok: false, error: "TOO_MANY_DIMENSIONS", status: 400 };
  }

  const allDims = [...rowFieldIds, ...colFieldIds];
  for (const id of allDims) {
    if (!isReportBuilderFieldId(id)) {
      return { ok: false, error: `UNKNOWN_FIELD:${id}`, status: 400 };
    }
    if (rowFieldIds.includes(id) && !fieldAllowsRow(id)) {
      return { ok: false, error: `FIELD_NOT_ALLOWED_ROW:${id}`, status: 400 };
    }
    if (colFieldIds.includes(id) && !fieldAllowsCol(id)) {
      return { ok: false, error: `FIELD_NOT_ALLOWED_COL:${id}`, status: 400 };
    }
  }

  const m = b.metrics;
  const metrics =
    m && typeof m === "object"
      ? {
          amount: Boolean((m as Record<string, unknown>).amount),
          qty: Boolean((m as Record<string, unknown>).qty),
          volume: Boolean((m as Record<string, unknown>).volume),
          akb: Boolean((m as Record<string, unknown>).akb)
        }
      : { amount: true, qty: false, volume: false, akb: false };

  if (!metrics.amount && !metrics.qty && !metrics.volume && !metrics.akb) {
    return { ok: false, error: "NO_METRICS", status: 400 };
  }

  return {
    ok: true,
    config: {
      datasetId,
      dateMode,
      dateFrom,
      dateTo,
      agentIds,
      statuses,
      orderTypes,
      rowFieldIds,
      colFieldIds,
      metrics,
      ...extra
    }
  };
}

/** WebDataRocks `getReport()` / `setReport()` JSON (minimal tekshiruv). */
export function isWdrNativeReportConfig(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return b.dataSource != null && typeof b.dataSource === "object" && b.slice != null && typeof b.slice === "object";
}

export function validateReportBuilderSavedConfigBody(
  body: unknown
):
  | { ok: true; variant: "legacy"; config: ReportBuilderConfigPayload }
  | { ok: true; variant: "wdr"; config: Record<string, unknown> }
  | { ok: false; error: string; status: number } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "INVALID_BODY", status: 400 };
  }
  if (isWdrNativeReportConfig(body)) {
    return { ok: true, variant: "wdr", config: body as Record<string, unknown> };
  }
  const v = validateReportBuilderConfig(body, {});
  if (!v.ok) return v;
  return { ok: true, variant: "legacy", config: v.config };
}

/** POST `/reports/report-builder/dataset` — faqat filtrlar. */
export function validateReportBuilderDatasetRequest(
  body: unknown
): { ok: true; filters: ReportBuilderDatasetRequest } | { ok: false; error: string; status: number } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "INVALID_BODY", status: 400 };
  }
  const b = body as Record<string, unknown>;

  const datasetId = String(b.datasetId ?? "").trim() as ReportBuilderDatasetRequest["datasetId"];
  if (datasetId !== DATASET_ORDERS_SALES_LINES) {
    return { ok: false, error: "UNKNOWN_DATASET", status: 400 };
  }

  const dateMode = String(b.dateMode ?? "order_date").trim() as ReportBuilderDateMode;
  if (!DATE_MODES.has(dateMode)) {
    return { ok: false, error: "INVALID_DATE_MODE", status: 400 };
  }

  const dateFrom = String(b.dateFrom ?? "").trim().slice(0, 10);
  const dateTo = String(b.dateTo ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    return { ok: false, error: "INVALID_DATE_RANGE", status: 400 };
  }
  if (dateFrom > dateTo) {
    return { ok: false, error: "DATE_FROM_AFTER_TO", status: 400 };
  }

  const agentIds = Array.isArray(b.agentIds)
    ? (b.agentIds as unknown[]).map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
    : [];
  const statuses = Array.isArray(b.statuses)
    ? uniq((b.statuses as unknown[]).map((x) => String(x).trim().toLowerCase()).filter(Boolean))
    : [];
  const orderTypes = Array.isArray(b.orderTypes)
    ? uniq((b.orderTypes as unknown[]).map((x) => String(x).trim()).filter((t) => ORDER_TYPE_ALLOW.has(t)))
    : [];

  const extra = parseExtraFilters(b);

  const pageLimitRaw = b.pageLimit != null ? Number(b.pageLimit) : undefined;
  const pageOffsetRaw = b.pageOffset != null ? Number(b.pageOffset) : undefined;
  const pageLimit =
    pageLimitRaw != null && Number.isFinite(pageLimitRaw) && pageLimitRaw > 0
      ? Math.min(Math.floor(pageLimitRaw), 50_000)
      : undefined;
  const pageOffset =
    pageOffsetRaw != null && Number.isFinite(pageOffsetRaw) && pageOffsetRaw >= 0
      ? Math.floor(pageOffsetRaw)
      : undefined;

  return {
    ok: true,
    filters: {
      datasetId,
      dateMode,
      dateFrom,
      dateTo,
      agentIds,
      statuses,
      orderTypes,
      ...extra,
      ...(pageLimit != null ? { pageLimit } : {}),
      ...(pageOffset != null ? { pageOffset } : {})
    }
  };
}
