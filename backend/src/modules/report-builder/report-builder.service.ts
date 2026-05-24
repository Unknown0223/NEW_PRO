/**
 * Domain: Report builder (dinamik dataset, preview, export, saved configs).
 * Boundary: route → Zod; servis → `report-builder.dataset` / `query` / `saved`.
 * Bog‘liq: `reports.route.ts`, `contracts/report-builder.schemas.ts`, `docs/domain-boundary.md`.
 */
import * as XLSX from "xlsx";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { ReportActor } from "../reports/client-sales-4-report.service";
import { ORDER_STATUSES, ORDER_TYPE_LABELS, ORDER_TYPES } from "../orders/order-status";
import { listDistinctPriceTypesForTenant } from "../reference/reference.service";
import { referencesWithResolvedTerritoryNodes } from "../tenant-settings/tenant-settings.service";
import { getReportBuilderMetadata } from "./report-builder.metadata";
import { runReportBuilderDataset } from "./report-builder.dataset";
import { buildMatrixView, runReportBuilderPreview } from "./report-builder.query";
import { mergeTerritoryFilterOptions, type TerritoryRow } from "../reports/territory-nodes";
import * as saved from "./report-builder.saved";
import type {
  ReportBuilderConfigPayload,
  ReportBuilderDatasetResponse,
  ReportBuilderFilterOptionsResponse,
  ReportBuilderMatrixView,
  ReportBuilderPreviewResult
} from "./report-builder.types";
import { ReportBuilderHttpError } from "./report-builder.validate";
import type { ReportBuilderDatasetRequest } from "./report-builder.types";

export type ReportBuilderPreviewResponse = ReportBuilderPreviewResult & {
  matrix?: ReportBuilderMatrixView;
};

function jsonSafe(v: unknown): unknown {
  if (typeof v === "bigint") return v.toString();
  if (v instanceof Prisma.Decimal) return v.toString();
  if (v instanceof Date) return v.toISOString();
  return v;
}

function serializeRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const o: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(row)) {
      o[k] = jsonSafe(val);
    }
    return o;
  });
}

