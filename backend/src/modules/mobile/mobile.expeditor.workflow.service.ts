/**
 * Ekspeditor mobil oqimlari — bosh sahifa, vizitlar, qarzdorlar, to'lovlar, nakladnoylar.
 */
import { prisma } from "../../config/database";
import { Prisma } from "@prisma/client";
import { loadDeliveryDebtByClient, mergeLedgerWithUnpaidDelivered } from "../client-balances/client-balances.delivery";
import { getClientBalanceLedger } from "../clients/client-balance-ledger.get";
import { loadTenantLedgerPaymentContext } from "../clients/client-balance-ledger.helpers";
import { updateOrderStatus } from "../orders/domain/order.lifecycle";
import { parseExpeditorAssignmentRules } from "../staff/staff.shared.helpers";
import { resolvePaymentMethodRefToLabel } from "../tenant-settings/finance-refs";
import { loadExpeditorMobileConfig } from "./mobile.expeditor.service";

const SHIPPING_STATUSES = ["picking", "delivering"] as const;
const COMPLETED_STATUSES = ["delivered", "returned"] as const;
const RETURN_TYPES = ["return", "partial_return", "return_by_order"] as const;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * To'lovlarni vizit (AgentVisit check-in seansi) bo'yicha guruhlash kaliti.
 * Bir vizit oynasiga tushgan to'lovlar bir xil `v<visitId>` kalitini oladi;
 * hech bir vizitga to'g'ri kelmasa — guruhlanmaydi (caller solo qiladi).
 *
 * Oyna chegarasi: [checked_in_at, end), bu yerda end = min(checked_out_at,
 * keyingi vizit check-in, checked_in_at + MAX). MAX — ochiq (checkout
 * qilinmagan) oxirgi vizit keyinchalik bog'liq bo'lmagan to'lovlarni
 * o'ziga tortib olmasligi uchun (bir ish kuni ~ 12 soat).
 */
async function buildPaymentVisitGrouper(
  tenantId: number,
  clientId: number,
  payments: { id: number; ts: number; actorId: number | null }[]
): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (payments.length === 0) return out;

  const MAX_VISIT_MS = 12 * 60 * 60 * 1000;
  const visits = await prisma.agentVisit.findMany({
    where: { tenant_id: tenantId, client_id: clientId },
    select: { id: true, agent_id: true, checked_in_at: true, checked_out_at: true },
    orderBy: { checked_in_at: "asc" }
  });
  if (visits.length === 0) return out;

  const byAgent = new Map<number, { id: number; inAt: number; outAt: number | null }[]>();
  for (const v of visits) {
    const arr = byAgent.get(v.agent_id) ?? [];
    arr.push({ id: v.id, inAt: v.checked_in_at.getTime(), outAt: v.checked_out_at?.getTime() ?? null });
    byAgent.set(v.agent_id, arr);
  }

  for (const p of payments) {
    if (p.actorId == null) continue;
    const arr = byAgent.get(p.actorId);
    if (!arr) continue;
    // Eng oxirgi check-in <= to'lov vaqti bo'lgan vizitni topamiz (arr asc tartibda).
    let chosenIdx = -1;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].inAt <= p.ts) chosenIdx = i;
      else break;
    }
    if (chosenIdx < 0) continue;
    const chosen = arr[chosenIdx];
    const next = arr[chosenIdx + 1];
    const end = Math.min(
      chosen.outAt ?? Number.POSITIVE_INFINITY,
      next ? next.inAt : Number.POSITIVE_INFINITY,
      chosen.inAt + MAX_VISIT_MS
    );
    if (p.ts < end) out.set(p.id, `v${chosen.id}`);
  }

  return out;
}

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

/**
 * Kassir tomonidan ekspeditorga «qaytarilgan» to'lovlar (xato to'lov) — faol taymerli.
 * Ekspeditor shu vaqt ichida to'g'rilab qayta yuborishi kerak; muddat tugasa ro'yxatdan tushadi.
 */
