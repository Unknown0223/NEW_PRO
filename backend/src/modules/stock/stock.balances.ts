import ExcelJS from "exceljs";
import XLSX from "xlsx";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getRedisForApp, invalidateStock } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";

import type {
  StockBalanceByWhRow,
  StockBalanceSummaryRow,
  StockBalanceTotals,
  StockBalanceValuationRow,
  WarehouseStockPurpose
} from "./stock.types";
import {
  type BalanceFilterOpts,
  aggregateByProduct,
  fetchRawBalanceLines,
  filterAggByQtyMode,
  filterWhByQtyMode,
  linesToByWarehouseRows,
  sortAggRows,
  sortByWhRows,
  totalsFromAgg,
  totalsFromByWh
} from "./stock.balances.helpers";

export type StockBalancesListResponse =
  | {
      view: "summary";
      data: StockBalanceSummaryRow[];
      totals: StockBalanceTotals;
      total: number;
      page: number;
      limit: number;
    }
  | {
      view: "valuation";
      data: StockBalanceValuationRow[];
      totals: StockBalanceTotals;
      total: number;
      page: number;
      limit: number;
    }
  | {
      view: "by_warehouse";
      data: StockBalanceByWhRow[];
      totals: StockBalanceTotals;
      total: number;
      page: number;
      limit: number;
    };

/**
 * Остатки: summary (по товару), valuation (+ суммы по типу цены), by_warehouse (строка на склад+товар).
 */
export async function listStockBalances(
  tenantId: number,
  opts: BalanceFilterOpts & {
    view: "summary" | "valuation" | "by_warehouse";
    price_type?: string | null;
    sort: "name_asc" | "name_desc" | "available_desc";
    page: number;
    limit: number;
  }
): Promise<StockBalancesListResponse> {
  const lines = await fetchRawBalanceLines(tenantId, opts);
  const { page, limit, view } = opts;

  if (view === "by_warehouse") {
    let whRows = linesToByWarehouseRows(lines);
    whRows = filterWhByQtyMode(whRows, opts.qty_mode);
    sortByWhRows(whRows, opts.sort);
    const totals = totalsFromByWh(whRows);
    const total = whRows.length;
    const skip = (page - 1) * limit;
    const slice = whRows.slice(skip, skip + limit);
    return {
      view: "by_warehouse",
      data: slice.map((r) => ({
        warehouse_id: r.warehouse_id,
        warehouse_name: r.warehouse_name,
        category_id: r.category_id,
        category_name: r.category_name,
        product_id: r.product_id,
        sku: r.sku,
        name: r.name,
        qty: r.qty.toString(),
        reserved_qty: r.reserved.toString(),
        available_qty: r.available.toString()
      })),
      totals,
      total,
      page,
      limit
    };
  }

  let aggRows = aggregateByProduct(lines);
  aggRows = filterAggByQtyMode(aggRows, opts.qty_mode);
  sortAggRows(aggRows, opts.sort);
  const totalsBase = totalsFromAgg(aggRows);
  const total = aggRows.length;
  const skip = (page - 1) * limit;
  const sliceAgg = aggRows.slice(skip, skip + limit);

  if (view === "valuation") {
    const pt = opts.price_type?.trim();
    if (!pt) {
      throw new Error("PRICE_TYPE_REQUIRED");
    }
    const ids = aggRows.map((r) => r.product_id);
    const prices =
      ids.length === 0
        ? []
        : await prisma.productPrice.findMany({
            where: {
              tenant_id: tenantId,
              price_type: pt,
              product_id: { in: ids }
            },
            select: { product_id: true, price: true, currency: true }
          });
    const pm = new Map(prices.map((p) => [p.product_id, p]));
    let currency = "UZS";
    const withAmounts = aggRows.map((r) => {
      const pr = pm.get(r.product_id);
      const price = pr?.price ?? new Prisma.Decimal(0);
      if (pr?.currency) {
        currency = pr.currency;
      }
      return {
        ...r,
        amount_actual: r.qty.mul(price),
        amount_reserved: r.reserved.mul(price),
        amount_available: r.available.mul(price)
      };
    });
    let ta = new Prisma.Decimal(0);
    let trs = new Prisma.Decimal(0);
    let tav = new Prisma.Decimal(0);
    for (const r of withAmounts) {
      ta = ta.plus(r.amount_actual);
      trs = trs.plus(r.amount_reserved);
      tav = tav.plus(r.amount_available);
    }
    const sliceVal = withAmounts.slice(skip, skip + limit);
    return {
      view: "valuation",
      data: sliceVal.map((r) => ({
        product_id: r.product_id,
        sku: r.sku,
        name: r.name,
        qty: r.qty.toString(),
        reserved_qty: r.reserved.toString(),
        available_qty: r.available.toString(),
        amount_actual: r.amount_actual.toFixed(2),
        amount_reserved: r.amount_reserved.toFixed(2),
        amount_available: r.amount_available.toFixed(2),
        currency
      })),
      totals: {
        ...totalsBase,
        amount_actual: ta.toFixed(2),
        amount_reserved: trs.toFixed(2),
        amount_available: tav.toFixed(2),
        currency
      },
      total,
      page,
      limit
    };
  }

  return {
    view: "summary",
    data: sliceAgg.map((r) => ({
      product_id: r.product_id,
      sku: r.sku,
      name: r.name,
      qty: r.qty.toString(),
      reserved_qty: r.reserved.toString(),
      available_qty: r.available.toString()
    })),
    totals: totalsBase,
    total,
    page,
    limit
  };
}

