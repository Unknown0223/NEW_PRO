/**
 * StockReservation — ombor bron yozuv/assert seami (ADR-007).
 * Orders / transfers faqat thin adapter; lock public emas.
 */
import { Prisma } from "@prisma/client";
import type { DbExecutor } from "../../lib/db-context";

export type StockNeedMapArgs = {
  tenantId: number;
  warehouseId: number;
  needByProduct: Map<number, Prisma.Decimal>;
};

type LockedStockRow = {
  product_id: number;
  qty: Prisma.Decimal;
  reserved_qty: Prisma.Decimal;
};

function positiveNeedEntries(
  needByProduct: Map<number, Prisma.Decimal>
): Array<[number, Prisma.Decimal]> {
  const out: Array<[number, Prisma.Decimal]> = [];
  for (const [productId, need] of needByProduct) {
    if (productId > 0 && need.gt(0)) out.push([productId, need]);
  }
  return out;
}

function throwInsufficientStock(
  productId: number,
  available: Prisma.Decimal,
  requested: Prisma.Decimal
): never {
  const err = new Error("INSUFFICIENT_STOCK") as Error & {
    product_id: number;
    available: string;
    requested: string;
  };
  err.product_id = productId;
  err.available = available.toString();
  err.requested = requested.toString();
  throw err;
}

function availableOf(qty: Prisma.Decimal, reservedRaw: Prisma.Decimal): Prisma.Decimal {
  const reserved = reservedRaw.lt(0) ? new Prisma.Decimal(0) : reservedRaw;
  const available = qty.sub(reserved);
  return available.lt(0) ? new Prisma.Decimal(0) : available;
}

/**
 * Ichki: product_id ASC bo‘yicha FOR UPDATE.
 * Yo‘q qatorlar 0/0 bilan yaratiladi.
 */
async function lockStockRowsForUpdate(
  tx: Prisma.TransactionClient,
  args: { tenantId: number; warehouseId: number; productIds: number[] }
): Promise<Map<number, LockedStockRow>> {
  const sortedIds = [...new Set(args.productIds)].filter((id) => id > 0).sort((a, b) => a - b);
  const map = new Map<number, LockedStockRow>();
  if (sortedIds.length === 0) return map;

  for (const productId of sortedIds) {
    await tx.$executeRaw`
      INSERT INTO stock (tenant_id, warehouse_id, product_id, qty, reserved_qty, created_at, updated_at)
      VALUES (${args.tenantId}, ${args.warehouseId}, ${productId}, 0, 0, now(), now())
      ON CONFLICT (tenant_id, warehouse_id, product_id) DO NOTHING
    `;
  }

  const rows = await tx.$queryRaw<LockedStockRow[]>`
    SELECT product_id, qty, reserved_qty
    FROM stock
    WHERE tenant_id = ${args.tenantId}
      AND warehouse_id = ${args.warehouseId}
      AND product_id IN (${Prisma.join(sortedIds)})
    ORDER BY product_id
    FOR UPDATE
  `;

  for (const row of rows) {
    map.set(Number(row.product_id), {
      product_id: Number(row.product_id),
      qty: new Prisma.Decimal(row.qty),
      reserved_qty: new Prisma.Decimal(row.reserved_qty)
    });
  }
  return map;
}

async function loadStockRows(
  db: DbExecutor,
  args: { tenantId: number; warehouseId: number; productIds: number[] }
): Promise<Map<number, LockedStockRow>> {
  const sortedIds = [...new Set(args.productIds)].filter((id) => id > 0).sort((a, b) => a - b);
  const map = new Map<number, LockedStockRow>();
  if (sortedIds.length === 0) return map;

  const rows = await db.$queryRaw<LockedStockRow[]>`
    SELECT product_id, qty, reserved_qty
    FROM stock
    WHERE tenant_id = ${args.tenantId}
      AND warehouse_id = ${args.warehouseId}
      AND product_id IN (${Prisma.join(sortedIds)})
    ORDER BY product_id
  `;

  for (const row of rows) {
    map.set(Number(row.product_id), {
      product_id: Number(row.product_id),
      qty: new Prisma.Decimal(row.qty),
      reserved_qty: new Prisma.Decimal(row.reserved_qty)
    });
  }
  return map;
}