export async function listMobileExpeditorReturnedPayments(tenantId: number, expeditorUserId: number) {
  const now = new Date();
  const grants = await prisma.paymentEditGrant.findMany({
    where: {
      tenant_id: tenantId,
      access_user_id: expeditorUserId,
      status: "active",
      expires_at: { gt: now },
      payment: { deleted_at: null, workflow_status: "rejected", entry_kind: "payment" }
    },
    orderBy: { expires_at: "asc" },
    select: {
      id: true,
      expires_at: true,
      created_at: true,
      comment: true,
      cancel_reason_ref: true,
      payment: {
        select: {
          id: true,
          order_id: true,
          amount: true,
          payment_type: true,
          client: { select: { id: true, name: true } },
          order: { select: { number: true } }
        }
      }
    }
  });

  return grants.map((g) => ({
    grant_id: g.id,
    payment_id: g.payment.id,
    order_id: g.payment.order_id,
    order_number: g.payment.order?.number ?? null,
    client_id: g.payment.client?.id ?? null,
    client_name: g.payment.client?.name ?? "—",
    amount: Number(g.payment.amount),
    payment_type: g.payment.payment_type,
    reason: (g.comment ?? g.cancel_reason_ref ?? "").trim() || null,
    expires_at: g.expires_at.toISOString(),
    created_at: g.created_at.toISOString()
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

/**
 * Mijoz balansi — agent (owner) va to'lov usuli bo'yicha taqsimot.
 * Reference «Баланс по агенту» sheet uchun. Manfiy = qarz.
 */
export async function getMobileExpeditorClientBalanceDetail(
  tenantId: number,
  _expeditorUserId: number,
  clientId: number
) {
  const balRow = await prisma.clientBalance.findFirst({
    where: { tenant_id: tenantId, client_id: clientId },
    select: { balance: true }
  });
  const ledger = balRow?.balance ?? new Prisma.Decimal(0);
  const deliveryMap = await loadDeliveryDebtByClient(tenantId, [clientId]);
  const merged = mergeLedgerWithUnpaidDelivered(ledger, deliveryMap.get(clientId));
  const total = Number(merged);

  const orders = await prisma.order.findMany({
    where: {
      tenant_id: tenantId,
      client_id: clientId,
      order_type: "order",
      status: { not: "cancelled" }
    },
    select: {
      agent_id: true,
      payment_method_ref: true,
      total_sum: true,
      agent: { select: { id: true, name: true, code: true } }
    }
  });

  const { paymentMethodEntries } = await loadTenantLedgerPaymentContext(tenantId);

  type Agg = {
    id: number | null;
    name: string;
    code: string | null;
    orderSum: number;
    byMethod: Map<string, number>;
  };
  const byAgent = new Map<number, Agg>();
  let totalOrderSum = 0;
  for (const o of orders) {
    const aid = o.agent_id ?? 0;
    const sum = Number(o.total_sum);
    totalOrderSum += sum;
    if (!byAgent.has(aid)) {
      byAgent.set(aid, {
        id: o.agent?.id ?? null,
        name: o.agent?.name ?? "—",
        code: o.agent?.code ?? null,
        orderSum: 0,
        byMethod: new Map()
      });
    }
    const agg = byAgent.get(aid)!;
    agg.orderSum += sum;
    const label = resolvePaymentMethodRefToLabel(o.payment_method_ref, paymentMethodEntries) ?? "Naqd";
    agg.byMethod.set(label, (agg.byMethod.get(label) ?? 0) + sum);
  }

  const owners = [...byAgent.values()]
    .map((a) => {
      const share = totalOrderSum > 0 ? a.orderSum / totalOrderSum : 0;
      const ownerBalance = total * share;
      const payment_methods = [...a.byMethod.entries()].map(([name, methodSum]) => {
        const mShare = a.orderSum > 0 ? methodSum / a.orderSum : 0;
        return { name, balance: ownerBalance * mShare };
      });
      return {
        owner: { id: a.id, name: a.name, code: a.code },
        total_balance: ownerBalance,
        payment_methods
      };
    })
    .sort((x, y) => x.total_balance - y.total_balance);

  return { total_balance: total, owners };
}

/**
 * Mijoz kartasi (Должники → mijoz): sarlavha (manzil/mo'ljal/balans/koordinata),
 * to'lov tarixi («Оплата») va qaytarilgan zakazlar («Возвращенные заказы»).
 */
export async function getMobileExpeditorClientDetail(
  tenantId: number,
  _expeditorUserId: number,
  clientId: number
) {
  const client = await prisma.client.findFirst({
    where: { tenant_id: tenantId, id: clientId },
    select: {
      id: true,
      name: true,
      legal_name: true,
      address: true,
      city: true,
      region: true,
      district: true,
      landmark: true,
      phone: true,
      client_code: true,
      latitude: true,
      longitude: true
    }
  });
  if (!client) return null;

  const balRow = await prisma.clientBalance.findFirst({
    where: { tenant_id: tenantId, client_id: clientId },
    select: { balance: true }
  });
  const ledger = balRow?.balance ?? new Prisma.Decimal(0);
  const deliveryMap = await loadDeliveryDebtByClient(tenantId, [clientId]);
  const merged = mergeLedgerWithUnpaidDelivered(ledger, deliveryMap.get(clientId));
  const totalBalance = Number(merged);

  // «Оплата» — mijoz bo'yicha to'lov tarixi (kim qabul qilganidan qat'i nazar).
  const payments = await prisma.payment.findMany({
    where: {
      tenant_id: tenantId,
      deleted_at: null,
      entry_kind: "payment",
      order: { client_id: clientId }
    },
    select: {
      id: true,
      amount: true,
      payment_type: true,
      paid_at: true,
      received_at: true,
      created_at: true,
      workflow_status: true,
      created_by_user_id: true,
      expeditor_user_id: true,
      order: {
        select: {
          id: true,
          number: true,
          agent: { select: { id: true, name: true, code: true } }
        }
      }
    },
    orderBy: { created_at: "desc" },
    take: 100
  });

  // To'lovlarni «vizit» bo'yicha guruhlash: bir vizit ichida (bitta «Начать
  // визит» seansida) qilingan to'lovlar bitta `visit_group` oladi. Buni
  // to'lov vaqtini (received_at) o'sha xodimning shu mijoz bo'yicha vizit
  // (AgentVisit) oynalariga moslashtirib aniqlaymiz. Mos vizit topilmasa —
  // har bir to'lov o'z guruhida (solo) qoladi.
  const visitGroupOf = await buildPaymentVisitGrouper(
    tenantId,
    clientId,
    payments.map((p) => ({
      id: p.id,
      ts: (p.received_at ?? p.paid_at ?? p.created_at).getTime(),
      actorId: p.expeditor_user_id ?? p.created_by_user_id ?? null
    }))
  );

  const paymentRows = payments.map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    payment_type: p.payment_type,
    paid_at: (p.paid_at ?? p.received_at ?? p.created_at).toISOString(),
    workflow_status: String(p.workflow_status ?? "confirmed"),
    order_id: p.order?.id ?? null,
    order_number: p.order?.number ?? null,
    agent_name: p.order?.agent?.name ?? null,
    agent_code: p.order?.agent?.code ?? null,
    visit_group: visitGroupOf.get(p.id) ?? `p${p.id}`
  }));

  // «Возвращенные заказы» — qaytarilgan zakazlar (return turi yoki status=returned).
  const returnOrders = await prisma.order.findMany({
    where: {
      tenant_id: tenantId,
      client_id: clientId,
      status: { not: "cancelled" },
      OR: [
        { order_type: { in: [...RETURN_TYPES] } },
        { order_type: "order", status: "returned" }
      ]
    },
    select: {
      id: true,
      number: true,
      total_sum: true,
      status: true,
      order_type: true,
      created_at: true,
      updated_at: true
    },
    orderBy: { created_at: "desc" },
    take: 100
  });

  const returnRows = returnOrders.map((o) => ({
    id: o.id,
    order_number: o.number,
    total_sum: Number(o.total_sum),
    status: o.status,
    order_type: o.order_type,
    date: (o.updated_at ?? o.created_at).toISOString()
  }));

  const addressParts = [client.city, client.region, client.district, client.address].filter(Boolean);

  return {
    client: {
      id: client.id,
      name: client.name,
      legal_name: client.legal_name,
      client_code: client.client_code,
      address: client.address ?? (addressParts.length ? addressParts.join(", ") : null),
      full_address: addressParts.length ? addressParts.join(", ") : null,
      landmark: client.landmark,
      phone: client.phone,
      latitude: client.latitude != null ? Number(client.latitude) : null,
      longitude: client.longitude != null ? Number(client.longitude) : null,
      total_balance: totalBalance
    },
    payments: paymentRows,
    returns: returnRows
  };
}

/** «История заказов» — mijoz zakazlari (sana filtri bilan). */
export async function listMobileExpeditorClientOrders(
  tenantId: number,
  _expeditorUserId: number,
  clientId: number,
  opts: { from?: Date | null; to?: Date | null } = {}
) {
  const { paymentMethodEntries } = await loadTenantLedgerPaymentContext(tenantId);
  const createdAt: { gte?: Date; lte?: Date } = {};
  if (opts.from) createdAt.gte = opts.from;
  if (opts.to) createdAt.lte = opts.to;

  const orders = await prisma.order.findMany({
    where: {
      tenant_id: tenantId,
      client_id: clientId,
      order_type: "order",
      status: { not: "cancelled" },
      ...(opts.from || opts.to ? { created_at: createdAt } : {})
    },
    select: {
      id: true,
      number: true,
      total_sum: true,
      status: true,
      created_at: true,
      payment_method_ref: true
    },
    orderBy: { created_at: "desc" },
    take: 200
  });

  return orders.map((o) => ({
    id: o.id,
    order_number: o.number,
    total_sum: Number(o.total_sum),
    status: o.status,
    date: o.created_at.toISOString(),
    payment_method: o.payment_method_ref
      ? resolvePaymentMethodRefToLabel(o.payment_method_ref, paymentMethodEntries) ?? null
      : null
  }));
}

/** «Акт сверки» — mijoz ledger (web bilan bir xil mantiq, sana filtri). */
export async function getMobileExpeditorClientLedger(
  tenantId: number,
  _expeditorUserId: number,
  clientId: number,
  opts: { from?: Date | null; to?: Date | null; page?: number; kind?: "all" | "debt" | "payment" } = {}
) {
  const res = await getClientBalanceLedger(tenantId, clientId, {
    page: opts.page ?? 1,
    limit: 100,
    date_from: opts.from ?? null,
    date_to_end: opts.to ?? null,
    ledger_kind: opts.kind ?? "all"
  });

  return {
    account_balance: Number(res.account_balance),
    total: res.total,
    page: res.page,
    rows: res.rows.map((r) => ({
      date: r.sort_at,
      kind: r.row_kind,
      order_number: r.order_number,
      type_label: r.type_label,
      debt_amount: r.debt_amount != null ? Number(r.debt_amount) : null,
      payment_amount: r.payment_amount != null ? Number(r.payment_amount) : null,
      amount:
        (r.payment_amount != null ? Number(r.payment_amount) : 0) +
        (r.debt_amount != null ? Number(r.debt_amount) : 0)
    }))
  };
}

/** To'lovlar ro'yxati yoki mijoz bo'yicha guruh. */
export async function listMobileExpeditorPayments(
  tenantId: number,
  expeditorUserId: number,
  groupBy: "list" | "clients" = "list"
) {
  const payments = await prisma.payment.findMany({
    where: {
      tenant_id: tenantId,
      expeditor_user_id: expeditorUserId,
      deleted_at: null,
      entry_kind: "payment"
    },
    select: {
      id: true,
      amount: true,
      payment_type: true,
      paid_at: true,
      received_at: true,
      created_at: true,
      workflow_status: true,
      order: {
        select: {
          id: true,
          number: true,
          client: { select: { id: true, name: true } }
        }
      }
    },
    orderBy: [{ workflow_status: "asc" }, { created_at: "desc" }],
    take: 200
  });

  const rows = payments.map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    payment_type: p.payment_type,
    paid_at: p.paid_at?.toISOString() ?? null,
    received_at: p.received_at?.toISOString() ?? null,
    created_at: p.created_at.toISOString(),
    workflow_status: String(p.workflow_status ?? "confirmed"),
    order_id: p.order?.id ?? null,
    order_number: p.order?.number ?? null,
    client_id: p.order?.client.id ?? null,
    client_name: p.order?.client.name ?? null
  }));

  if (groupBy === "list") return { mode: "list" as const, data: rows };

  const byClient = new Map<number, { client_id: number; client_name: string; total: number; payments: typeof rows }>();
  for (const r of rows) {
    if (r.client_id == null) continue;
    const cur = byClient.get(r.client_id) ?? {
      client_id: r.client_id,
      client_name: r.client_name ?? "",
      total: 0,
      payments: []
    };
    cur.total += r.amount;
    cur.payments.push(r);
    byClient.set(r.client_id, cur);
  }
  return { mode: "clients" as const, data: [...byClient.values()] };
}