/** @deprecated используйте listStockBalances с view: "summary" */
export async function listStockBalancesSummary(
  tenantId: number,
  opts: {
    purpose: WarehouseStockPurpose;
    warehouse_id?: number | null;
    category_id?: number | null;
    group_id?: number | null;
    active_only: boolean;
    q: string;
    page: number;
    limit: number;
    sort: "name_asc" | "name_desc" | "available_desc";
  }
): Promise<{ data: StockBalanceSummaryRow[]; total: number; page: number; limit: number }> {
  const r = await listStockBalances(tenantId, { ...opts, view: "summary", qty_mode: "all" });
  return { data: r.data, total: r.total, page: r.page, limit: r.limit };
}

const EXPORT_ROW_CAP = 25_000;

export async function buildStockBalancesExportBuffer(
  tenantId: number,
  opts: BalanceFilterOpts & {
    view: "summary" | "valuation" | "by_warehouse";
    price_type?: string | null;
    sort: "name_asc" | "name_desc" | "available_desc";
  }
): Promise<Buffer> {
  const res = await listStockBalances(tenantId, {
    ...opts,
    page: 1,
    limit: EXPORT_ROW_CAP
  });
  if (res.total > EXPORT_ROW_CAP) {
    throw new Error("EXPORT_TOO_LARGE");
  }

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Остатки", { views: [{ state: "frozen", ySplit: 1 }] });

  if (res.view === "by_warehouse") {
    sheet.columns = [
      { header: "Склад", key: "wh", width: 24 },
      { header: "Категория", key: "cat", width: 22 },
      { header: "Товар", key: "name", width: 36 },
      { header: "Код", key: "sku", width: 16 },
      { header: "Факт", key: "qty", width: 14 },
      { header: "Новые заявки", key: "res", width: 16 },
      { header: "Доступно", key: "av", width: 14 }
    ];
    for (const row of res.data) {
      sheet.addRow({
        wh: row.warehouse_name,
        cat: row.category_name ?? "",
        name: row.name,
        sku: row.sku,
        qty: row.qty,
        res: row.reserved_qty,
        av: row.available_qty
      });
    }
  } else if (res.view === "valuation") {
    sheet.columns = [
      { header: "Товар", key: "name", width: 36 },
      { header: "Код", key: "sku", width: 16 },
      { header: "Факт шт", key: "qty", width: 12 },
      { header: "Факт сумма", key: "aq", width: 16 },
      { header: "Новые заявки, шт", key: "rs", width: 14 },
      { header: "Новые заявки, сумма", key: "ars", width: 18 },
      { header: "Доступно шт", key: "av", width: 12 },
      { header: "Доступно сумма", key: "aav", width: 16 },
      { header: "Валюта", key: "cur", width: 10 }
    ];
    for (const row of res.data) {
      const r = row as StockBalanceValuationRow;
      sheet.addRow({
        name: r.name,
        sku: r.sku,
        qty: r.qty,
        aq: r.amount_actual,
        rs: r.reserved_qty,
        ars: r.amount_reserved,
        av: r.available_qty,
        aav: r.amount_available,
        cur: r.currency
      });
    }
  } else {
    sheet.columns = [
      { header: "Товар", key: "name", width: 36 },
      { header: "Код", key: "sku", width: 16 },
      { header: "Фактический остаток", key: "qty", width: 18 },
      { header: "Новые заявки", key: "res", width: 16 },
      { header: "Доступно", key: "av", width: 14 }
    ];
    for (const row of res.data) {
      sheet.addRow({
        name: row.name,
        sku: row.sku,
        qty: row.qty,
        res: row.reserved_qty,
        av: row.available_qty
      });
    }
  }

  const h = sheet.getRow(1);
  h.font = { bold: true };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
