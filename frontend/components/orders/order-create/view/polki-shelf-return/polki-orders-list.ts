import type { PolkiOrderGroup, PolkiOrderPickRow, PolkiPairRowModel } from "../../types";
import type { OrderReturnBalanceView } from "./return-order-balance-block";
import { polkiOrderBonusLimits } from "./polki-bonus-calc";
import { orderStatusLabelRu, parsePriceAmount, parseStockQty, polkiOrderRowHasBonus } from "../../utils";
import { formatPolkiMoneySum, formatPolkiQtyDisplay } from "./polki-format-display";
import {
  summarizePolkiOrderRows,
  type PolkiOrderCompositionSummary
} from "./polki-order-composition";

export type PolkiOrdersListEntry = {
  orderId: number;
  orderNumber: string;
  orderDate: string;
  status: string;
  statusLabel: string;
  warehouseName: string | null;
  qtyDisplay: string;
  sumDisplay: string;
  bonusSumDisplay: string;
  hasBonus: boolean;
  lineCount: number;
  maxPaid: number;
  maxBonus: number;
  composition: PolkiOrderCompositionSummary | null;
  pickable: boolean;
  selected: boolean;
  balance: OrderReturnBalanceView | null;
};

type ContextOrder = {
  id: number;
  number: string;
  status: string;
  created_at: string;
  total_sum?: string;
  bonus_sum?: string;
};

export function buildPolkiOrdersListEntries(input: {
  isPolkiByOrder: boolean;
  polkiOrderIdSet: Set<number>;
  polkiOrdersForPick: PolkiOrderPickRow[];
  contextOrders: ContextOrder[] | undefined;
  polkiOrderGroups: PolkiOrderGroup[];
  polkiRowsAll: PolkiPairRowModel[];
  pickById: Map<number, PolkiOrderPickRow>;
  orderBalanceById?: Map<number, OrderReturnBalanceView>;
}): PolkiOrdersListEntry[] {
  const groupById = new Map(input.polkiOrderGroups.map((g) => [g.orderId, g]));
  const seen = new Set<number>();
  const out: PolkiOrdersListEntry[] = [];

  const compositionForOrder = (orderId: number): PolkiOrderCompositionSummary | null => {
    const rows = input.polkiRowsAll.filter((r) => r.order_id === orderId);
    return rows.length > 0 ? summarizePolkiOrderRows(rows) : null;
  };

  const pushFromPick = (o: PolkiOrderPickRow) => {
    if (seen.has(o.id)) return;
    seen.add(o.id);
    const g = groupById.get(o.id);
    const orderRows = input.polkiRowsAll.filter((r) => r.order_id === o.id);
    const limits =
      orderRows.length > 0
        ? polkiOrderBonusLimits(orderRows)
        : g
          ? polkiOrderBonusLimits(g.rows)
          : { maxPaid: 0, maxBonus: 0 };
    const composition = compositionForOrder(o.id);
    const dateStr = o.created_at ? String(o.created_at).slice(0, 10) : "—";
    const balance = input.orderBalanceById?.get(o.id) ?? null;
    out.push({
      orderId: o.id,
      orderNumber: o.number,
      orderDate: dateStr,
      status: o.status,
      statusLabel: orderStatusLabelRu(o.status),
      warehouseName: o.warehouse_name?.trim() || null,
      qtyDisplay:
        o.qty != null && String(o.qty).trim() !== ""
          ? formatPolkiQtyDisplay(parseStockQty(o.qty))
          : g
            ? formatPolkiQtyDisplay(g.rows.length)
            : "—",
      sumDisplay:
        o.total_sum != null && String(o.total_sum).trim() !== ""
          ? formatPolkiMoneySum(o.total_sum)
          : "—",
      bonusSumDisplay:
        o.bonus_sum != null && String(o.bonus_sum).trim() !== ""
          ? formatPolkiMoneySum(o.bonus_sum)
          : "0",
      hasBonus: polkiOrderRowHasBonus(o) || limits.maxBonus > 0,
      lineCount: g?.rows.length ?? 0,
      maxPaid: limits.maxPaid,
      maxBonus: limits.maxBonus,
      composition,
      pickable: input.isPolkiByOrder && !(balance?.fully_returned ?? false),
      selected: input.polkiOrderIdSet.has(o.id),
      balance
    });
  };

  const pushFromContext = (o: ContextOrder) => {
    if (seen.has(o.id)) return;
    const g = groupById.get(o.id);
    if (!g && input.isPolkiByOrder) return;
    seen.add(o.id);
    const pick = input.pickById.get(o.id);
    const limits = g ? polkiOrderBonusLimits(g.rows) : { maxPaid: 0, maxBonus: 0 };
    const composition = compositionForOrder(o.id);
    const dateStr = o.created_at ? String(o.created_at).slice(0, 10) : "—";
    const bonusSum = parsePriceAmount(o.bonus_sum ?? "0");
    out.push({
      orderId: o.id,
      orderNumber: o.number,
      orderDate: dateStr,
      status: o.status,
      statusLabel: orderStatusLabelRu(o.status),
      warehouseName: pick?.warehouse_name?.trim() || null,
      qtyDisplay: g ? formatPolkiQtyDisplay(g.rows.length) : "—",
      sumDisplay:
        o.total_sum != null && String(o.total_sum).trim() !== ""
          ? formatPolkiMoneySum(o.total_sum)
          : "—",
      bonusSumDisplay: bonusSum > 0 ? formatPolkiMoneySum(bonusSum) : "0",
      hasBonus: bonusSum > 0 || limits.maxBonus > 0,
      lineCount: g?.rows.length ?? 0,
      maxPaid: limits.maxPaid,
      maxBonus: limits.maxBonus,
      composition,
      pickable: input.isPolkiByOrder && Boolean(pick) && !(input.orderBalanceById?.get(o.id)?.fully_returned ?? false),
      selected: input.polkiOrderIdSet.has(o.id),
      balance: input.orderBalanceById?.get(o.id) ?? null
    });
  };

  if (input.isPolkiByOrder) {
    for (const o of input.polkiOrdersForPick) pushFromPick(o);
  } else {
    for (const o of input.contextOrders ?? []) pushFromContext(o);
    for (const g of input.polkiOrderGroups) {
      if (seen.has(g.orderId)) continue;
      const pick = input.pickById.get(g.orderId);
      if (pick) pushFromPick(pick);
      else {
        seen.add(g.orderId);
        const limits = polkiOrderBonusLimits(g.rows);
        out.push({
          orderId: g.orderId,
          orderNumber: g.orderNumber,
          orderDate: g.orderDate || "—",
          status: "delivered",
          statusLabel: orderStatusLabelRu("delivered"),
          warehouseName: null,
          qtyDisplay: String(g.rows.length),
          sumDisplay: "—",
          bonusSumDisplay: limits.maxBonus > 0 ? "∑" : "0",
          hasBonus: limits.maxBonus > 0,
          lineCount: g.rows.length,
          maxPaid: limits.maxPaid,
          maxBonus: limits.maxBonus,
          composition: compositionForOrder(g.orderId),
          pickable: false,
          selected: false,
          balance: input.orderBalanceById?.get(g.orderId) ?? null
        });
      }
    }
  }

  return out.sort((a, b) => b.orderDate.localeCompare(a.orderDate) || a.orderId - b.orderId);
}