/** Otgruzka / qaytarish nakladnoylari (virtual guruhlar). */
export async function listMobileExpeditorShipmentDocuments(
  tenantId: number,
  expeditorUserId: number,
  docType: "shipping" | "return"
) {
  const isReturn = docType === "return";
  const orders = await prisma.order.findMany({
    where: {
      tenant_id: tenantId,
      expeditor_user_id: expeditorUserId,
      status: { not: "cancelled" },
      ...(isReturn
        ? { order_type: { in: [...RETURN_TYPES] } }
        : { order_type: "order", status: { in: [...SHIPPING_STATUSES] } })
    },
    select: {
      id: true,
      number: true,
      status: true,
      order_type: true,
      total_sum: true,
      created_at: true,
      warehouse_id: true,
      warehouse: { select: { id: true, name: true } }
    },
    orderBy: { created_at: "desc" }
  });

  if (orders.length === 0) return [];

  // Har bir zakaz = bitta nakladnoy (veb «Накладные» bilan bir xil, ID = zakaz raqami).
  // «Дата отгрузки» = delivering bosqichiga o'tgan kun (status log), bo'lmasa yaratilgan kun.
  const orderIds = orders.map((o) => o.id);
  const deliverLogs = await prisma.orderStatusLog.findMany({
    where: { order_id: { in: orderIds }, to_status: "delivering" },
    select: { order_id: true, created_at: true },
    orderBy: { created_at: "asc" }
  });
  const deliverAt = new Map<number, Date>();
  for (const l of deliverLogs) {
    if (!deliverAt.has(l.order_id)) deliverAt.set(l.order_id, l.created_at);
  }

  return orders
    .map((o) => {
      const shipAt = deliverAt.get(o.id) ?? null;
      return {
        id: o.number,
        order_id: o.id,
        warehouse_id: o.warehouse_id,
        warehouse_name: o.warehouse?.name ?? null,
        ship_date: shipAt ? dayKey(shipAt) : dayKey(o.created_at),
        created_at: o.created_at.toISOString(),
        confirmed_at: shipAt ? shipAt.toISOString() : null,
        status: o.status === "delivering" ? "confirmed" : "waiting_confirmation",
        order_ids: [o.id],
        order_numbers: [o.number],
        total_sum: Number(o.total_sum),
        doc_type: isReturn ? "return" : "shipping"
      };
    })
    .sort(
      (a, b) =>
        b.ship_date.localeCompare(a.ship_date) || b.order_id - a.order_id
    );
}

