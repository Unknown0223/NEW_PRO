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
import { loadOrderCreateCatalogSlice } from "../orders/order-create-context.catalog";
import { listWarehousesForTenant } from "../reference/reference.service";
import { resolveConstraintScope } from "../linkage/linkage.service";
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
  monthUtcRange,
  workRegionDayRange,
  workRegionTodayKey
} from "./mobile-agent-sync.service";

type WarehouseLite = { id: number; name: string; type?: string | null };

/** Agent bog‘langan ombor — zakaz/ostatka uchun default (tarixdagi boshqa ombor emas). */
async function resolveAgentDefaultWarehouseId(
  tenantId: number,
  userId: number,
  warehouses: WarehouseLite[]
): Promise<number | null> {
  if (warehouses.length === 0) return null;
  const allowed = new Set(warehouses.map((w) => w.id));

  const links = await prisma.warehouseUserLink.findMany({
    where: {
      user_id: userId,
      warehouse_id: { in: [...allowed] },
      warehouse: { tenant_id: tenantId, is_active: true }
    },
    select: { warehouse_id: true, warehouse: { select: { type: true, name: true } } },
    orderBy: { warehouse_id: "asc" }
  });
  if (links.length > 0) {
    const main = links.find((l) => l.warehouse.type === "main");
    const pick = main ?? links[0]!;
    return pick.warehouse_id;
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, tenant_id: tenantId },
    select: { warehouse_id: true }
  });
  if (user?.warehouse_id != null && allowed.has(user.warehouse_id)) {
    return user.warehouse_id;
  }

  return warehouses[0]!.id;
}

