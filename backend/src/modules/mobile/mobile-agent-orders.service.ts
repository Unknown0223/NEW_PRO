import { Prisma } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "../../config/database";
import type { mobileCreateOrderBodySchema } from "../../contracts/mobile.schemas";
import {
  loadDeliveryDebtByClient,
  mergeLedgerWithUnpaidDelivered
} from "../client-balances/client-balances.service";
import { createOrder } from "../orders/domain/order.create";
import { loadAvailableQtyByProductId } from "../orders/order-bonus-context.match-gifts";
import { getOrderCreateContextBundle } from "../orders/order-create-context.service";
import { listWarehousesForTenant } from "../reference/reference.service";
import {
  executionPctFromPlanFact,
  loadMonitoringPlanAggregates
} from "../plans/plans.monitoring-aggregates";
import { assertOrderAgentAllowedForClient } from "../work-slots/work-slots.lock";
import { getMobileOrderClientFinance } from "./mobile-order-client-finance";
import {
  assertStockSnapshotToday,
  validateShipmentDateRequired
} from "./mobile-order-policy";
import {
  agentScopedClientWhere,
  agentScopedOrderWhere,
  assertAgentScopedClient,
  assertMobilePhotoReportForClient,
  loadAgentMobileConfig,
  localTodayRange,
  monthUtcRange
} from "./mobile-agent-sync.service";

export async function getMobileOrderCreateContext(
  tenantId: number,
  userId: number,
  opts?: { clientId?: number; warehouseId?: number }
) {
  const bundle = await getOrderCreateContextBundle(tenantId, {
    selected_client_id: opts?.clientId,
    selected_warehouse_id: opts?.warehouseId,
    selected_agent_id: userId
  });

  const clientFinance =
    opts?.clientId != null
      ? await getMobileOrderClientFinance(tenantId, userId, opts.clientId)
      : null;

  return {
    warehouses: bundle.warehouses,
    price_types: bundle.price_types,
    products: bundle.products.map((p) => ({
      ...p,
      category_name: p.category?.name ?? null
    })),
    client_finance: clientFinance
  };
}

export async function getMobileOrderStock(
  tenantId: number,
  warehouseId: number,
  productIds: number[]
) {
  const available = await loadAvailableQtyByProductId(
    prisma,
    tenantId,
    warehouseId,
    productIds
  );
  return productIds.map((product_id) => ({
    product_id,
    available: available.get(product_id) ?? 0
  }));
}

export async function getMobileWarehouseStockView(
  tenantId: number,
  userId: number,
  warehouseId?: number
) {
  const warehouses = await listWarehousesForTenant(tenantId);
  const whId = warehouseId ?? warehouses[0]?.id;
  if (whId == null) {
    return { warehouses, warehouse_id: null, categories: [] };
  }

  const stocks = await prisma.stock.findMany({
    where: {
      tenant_id: tenantId,
      warehouse_id: whId,
      qty: { gt: 0 }
    },
    select: {
      qty: true,
      reserved_qty: true,
      product: {
        select: {
          id: true,
          name: true,
          category: { select: { id: true, name: true } },
          prices: { select: { price_type: true, price: true, currency: true }, take: 3 }
        }
      }
    },
    take: 5000
  });

  const byCategory = new Map<string, Array<{ name: string; available: number; price?: string; currency?: string }>>();
  for (const s of stocks) {
    const free = Math.max(0, Number(s.qty) - Math.max(0, Number(s.reserved_qty)));
    if (free <= 0) continue;
    const cat = s.product.category?.name ?? "Boshqa";
    const retail = s.product.prices.find((p) => p.price_type === "retail") ?? s.product.prices[0];
    const list = byCategory.get(cat) ?? [];
    list.push({
      name: s.product.name,
      available: free,
      ...(retail
        ? { price: retail.price.toString(), currency: retail.currency }
        : {})
    });
    byCategory.set(cat, list);
  }

  const categories = [...byCategory.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "ru"))
    .map(([name, items]) => ({
      name,
      items: items.sort((a, b) => a.name.localeCompare(b.name, "ru"))
    }));

  void userId;
  return { warehouses, warehouse_id: whId, categories };
}

export async function createMobileOrder(
  tenantId: number,
  userId: number,
  role: string,
  body: z.infer<typeof mobileCreateOrderBodySchema>
) {
  const cfg = await loadAgentMobileConfig(tenantId, userId);
  if (cfg) {
    await assertStockSnapshotToday(tenantId, userId, cfg);
    validateShipmentDateRequired(cfg, body.shipment_date);
  }
  await assertAgentScopedClient(tenantId, userId, body.client_id);
  await assertMobilePhotoReportForClient(tenantId, userId, body.client_id, cfg);
  await assertOrderAgentAllowedForClient(tenantId, body.client_id, userId);

  return createOrder(
    tenantId,
    {
      client_id: body.client_id,
      warehouse_id: body.warehouse_id,
      agent_id: userId,
      price_type: body.price_type,
      comment: body.comment ?? null,
      is_consignment: body.is_consignment,
      consignment_due_date: body.consignment_due_date ?? null,
      apply_bonus: body.apply_bonus ?? true,
      apply_discount: body.apply_discount ?? true,
      bonus_gift_overrides: body.bonus_gift_overrides,
      bonus_gift_lines: body.bonus_gift_lines,
      order_type: "order",
      items: body.items
    },
    { role, userId }
  );
}

