import { prisma } from "../../config/database";
import { fmt, toNum } from "./stock.shared";
import type { StockReceiptDailyOpts, StockReceiptDailyRow } from "./stock.receipt-report.types";
import { parseReceiptRange } from "./stock.receipt-report.shared";

export async function listStockReceiptReportDaily(
  tenantId: number,
  opts: StockReceiptDailyOpts
): Promise<{
  data: StockReceiptDailyRow[];
  total: number;
  page: number;
  limit: number;
  totals: { qty: string; total: string };
}> {
  const range = parseReceiptRange(opts.date_from, opts.date_to);
  const q = opts.q.trim();
  const rows = await prisma.goodsReceiptLine.findMany({
    where: {
      receipt: {
        tenant_id: tenantId,
        deleted_at: null,
        status: "posted",
        warehouse_id: opts.warehouse_id ?? undefined,
        supplier_id: opts.supplier_id ?? undefined,
        OR: [{ receipt_at: { gte: range.from, lte: range.to } }, { receipt_at: null, created_at: { gte: range.from, lte: range.to } }]
      },
      product: {
        tenant_id: tenantId,
        category_id: opts.category_id ?? undefined,
        ...(q
          ? {
              OR: [
                { sku: { contains: q, mode: "insensitive" } },
                { name: { contains: q, mode: "insensitive" } }
              ]
            }
          : {})
      }
    },
    select: {
      qty: true,
      line_total: true,
      receipt_id: true,
      receipt: { select: { receipt_at: true, created_at: true } }
    }
  });
  const byDay = new Map<string, { docs: Set<number>; lines: number; qty: number; total: number }>();
  let totalQty = 0;
  let totalSum = 0;
  for (const row of rows) {
    const dt = row.receipt.receipt_at ?? row.receipt.created_at;
    const day = dt.toISOString().slice(0, 10);
    const cur = byDay.get(day) ?? { docs: new Set<number>(), lines: 0, qty: 0, total: 0 };
    cur.docs.add(row.receipt_id);
    cur.lines += 1;
    cur.qty += toNum(row.qty);
    cur.total += toNum(row.line_total);
    byDay.set(day, cur);
    totalQty += toNum(row.qty);
    totalSum += toNum(row.line_total);
  }
  const sorted = [...byDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, v]) => ({
      day,
      docs_count: v.docs.size,
      lines_count: v.lines,
      qty: fmt(v.qty),
      total: v.total.toFixed(2)
    }));
  const total = sorted.length;
  const skip = (opts.page - 1) * opts.limit;
  return {
    data: sorted.slice(skip, skip + opts.limit),
    total,
    page: opts.page,
    limit: opts.limit,
    totals: { qty: fmt(totalQty), total: totalSum.toFixed(2) }
  };
}