function sortWarehousesDefaultFirst<T extends WarehouseLite>(
  warehouses: T[],
  defaultId: number | null
): T[] {
  if (defaultId == null) return warehouses;
  const head = warehouses.filter((w) => w.id === defaultId);
  const tail = warehouses.filter((w) => w.id !== defaultId);
  return [...head, ...tail];
}

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

  const defaultWarehouseId = await resolveAgentDefaultWarehouseId(
    tenantId,
    userId,
    bundle.warehouses
  );
  const warehouses = sortWarehousesDefaultFirst(bundle.warehouses, defaultWarehouseId);

  return {
    warehouses,
    default_warehouse_id: defaultWarehouseId,
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
  const bundle = await getOrderCreateContextBundle(tenantId, { selected_agent_id: userId });
  const defaultWhId = await resolveAgentDefaultWarehouseId(tenantId, userId, bundle.warehouses);
  const warehouses = sortWarehousesDefaultFirst(bundle.warehouses, defaultWhId);
  const whId = warehouseId ?? defaultWhId ?? warehouses[0]?.id;
  if (whId == null) {
    return { warehouses, warehouse_id: null, categories: [] };
  }

  const scope = await resolveConstraintScope(tenantId, { selected_agent_id: userId });
  const catalog = await loadOrderCreateCatalogSlice(tenantId, scope);
  const products = catalog.products.filter((p) => !p.is_blocked);

  const productIds = products.map((p) => p.id);
  const available = await loadAvailableQtyByProductId(prisma, tenantId, whId, productIds);

  const byCategory = new Map<
    string,
    Array<{ name: string; category_name: string; available: number; price?: string; currency?: string }>
  >();

  for (const p of products) {
    const cat = p.category?.name ?? "Boshqa";
    const free = available.get(p.id) ?? 0;
    const retail = p.prices.find((x) => x.price_type === "retail") ?? p.prices[0];
    const list = byCategory.get(cat) ?? [];
    list.push({
      name: p.name,
      category_name: cat,
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
  const dateStr = opts?.date ?? workRegionTodayKey();
  const { start: dayStart, end: dayEnd } = workRegionDayRange(dateStr);

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
      product_name: string | null;
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
        p.name AS product_name,
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
        CASE WHEN product_name IS NULL OR btrim(product_name) = '' THEN '—' ELSE product_name END AS product_name,
        CASE WHEN category_name IS NULL OR btrim(category_name) = '' THEN 'Boshqa' ELSE category_name END AS category_name,
        parent_name,
        qty,
        total,
        qty * volume_unit AS volume_m3
      FROM lines
    )
    SELECT
      product_name,
      category_name,
      parent_name,
      COALESCE(SUM(qty), 0)::numeric(15,3) AS qty,
      COALESCE(SUM(volume_m3), 0)::numeric(15,6) AS volume_m3,
      COALESCE(SUM(total), 0)::numeric(15,2) AS sum,
      COUNT(DISTINCT client_id)::bigint AS akb
    FROM signed
    GROUP BY product_name, category_name, parent_name
    ORDER BY category_name ASC, product_name ASC
  `;

  type Agg = { qty: number; volume_m3: number; sum: number; akb: number };
  type TreeRow = { name: string; qty: number; volume_m3: number; sum: number; depth: number };
  const treeRows: TreeRow[] = [];
  const parentMap = new Map<string, Agg>();
  const subcatMap = new Map<string, Agg>();
  const standaloneCatMap = new Map<string, Agg>();
  const productsBySubcat = new Map<string, TreeRow[]>();
  const productsByStandalone = new Map<string, TreeRow[]>();
  let totalQty = 0;
  let totalVol = 0;
  let totalSum = 0;

  const bumpAgg = (map: Map<string, Agg>, key: string, qty: number, vol: number, sum: number, akb: number) => {
    const prev = map.get(key) ?? { qty: 0, volume_m3: 0, sum: 0, akb: 0 };
    prev.qty += qty;
    prev.volume_m3 += vol;
    prev.sum += sum;
    prev.akb += akb;
    map.set(key, prev);
  };

  const pushProduct = (map: Map<string, TreeRow[]>, key: string, row: TreeRow) => {
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  };

  for (const r of rows) {
    const qty = Number(r.qty);
    const vol = Number(r.volume_m3);
    const sum = Number(r.sum);
    const catName = r.category_name ?? "Boshqa";
    const productName = r.product_name ?? "—";
    totalQty += qty;
    totalVol += vol;
    totalSum += sum;

    if (r.parent_name) {
      const parentKey = r.parent_name;
      const subcatKey = `${parentKey}::${catName}`;
      bumpAgg(parentMap, parentKey, qty, vol, sum, Number(r.akb));
      bumpAgg(subcatMap, subcatKey, qty, vol, sum, Number(r.akb));
      pushProduct(productsBySubcat, subcatKey, {
        name: productName,
        qty,
        volume_m3: vol,
        sum,
        depth: 2
      });
    } else {
      bumpAgg(standaloneCatMap, catName, qty, vol, sum, Number(r.akb));
      pushProduct(productsByStandalone, catName, {
        name: productName,
        qty,
        volume_m3: vol,
        sum,
        depth: 1
      });
    }
  }

  const parentNames = [...parentMap.keys()].sort((a, b) => a.localeCompare(b, "ru"));
  for (const parentName of parentNames) {
    const agg = parentMap.get(parentName)!;
    treeRows.push({ name: parentName, qty: agg.qty, volume_m3: agg.volume_m3, sum: agg.sum, depth: 0 });
    const subcatKeys = [...subcatMap.keys()]
      .filter((k) => k.startsWith(`${parentName}::`))
      .sort((a, b) => a.localeCompare(b, "ru"));
    for (const subcatKey of subcatKeys) {
      const subAgg = subcatMap.get(subcatKey)!;
      const subName = subcatKey.slice(parentName.length + 2);
      treeRows.push({ name: subName, qty: subAgg.qty, volume_m3: subAgg.volume_m3, sum: subAgg.sum, depth: 1 });
      const products = productsBySubcat.get(subcatKey) ?? [];
      products.sort((a, b) => a.name.localeCompare(b.name, "ru"));
      treeRows.push(...products);
    }
  }

  const parentNameSet = new Set(parentNames);
  const standaloneNames = [...standaloneCatMap.keys()]
    .filter((name) => !parentNameSet.has(name))
    .sort((a, b) => a.localeCompare(b, "ru"));
  for (const catName of standaloneNames) {
    const agg = standaloneCatMap.get(catName)!;
    treeRows.push({ name: catName, qty: agg.qty, volume_m3: agg.volume_m3, sum: agg.sum, depth: 0 });
    const products = productsByStandalone.get(catName) ?? [];
    products.sort((a, b) => a.name.localeCompare(b.name, "ru"));
    treeRows.push(...products);
  }

  return {
    date,
    totals: {
      qty: totalQty,
      volume_m3: totalVol,
      sum: totalSum,
      akb: rows.reduce((acc, r) => acc + Number(r.akb), 0)
    },
    rows: treeRows
  };
}

/** Veb mijoz kartochkasi: joriy agent bo‘yicha «Общий» (to‘lov − dolg, boshqa agentlar emas). */
export async function listMobileAgentClientLedgerBalances(tenantId: number, agentUserId: number) {
  const excluded = ["cancelled", "returned"] as const;

  const rows = await prisma.$queryRaw<Array<{ client_id: number; balance: Prisma.Decimal }>>`
    SELECT u.client_id,
      (
        SUM(
          CASE
            WHEN u.payment_amount IS NOT NULL AND u.payment_amount > 0 THEN u.payment_amount
            ELSE 0::decimal(15,2)
          END
        )
        - SUM(
          CASE
            WHEN u.debt_amount IS NOT NULL AND u.debt_amount <> 0 THEN ABS(u.debt_amount)
            ELSE 0::decimal(15,2)
          END
        )
      )::decimal(15,2) AS balance
    FROM (
      SELECT
        o.client_id,
        o.agent_id AS ledger_agent_id,
        (-(o.total_sum))::decimal(15,2) AS debt_amount,
        NULL::decimal(15,2) AS payment_amount
      FROM orders o
      JOIN clients c ON c.id = o.client_id AND c.tenant_id = ${tenantId}
      WHERE o.tenant_id = ${tenantId}
        AND o.status NOT IN (${Prisma.join(excluded)})
        AND o.order_type = 'order'
        AND c.is_active = true
        AND c.merged_into_client_id IS NULL
        AND (
          c.agent_id = ${agentUserId}
          OR EXISTS (
            SELECT 1 FROM client_agent_assignments caa
            WHERE caa.client_id = c.id AND caa.agent_id = ${agentUserId}
          )
        )

      UNION ALL

      SELECT
        p.client_id,
        COALESCE(p.ledger_agent_id, ord.agent_id, c.agent_id) AS ledger_agent_id,
        CASE WHEN p.entry_kind = 'client_expense' THEN p.amount ELSE NULL END AS debt_amount,
        CASE WHEN p.entry_kind = 'payment' THEN p.amount ELSE NULL END AS payment_amount
      FROM client_payments p
      JOIN clients c ON c.id = p.client_id AND c.tenant_id = ${tenantId}
      LEFT JOIN orders ord ON ord.id = p.order_id AND ord.tenant_id = ${tenantId}
      WHERE p.tenant_id = ${tenantId}
        AND p.deleted_at IS NULL
        AND c.is_active = true
        AND c.merged_into_client_id IS NULL
        AND (
          c.agent_id = ${agentUserId}
          OR EXISTS (
            SELECT 1 FROM client_agent_assignments caa
            WHERE caa.client_id = c.id AND caa.agent_id = ${agentUserId}
          )
        )
    ) u
    WHERE u.ledger_agent_id = ${agentUserId}
    GROUP BY u.client_id
  `;

  return rows.map((r) => ({ id: r.client_id, balance: Number(r.balance) }));
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