function mapOrderHistoryRow(o: {
  id: number;
  number: string;
  order_type: string;
  status: string;
  total_sum: Prisma.Decimal;
  bonus_sum: Prisma.Decimal;
  discount_sum: Prisma.Decimal | null;
  created_at: Date;
  client: { name: string };
  items: Array<{
    qty: Prisma.Decimal;
    price: Prisma.Decimal;
    total: Prisma.Decimal;
    is_bonus: boolean;
    product: { name: string; volume_m3: Prisma.Decimal | null };
  }>;
}) {
  let qty = 0;
  let bonusQty = 0;
  let volumeM3 = 0;
  for (const it of o.items) {
    const q = Number(it.qty);
    if (it.is_bonus) bonusQty += q;
    else qty += q;
    const vol = it.product.volume_m3 != null ? Number(it.product.volume_m3) : 0;
    volumeM3 += q * vol;
  }
  return {
    id: o.id,
    number: o.number,
    order_type: o.order_type,
    status: o.status,
    client_name: o.client.name,
    created_at: o.created_at.toISOString(),
    total_sum: Number(o.total_sum),
    bonus_sum: Number(o.bonus_sum),
    discount_sum: Number(o.discount_sum ?? 0),
    qty,
    bonus_qty: bonusQty,
    volume_m3: volumeM3 > 0 ? volumeM3 : null,
    items: o.items.map((it) => ({
      product_name: it.product.name,
      qty: Number(it.qty),
      price: Number(it.price),
      total: Number(it.total),
      is_bonus: it.is_bonus
    }))
  };
}

export async function listMobileAgentOrdersHistory(
  tenantId: number,
  userId: number,
  opts?: { date?: string }
) {
  const dateStr = opts?.date ?? new Date().toISOString().slice(0, 10);
  const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
  const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);

  const orders = await prisma.order.findMany({
    where: {
      ...agentScopedOrderWhere(tenantId, userId),
      created_at: { gte: dayStart, lte: dayEnd }
    },
    orderBy: { created_at: "desc" },
    take: 200,
    select: {
      id: true,
      number: true,
      order_type: true,
      status: true,
      total_sum: true,
      bonus_sum: true,
      discount_sum: true,
      created_at: true,
      client: { select: { name: true } },
      items: {
        select: {
          qty: true,
          price: true,
          total: true,
          is_bonus: true,
          product: { select: { name: true, volume_m3: true } }
        }
      }
    }
  });

  return {
    date: dateStr,
    data: orders.map(mapOrderHistoryRow)
  };
}

export async function getMobileAgentOrderDetail(
  tenantId: number,
  userId: number,
  orderId: number
) {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      ...agentScopedOrderWhere(tenantId, userId)
    },
    select: {
      id: true,
      number: true,
      order_type: true,
      status: true,
      total_sum: true,
      bonus_sum: true,
      discount_sum: true,
      created_at: true,
      client: { select: { name: true } },
      items: {
        select: {
          qty: true,
          price: true,
          total: true,
          is_bonus: true,
          product: { select: { name: true, volume_m3: true } }
        }
      }
    }
  });
  if (!order) throw new Error("NOT_FOUND");
  return mapOrderHistoryRow(order);
}

export async function getMobileAgentDashboard(tenantId: number, userId: number) {
  const { start, end } = localTodayRange();
  const month = end.getUTCMonth() + 1;
  const year = end.getUTCFullYear();

  const [clientsCount, visitsToday, ordersAgg, pendingOffline, planAgg] = await Promise.all([
    prisma.client.count({
      where: { ...agentScopedClientWhere(tenantId, userId), is_active: true }
    }),
    prisma.agentVisit.count({
      where: {
        tenant_id: tenantId,
        agent_id: userId,
        checked_in_at: { gte: start, lte: end }
      }
    }),
    prisma.order.aggregate({
      where: {
        ...agentScopedOrderWhere(tenantId, userId),
        order_type: "order",
        created_at: { gte: start, lte: end }
      },
      _count: true,
      _sum: { total_sum: true }
    }),
    prisma.order.count({
      where: { ...agentScopedOrderWhere(tenantId, userId), status: "pending_sync" }
    }),
    loadMonitoringPlanAggregates(tenantId, month, year, {
      tenantId,
      agent_ids: [userId],
      supervisor_ids: [],
      branch_codes: [],
      territory_1_list: [],
      territory_2_list: [],
      territory_3_list: [],
      territory_terms: []
    })
  ]);

  const ordersSumToday = Number(ordersAgg._sum.total_sum ?? 0);
  const planSum = Number(planAgg.byAgent.get(userId) ?? 0);
  const performancePct =
    planSum > 0 ? Math.round((ordersSumToday / planSum) * 100) : executionPctFromPlanFact(
        new Prisma.Decimal(planSum),
        ordersSumToday
      ) ?? 0;

  return {
    clients_count: clientsCount,
    visits_today: visitsToday,
    orders_today: ordersAgg._count,
    orders_sum_today: ordersSumToday,
    plan_sum: planSum,
    performance_pct: performancePct ?? 0,
    pending_offline: pendingOffline
  };
}

