import ExcelJS from "exceljs";
import XLSX from "xlsx";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getRedisForApp, invalidateStock } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";

import type {
  StockBalanceByWhRow,
  StockBalanceQtyMode,
  StockBalanceSummaryRow,
  StockBalanceTotals,
  StockBalanceValuationRow,
  WarehouseStockPurpose
} from "./stock.types";

export type BalanceFilterOpts = {
  purpose: WarehouseStockPurpose;
  warehouse_id?: number | null;
  category_id?: number | null;
  group_id?: number | null;
  active_only: boolean;
  q: string;
  /** Кол-во: все / только с остатком / нулевые */
  qty_mode: StockBalanceQtyMode;
};

type AggRow = {
  product_id: number;
  sku: string;
  name: string;
  qty: Prisma.Decimal;
  reserved: Prisma.Decimal;
  available: Prisma.Decimal;
};

type RawBalanceLine = {
  product_id: number;
  warehouse_id: number;
  qty: Prisma.Decimal;
  reserved_qty: Prisma.Decimal;
  product: {
    sku: string;
    name: string;
    category: { id: number; name: string } | null;
  };
  warehouse: { id: number; name: string };
};

export async function fetchWarehouseIdsForBalances(
  tenantId: number,
  opts: BalanceFilterOpts
): Promise<number[]> {
  const whWhere: Prisma.WarehouseWhereInput = {
    tenant_id: tenantId,
    is_active: true,
    stock_purpose: opts.purpose
  };
  if (opts.warehouse_id != null && Number.isFinite(opts.warehouse_id)) {
    whWhere.id = opts.warehouse_id;
  }
  const warehouses = await prisma.warehouse.findMany({
    where: whWhere,
    select: { id: true }
  });
  return warehouses.map((w) => w.id);
}

export function buildProductWhere(tenantId: number, opts: BalanceFilterOpts): Prisma.ProductWhereInput {
  const productWhere: Prisma.ProductWhereInput = { tenant_id: tenantId };
  if (opts.active_only) {
    productWhere.is_active = true;
  }
  if (opts.category_id != null && Number.isFinite(opts.category_id)) {
    productWhere.category_id = opts.category_id;
  }
  if (opts.group_id != null && Number.isFinite(opts.group_id)) {
    productWhere.product_group_id = opts.group_id;
  }
  const q = opts.q.trim();
  if (q) {
    productWhere.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } }
    ];
  }
  return productWhere;
}

export async function fetchRawBalanceLines(
  tenantId: number,
  opts: BalanceFilterOpts
): Promise<RawBalanceLine[]> {
  const whIds = await fetchWarehouseIdsForBalances(tenantId, opts);
  if (whIds.length === 0) return [];
  const productWhere = buildProductWhere(tenantId, opts);
  const rows = await prisma.stock.findMany({
    where: {
      tenant_id: tenantId,
      warehouse_id: { in: whIds },
      product: productWhere
    },
    select: {
      product_id: true,
      warehouse_id: true,
      qty: true,
      reserved_qty: true,
      product: {
        select: {
          sku: true,
          name: true,
          category: { select: { id: true, name: true } }
        }
      },
      warehouse: { select: { id: true, name: true } }
    }
  });
  return rows as RawBalanceLine[];
}

export function aggregateByProduct(lines: RawBalanceLine[]): AggRow[] {
  const agg = new Map<
    number,
    { sku: string; name: string; qty: Prisma.Decimal; reserved: Prisma.Decimal }
  >();
  for (const s of lines) {
    const cur = agg.get(s.product_id);
    if (!cur) {
      agg.set(s.product_id, {
        sku: s.product.sku,
        name: s.product.name,
        qty: s.qty,
        reserved: s.reserved_qty
      });
    } else {
      cur.qty = cur.qty.plus(s.qty);
      cur.reserved = cur.reserved.plus(s.reserved_qty);
    }
  }
  return [...agg.entries()].map(([product_id, v]) => {
    let available = v.qty.minus(v.reserved);
    if (available.lt(0)) {
      available = new Prisma.Decimal(0);
    }
    return {
      product_id,
      sku: v.sku,
      name: v.name,
      qty: v.qty,
      reserved: v.reserved,
      available
    };
  });
}

