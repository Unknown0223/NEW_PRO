/**
 * Yuklar hisoboti — order_type=exchange qatorlarini «Обмен отгруз / Обмен возврат» ga ajratish.
 * qty = hujjat soni (return/shelf_return bilan bir xil); sum = plus/minus qator total'lari.
 */

export type ExchangeLineForShipment = {
  exchange_line_kind: string | null | undefined;
  /** number | string | Prisma.Decimal */
  total: { toString(): string } | number | string;
  is_bonus?: boolean | null;
};

export type ExchangeOrderForShipment = {
  items: ExchangeLineForShipment[];
};

export type ShipmentSideAgg = { qty: number; sum: number };

function lineTotal(raw: ExchangeLineForShipment["total"]): number {
  const n = typeof raw === "number" ? raw : Number(raw.toString());
  return Number.isFinite(n) ? n : 0;
}

export function aggregateExchangeShipmentSides(
  orders: ExchangeOrderForShipment[]
): { exchange_ship: ShipmentSideAgg; exchange_return: ShipmentSideAgg } {
  let shipQty = 0;
  let shipSum = 0;
  let returnQty = 0;
  let returnSum = 0;

  for (const order of orders) {
    let hasPlus = false;
    let hasMinus = false;
    for (const item of order.items) {
      if (item.is_bonus) continue;
      const kind = item.exchange_line_kind;
      if (kind === "plus") {
        hasPlus = true;
        shipSum += lineTotal(item.total);
      } else if (kind === "minus") {
        hasMinus = true;
        returnSum += lineTotal(item.total);
      }
    }
    if (hasPlus) shipQty += 1;
    if (hasMinus) returnQty += 1;
  }

  return {
    exchange_ship: { qty: shipQty, sum: shipSum },
    exchange_return: { qty: returnQty, sum: returnSum }
  };
}
