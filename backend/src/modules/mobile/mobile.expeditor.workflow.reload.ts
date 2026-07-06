/**
 * Ekspeditor ombor/otgruzka oqimi — nakladnoylar, omborlar, mashina qoldig'i.
 */
import { prisma } from "../../config/database";
import { Prisma } from "@prisma/client";
import { loadDeliveryDebtByClient, mergeLedgerWithUnpaidDelivered } from "../client-balances/client-balances.delivery";
import { loadTenantLedgerPaymentContext } from "../clients/client-balance-ledger.helpers";
import { updateOrderStatus } from "../orders/domain/order.lifecycle";
import { resolvePaymentMethodRefToLabel } from "../tenant-settings/finance-refs";

const SHIPPING_STATUSES = ["picking", "delivering"] as const;
const RETURN_TYPES = ["return", "partial_return", "return_by_order"] as const;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
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
