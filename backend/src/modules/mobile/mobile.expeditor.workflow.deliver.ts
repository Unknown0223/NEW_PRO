/**
 * Ekspeditor yetkazish oqimi — bosh sahifa, vizitlar, qarzdorlar.
 */
import { prisma } from "../../config/database";
import { Prisma } from "@prisma/client";
import { loadDeliveryDebtByClient, mergeLedgerWithUnpaidDelivered } from "../client-balances/client-balances.delivery";
import { loadExpeditorMobileConfig } from "./mobile.expeditor.service";
import { parseExpeditorAssignmentRules } from "../staff/staff.shared.helpers";

const COMPLETED_STATUSES = ["delivered", "returned"] as const;
const RETURN_TYPES = ["return", "partial_return", "return_by_order"] as const;

async function expeditorClientIds(tenantId: number, expeditorUserId: number): Promise<number[]> {
  const rows = await prisma.order.findMany({
    where: {
      tenant_id: tenantId,
      expeditor_user_id: expeditorUserId,
      order_type: "order",
      status: { not: "cancelled" }
    },
    select: { client_id: true },
    distinct: ["client_id"]
  });
  return rows.map((r) => r.client_id);
}

/** Bosh sahifa: kunlik hisobot, otgruzka statistikasi, sinxronizatsiya. */
export async function getMobileExpeditorDashboard(tenantId: number, expeditorUserId: number) {
  const cfg = await loadExpeditorMobileConfig(tenantId, expeditorUserId);
  const today = new Date();
  const todayStart = new Date(today.toISOString().slice(0, 10) + "T00:00:00.000Z");

  const orders = await prisma.order.findMany({
    where: {
      tenant_id: tenantId,
      expeditor_user_id: expeditorUserId,
      order_type: "order",
      status: { not: "cancelled" }
    },
    select: { id: true, status: true, total_sum: true, client_id: true, created_at: true }
  });

  const returnOrders = await prisma.order.findMany({
    where: {
      tenant_id: tenantId,
      expeditor_user_id: expeditorUserId,
      order_type: { in: [...RETURN_TYPES] },
      status: { not: "cancelled" }
    },
    select: { id: true, status: true, total_sum: true, order_type: true }
  });

  const countBy = (statuses: string[]) =>
    orders.filter((o) => statuses.includes(o.status)).length;

  const sumBy = (statuses: string[]) =>
    orders
      .filter((o) => statuses.includes(o.status))
      .reduce((s, o) => s + Number(o.total_sum), 0);

  // Bugungi (holat o'zgargan kun bo'yicha) faol va tugallangan zakazlar — vizitlar
  // ro'yxati bilan bir xil mantiq (sana = order_status_logs.created_at).
  const [activeTodayRows, completedTodayRows] = await Promise.all([
    prisma.order.findMany({
      where: {
        tenant_id: tenantId,
        expeditor_user_id: expeditorUserId,
        order_type: "order",
        status: { in: ["picking", "delivering"] },
        status_logs: {
          some: { to_status: { in: ["picking", "delivering"] }, created_at: { gte: todayStart } }
        }
      },
      select: { client_id: true }
    }),
    prisma.order.findMany({
      where: {
        tenant_id: tenantId,
        expeditor_user_id: expeditorUserId,
        order_type: "order",
        status: { in: ["delivered", "returned"] },
        status_logs: {
          some: { to_status: { in: ["delivered", "returned"] }, created_at: { gte: todayStart } }
        }
      },
      select: { client_id: true }
    })
  ]);
  const activeClients = new Set(activeTodayRows.map((o) => o.client_id));
  const visitedToday = new Set(completedTodayRows.map((o) => o.client_id));

  const pendingToday = await prisma.payment.aggregate({
    where: {
      tenant_id: tenantId,
      expeditor_user_id: expeditorUserId,
      deleted_at: null,
      entry_kind: "payment",
      workflow_status: "pending_confirmation",
      received_at: { gte: todayStart }
    },
    _sum: { amount: true },
    _count: true
  });

  const confirmedToday = await prisma.payment.aggregate({
    where: {
      tenant_id: tenantId,
      expeditor_user_id: expeditorUserId,
      deleted_at: null,
      entry_kind: "payment",
      workflow_status: { notIn: ["pending_confirmation", "rejected"] },
      confirmed_at: { gte: todayStart }
    },
    _sum: { amount: true },
    _count: true
  });

  const user = await prisma.user.findFirst({
    where: { id: expeditorUserId, tenant_id: tenantId },
    select: { last_sync_at: true }
  });

  const totalVisits = activeClients.size + visitedToday.size;
  const visited = visitedToday.size;
  const performancePct = totalVisits > 0 ? Math.round((visited / totalVisits) * 100) : 0;

  return {
    daily_report: {
      performance_pct: performancePct,
      visited,
      visit_total: totalVisits,
      remaining: Math.max(0, totalVisits - visited)
    },
    last_sync_at: user?.last_sync_at?.toISOString() ?? null,
    payments: {
      pending_count: pendingToday._count,
      pending_sum: Number(pendingToday._sum.amount ?? 0),
      confirmed_count: confirmedToday._count,
      confirmed_sum: Number(confirmedToday._sum.amount ?? 0),
      /** @deprecated pending_* ishlating */
      synced_count: pendingToday._count,
      synced_sum: Number(pendingToday._sum.amount ?? 0)
    },
    shipment_report: [
      { type: "shipped", label: "Отгружено", qty: countBy(["picking"]), sum: sumBy(["picking"]) },
      { type: "delivered", label: "Доставлено", qty: countBy(["delivered"]), sum: sumBy(["delivered"]) },
      { type: "return", label: "Возврат", qty: returnOrders.filter((o) => o.order_type === "return").length, sum: returnOrders.filter((o) => o.order_type === "return").reduce((s, o) => s + Number(o.total_sum), 0) },
      { type: "shelf_return", label: "Возврат с полки", qty: returnOrders.filter((o) => o.order_type === "return_by_order").length, sum: returnOrders.filter((o) => o.order_type === "return_by_order").reduce((s, o) => s + Number(o.total_sum), 0) },
      { type: "exchange_ship", label: "Обмен отгруз", qty: 0, sum: 0 },
      { type: "exchange_return", label: "Обмен возврат", qty: 0, sum: 0 },
      { type: "on_board", label: "На борту", qty: countBy(["delivering"]), sum: sumBy(["delivering"]) },
      { type: "remaining", label: "Осталось доставить", qty: countBy(["picking", "delivering"]), sum: sumBy(["picking", "delivering"]) }
    ],
    config: {
      accept_payment_for_order: cfg.expeditor?.accept_payment_for_order !== false,
      accept_payment_on_delivery: cfg.expeditor?.accept_payment_on_delivery !== false,
      accept_payment_from_debtors: cfg.expeditor?.accept_payment_from_debtors === true,
      allow_return_from_shelf: cfg.orders?.allow_return_from_shelf === true,
      fingerprint_required: cfg.expeditor?.fingerprint_required_for_shipment_confirm === true
    }
  };
}

