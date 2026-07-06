import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { invalidateStock } from "../../lib/redis-cache";
import { logger } from "../../config/logger";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { applyStockAdjustmentInTx, type StockAdjustmentInput } from "./stock.service";

const wcLog = logger.child({ module: "warehouse_correction" });

const CORRECTION_KINDS = ["correction"] as const;
export type WarehouseCorrectionKind = (typeof CORRECTION_KINDS)[number];

export type WarehouseCorrectionListRow = {
  id: number;
  occurred_at: string;
  created_at: string;
  kind: string;
  warehouse_id: number;
  warehouse_name: string;
  created_by_name: string | null;
  total_qty_delta: string;
  total_volume_m3: string;
  total_amount: string;
  currency: string;
  comment: string | null;
  line_count: number;
  price_type: string | null;
};

export type CorrectionWorkspaceRow = {
  product_id: number;
  sku: string;
  name: string;
  unit: string;
  qty: string;
  reserved_qty: string;
  available_qty: string;
  price: string | null;
  currency: string | null;
};

export function parseOccurredAt(raw: string | undefined | null): Date {
  if (!raw || !raw.trim()) return new Date();
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export async function listDistinctPriceTypesForTenant(tenantId: number): Promise<string[]> {
  const rows = await prisma.productPrice.findMany({
    where: { tenant_id: tenantId },
    select: { price_type: true },
    distinct: ["price_type"],
    orderBy: { price_type: "asc" }
  });
  const types = rows.map((r) => r.price_type);
  wcLog.debug(
    { op: "price_types_distinct", tenantId, count: types.length },
    "warehouse_correction price types listed"
  );
  return types;
}

export async function listWarehouseCorrections(
  tenantId: number,
  opts: {
    warehouse_id?: number;
    kind?: string;
    q?: string;
    page: number;
    limit: number;
  }
): Promise<{ data: WarehouseCorrectionListRow[]; total: number }> {
  const page = Math.max(1, opts.page);
  const limit = Math.min(200, Math.max(1, opts.limit));
  const skip = (page - 1) * limit;

  const where: Prisma.WarehouseCorrectionWhereInput = { tenant_id: tenantId };
  if (opts.warehouse_id != null && opts.warehouse_id > 0) {
    where.warehouse_id = opts.warehouse_id;
  }
  if (opts.kind && CORRECTION_KINDS.includes(opts.kind as WarehouseCorrectionKind)) {
    where.kind = opts.kind;
  }
  const q = opts.q?.trim().slice(0, 200);
  if (q) {
    where.OR = [
      { comment: { contains: q, mode: "insensitive" } },
      { warehouse: { name: { contains: q, mode: "insensitive" } } },
      { created_by: { name: { contains: q, mode: "insensitive" } } }
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.warehouseCorrection.count({ where }),
    prisma.warehouseCorrection.findMany({
      where,
      skip,
      take: limit,
      orderBy: { created_at: "desc" },
      include: {
        warehouse: { select: { name: true } },
        created_by: { select: { name: true, first_name: true, last_name: true } }
      }
    })
  ]);

  wcLog.debug(
    {
      op: "journal_list",
      tenantId,
      warehouse_id: opts.warehouse_id ?? null,
      kind: opts.kind ?? null,
      hasSearch: Boolean(q),
      page,
      limit,
      total,
      returned: rows.length
    },
    "warehouse_correction journal list"
  );

  const data: WarehouseCorrectionListRow[] = rows.map((r) => {
    const u = r.created_by;
    const createdByName =
      u == null
        ? null
        : [u.last_name, u.first_name].filter(Boolean).join(" ").trim() || u.name;
    return {
      id: r.id,
      occurred_at: r.occurred_at.toISOString(),
      created_at: r.created_at.toISOString(),
      kind: r.kind,
      warehouse_id: r.warehouse_id,
      warehouse_name: r.warehouse.name,
      created_by_name: createdByName,
      total_qty_delta: r.total_qty_delta.toString(),
      total_volume_m3: r.total_volume_m3.toString(),
      total_amount: r.total_amount.toString(),
      currency: r.currency,
      comment: r.comment,
      line_count: r.line_count,
      price_type: r.price_type
    };
  });

  return { data, total };
}

export type CorrectionWorkspaceScope =
  | { kind: "catalog_group"; id: number }
  | { kind: "category"; id: number };

export async function listCorrectionWorkspaceRows(
  tenantId: number,
  warehouseId: number,
  scope: CorrectionWorkspaceScope,
  priceType: string | null
): Promise<CorrectionWorkspaceRow[]> {
  const usePerf = typeof performance !== "undefined";
  const t0 = usePerf ? performance.now() : Date.now();
  const wh = await prisma.warehouse.findFirst({
    where: { id: warehouseId, tenant_id: tenantId }
  });
  if (!wh) throw new Error("BAD_WAREHOUSE");

  const productWhere: Prisma.ProductWhereInput = {
    tenant_id: tenantId,
    is_active: true
  };
  if (scope.kind === "catalog_group") {
    productWhere.product_group_id = scope.id;
  } else {
    productWhere.category_id = scope.id;
  }

  type Row = {
    id: number;
    sku: string;
    name: string;
    unit: string;
    stock: { qty: Prisma.Decimal; reserved_qty: Prisma.Decimal }[];
    prices?: { price: Prisma.Decimal; currency: string }[];
  };

  const products = (await prisma.product.findMany({
    where: productWhere,
    orderBy: [{ sort_order: "asc" }, { name: "asc" }, { id: "asc" }],
    include: {
      stock: {
        where: { tenant_id: tenantId, warehouse_id: warehouseId }
      },
      ...(priceType
        ? {
            prices: {
              where: { tenant_id: tenantId, price_type: priceType }
            }
          }
        : {})
    }
  })) as Row[];

  const durationMs = (usePerf ? performance.now() : Date.now()) - t0;
  wcLog.info(
    {
      op: "workspace_load",
      tenantId,
      warehouseId,
      warehouseName: wh.name,
      scopeKind: scope.kind,
      scopeId: scope.id,
      priceType: priceType ?? null,
      rowCount: products.length,
      durationMs: Math.round(durationMs * 100) / 100
    },
    "warehouse_correction workspace loaded"
  );

  return products.map((p) => {
    const st = p.stock[0];
    const qty = st?.qty ?? new Prisma.Decimal(0);
    const resRaw = st?.reserved_qty ?? new Prisma.Decimal(0);
    const res = resRaw.lt(0) ? new Prisma.Decimal(0) : resRaw;
    const avail = qty.sub(res);
    const priceRow = priceType ? p.prices?.[0] : undefined;
    return {
      product_id: p.id,
      sku: p.sku,
      name: p.name,
      unit: p.unit,
      qty: qty.toString(),
      reserved_qty: res.toString(),
      available_qty: avail.toString(),
      price: priceRow?.price != null ? priceRow.price.toString() : null,
      currency: priceRow?.currency ?? null
    };
  });
}
