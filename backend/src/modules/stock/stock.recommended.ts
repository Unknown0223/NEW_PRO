import ExcelJS from "exceljs";
import XLSX from "xlsx";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getRedisForApp, invalidateStock } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import {
  daysInclusive,
  fmt,
  parseYmdToDateEnd,
  parseYmdToDateStart,
  riskFromCoverage,
  toNum
} from "./stock.shared";

export type RecommendedStockRow = {
  product_id: number;
  sku: string;
  category_name: string | null;
  product_name: string;
  stock_qty: string;
  avg_daily_sales: string;
  coverage_days: string;
  rec_stock_6: string;
  rec_stock_10: string;
  rec_stock_30: string;
  rec_stock_month_end: string;
  category_share_pct: string;
  sold_qty: string;
  risk_level: "low" | "medium" | "healthy" | "overstock";
};

type RecommendedStockListOpts = {
  date_from: string;
  date_to: string;
  warehouse_id?: number;
  category_id?: number;
  product_id?: number;
  qty_mode: "all" | "positive" | "zero";
  q: string;
  sort_by:
    | "sku"
    | "category"
    | "name"
    | "stock"
    | "avg"
    | "coverage"
    | "r6"
    | "r10"
    | "r30"
    | "rme"
    | "share";
  sort_dir: "asc" | "desc";
  page: number;
  limit: number;
};

export async function listRecommendedStock(
  tenantId: number,
  opts: RecommendedStockListOpts
): Promise<{
  data: RecommendedStockRow[];
  total: number;
  page: number;
  limit: number;
  kpi: { total_days: number; passed_days: number; remaining_days: number };
}> {
  const totalDays = daysInclusive(opts.date_from, opts.date_to);
  const today = new Date();
  const fromDate = parseYmdToDateStart(opts.date_from);
  const toDate = parseYmdToDateEnd(opts.date_to);
  const elapsedMs = Math.min(Math.max(today.getTime(), fromDate.getTime()), toDate.getTime()) - fromDate.getTime();
  const passedDays = Math.max(0, Math.min(totalDays, Math.floor(elapsedMs / 86_400_000) + 1));
  const remainingDays = Math.max(0, totalDays - passedDays);

  const whWhere: Prisma.WarehouseWhereInput = {
    tenant_id: tenantId,
    is_active: true,
    stock_purpose: "sales"
  };
  if (opts.warehouse_id != null) {
    whWhere.id = opts.warehouse_id;
  }
  const warehouseIds = (
    await prisma.warehouse.findMany({ where: whWhere, select: { id: true } })
  ).map((w) => w.id);
  if (warehouseIds.length === 0) {
    return {
      data: [],
      total: 0,
      page: opts.page,
      limit: opts.limit,
      kpi: { total_days: totalDays, passed_days: passedDays, remaining_days: remainingDays }
    };
  }

  const productWhere: Prisma.ProductWhereInput = { tenant_id: tenantId };
  if (opts.category_id != null) productWhere.category_id = opts.category_id;
  if (opts.product_id != null) productWhere.id = opts.product_id;
  if (opts.q.trim()) {
    const q = opts.q.trim();
    productWhere.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } }
    ];
  }

  const stockRows = await prisma.stock.findMany({
    where: {
      tenant_id: tenantId,
      warehouse_id: { in: warehouseIds },
      product: productWhere
    },
    select: { product_id: true, qty: true }
  });
  const stockByProduct = new Map<number, number>();
  for (const r of stockRows) {
    stockByProduct.set(r.product_id, (stockByProduct.get(r.product_id) ?? 0) + toNum(r.qty));
  }

  const salesRows = await prisma.orderItem.groupBy({
    by: ["product_id"],
    where: {
      order: {
        tenant_id: tenantId,
        order_type: "order",
        status: "delivered",
        created_at: { gte: fromDate, lte: toDate },
        ...(opts.warehouse_id != null ? { warehouse_id: opts.warehouse_id } : {})
      },
      product: productWhere
    },
    _sum: { qty: true }
  });
  const soldByProduct = new Map<number, number>();
  for (const r of salesRows) {
    soldByProduct.set(r.product_id, toNum(r._sum.qty));
  }

  const ids = [...new Set([...stockByProduct.keys(), ...soldByProduct.keys()])];
  if (ids.length === 0) {
    return {
      data: [],
      total: 0,
      page: opts.page,
      limit: opts.limit,
      kpi: { total_days: totalDays, passed_days: passedDays, remaining_days: remainingDays }
    };
  }
  const products = await prisma.product.findMany({
    where: { tenant_id: tenantId, id: { in: ids } },
    select: { id: true, sku: true, name: true, category: { select: { name: true } }, category_id: true }
  });

  const soldByCategory = new Map<number, number>();
  for (const p of products) {
    const cId = p.category_id ?? -1;
    soldByCategory.set(cId, (soldByCategory.get(cId) ?? 0) + (soldByProduct.get(p.id) ?? 0));
  }

  const rows: RecommendedStockRow[] = products.map((p) => {
    const stockQty = stockByProduct.get(p.id) ?? 0;
    const soldQty = soldByProduct.get(p.id) ?? 0;
    const avgDailySales = soldQty / totalDays;
    const coverageDays = avgDailySales > 0 ? stockQty / avgDailySales : stockQty > 0 ? 999 : 0;
    const rec6 = avgDailySales * 6;
    const rec10 = avgDailySales * 10;
    const rec30 = avgDailySales * 30;
    const recMonthEnd = avgDailySales * remainingDays;
    const categoryTotal = soldByCategory.get(p.category_id ?? -1) ?? 0;
    const categorySharePct = categoryTotal > 0 ? (soldQty / categoryTotal) * 100 : 0;

    return {
      product_id: p.id,
      sku: p.sku,
      category_name: p.category?.name ?? null,
      product_name: p.name,
      stock_qty: fmt(stockQty),
      avg_daily_sales: fmt(avgDailySales),
      coverage_days: fmt(coverageDays, 2),
      rec_stock_6: fmt(rec6),
      rec_stock_10: fmt(rec10),
      rec_stock_30: fmt(rec30),
      rec_stock_month_end: fmt(recMonthEnd),
      category_share_pct: fmt(categorySharePct, 2),
      sold_qty: fmt(soldQty),
      risk_level: riskFromCoverage(coverageDays)
    };
  });

  const filteredRows =
    opts.qty_mode === "positive"
      ? rows.filter((r) => Number(r.stock_qty) > 0)
      : opts.qty_mode === "zero"
        ? rows.filter((r) => Number(r.stock_qty) <= 0)
        : rows;

  const dirMul = opts.sort_dir === "desc" ? -1 : 1;
  const cmpText = (x: string, y: string) =>
    x.localeCompare(y, undefined, { sensitivity: "base", numeric: true });
  const cmpNum = (x: string, y: string) => Number(x) - Number(y);
  const byDefault = (a: RecommendedStockRow, b: RecommendedStockRow) =>
    cmpText(a.category_name ?? "", b.category_name ?? "") || cmpText(a.product_name, b.product_name);

  filteredRows.sort((a, b) => {
    let c = 0;
    switch (opts.sort_by) {
      case "sku":
        c = cmpText(a.sku, b.sku);
        break;
      case "category":
        c = cmpText(a.category_name ?? "", b.category_name ?? "");
        break;
      case "name":
        c = cmpText(a.product_name, b.product_name);
        break;
      case "stock":
        c = cmpNum(a.stock_qty, b.stock_qty);
        break;
      case "avg":
        c = cmpNum(a.avg_daily_sales, b.avg_daily_sales);
        break;
      case "coverage":
        c = cmpNum(a.coverage_days, b.coverage_days);
        break;
      case "r6":
        c = cmpNum(a.rec_stock_6, b.rec_stock_6);
        break;
      case "r10":
        c = cmpNum(a.rec_stock_10, b.rec_stock_10);
        break;
      case "r30":
        c = cmpNum(a.rec_stock_30, b.rec_stock_30);
        break;
      case "rme":
        c = cmpNum(a.rec_stock_month_end, b.rec_stock_month_end);
        break;
      case "share":
        c = cmpNum(a.category_share_pct, b.category_share_pct);
        break;
      default:
        c = byDefault(a, b);
        break;
    }
    if (c === 0) c = byDefault(a, b);
    return c * dirMul;
  });

  const total = filteredRows.length;
  const skip = (opts.page - 1) * opts.limit;
  const data = filteredRows.slice(skip, skip + opts.limit);
  return {
    data,
    total,
    page: opts.page,
    limit: opts.limit,
    kpi: { total_days: totalDays, passed_days: passedDays, remaining_days: remainingDays }
  };
}