export async function getReportBuilderFilterOptions(
  tenantId: number,
  actor?: ReportActor
): Promise<ReportBuilderFilterOptionsResponse> {
  const whereAgent: Prisma.UserWhereInput =
    actor?.role === "agent" && actor.userId
      ? { tenant_id: tenantId, id: actor.userId, is_active: true }
      : actor?.role === "supervisor" && actor.userId
        ? { tenant_id: tenantId, role: "agent", supervisor_user_id: actor.userId, is_active: true }
        : { tenant_id: tenantId, role: "agent", is_active: true };

  const statuses = ORDER_STATUSES.map((id) => ({
    id,
    label:
      ({
        new: "Новый",
        confirmed: "Подтверждён",
        picking: "Комплектация",
        delivering: "Отгружен",
        delivered: "Доставлен",
        returned: "Возврат",
        cancelled: "Отменён"
      }[id] ?? id)
  }));

  const order_types = ORDER_TYPES.map((id) => ({
    id,
    label: ORDER_TYPE_LABELS[id as keyof typeof ORDER_TYPE_LABELS] ?? id
  }));

  const [
    agents,
    warehouses,
    products,
    product_categories,
    product_groups,
    brands,
    expeditors,
    supervisors,
    trade_directions,
    kpi_groups,
    clients,
    catalogPriceTypes,
    branchRows,
    paymentRows,
    clientCategoryRows,
    tenantRow,
    territoryRows
  ] = await Promise.all([
    prisma.user.findMany({
      where: whereAgent,
      select: { id: true, name: true, code: true, supervisor_user_id: true, trade_direction_id: true, branch: true },
      orderBy: { name: "asc" }
    }),
    prisma.warehouse.findMany({
      where: { tenant_id: tenantId, is_active: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" }
    }),
    prisma.product.findMany({
      where: { tenant_id: tenantId, is_active: true },
      select: { id: true, name: true, sku: true, category_id: true, product_group_id: true, brand_id: true },
      orderBy: { name: "asc" },
      take: 1500
    }),
    prisma.productCategory.findMany({
      where: { tenant_id: tenantId, is_active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 500
    }),
    prisma.productCatalogGroup.findMany({
      where: { tenant_id: tenantId, is_active: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
      take: 300
    }),
    prisma.productBrand.findMany({
      where: { tenant_id: tenantId, is_active: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
      take: 300
    }),
    prisma.user.findMany({
      where: { tenant_id: tenantId, role: "expeditor", is_active: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" }
    }),
    prisma.user.findMany({
      where: { tenant_id: tenantId, role: "supervisor", is_active: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" }
    }),
    prisma.tradeDirection.findMany({
      where: { tenant_id: tenantId, is_active: true },
      select: { id: true, name: true, code: true },
      orderBy: [{ sort_order: "asc" }, { name: "asc" }]
    }),
    prisma.kpiGroup.findMany({
      where: { tenant_id: tenantId, is_active: true },
      select: { id: true, name: true, code: true },
      orderBy: [{ sort_order: "asc" }, { name: "asc" }]
    }),
    prisma.client.findMany({
      where: { tenant_id: tenantId, is_active: true, merged_into_client_id: null },
      select: { id: true, name: true, client_code: true },
      orderBy: { name: "asc" },
      take: 2500
    }),
    listDistinctPriceTypesForTenant(tenantId, "sale"),
    prisma.user.findMany({
      where: {
        tenant_id: tenantId,
        role: "agent",
        is_active: true,
        branch: { not: null }
      },
      select: { branch: true },
      distinct: ["branch"],
      take: 80
    }),
    prisma.$queryRaw<Array<{ ref: string }>>`
      SELECT DISTINCT btrim(o.payment_method_ref) AS ref
      FROM orders o
      WHERE o.tenant_id = ${tenantId}
        AND o.payment_method_ref IS NOT NULL
        AND btrim(o.payment_method_ref) <> ''
      ORDER BY 1
      LIMIT 200
    `,
    prisma.client.findMany({
      where: {
        tenant_id: tenantId,
        is_active: true,
        merged_into_client_id: null,
        category: { not: null }
      },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
      take: 400
    }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true }
    }),
    prisma.client.findMany({
      where: {
        tenant_id: tenantId,
        is_active: true,
        merged_into_client_id: null
      },
      select: { zone: true, region: true, city: true, district: true },
      take: 5000
    })
  ]);

  const payment_methods = paymentRows.map((r) => ({ id: r.ref, label: r.ref }));
  const price_types = catalogPriceTypes.map((id) => ({ id, label: id }));
  const branches = branchRows
    .map((r) => r.branch?.trim())
    .filter((x): x is string => Boolean(x))
    .map((id) => ({ id, label: id }));

  const client_categories = clientCategoryRows
    .map((r) => r.category?.trim())
    .filter((x): x is string => Boolean(x))
    .map((id) => ({ id, label: id }));
  const refsRaw = ((tenantRow?.settings as { references?: Record<string, unknown> } | null)?.references ?? {}) as Record<
    string,
    unknown
  >;
  const refs = referencesWithResolvedTerritoryNodes(refsRaw);
  const territoryMerged = mergeTerritoryFilterOptions(
    refs,
    territoryRows.map((r) => ({
      // Robust fallback for tenants where one of zone/region/city isn't populated.
      t1: (r.zone ?? "").trim() || (r.region ?? "").trim() || null,
      t2: (r.region ?? "").trim() || (r.city ?? "").trim() || null,
      t3: (r.city ?? "").trim() || (r.district ?? "").trim() || null
    })) satisfies TerritoryRow[]
  );
  const territory_level_1 = territoryMerged.territory_1.map((id) => ({ id, label: id }));
  const territory_level_2 = territoryMerged.territory_2.map((id) => ({ id, label: id }));
  const territory_level_3 = territoryMerged.territory_3.map((id) => ({ id, label: id }));

  return {
    agents,
    statuses,
    order_types,
    warehouses,
    products,
    product_categories,
    product_groups,
    brands,
    expeditors,
    supervisors,
    trade_directions,
    kpi_groups,
    clients: clients.map((c) => ({ id: c.id, name: c.name, code: c.client_code })),
    payment_methods,
    price_types,
    branches,
    client_categories,
    territory_level_1,
    territory_level_2,
    territory_level_3,
    territory_2_by_1: territoryMerged.territory_2_by_1,
    territory_3_by_2: territoryMerged.territory_3_by_2
  };
}

export function reportBuilderMetadata() {
  return getReportBuilderMetadata();
}

export async function reportBuilderDataset(
  tenantId: number,
  filters: ReportBuilderDatasetRequest,
  actor?: ReportActor
): Promise<ReportBuilderDatasetResponse> {
  const raw = await runReportBuilderDataset(tenantId, filters, actor);
  return {
    ...raw,
    rows: serializeRows(raw.rows)
  };
}

export async function reportBuilderPreview(
  tenantId: number,
  config: ReportBuilderConfigPayload,
  actor?: ReportActor
): Promise<ReportBuilderPreviewResponse> {
  const raw = await runReportBuilderPreview(tenantId, config, actor, {});
  const matrix = buildMatrixView(config, raw);
  const rows = serializeRows(raw.rows);
  return {
    columns: raw.columns,
    rows,
    truncated: raw.truncated,
    totalRowCount: raw.totalRowCount,
    matrix: matrix.enabled ? matrix : undefined
  };
}

export async function reportBuilderExportXlsx(
  tenantId: number,
  config: ReportBuilderConfigPayload,
  actor?: ReportActor
): Promise<{ buffer: Buffer; truncated: boolean; totalRowCount: number }> {
  const raw = await runReportBuilderPreview(tenantId, config, actor, { exportMode: true });
  const rows = serializeRows(raw.rows);
  const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "report");
  const buffer = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  return { buffer, truncated: raw.truncated, totalRowCount: raw.totalRowCount };
}

export const reportBuilderSaved = {
  list: saved.listReportBuilderSaved,
  get: saved.getReportBuilderSaved,
  create: saved.createReportBuilderSaved,
  update: saved.updateReportBuilderSaved,
  delete: saved.deleteReportBuilderSaved
};

export type { ReportBuilderConfigPayload, ReportBuilderDatasetResponse };