export function filterAggByQtyMode(rows: AggRow[], mode: StockBalanceQtyMode): AggRow[] {
  if (mode === "positive") return rows.filter((r) => r.qty.gt(0));
  if (mode === "zero") return rows.filter((r) => !r.qty.gt(0));
  return rows;
}

export function filterWhByQtyMode(rows: ByWhAgg[], mode: StockBalanceQtyMode): ByWhAgg[] {
  if (mode === "positive") return rows.filter((r) => r.qty.gt(0));
  if (mode === "zero") return rows.filter((r) => !r.qty.gt(0));
  return rows;
}

export function sortAggRows(rows: AggRow[], sort: "name_asc" | "name_desc" | "available_desc"): void {
  if (sort === "name_asc") {
    rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  } else if (sort === "name_desc") {
    rows.sort((a, b) => b.name.localeCompare(a.name, undefined, { sensitivity: "base" }));
  } else {
    rows.sort((a, b) => b.available.comparedTo(a.available) || a.name.localeCompare(b.name));
  }
}

export function totalsFromAgg(rows: AggRow[]): StockBalanceTotals {
  let tq = new Prisma.Decimal(0);
  let tr = new Prisma.Decimal(0);
  let ta = new Prisma.Decimal(0);
  for (const r of rows) {
    tq = tq.plus(r.qty);
    tr = tr.plus(r.reserved);
    ta = ta.plus(r.available);
  }
  return {
    qty: tq.toString(),
    reserved_qty: tr.toString(),
    available_qty: ta.toString()
  };
}

type ByWhAgg = {
  warehouse_id: number;
  warehouse_name: string;
  category_id: number | null;
  category_name: string | null;
  product_id: number;
  sku: string;
  name: string;
  qty: Prisma.Decimal;
  reserved: Prisma.Decimal;
  available: Prisma.Decimal;
};

export function linesToByWarehouseRows(lines: RawBalanceLine[]): ByWhAgg[] {
  return lines.map((s) => {
    let available = s.qty.minus(s.reserved_qty);
    if (available.lt(0)) {
      available = new Prisma.Decimal(0);
    }
    return {
      warehouse_id: s.warehouse_id,
      warehouse_name: s.warehouse.name,
      category_id: s.product.category?.id ?? null,
      category_name: s.product.category?.name ?? null,
      product_id: s.product_id,
      sku: s.product.sku,
      name: s.product.name,
      qty: s.qty,
      reserved: s.reserved_qty,
      available
    };
  });
}

export function sortByWhRows(
  rows: ByWhAgg[],
  sort: "name_asc" | "name_desc" | "available_desc"
): void {
  const cmpWh = (a: ByWhAgg, b: ByWhAgg) =>
    a.warehouse_name.localeCompare(b.warehouse_name, undefined, { sensitivity: "base" });
  const cmpCat = (a: ByWhAgg, b: ByWhAgg) =>
    (a.category_name ?? "").localeCompare(b.category_name ?? "", undefined, { sensitivity: "base" });
  const cmpName = (a: ByWhAgg, b: ByWhAgg) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  if (sort === "available_desc") {
    rows.sort(
      (a, b) =>
        b.available.comparedTo(a.available) || cmpWh(a, b) || cmpCat(a, b) || cmpName(a, b)
    );
  } else if (sort === "name_desc") {
    rows.sort((a, b) => cmpName(b, a) || cmpWh(a, b) || cmpCat(a, b));
  } else {
    rows.sort((a, b) => cmpWh(a, b) || cmpCat(a, b) || cmpName(a, b));
  }
}

export function totalsFromByWh(rows: ByWhAgg[]): StockBalanceTotals {
  let tq = new Prisma.Decimal(0);
  let tr = new Prisma.Decimal(0);
  let ta = new Prisma.Decimal(0);
  for (const r of rows) {
    tq = tq.plus(r.qty);
    tr = tr.plus(r.reserved);
    ta = ta.plus(r.available);
  }
  return {
    qty: tq.toString(),
    reserved_qty: tr.toString(),
    available_qty: ta.toString()
  };
}
