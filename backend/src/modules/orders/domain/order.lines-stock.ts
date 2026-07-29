/**
 * Domain: Orders — tahrirlashda sklad rezerv / fizik qoldiqni moslash.
 * «new»: reserved_qty; «confirmed»: qty (confirmda allaqachon chiqarilgan).
 */
import { Prisma } from "@prisma/client";

export type OrderLinesStockMode = "reserved" | "consumed";

function stockModeForStatus(status: string): OrderLinesStockMode | null {
  if (status === "new") return "reserved";
  if (status === "confirmed") return "consumed";
  return null;
}

function addNeed(map: Map<number, Prisma.Decimal>, productId: number, qty: Prisma.Decimal) {
  const cur = map.get(productId) ?? new Prisma.Decimal(0);
  map.set(productId, cur.add(qty));
}

function needMapFromLines(
  lines: Array<{ product_id: number; qty: Prisma.Decimal; exchange_line_kind?: string | null }>
): Map<number, Prisma.Decimal> {
  const need = new Map<number, Prisma.Decimal>();
  for (const l of lines) {
    if (l.exchange_line_kind === "minus") continue;
    addNeed(need, l.product_id, l.qty);
  }
  return need;
}

/**
 * Oldingi va yangi outbound qatorlar farqiga qarab skladni yangilaydi.
 * Yetarli qoldiq bo‘lmasa — INSUFFICIENT_STOCK.
 */
export async function adjustOutboundStockForOrderLinesEdit(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: number;
    warehouseId: number;
    orderStatus: string;
    prevLines: Array<{
      product_id: number;
      qty: Prisma.Decimal;
      exchange_line_kind?: string | null;
    }>;
    nextLines: Array<{
      product_id: number;
      qty: Prisma.Decimal;
      exchange_line_kind?: string | null;
    }>;
  }
): Promise<void> {
  const mode = stockModeForStatus(params.orderStatus);
  if (mode == null) return;

  const prevNeed = needMapFromLines(params.prevLines);
  const nextNeed = needMapFromLines(params.nextLines);
  const productIds = new Set<number>([...prevNeed.keys(), ...nextNeed.keys()]);
  if (productIds.size === 0) return;

  const ids = [...productIds];
  const stockRows = await tx.stock.findMany({
    where: {
      tenant_id: params.tenantId,
      warehouse_id: params.warehouseId,
      product_id: { in: ids }
    },
    select: { product_id: true, qty: true, reserved_qty: true }
  });
  const stockMap = new Map(stockRows.map((s) => [s.product_id, s]));

  type Delta = { productId: number; delta: Prisma.Decimal };
  const deltas: Delta[] = [];
  for (const productId of ids) {
    const prev = prevNeed.get(productId) ?? new Prisma.Decimal(0);
    const next = nextNeed.get(productId) ?? new Prisma.Decimal(0);
    const delta = next.sub(prev);
    if (delta.eq(0)) continue;
    deltas.push({ productId, delta });
  }
  if (deltas.length === 0) return;

  for (const { productId, delta } of deltas) {
    if (!delta.gt(0)) continue;
    const row = stockMap.get(productId);
    const qty = row?.qty ?? new Prisma.Decimal(0);
    const reservedRaw = row?.reserved_qty ?? new Prisma.Decimal(0);
    const reserved = reservedRaw.lt(0) ? new Prisma.Decimal(0) : reservedRaw;
    const available = qty.sub(reserved);
    if (available.lt(delta)) {
      const err = new Error("INSUFFICIENT_STOCK") as Error & {
        product_id: number;
        available: string;
        requested: string;
      };
      err.product_id = productId;
      err.available = available.toString();
      err.requested = delta.toString();
      throw err;
    }
  }

  for (const { productId, delta } of deltas) {
    const abs = delta.abs();
    if (mode === "reserved") {
      await tx.stock.upsert({
        where: {
          tenant_id_warehouse_id_product_id: {
            tenant_id: params.tenantId,
            warehouse_id: params.warehouseId,
            product_id: productId
          }
        },
        create: {
          tenant_id: params.tenantId,
          warehouse_id: params.warehouseId,
          product_id: productId,
          reserved_qty: delta.gt(0) ? delta : new Prisma.Decimal(0)
        },
        update: delta.gt(0)
          ? { reserved_qty: { increment: abs } }
          : { reserved_qty: { decrement: abs } }
      });
    } else {
      // confirmed: fizik qty allaqachon kamaytirilgan — farqni qty ga qo‘llaymiz
      await tx.stock.upsert({
        where: {
          tenant_id_warehouse_id_product_id: {
            tenant_id: params.tenantId,
            warehouse_id: params.warehouseId,
            product_id: productId
          }
        },
        create: {
          tenant_id: params.tenantId,
          warehouse_id: params.warehouseId,
          product_id: productId,
          qty: delta.lt(0) ? abs : new Prisma.Decimal(0),
          reserved_qty: new Prisma.Decimal(0)
        },
        update: delta.gt(0)
          ? { qty: { decrement: abs } }
          : { qty: { increment: abs } }
      });
    }
  }
}