/** Nakladnoy tafsiloti. */
export async function getMobileExpeditorShipmentDocumentDetail(
  tenantId: number,
  expeditorUserId: number,
  documentId: string
) {
  const docs = await listMobileExpeditorShipmentDocuments(tenantId, expeditorUserId, "shipping");
  const retDocs = await listMobileExpeditorShipmentDocuments(tenantId, expeditorUserId, "return");
  const doc = [...docs, ...retDocs].find((d) => d.id === documentId);
  if (!doc) throw new Error("NOT_FOUND");

  const items = await prisma.orderItem.findMany({
    where: {
      order_id: { in: doc.order_ids },
      order: { tenant_id: tenantId, expeditor_user_id: expeditorUserId }
    },
    select: {
      qty: true,
      total: true,
      product: {
        select: {
          sku: true,
          name: true,
          category: { select: { name: true } }
        }
      }
    }
  });

  const productRows = items.map((i) => ({
    code: i.product.sku,
    name: i.product.name,
    category: i.product.category?.name ?? null,
    qty: Number(i.qty),
    sum: Number(i.total)
  }));

  // Ekspeditor nomi va tasdiqlash vaqti (delivering bosqichiga o'tgan eng so'nggi log).
  const [expeditor, confirmLog] = await Promise.all([
    prisma.user.findFirst({
      where: { id: expeditorUserId, tenant_id: tenantId },
      select: { name: true }
    }),
    doc.status === "waiting_confirmation"
      ? Promise.resolve(null)
      : prisma.orderStatusLog.findFirst({
          where: { order_id: { in: doc.order_ids }, to_status: "delivering" },
          orderBy: { created_at: "desc" },
          select: { created_at: true }
        })
  ]);
  const confirmedAt = confirmLog?.created_at?.toISOString() ?? null;

  return {
    ...doc,
    expeditor_name: expeditor?.name ?? null,
    confirmed_at: confirmedAt,
    expeditor_status: doc.status === "waiting_confirmation" ? "Ожидание подтверждения" : "Подтверждено",
    products: productRows,
    confirmations: [
      {
        role: "expeditor",
        label: "Экспедитор",
        name: expeditor?.name ?? null,
        confirmed_at: confirmedAt,
        status: doc.status === "waiting_confirmation" ? "Ожидание подтверждения" : "Подтверждено"
      }
    ]
  };
}

