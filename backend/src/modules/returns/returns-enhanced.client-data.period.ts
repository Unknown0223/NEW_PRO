import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { ClientReturnsData, OrderItemSummary } from "./returns-enhanced.types";
import {
  adjustOrderItemsQtyAfterPriorReturns,
  localDayEnd,
  localDayStart
} from "./returns-enhanced.helpers";
import { computeOrderReturnBalance } from "./returns-order-balance";
import { mergeOptionalDateRange } from "./returns-filter.service";
import { buildReturnFilterMetaForClient } from "./returns-filter.stats";
import { logReturnFilterDecision } from "./returns-filter.log";
import { POLKI_SOURCE_ORDER_STATUS } from "./returns-enhanced.client-data.shared";

export async function loadClientReturnsPeriodData(
  tenantId: number,
  clientId: number,
  dateFrom?: string,
  dateTo?: string,
  shrinkLineQtyAfterReturns = true
): Promise<ClientReturnsData> {
  const { window: filterWindow, meta: filterMeta } = await buildReturnFilterMetaForClient(
    tenantId,
    clientId
  );
  logReturnFilterDecision(tenantId, clientId, filterMeta, "client-data");

  if (filterWindow.empty) {
    const balance = new Prisma.Decimal(filterMeta.client_balance ?? "0");
    return {
      polki_scope: "period",
      orders: [],
      items: [],
      total_orders: 0,
      total_returned_qty: "0",
      total_paid_value: "0",
      already_returned_value: "0",
      max_returnable_value: "0",
      client_balance: balance.toString(),
      client_debt: balance.lt(0) ? balance.abs().toString() : "0",
      filter_meta: filterMeta
    };
  }

  const createdAt = mergeOptionalDateRange(filterWindow, dateFrom, dateTo, localDayStart, localDayEnd);

  const orders = await prisma.order.findMany({
    where: {
      tenant_id: tenantId,
      client_id: clientId,
      status: POLKI_SOURCE_ORDER_STATUS,
      ...(createdAt ? { created_at: createdAt } : {})
    },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      number: true,
      status: true,
      total_sum: true,
      bonus_sum: true,
      created_at: true,
      items: {
        select: {
          product_id: true,
          qty: true,
          price: true,
          total: true,
          is_bonus: true,
          product: { select: { sku: true, name: true, unit: true, category_id: true } }
        }
      }
    }
  });

  const orderIds = orders.map((o) => o.id);
  const returns =
    orderIds.length === 0
      ? []
      : await prisma.salesReturn.findMany({
          where: {
            tenant_id: tenantId,
            client_id: clientId,
            order_id: { in: orderIds },
            status: "posted"
          },
          select: {
            order_id: true,
            refund_amount: true,
            lines: { select: { product_id: true, qty: true, paid_qty: true, bonus_qty: true } }
          }
        });

  let totalPaidValue = new Prisma.Decimal(0);
  const items: OrderItemSummary[] = [];
  for (const o of orders) {
    for (const item of o.items) {
      items.push({
        product_id: item.product_id,
        sku: item.product.sku,
        name: item.product.name,
        unit: item.product.unit,
        qty: item.qty.toString(),
        price: item.price.toString(),
        total: item.total.toString(),
        is_bonus: item.is_bonus,
        order_id: o.id,
        order_number: o.number,
        category_id: item.product.category_id
      });
      if (!item.is_bonus) totalPaidValue = totalPaidValue.add(item.total);
    }
  }

  const itemsOut = shrinkLineQtyAfterReturns
    ? adjustOrderItemsQtyAfterPriorReturns(items, returns)
    : items;

  const orderBalances = orders.map((o) => {
    const orig = items.filter((i) => i.order_id === o.id);
    const rem = itemsOut.filter((i) => i.order_id === o.id);
    return computeOrderReturnBalance(o.id, orig, rem, returns);
  });

  const openOrderIds = new Set(
    orderBalances.filter((b) => !b.fully_returned).map((b) => b.order_id)
  );
  const openOrders = orders.filter((o) => openOrderIds.has(o.id));
  const openItems = itemsOut.filter((i) => openOrderIds.has(i.order_id));

  const totalReturnedQty = returns.reduce(
    (a, ret) => a + ret.lines.reduce((b, l) => b + Number(l.qty), 0),
    0
  );
  const alreadyReturned = returns.reduce(
    (a, r) => a.add(r.refund_amount ?? new Prisma.Decimal(0)),
    new Prisma.Decimal(0)
  );

  const bal = await prisma.clientBalance.findUnique({
    where: { tenant_id_client_id: { tenant_id: tenantId, client_id: clientId } },
    select: { balance: true }
  });
  const balance = bal?.balance ?? new Prisma.Decimal(0);
  const maxReturnable = totalPaidValue.sub(alreadyReturned);

  return {
    polki_scope: "period",
    orders: openOrders.map((o) => ({
      id: o.id,
      number: o.number,
      status: o.status,
      total_sum: o.total_sum.toString(),
      bonus_sum: o.bonus_sum.toString(),
      created_at: o.created_at.toISOString()
    })),
    items: openItems,
    order_balances: orderBalances.filter((b) => openOrderIds.has(b.order_id)),
    total_orders: openOrders.length,
    total_returned_qty: String(totalReturnedQty),
    total_paid_value: totalPaidValue.toString(),
    already_returned_value: alreadyReturned.toString(),
    max_returnable_value: maxReturnable.gt(0) ? maxReturnable.toString() : "0",
    client_balance: balance.toString(),
    client_debt: balance.lt(0) ? balance.abs().toString() : "0",
    filter_meta: filterMeta
  };
}
