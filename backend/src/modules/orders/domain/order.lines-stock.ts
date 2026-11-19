/**
 * Domain: Orders — tahrirlashda sklad rezerv / fizik qoldiqni moslash.
 * «new»: StockReservation reserve/release; «confirmed»: fizik qty (reserved allaqachon consume).
 */
import { Prisma } from "@prisma/client";
import { release, reserve } from "../../stock/stock-reservation";

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
 * Yetarli qoldiq bo‘lmasa — INSUFFICIENT_STOCK (reserve).
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

  const toReserve = new Map<number, Prisma.Decimal>();
  const toRelease = new Map<number, Prisma.Decimal>();
  const qtyDeltas: Array<{ productId: number; delta: Prisma.Decimal }> = [];

  for (const productId of productIds) {
    const prev = prevNeed.get(productId) ?? new Prisma.Decimal(0);
    const next = nextNeed.get(productId) ?? new Prisma.Decimal(0);
    const delta = next.sub(prev);
    if (delta.eq(0)) continue;
    if (mode === "reserved") {
      if (delta.gt(0)) toReserve.set(productId, delta);
      else toRelease.set(productId, delta.abs());
    } else {
      qtyDeltas.push({ productId, delta });
    }
  }

  if (mode === "reserved") {
    if (toRelease.size > 0) {
      await release(tx, {
        tenantId: params.tenantId,
        warehouseId: params.warehouseId,
        needByProduct: toRelease
      });
    }
    if (toReserve.size > 0) {
      await reserve(tx, {
        tenantId: params.tenantId,
        warehouseId: params.warehouseId,
        needByProduct: toReserve
      });
    }
    return;
  }

  // confirmed: fizik qty allaqachon kamaytirilgan — farqni qty ga qo‘llaymiz (reserved emas)
  for (const { productId, delta } of qtyDeltas) {
    const abs = delta.abs();
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
      update: delta.gt(0) ? { qty: { decrement: abs } } : { qty: { increment: abs } }
    });
  }
}
