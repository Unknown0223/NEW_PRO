import { prisma } from "../../config/database";
import { fmt, toNum } from "./stock.shared";
import type {
  StockReceiptTimelineColumn,
  StockReceiptTimelineOpts,
  StockReceiptTimelineRow
} from "./stock.receipt-report.types";
import { parseReceiptRange } from "./stock.receipt-report.shared";

export async function listStockReceiptTimelineReport(
  tenantId: number,
  opts: StockReceiptTimelineOpts
): Promise<{
  columns: StockReceiptTimelineColumn[];
  data: StockReceiptTimelineRow[];
  total: number;
  page: number;
  limit: number;
  totals: { total_qty: string; by_column: Record<string, string> };
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
        OR: [{ receipt_at: { gte: range.from, lte: range.to } }, { receipt_at: null, created_at: { gte: range.from, lte: range.to } }]
      },
      product: {
        tenant_id: tenantId,
        id: opts.product_id ?? undefined,
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
      receipt_id: true,
      product_id: true,
      product: { select: { sku: true, name: true, category: { select: { name: true } } } },
      receipt: { select: { receipt_at: true, created_at: true } }
    }
  });

  const colMeta = new Map<string, StockReceiptTimelineColumn>();
  const productMap = new Map<
    number,
    {
      product_id: number;
      category_name: string | null;
      product_name: string;
      sku: string;
      total_qty: number;
      values: Map<string, number>;
    }
  >();
  const colTotals = new Map<string, number>();

  for (const r of rows) {
    const at = r.receipt.receipt_at ?? r.receipt.created_at;
    const key = `${r.receipt_id}`;
    if (!colMeta.has(key)) {
      colMeta.set(key, {
        key,
        label: at.toLocaleString("ru-RU", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false
        }),
        at: at.toISOString(),
        receipt_id: r.receipt_id
      });
    }
    const qty = toNum(r.qty);
    const p =
      productMap.get(r.product_id) ??
      {
        product_id: r.product_id,
        category_name: r.product.category?.name ?? null,
        product_name: r.product.name,
        sku: r.product.sku,
        total_qty: 0,
        values: new Map<string, number>()
      };
    p.total_qty += qty;
    p.values.set(key, (p.values.get(key) ?? 0) + qty);
    productMap.set(r.product_id, p);
    colTotals.set(key, (colTotals.get(key) ?? 0) + qty);
  }

  const columns = [...colMeta.values()].sort((a, b) => a.at.localeCompare(b.at));
  const allRows = [...productMap.values()]
    .filter((r) =>
      opts.qty_mode === "positive" ? r.total_qty > 0 : opts.qty_mode === "zero" ? r.total_qty <= 0 : true
    )
    .sort(
      (a, b) =>
        (a.category_name ?? "").localeCompare(b.category_name ?? "", undefined, { sensitivity: "base" }) ||
        a.product_name.localeCompare(b.product_name, undefined, { sensitivity: "base" })
    );

  const total = allRows.length;
  const skip = (opts.page - 1) * opts.limit;
  const pageRows = allRows.slice(skip, skip + opts.limit);
  const data: StockReceiptTimelineRow[] = pageRows.map((r) => {
    const values: Record<string, string> = {};
    for (const c of columns) {
      const v = r.values.get(c.key) ?? 0;
      values[c.key] = v > 0 ? fmt(v, 0) : "0";
    }
    return {
      product_id: r.product_id,
      category_name: r.category_name,
      product_name: r.product_name,
      sku: r.sku,
      total_qty: fmt(r.total_qty, 0),
      values
    };
  });

  const by_column: Record<string, string> = {};
  for (const c of columns) {
    by_column[c.key] = fmt(colTotals.get(c.key) ?? 0, 0);
  }
  const totalQty = allRows.reduce((s, r) => s + r.total_qty, 0);

  return {
    columns,
    data,
    total,
    page: opts.page,
    limit: opts.limit,
    totals: { total_qty: fmt(totalQty, 0), by_column }
  };
}
