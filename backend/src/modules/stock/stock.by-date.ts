import ExcelJS from "exceljs";
import XLSX from "xlsx";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getRedisForApp, invalidateStock } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { fmt, parseYmdToDateEnd, toNum } from "./stock.shared";

export type StockByDateRow = {
  idx: number;
  product_id: number;
  sku: string;
  category_name: string | null;
  product_name: string;
  block_name: string | null;
  qty: string;
  volume: string;
  amount: string;
};

type StockByDateOpts = {
  date: string;
  warehouse_id: number;
  category_id?: number;
  product_id?: number;
  price_type?: string | null;
  q: string;
  page: number;
  limit: number;
};

function parseAsOfDateTime(value: string): Date {
  const v = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return parseYmdToDateEnd(v);
  }
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) return d;
  return new Date();
}

export async function listStockBySpecificDate(
  tenantId: number,
  opts: StockByDateOpts
): Promise<{ data: StockByDateRow[]; total: number; page: number; limit: number }> {
  const asOf = parseAsOfDateTime(opts.date);

  const wh = await prisma.warehouse.findFirst({
    where: { tenant_id: tenantId, id: opts.warehouse_id },
    select: { id: true }
  });
  if (!wh) throw new Error("BAD_WAREHOUSE");

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

  const products = await prisma.product.findMany({
    where: productWhere,
    select: {
      id: true,
      sku: true,
      name: true,
      volume_m3: true,
      category: { select: { name: true } }
    }
  });
  if (products.length === 0) {
    return { data: [], total: 0, page: opts.page, limit: opts.limit };
  }
  const productIds = products.map((p) => p.id);
  const byProduct = new Map(products.map((p) => [p.id, p]));

  const [receipts, sales, returns, corrections, transferOut, transferIn] = await Promise.all([
    prisma.goodsReceiptLine.groupBy({
      by: ["product_id"],
      where: {
        product_id: { in: productIds },
        receipt: {
          tenant_id: tenantId,
          warehouse_id: opts.warehouse_id,
          status: "posted",
          deleted_at: null,
          OR: [{ receipt_at: { lte: asOf } }, { receipt_at: null, created_at: { lte: asOf } }]
        }
      },
      _sum: { qty: true }
    }),
    prisma.orderItem.groupBy({
      by: ["product_id"],
      where: {
        product_id: { in: productIds },
        order: {
          tenant_id: tenantId,
          warehouse_id: opts.warehouse_id,
          status: "delivered",
          order_type: "order",
          created_at: { lte: asOf }
        }
      },
      _sum: { qty: true }
    }),
    prisma.salesReturnLine.groupBy({
      by: ["product_id"],
      where: {
        product_id: { in: productIds },
        return: {
          tenant_id: tenantId,
          warehouse_id: opts.warehouse_id,
          status: "posted",
          created_at: { lte: asOf }
        }
      },
      _sum: { qty: true }
    }),
    prisma.warehouseCorrectionLine.groupBy({
      by: ["product_id"],
      where: {
        product_id: { in: productIds },
        document: {
          tenant_id: tenantId,
          warehouse_id: opts.warehouse_id,
          occurred_at: { lte: asOf }
        }
      },
      _sum: { qty_delta: true }
    }),
    prisma.$queryRaw<{ product_id: number; qty: Prisma.Decimal }[]>(
      Prisma.sql`
      SELECT l.product_id, COALESCE(SUM(COALESCE(l.received_qty, l.qty)), 0) AS qty
      FROM warehouse_transfer_lines l
      JOIN warehouse_transfers t ON t.id = l.transfer_id
      WHERE t.tenant_id = ${tenantId}
        AND t.source_warehouse_id = ${opts.warehouse_id}
        AND t.started_at IS NOT NULL
        AND t.started_at <= ${asOf}
        AND t.status <> 'cancelled'
        AND l.product_id IN (${Prisma.join(productIds.map((id) => Prisma.sql`${id}`))})
      GROUP BY l.product_id
    `
    ),
    prisma.$queryRaw<{ product_id: number; qty: Prisma.Decimal }[]>(
      Prisma.sql`
      SELECT l.product_id, COALESCE(SUM(COALESCE(l.received_qty, l.qty)), 0) AS qty
      FROM warehouse_transfer_lines l
      JOIN warehouse_transfers t ON t.id = l.transfer_id
      WHERE t.tenant_id = ${tenantId}
        AND t.destination_warehouse_id = ${opts.warehouse_id}
        AND t.received_at IS NOT NULL
        AND t.received_at <= ${asOf}
        AND t.status = 'received'
        AND l.product_id IN (${Prisma.join(productIds.map((id) => Prisma.sql`${id}`))})
      GROUP BY l.product_id
    `
    )
  ]);

  const addMap = (rows: { product_id: number; _sum?: { qty?: Prisma.Decimal | null; qty_delta?: Prisma.Decimal | null } }[], key: "qty" | "qty_delta") => {
    const m = new Map<number, number>();
    for (const r of rows) {
      const v = key === "qty" ? r._sum?.qty : r._sum?.qty_delta;
      m.set(r.product_id, toNum(v ?? 0));
    }
    return m;
  };
  const receiptsMap = addMap(receipts, "qty");
  const salesMap = addMap(sales, "qty");
  const returnsMap = addMap(returns, "qty");
  const corrMap = addMap(corrections, "qty_delta");
  const outMap = new Map<number, number>(transferOut.map((r) => [r.product_id, toNum(r.qty)]));
  const inMap = new Map<number, number>(transferIn.map((r) => [r.product_id, toNum(r.qty)]));

  const priceRows =
    opts.price_type?.trim()
      ? await prisma.productPrice.findMany({
          where: { tenant_id: tenantId, price_type: opts.price_type.trim(), product_id: { in: productIds } },
          select: { product_id: true, price: true }
        })
      : [];
  const priceMap = new Map<number, number>(priceRows.map((p) => [p.product_id, toNum(p.price)]));

  const computed: StockByDateRow[] = [];
  for (const pid of productIds) {
    const p = byProduct.get(pid)!;
    const qty =
      (receiptsMap.get(pid) ?? 0) -
      (salesMap.get(pid) ?? 0) +
      (returnsMap.get(pid) ?? 0) +
      (corrMap.get(pid) ?? 0) -
      (outMap.get(pid) ?? 0) +
      (inMap.get(pid) ?? 0);
    if (Math.abs(qty) < 0.0000001) continue;
    const volume = qty * toNum(p.volume_m3 ?? 0);
    const amount = qty * (priceMap.get(pid) ?? 0);
    computed.push({
      idx: 0,
      product_id: pid,
      sku: p.sku,
      category_name: p.category?.name ?? null,
      product_name: p.name,
      block_name: null,
      qty: fmt(qty),
      volume: fmt(volume, 6),
      amount: amount.toFixed(2)
    });
  }

  computed.sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true, sensitivity: "base" }));
  const total = computed.length;
  const skip = (opts.page - 1) * opts.limit;
  const pageRows = computed.slice(skip, skip + opts.limit).map((r, i) => ({ ...r, idx: skip + i + 1 }));
  return { data: pageRows, total, page: opts.page, limit: opts.limit };
}

export async function buildStockByDateExportBuffer(
  tenantId: number,
  opts: Omit<StockByDateOpts, "page" | "limit">
): Promise<Buffer> {
  const res = await listStockBySpecificDate(tenantId, { ...opts, page: 1, limit: 25_000 });
  if (res.total > 25_000) throw new Error("EXPORT_TOO_LARGE");
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Остатки на дату", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "№", key: "idx", width: 8 },
    { header: "Код", key: "sku", width: 16 },
    { header: "Категория", key: "category", width: 24 },
    { header: "Названия", key: "name", width: 38 },
    { header: "Блок", key: "block", width: 14 },
    { header: "Кол-во", key: "qty", width: 12 },
    { header: "Объем", key: "volume", width: 14 },
    { header: "Сумма", key: "amount", width: 16 }
  ];
  for (const r of res.data) {
    sheet.addRow({
      idx: r.idx,
      sku: r.sku,
      category: r.category_name ?? "",
      name: r.product_name,
      block: r.block_name ?? "",
      qty: r.qty,
      volume: r.volume,
      amount: r.amount
    });
  }
  sheet.getRow(1).font = { bold: true };
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