/** Nakladnoy tasdiqlash — picking → delivering. */
export async function confirmMobileExpeditorShipmentDocument(
  tenantId: number,
  expeditorUserId: number,
  documentId: string
) {
  const detail = await getMobileExpeditorShipmentDocumentDetail(tenantId, expeditorUserId, documentId);
  if (detail.doc_type !== "shipping") throw new Error("BAD_DOC_TYPE");
  if (detail.status !== "waiting_confirmation") throw new Error("ALREADY_CONFIRMED");

  const pickingIds = await prisma.order.findMany({
    where: {
      tenant_id: tenantId,
      expeditor_user_id: expeditorUserId,
      id: { in: detail.order_ids },
      status: "picking"
    },
    select: { id: true }
  });

  for (const o of pickingIds) {
    await updateOrderStatus(tenantId, o.id, "delivering", expeditorUserId, "expeditor");
  }

  return { id: documentId, confirmed_count: pickingIds.length };
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

/**
 * Mashinadagi qoldiq — ekspeditor skladdan olib chiqqan, hali mijozga
 * yetkazilmagan mahsulotlar (остаток в машине).
 *
 * Hisob: zakaz pozitsiyalaridan olinadi (bazaga alohida saqlanmaydi).
 *  - loaded   = mashinadagi/yetkazilgan zakazlar (picking|delivering|delivered) yig'indisi
 *  - delivered = yetkazib bo'lingan zakazlar yig'indisi (mashinadan chiqib ketgan)
 *  - remaining = loaded − delivered  (ya'ni picking|delivering pozitsiyalari)
 * Faqat `order` turidagi (sotuv) zakazlar hisobga olinadi.
 */
export async function getMobileExpeditorVehicleStock(tenantId: number, expeditorUserId: number) {
  const items = await prisma.orderItem.findMany({
    where: {
      order: {
        tenant_id: tenantId,
        expeditor_user_id: expeditorUserId,
        order_type: "order",
        status: { in: ["picking", "delivering", "delivered"] }
      }
    },
    select: {
      qty: true,
      order: { select: { status: true } },
      product: {
        select: {
          id: true,
          sku: true,
          name: true,
          category: { select: { name: true } }
        }
      }
    }
  });

  const byProduct = new Map<
    number,
    {
      product_id: number;
      code: string | null;
      name: string;
      category: string | null;
      loaded_qty: number;
      delivered_qty: number;
      remaining_qty: number;
    }
  >();

  for (const it of items) {
    const pid = it.product.id;
    const cur =
      byProduct.get(pid) ??
      {
        product_id: pid,
        code: it.product.sku ?? null,
        name: it.product.name,
        category: it.product.category?.name ?? null,
        loaded_qty: 0,
        delivered_qty: 0,
        remaining_qty: 0
      };
    const qty = Number(it.qty);
    cur.loaded_qty += qty;
    if (it.order.status === "delivered") cur.delivered_qty += qty;
    byProduct.set(pid, cur);
  }

  const products = [...byProduct.values()]
    .map((r) => ({ ...r, remaining_qty: r.loaded_qty - r.delivered_qty }))
    .filter((r) => r.remaining_qty > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const totals = {
    product_count: products.length,
    remaining_qty: products.reduce((s, r) => s + r.remaining_qty, 0),
    loaded_qty: products.reduce((s, r) => s + r.loaded_qty, 0),
    delivered_qty: products.reduce((s, r) => s + r.delivered_qty, 0)
  };

  return { products, totals };
}