export async function getMobileAgentDailySales(tenantId: number, userId: number) {
  const { start, end } = monthUtcRange();
  const date = start.toISOString().slice(0, 10);

  const rows = await prisma.$queryRaw<
    Array<{
      category_name: string | null;
      parent_name: string | null;
      qty: Prisma.Decimal;
      volume_m3: Prisma.Decimal;
      sum: Prisma.Decimal;
      akb: bigint;
    }>
  >`
    WITH lines AS (
      SELECT
        o.client_id,
        oi.qty,
        oi.total,
        oi.is_bonus,
        pc.name AS category_name,
        parent.name AS parent_name,
        COALESCE(p.volume_m3, 0)::numeric(14,6) AS volume_unit
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id AND p.tenant_id = ${tenantId}
      LEFT JOIN product_categories pc ON pc.id = p.category_id
      LEFT JOIN product_categories parent ON parent.id = pc.parent_id
      WHERE o.tenant_id = ${tenantId}
        AND o.agent_id = ${userId}
        AND o.created_at >= ${start}
        AND o.created_at < ${end}
        AND o.order_type IN ('order', 'return_by_order')
        AND oi.is_bonus = false
    ),
    signed AS (
      SELECT
        client_id,
        CASE WHEN category_name IS NULL OR btrim(category_name) = '' THEN 'Boshqa' ELSE category_name END AS category_name,
        parent_name,
        qty,
        total,
        qty * volume_unit AS volume_m3
      FROM lines
    )
    SELECT
      category_name,
      parent_name,
      COALESCE(SUM(qty), 0)::numeric(15,3) AS qty,
      COALESCE(SUM(volume_m3), 0)::numeric(15,6) AS volume_m3,
      COALESCE(SUM(total), 0)::numeric(15,2) AS sum,
      COUNT(DISTINCT client_id)::bigint AS akb
    FROM signed
    GROUP BY category_name, parent_name
    ORDER BY category_name ASC
  `;

  const treeRows: Array<{ name: string; qty: number; volume_m3: number; sum: number; depth: number }> = [];
  const parentMap = new Map<string, { qty: number; volume_m3: number; sum: number; akb: number }>();
  let totalQty = 0;
  let totalVol = 0;
  let totalSum = 0;
  const akbSet = new Set<number>();

  for (const r of rows) {
    const qty = Number(r.qty);
    const vol = Number(r.volume_m3);
    const sum = Number(r.sum);
    totalQty += qty;
    totalVol += vol;
    totalSum += sum;

    if (r.parent_name) {
      const key = r.parent_name;
      const prev = parentMap.get(key) ?? { qty: 0, volume_m3: 0, sum: 0, akb: 0 };
      prev.qty += qty;
      prev.volume_m3 += vol;
      prev.sum += sum;
      prev.akb += Number(r.akb);
      parentMap.set(key, prev);
      treeRows.push({ name: r.category_name ?? "Boshqa", qty, volume_m3: vol, sum, depth: 1 });
    } else {
      treeRows.push({ name: r.category_name ?? "Boshqa", qty, volume_m3: vol, sum, depth: 0 });
    }
  }

  for (const [name, agg] of parentMap.entries()) {
    treeRows.unshift({ name, qty: agg.qty, volume_m3: agg.volume_m3, sum: agg.sum, depth: 0 });
  }

  return {
    date,
    totals: {
      qty: totalQty,
      volume_m3: totalVol,
      sum: totalSum,
      akb: akbSet.size || rows.reduce((acc, r) => acc + Number(r.akb), 0)
    },
    rows: treeRows
  };
}

export async function listMobileAgentDebtors(tenantId: number, userId: number, limit = 100) {
  const clients = await prisma.client.findMany({
    where: { ...agentScopedClientWhere(tenantId, userId), is_active: true },
    select: {
      id: true,
      name: true,
      phone: true,
      client_code: true,
      client_balances: { take: 1, select: { balance: true } }
    },
    orderBy: { name: "asc" },
    take: Math.min(limit, 200)
  });

  const clientIds = clients.map((c) => c.id);
  const deliveryMap = await loadDeliveryDebtByClient(tenantId, clientIds);

  return clients
    .map((c) => {
      const ledger = c.client_balances[0]?.balance ?? new Prisma.Decimal(0);
      const merged = mergeLedgerWithUnpaidDelivered(ledger, deliveryMap.get(c.id));
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        client_code: c.client_code,
        balance: Number(merged),
        overdue_at: deliveryMap.get(c.id)?.firstDel?.toISOString() ?? null
      };
    })
    .filter((c) => c.balance < -0.01)
    .sort((a, b) => a.balance - b.balance)
    .slice(0, limit);
}