/** Bugun (UTC kun boshi) — boshqa hisoblar bilan bir xil chegara. */
function todayStartUtc(): Date {
  return new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
}

/** Vizitlar: active | completed | routes | unfinished */
export async function listMobileExpeditorVisits(
  tenantId: number,
  expeditorUserId: number,
  tab: "active" | "completed" | "routes" | "unfinished"
) {
  const todayStart = todayStartUtc();

  const baseWhere = {
    tenant_id: tenantId,
    expeditor_user_id: expeditorUserId,
    order_type: "order" as const,
    status: { not: "cancelled" as const }
  };

  // Sana asosi — holat o'zgargan kun (order_status_logs). Faqat bugungilar.
  let where: Prisma.OrderWhereInput;
  if (tab === "completed") {
    // Bugun yetkazilgan/qaytarilgan (barcha tugallangan turlari).
    where = {
      ...baseWhere,
      status: { in: ["delivered", "returned"] },
      status_logs: {
        some: { to_status: { in: ["delivered", "returned"] }, created_at: { gte: todayStart } }
      }
    };
  } else if (tab === "unfinished") {
    // Avvalgi kunlarda boshlangan, lekin hali tugallanmagan (eski) zakazlar.
    where = {
      ...baseWhere,
      status: { in: ["picking", "delivering"] },
      status_logs: {
        some: { to_status: { in: ["picking", "delivering"] }, created_at: { lt: todayStart } },
        none: { to_status: { in: ["picking", "delivering"] }, created_at: { gte: todayStart } }
      }
    };
  } else {
    // active | routes — bugungi yetkazishlar (bugun jarayonga kirgan).
    where = {
      ...baseWhere,
      status: { in: ["picking", "delivering"] },
      status_logs: {
        some: { to_status: { in: ["picking", "delivering"] }, created_at: { gte: todayStart } }
      }
    };
  }

  const orders = await prisma.order.findMany({
    where,
    select: {
      id: true,
      number: true,
      status: true,
      total_sum: true,
      client_id: true,
      comment: true,
      client: {
        select: {
          id: true,
          name: true,
          phone: true,
          address: true,
          city: true,
          region: true,
          zone: true,
          latitude: true,
          longitude: true,
          client_balances: { take: 1, select: { balance: true } }
        }
      }
    },
    orderBy: [{ status: "asc" }, { id: "asc" }]
  });

  if (tab === "routes") {
    const byClient = new Map<number, (typeof orders)[0]>();
    for (const o of orders) {
      if (!byClient.has(o.client_id)) byClient.set(o.client_id, o);
    }
    const routeList = [...byClient.values()];
    return routeList.map((o, idx) => ({
      seq: idx + 1,
      order_id: o.id,
      order_number: o.number,
      client_id: o.client.id,
      client_name: o.client.name,
      phone: o.client.phone ?? null,
      address: [o.client.city, o.client.zone, o.client.address].filter(Boolean).join(", ") || null,
      visit_reason: o.comment?.trim() || null,
      task_label: "Взыскание долгов",
      status: o.status,
      latitude: o.client.latitude != null ? Number(o.client.latitude) : null,
      longitude: o.client.longitude != null ? Number(o.client.longitude) : null,
      balance: Number(o.client.client_balances[0]?.balance ?? 0)
    }));
  }

  return orders.map((o) => ({
    order_id: o.id,
    order_number: o.number,
    client_id: o.client.id,
    client_name: o.client.name,
    phone: o.client.phone ?? null,
    address: [o.client.city, o.client.zone, o.client.address].filter(Boolean).join(", ") || null,
    status: o.status,
    total_sum: Number(o.total_sum),
    visit_reason: o.comment?.trim() || null,
    task_label:
      tab === "active"
        ? "Доставка"
        : tab === "unfinished"
          ? "Не завершён"
          : "Завершено",
    latitude: o.client.latitude != null ? Number(o.client.latitude) : null,
    longitude: o.client.longitude != null ? Number(o.client.longitude) : null,
    balance: Number(o.client.client_balances[0]?.balance ?? 0)
  }));
}

