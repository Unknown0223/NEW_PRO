import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/database";
import { statusContributesToDeliveredReceivableDebt } from "../order-status";
import {
  orderMerchandiseNetReceivable,
  type OrderMerchandiseRuleHint
} from "../order-merchandise-net";
import {
  loadDeliveryDebtByClient,
  mergeLedgerWithUnpaidDelivered
} from "../../client-balances/client-balances.service";

type OrderFinanceSlice = {
  id: number;
  client_id: number;
  order_type: string;
  status: string;
  total_sum: Prisma.Decimal;
  discount_sum: Prisma.Decimal;
  applied_auto_bonus_rule_ids: number[];
};

async function loadMerchandiseRulesById(
  tenantId: number,
  ruleIds: number[]
): Promise<Map<number, OrderMerchandiseRuleHint>> {
  const out = new Map<number, OrderMerchandiseRuleHint>();
  if (ruleIds.length === 0) return out;
  const rows = await prisma.bonusRule.findMany({
    where: { tenant_id: tenantId, id: { in: ruleIds } },
    select: { id: true, type: true, discount_pct: true }
  });
  for (const r of rows) {
    out.set(r.id, {
      type: r.type,
      discount_pct: r.discount_pct != null ? Number(r.discount_pct) : null
    });
  }
  return out;
}

/** Ro‘yxat va bitta zakaz tafsiloti: taqsimot, mijoz balansi, birinchi «отгружен/доставлен» vaqtlari. */
export async function loadOrdersFinanceEnrichment(
  tenantId: number,
  slices: OrderFinanceSlice[]
): Promise<
  Map<
    number,
    {
      debt: string | null;
      balance: string | null;
      delivered_at: string | null;
      shipped_at: string | null;
    }
  >
> {
  const out = new Map<
    number,
    {
      debt: string | null;
      balance: string | null;
      delivered_at: string | null;
      shipped_at: string | null;
    }
  >();
  if (slices.length === 0) return out;

  const ids = slices.map((s) => s.id);
  const clientIds = [...new Set(slices.map((s) => s.client_id))];
  const ruleIds = [...new Set(slices.flatMap((s) => s.applied_auto_bonus_rule_ids))];

  const [allocRows, statusRows, balRows, deliveryByClient, rulesById] = await Promise.all([
    prisma.$queryRaw<Array<{ order_id: number; alloc: Prisma.Decimal }>>`
      SELECT order_id, COALESCE(SUM(amount), 0)::decimal(15,2) AS alloc
      FROM payment_allocations
      WHERE tenant_id = ${tenantId}
        AND order_id IN (${Prisma.join(ids)})
      GROUP BY order_id
    `,
    prisma.$queryRaw<Array<{ order_id: number; to_status: string; first_at: Date }>>`
      SELECT order_id, to_status, MIN(created_at) AS first_at
      FROM order_status_logs
      WHERE order_id IN (${Prisma.join(ids)})
        AND to_status IN ('delivering', 'delivered')
      GROUP BY order_id, to_status
    `,
    prisma.clientBalance.findMany({
      where: { tenant_id: tenantId, client_id: { in: clientIds } },
      select: { client_id: true, balance: true }
    }),
    loadDeliveryDebtByClient(tenantId, clientIds),
    loadMerchandiseRulesById(tenantId, ruleIds)
  ]);

  const allocByOrder = new Map<number, Prisma.Decimal>();
  for (const r of allocRows) {
    allocByOrder.set(r.order_id, r.alloc);
  }

  const shippedDelivered = new Map<number, { ship?: Date; del?: Date }>();
  for (const r of statusRows) {
    const cur = shippedDelivered.get(r.order_id) ?? {};
    if (r.to_status === "delivering") cur.ship = r.first_at;
    if (r.to_status === "delivered") cur.del = r.first_at;
    shippedDelivered.set(r.order_id, cur);
  }

  const balByClient = new Map<number, Prisma.Decimal>();
  for (const b of balRows) {
    balByClient.set(b.client_id, b.balance);
  }

  for (const s of slices) {
    const allocated = allocByOrder.get(s.id) ?? new Prisma.Decimal(0);
    let debt: string | null = null;
    if (statusContributesToDeliveredReceivableDebt(s.status, s.order_type)) {
      const merchandiseNet = orderMerchandiseNetReceivable(
        s.total_sum,
        s.discount_sum,
        s.applied_auto_bonus_rule_ids,
        rulesById
      );
      const unpaid = merchandiseNet.sub(allocated);
      debt = (unpaid.gt(0) ? unpaid : new Prisma.Decimal(0)).toString();
    }
    const ledger = balByClient.get(s.client_id) ?? new Prisma.Decimal(0);
    const blend = deliveryByClient.get(s.client_id);
    const displayBal = mergeLedgerWithUnpaidDelivered(ledger, blend);
    const times = shippedDelivered.get(s.id);
    out.set(s.id, {
      debt,
      balance: displayBal.toString(),
      delivered_at: times?.del?.toISOString() ?? null,
      shipped_at: times?.ship?.toISOString() ?? null
    });
  }
  return out;
}