export async function buildRecommendedStockExportBuffer(
  tenantId: number,
  opts: Omit<RecommendedStockListOpts, "page" | "limit">
): Promise<Buffer> {
  const res = await listRecommendedStock(tenantId, { ...opts, page: 1, limit: 25_000 });
  if (res.total > 25_000) {
    throw new Error("EXPORT_TOO_LARGE");
  }
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Рекомендованный запас", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "Код", key: "sku", width: 16 },
    { header: "Категория", key: "category", width: 22 },
    { header: "Ассортимент", key: "name", width: 40 },
    { header: "Товар на складе", key: "stock", width: 16 },
    { header: "Сред. дневные продажи", key: "avg", width: 18 },
    { header: "Текущ. запас хватит на... дней", key: "coverage", width: 24 },
    { header: "Рек. запас на 6 дней", key: "r6", width: 18 },
    { header: "Рек. запас на 10 дней", key: "r10", width: 18 },
    { header: "Рек. запас на 30 дней", key: "r30", width: 18 },
    { header: "Рек. запас до конца месяца", key: "rme", width: 24 },
    { header: "Доля в категории, %", key: "share", width: 18 }
  ];
  for (const r of res.data) {
    sheet.addRow({
      sku: r.sku,
      category: r.category_name ?? "",
      name: r.product_name,
      stock: r.stock_qty,
      avg: r.avg_daily_sales,
      coverage: r.coverage_days,
      r6: r.rec_stock_6,
      r10: r.rec_stock_10,
      r30: r.rec_stock_30,
      rme: r.rec_stock_month_end,
      share: r.category_share_pct
    });
  }
  sheet.getRow(1).font = { bold: true };
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