/** Qarzdor mijozlar — ekspeditor zakazlari bo'yicha. */
export async function listMobileExpeditorDebtors(tenantId: number, expeditorUserId: number, limit = 100) {
  const cfg = await loadExpeditorMobileConfig(tenantId, expeditorUserId);
  if (cfg.expeditor?.accept_payment_from_debtors === false && cfg.expeditor?.accept_payment_on_delivery === false) {
    return [];
  }

  const clientIds = await expeditorClientIds(tenantId, expeditorUserId);
  if (!clientIds.length) return [];

  const clients = await prisma.client.findMany({
    where: { tenant_id: tenantId, id: { in: clientIds }, is_active: true },
    select: {
      id: true,
      name: true,
      phone: true,
      client_code: true,
      address: true,
      city: true,
      region: true,
      client_balances: { take: 1, select: { balance: true } }
    },
    orderBy: { name: "asc" },
    take: Math.min(limit, 200)
  });

  const deliveryMap = await loadDeliveryDebtByClient(tenantId, clientIds);

  return clients
    .map((c) => {
      const ledger = c.client_balances[0]?.balance ?? new Prisma.Decimal(0);
      const delivery = deliveryMap.get(c.id);
      const merged = mergeLedgerWithUnpaidDelivered(ledger, delivery);
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        client_code: c.client_code,
        address: [c.city, c.region, c.address].filter(Boolean).join(", ") || null,
        balance: Number(merged),
        overdue_at: delivery?.firstDel?.toISOString() ?? null
      };
    })
    .filter((c) => c.balance < -0.01)
    .sort((a, b) => a.balance - b.balance)
    .slice(0, limit);
}

/** Ekspeditor omborlari (assignment rules + zakazlar). */
export async function listMobileExpeditorWarehouses(tenantId: number, expeditorUserId: number) {
  const user = await prisma.user.findFirst({
    where: { id: expeditorUserId, tenant_id: tenantId, role: "expeditor" },
    select: { expeditor_assignment_rules: true }
  });
  const rules = parseExpeditorAssignmentRules(user?.expeditor_assignment_rules);
  const ruleIds = (rules.warehouse_ids ?? []).filter((id) => Number.isFinite(id) && id > 0);

  const fromOrders = await prisma.order.findMany({
    where: {
      tenant_id: tenantId,
      expeditor_user_id: expeditorUserId,
      warehouse_id: { not: null }
    },
    select: { warehouse_id: true },
    distinct: ["warehouse_id"]
  });
  const orderWhIds = fromOrders.map((r) => r.warehouse_id!).filter(Boolean);

  const allIds = [...new Set([...ruleIds, ...orderWhIds])];
  if (!allIds.length) {
    const all = await prisma.warehouse.findMany({
      where: { tenant_id: tenantId, is_active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    });
    return all;
  }

  return prisma.warehouse.findMany({
    where: { tenant_id: tenantId, id: { in: allIds }, is_active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });
}
