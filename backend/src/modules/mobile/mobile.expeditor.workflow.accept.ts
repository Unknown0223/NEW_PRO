/**
 * Ekspeditor to'lov qabul qilish oqimi — qarzdorlar kartasi, to'lovlar, ledger.
 */
import { prisma } from "../../config/database";
import { Prisma } from "@prisma/client";
import { loadDeliveryDebtByClient, mergeLedgerWithUnpaidDelivered } from "../client-balances/client-balances.delivery";
import { getClientBalanceLedger } from "../clients/client-balance-ledger.get";
import { loadTenantLedgerPaymentContext } from "../clients/client-balance-ledger.helpers";
import { resolvePaymentMethodRefToLabel } from "../tenant-settings/finance-refs";

const RETURN_TYPES = ["return", "partial_return", "return_by_order"] as const;

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
