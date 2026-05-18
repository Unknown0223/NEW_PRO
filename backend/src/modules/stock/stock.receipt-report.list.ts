import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { fmt, toNum } from "./stock.shared";
import type { StockReceiptReportOpts, StockReceiptReportRow } from "./stock.receipt-report.types";
import { parseReceiptRange } from "./stock.receipt-report.shared";

export async function listStockReceiptReport(
  tenantId: number,
  opts: StockReceiptReportOpts
): Promise<{
  data: StockReceiptReportRow[];
  total: number;
  page: number;
  limit: number;
  totals: { qty: string; total: string };
}> {
  const range = parseReceiptRange(opts.date_from, opts.date_to);
  const q = opts.q.trim();
  const lineWhere: Prisma.GoodsReceiptLineWhereInput = {
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
  };

  const lines = await prisma.goodsReceiptLine.findMany({
    where: lineWhere,
    select: {
      product_id: true,
      qty: true,
      line_total: true,
      unit_price: true,
      product: { select: { sku: true, name: true, category: { select: { name: true } } } },
      receipt: { select: { receipt_at: true, created_at: true } }
    }
  });

  type Agg = {
    product_id: number;
    sku: string;
    product_name: string;
    category_name: string | null;
    qty: number;
    total: number;
    last_purchase_at: Date | null;
  };
  const byProduct = new Map<number, Agg>();
  let totalQty = 0;
  let totalSum = 0;
  for (const ln of lines) {
    const qty = toNum(ln.qty);
    const sum = toNum(ln.line_total);
    const purchaseAt = ln.receipt.receipt_at ?? ln.receipt.created_at;
    const cur = byProduct.get(ln.product_id);
    if (!cur) {
      byProduct.set(ln.product_id, {
        product_id: ln.product_id,
        sku: ln.product.sku,
        product_name: ln.product.name,
        category_name: ln.product.category?.name ?? null,
        qty,
        total: sum,
        last_purchase_at: purchaseAt
      });
    } else {
      cur.qty += qty;
      cur.total += sum;
      if (
        purchaseAt &&
        (!cur.last_purchase_at || purchaseAt.getTime() > cur.last_purchase_at.getTime())
      ) {
        cur.last_purchase_at = purchaseAt;
      }
    }
    totalQty += qty;
    totalSum += sum;
  }

  const rows = [...byProduct.values()].sort(
    (a, b) =>
      (a.category_name ?? "").localeCompare(b.category_name ?? "", undefined, { sensitivity: "base" }) ||
      a.product_name.localeCompare(b.product_name, undefined, { sensitivity: "base" })
  );
  const total = rows.length;
  const skip = (opts.page - 1) * opts.limit;
  const data = rows.slice(skip, skip + opts.limit).map((r, i) => ({
    idx: skip + i + 1,
    product_id: r.product_id,
    category_name: r.category_name,
    sku: r.sku,
    product_name: r.product_name,
    last_purchase_at: r.last_purchase_at ? r.last_purchase_at.toISOString() : null,
    qty: fmt(r.qty),
    price: r.qty > 0 ? (r.total / r.qty).toFixed(2) : "0.00",
    total: r.total.toFixed(2)
  }));

  return {
    data,
    total,
    page: opts.page,
    limit: opts.limit,
    totals: { qty: fmt(totalQty), total: totalSum.toFixed(2) }
  };
}
