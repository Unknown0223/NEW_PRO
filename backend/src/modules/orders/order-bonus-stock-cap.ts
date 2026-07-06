import { Prisma } from "@prisma/client";
import { roundOrderMoney } from "./domain/order.detail-mappers";
import type { CreateOrderPaidBundle } from "./domain/order.create-tx.bonus";

export const BONUS_ALERT_CODES = ["stock_shortage"] as const;
export type BonusAlertCode = (typeof BONUS_ALERT_CODES)[number];

export function isBonusAlertCode(v: string): v is BonusAlertCode {
  return (BONUS_ALERT_CODES as readonly string[]).includes(v);
}

export type BonusStockCapResult = {
  bonusCreates: CreateOrderPaidBundle["bonusCreates"];
  bonusSum: Prisma.Decimal;
  bonusAlert: BonusAlertCode | null;
  shortageComment: string | null;
};

export async function capBonusCreatesToStock(
  tx: Prisma.TransactionClient,
  tenantId: number,
  warehouseId: number,
  paidAfterDisc: CreateOrderPaidBundle["paidAfterDisc"],
  bonusCreates: CreateOrderPaidBundle["bonusCreates"]
): Promise<BonusStockCapResult> {
  if (bonusCreates.length === 0) {
    return {
      bonusCreates,
      bonusSum: new Prisma.Decimal(0),
      bonusAlert: null,
      shortageComment: null
    };
  }

  const paidNeed = new Map<number, Prisma.Decimal>();
  for (const l of paidAfterDisc) {
    if (l.exchange_line_kind === "minus") continue;
    const cur = paidNeed.get(l.product_id) ?? new Prisma.Decimal(0);
    paidNeed.set(l.product_id, cur.add(l.qty));
  }

  const productIds = [
    ...new Set([...paidNeed.keys(), ...bonusCreates.map((b) => b.product_id)])
  ];
  const stockRows = await tx.stock.findMany({
    where: { tenant_id: tenantId, warehouse_id: warehouseId, product_id: { in: productIds } },
    select: { product_id: true, qty: true, reserved_qty: true }
  });
  const stockMap = new Map(stockRows.map((s) => [s.product_id, s]));

  for (const [productId, needQty] of paidNeed) {
    const row = stockMap.get(productId);
    const qty = row?.qty ?? new Prisma.Decimal(0);
    const reservedRaw = row?.reserved_qty ?? new Prisma.Decimal(0);
    const reserved = reservedRaw.lt(0) ? new Prisma.Decimal(0) : reservedRaw;
    const available = qty.sub(reserved);
    if (available.lt(needQty)) {
      const err = new Error("INSUFFICIENT_STOCK") as Error & {
        product_id: number;
        available: string;
        requested: string;
      };
      err.product_id = productId;
      err.available = available.toString();
      err.requested = needQty.toString();
      throw err;
    }
  }

  const bonusRoom = new Map<number, Prisma.Decimal>();
  for (const productId of productIds) {
    const row = stockMap.get(productId);
    const qty = row?.qty ?? new Prisma.Decimal(0);
    const reservedRaw = row?.reserved_qty ?? new Prisma.Decimal(0);
    const reserved = reservedRaw.lt(0) ? new Prisma.Decimal(0) : reservedRaw;
    const available = qty.sub(reserved);
    const paid = paidNeed.get(productId) ?? new Prisma.Decimal(0);
    const room = available.sub(paid);
    bonusRoom.set(productId, room.gt(0) ? room : new Prisma.Decimal(0));
  }

  const capped: CreateOrderPaidBundle["bonusCreates"] = [];
  const shortageParts: Array<{ productId: number; requested: number; given: number }> = [];
  let bonusSum = new Prisma.Decimal(0);

  for (const b of bonusCreates) {
    const room = bonusRoom.get(b.product_id) ?? new Prisma.Decimal(0);
    const req = b.qty;
    const given = Prisma.Decimal.min(req, room);
    bonusRoom.set(b.product_id, room.sub(given));

    if (given.lte(0)) {
      if (req.gt(0)) {
        shortageParts.push({
          productId: b.product_id,
          requested: Number(req),
          given: 0
        });
      }
      continue;
    }

    const total = roundOrderMoney(given.mul(b.price));
    bonusSum = bonusSum.add(total);
    capped.push({
      product_id: b.product_id,
      qty: given,
      price: b.price,
      total,
      is_bonus: true as const
    });

    if (given.lt(req)) {
      shortageParts.push({
        productId: b.product_id,
        requested: Number(req),
        given: Number(given)
      });
    }
  }

  if (shortageParts.length === 0) {
    return { bonusCreates: capped, bonusSum, bonusAlert: null, shortageComment: null };
  }

  const names = await tx.product.findMany({
    where: { tenant_id: tenantId, id: { in: shortageParts.map((s) => s.productId) } },
    select: { id: true, name: true }
  });
  const nameById = new Map(names.map((p) => [p.id, p.name]));

  const commentParts = shortageParts.map((s) => {
    const name = nameById.get(s.productId) ?? `#${s.productId}`;
    const short = s.requested - s.given;
    return `${name}: не хватает ${short} шт. (положено ${s.requested}, выдано ${s.given})`;
  });

  return {
    bonusCreates: capped,
    bonusSum,
    bonusAlert: "stock_shortage",
    shortageComment: `Бонус — недостаток на складе: ${commentParts.join("; ")}`
  };
}

function appendComment(base: string | null | undefined, extra: string | null): string | null {
  const b = (base ?? "").trim();
  const e = (extra ?? "").trim();
  if (!e) return b || null;
  if (!b) return e;
  if (b.includes(e)) return b;
  return `${b}\n${e}`;
}

export function mergeOrderAutoComments(
  baseComment: string | null | undefined,
  parts: Array<string | null | undefined>
): string | null {
  let out = (baseComment ?? "").trim() || null;
  for (const p of parts) {
    out = appendComment(out, p ?? null);
  }
  return out?.trim() || null;
}