function assertNeedAgainstMap(
  needEntries: Array<[number, Prisma.Decimal]>,
  stockMap: Map<number, LockedStockRow>
): void {
  for (const [productId, needQty] of needEntries) {
    const row = stockMap.get(productId);
    const qty = row?.qty ?? new Prisma.Decimal(0);
    const reserved = row?.reserved_qty ?? new Prisma.Decimal(0);
    const available = availableOf(qty, reserved);
    if (available.lt(needQty)) {
      throwInsufficientStock(productId, available, needQty);
    }
  }
}

/** Yozuvsiz: productId → Available (`max(0, qty − max(0, reserved))`). */
export async function loadAvailableByProduct(
  db: DbExecutor,
  args: { tenantId: number; warehouseId: number; productIds: number[] }
): Promise<Map<number, Prisma.Decimal>> {
  const ids = [...new Set(args.productIds)].filter((id) => id > 0);
  const out = new Map<number, Prisma.Decimal>();
  for (const id of ids) out.set(id, new Prisma.Decimal(0));
  if (ids.length === 0) return out;

  const stockMap = await loadStockRows(db, {
    tenantId: args.tenantId,
    warehouseId: args.warehouseId,
    productIds: ids
  });
  for (const id of ids) {
    const row = stockMap.get(id);
    out.set(
      id,
      availableOf(row?.qty ?? new Prisma.Decimal(0), row?.reserved_qty ?? new Prisma.Decimal(0))
    );
  }
  return out;
}

/** Yozuvsiz: needMap uchun available yetarlimi. */
export async function assertAvailable(db: DbExecutor, args: StockNeedMapArgs): Promise<void> {
  const needEntries = positiveNeedEntries(args.needByProduct);
  if (needEntries.length === 0) return;

  const stockMap = await loadStockRows(db, {
    tenantId: args.tenantId,
    warehouseId: args.warehouseId,
    productIds: needEntries.map(([id]) => id)
  });
  assertNeedAgainstMap(needEntries, stockMap);
}

/** Available yetarli bo‘lsa reserved_qty oshirish (FOR UPDATE). */
export async function reserve(tx: Prisma.TransactionClient, args: StockNeedMapArgs): Promise<void> {
  const needEntries = positiveNeedEntries(args.needByProduct);
  if (needEntries.length === 0) return;

  const stockMap = await lockStockRowsForUpdate(tx, {
    tenantId: args.tenantId,
    warehouseId: args.warehouseId,
    productIds: needEntries.map(([id]) => id)
  });
  assertNeedAgainstMap(needEntries, stockMap);

  for (const [productId, reserveQty] of needEntries) {
    await tx.stock.update({
      where: {
        tenant_id_warehouse_id_product_id: {
          tenant_id: args.tenantId,
          warehouse_id: args.warehouseId,
          product_id: productId
        }
      },
      data: { reserved_qty: { increment: reserveQty } }
    });
  }
}

/** Bronni kamaytirish; reserved_qty clamp ≥ 0 (FOR UPDATE). */
export async function release(tx: Prisma.TransactionClient, args: StockNeedMapArgs): Promise<void> {
  const needEntries = positiveNeedEntries(args.needByProduct);
  if (needEntries.length === 0) return;

  await lockStockRowsForUpdate(tx, {
    tenantId: args.tenantId,
    warehouseId: args.warehouseId,
    productIds: needEntries.map(([id]) => id)
  });

  for (const [productId, qty] of needEntries) {
    await tx.$executeRaw`
      UPDATE stock
      SET reserved_qty = GREATEST(0, reserved_qty - ${qty}::numeric),
          updated_at = now()
      WHERE tenant_id = ${args.tenantId}
        AND warehouse_id = ${args.warehouseId}
        AND product_id = ${productId}
    `;
  }
}

/** Confirm: qty va reserved_qty ni birga kamaytirish; reserved clamp ≥ 0 (FOR UPDATE). */
export async function consume(tx: Prisma.TransactionClient, args: StockNeedMapArgs): Promise<void> {
  const needEntries = positiveNeedEntries(args.needByProduct);
  if (needEntries.length === 0) return;

  await lockStockRowsForUpdate(tx, {
    tenantId: args.tenantId,
    warehouseId: args.warehouseId,
    productIds: needEntries.map(([id]) => id)
  });

  for (const [productId, qty] of needEntries) {
    await tx.$executeRaw`
      UPDATE stock
      SET qty = qty - ${qty}::numeric,
          reserved_qty = GREATEST(0, reserved_qty - ${qty}::numeric),
          updated_at = now()
      WHERE tenant_id = ${args.tenantId}
        AND warehouse_id = ${args.warehouseId}
        AND product_id = ${productId}
    `;
  }
}
