/**
 * Mobil ekspeditor (dastavchik) — yetkazish, to'lov, qaytarish, mijoz koordinatasi.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendClientAuditLog, updateClientFields } from "../clients/clients.service";
import { updateOrderStatus } from "../orders/domain/order.lifecycle";
import { getAllowedNextStatuses, normalizeOrderType } from "../orders/order-status";
import { listOrdersPaged } from "../orders/orders.service";
import { invalidateDashboard } from "../../lib/redis-cache";
import {
  paymentMethodStorageKey,
  paymentTypeStorageKeysFromMethodEntries,
  type PaymentMethodEntryDto
} from "../tenant-settings/finance-refs";
import { loadPaymentMethodEntriesForResolve } from "../tenant-settings/tenant-settings.profile.read";
import { resolveMobileConfigForUser } from "../staff/agent-mobile-config.defaults";
import type { AgentMobileConfigV1 } from "../staff/agent-mobile-config.types";
import { createPeriodReturn } from "../returns/returns-enhanced.create-period";
import { previewPolkiAutoBonusReverse } from "../returns/returns-bonus-reverse.preview";
import { loadInterchangeableSiblingsByProductId } from "../returns/returns-bonus-reverse.peresort";
import {
  getClientReturnsData,
  listClientOrderPickBalancesWithMeta
} from "../returns/returns-enhanced.client-data";
import { loadDeliveryDebtByClient } from "../client-balances/client-balances.delivery";

/**
 * Mijozning yetkazilgan (delivered) zakazlari bo'yicha to'lanmagan umumiy qarzi.
 * To'lov chegarasi: bitta zakaz qoldig'i emas, mijozning umumiy qarzigacha ruxsat —
 * shunda dastavchik qarzdorlikni ham yig'a oladi (naxt/qarz aralash bo'lsa ham).
 */
async function getExpeditorClientOutstandingDebt(
  tenantId: number,
  clientId: number
): Promise<number> {
  const map = await loadDeliveryDebtByClient(tenantId, [clientId]);
  const info = map.get(clientId);
  return info ? Math.max(0, Number(info.debt)) : 0;
}

export type ExpeditorPaymentMethodDto = {
  id: string;
  name: string;
  code: string | null;
  payment_type: string;
  currency_code: string;
};

function mapPaymentMethods(entries: PaymentMethodEntryDto[]): ExpeditorPaymentMethodDto[] {
  return entries
    .filter((e) => e.active !== false)
    .map((e) => ({
      id: e.id,
      name: e.name,
      code: e.code,
      payment_type: paymentMethodStorageKey(e),
      currency_code: e.currency_code
    }));
}

export function expeditorPaymentsEnabled(cfg: AgentMobileConfigV1): boolean {
  if (cfg.expeditor?.accept_payment_for_order === false) return false;
  const onDelivery = cfg.expeditor?.accept_payment_on_delivery !== false;
  const fromDebtors = cfg.expeditor?.accept_payment_from_debtors === true;
  return onDelivery || fromDebtors;
}

function assertExpeditorPaymentsAllowed(cfg: AgentMobileConfigV1): void {
  if (!expeditorPaymentsEnabled(cfg)) throw new Error("PAYMENT_DISABLED");
}

/** Config `allowed_payment_method_ids` bo'yicha filtrlash; bo'sh = hammasi. */
export function filterExpeditorPaymentMethods(
  methods: ExpeditorPaymentMethodDto[],
  allowedIds: string[] | undefined | null
): ExpeditorPaymentMethodDto[] {
  const ids = (allowedIds ?? []).map((x) => String(x ?? "").trim()).filter(Boolean);
  if (ids.length === 0) return methods;
  const set = new Set(ids);
  return methods.filter((m) => set.has(m.id));
}

/** Tasdiqlangan to'lovlar qarz/qoldiq hisobiga kiradi; `pending_confirmation` va `rejected` — yo'q. */
export function isPaymentCountedTowardOrderDebt(workflowStatus: string | null | undefined): boolean {
  const wf = String(workflowStatus ?? "confirmed");
  return wf !== "pending_confirmation" && wf !== "rejected";
}

async function sumOrderPayments(
  tenantId: number,
  orderId: number,
  workflowStatus?: "pending_confirmation" | "confirmed"
): Promise<number> {
  const where: Prisma.PaymentWhereInput = {
    tenant_id: tenantId,
    order_id: orderId,
    deleted_at: null,
    entry_kind: "payment"
  };
  if (workflowStatus === "pending_confirmation") {
    where.workflow_status = "pending_confirmation";
  } else if (workflowStatus === "confirmed") {
    where.workflow_status = { notIn: ["pending_confirmation", "rejected"] };
  }
  const agg = await prisma.payment.aggregate({ where, _sum: { amount: true } });
  return Number(agg._sum.amount ?? 0);
}

export async function loadExpeditorMobileConfig(
  tenantId: number,
  expeditorUserId: number
): Promise<AgentMobileConfigV1> {
  const u = await prisma.user.findFirst({
    where: { id: expeditorUserId, tenant_id: tenantId, role: "expeditor", is_active: true },
    select: { role: true, agent_entitlements: true }
  });
  if (!u) throw new Error("NOT_FOUND");
  return resolveMobileConfigForUser(u.role ?? "expeditor", u.agent_entitlements);
}

async function assertExpeditorOwnsOrder(
  tenantId: number,
  expeditorUserId: number,
  orderId: number
) {
  const row = await prisma.order.findFirst({
    where: { id: orderId, tenant_id: tenantId, expeditor_user_id: expeditorUserId },
    select: {
      id: true,
      client_id: true,
      agent_id: true,
      status: true,
      order_type: true,
      comment: true,
      total_sum: true,
      is_consignment: true
    }
  });
  if (!row) throw new Error("NOT_FOUND");
  return row;
}

function tradeDirectionAllowed(
  cfg: AgentMobileConfigV1,
  tradeDirectionId: number | null | undefined
): boolean {
  const allowed = cfg.expeditor?.allowed_trade_direction_ids;
  if (!allowed || allowed.length === 0) return true;
  if (tradeDirectionId == null || tradeDirectionId < 1) return false;
  return allowed.includes(tradeDirectionId);
}

/** Ekspeditor yetkazishlar ro'yxati (mijoz manzili bilan). */
export async function listMobileExpeditorDeliveries(
  tenantId: number,
  expeditorUserId: number,
  opts: { page?: number; limit?: number; status?: string }
) {
  const cfg = await loadExpeditorMobileConfig(tenantId, expeditorUserId);
  const result = await listOrdersPaged(
    tenantId,
    {
      page: opts.page ?? 1,
      limit: Math.min(opts.limit ?? 50, 100),
      status: opts.status?.trim() || undefined,
      expeditor_user_id: expeditorUserId,
      order_type: "order"
    },
    "expeditor",
    expeditorUserId
  );

  const allowedDirs = cfg.expeditor?.allowed_trade_direction_ids;
  let data = result.data;
  if (allowedDirs && allowedDirs.length > 0) {
    const dirSet = new Set(allowedDirs);
    const orderIds = data.map((o) => o.id);
    if (orderIds.length > 0) {
      const rows = await prisma.order.findMany({
        where: { tenant_id: tenantId, id: { in: orderIds } },
        select: {
          id: true,
          agent: { select: { trade_direction_id: true } }
        }
      });
      const dirByOrder = new Map(rows.map((r) => [r.id, r.agent?.trade_direction_id ?? null]));
      data = data.filter((o) => {
        const td = dirByOrder.get(o.id) ?? null;
        return tradeDirectionAllowed(cfg, td);
      });
    }
  }

  return {
    ...result,
    data: data.map((o) => ({
      id: o.id,
      number: o.number,
      status: o.status,
      client_id: o.client_id,
      client_name: o.client_name,
      client_phone: o.client_phone,
      address: [o.city, o.zone, o.region].filter(Boolean).join(", ") || null,
      total_sum: o.total_sum,
      debt: o.debt,
      delivered_at: o.delivered_at,
      expected_ship_date: o.expected_ship_date
    }))
  };
}

/** Bitta yetkazish — mahsulotlar, mijoz, keyingi holatlar. */
export async function getMobileExpeditorOrderDetail(
  tenantId: number,
  expeditorUserId: number,
  orderId: number
) {
  await assertExpeditorOwnsOrder(tenantId, expeditorUserId, orderId);
  const row = await prisma.order.findFirst({
    where: { id: orderId, tenant_id: tenantId, expeditor_user_id: expeditorUserId },
    select: {
      id: true,
      number: true,
      order_type: true,
      status: true,
      total_sum: true,
      bonus_sum: true,
      discount_sum: true,
      comment: true,
      created_at: true,
      is_consignment: true,
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
          longitude: true
        }
      },
      items: {
        select: {
          id: true,
          qty: true,
          price: true,
          total: true,
          is_bonus: true,
          product: { select: { id: true, name: true, sku: true } }
        },
        orderBy: [{ is_bonus: "asc" }, { id: "asc" }]
      }
    }
  });
  if (!row) throw new Error("NOT_FOUND");

  const orderType = normalizeOrderType(row.order_type);
  const items = row.items.map((i) => ({
    id: i.id,
    product_id: i.product.id,
    product_name: i.product.name,
    sku: i.product.sku,
    qty: Number(i.qty),
    price: Number(i.price),
    total: Number(i.total),
    is_bonus: i.is_bonus
  }));

  const existingPayments = await prisma.payment.findMany({
    where: {
      tenant_id: tenantId,
      order_id: orderId,
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
      workflow_status: true
    }
  });

  return {
    id: row.id,
    number: row.number,
    order_type: row.order_type ?? "order",
    status: row.status,
    comment: row.comment,
    is_consignment: row.is_consignment === true,
    created_at: row.created_at.toISOString(),
    total_sum: Number(row.total_sum),
    bonus_sum: Number(row.bonus_sum),
    discount_sum: Number(row.discount_sum),
    client: {
      id: row.client.id,
      name: row.client.name,
      phone: row.client.phone,
      address: row.client.address,
      city: row.client.city,
      region: row.client.region,
      zone: row.client.zone,
      latitude: row.client.latitude != null ? Number(row.client.latitude) : null,
      longitude: row.client.longitude != null ? Number(row.client.longitude) : null
    },
    items,
    payments: existingPayments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      payment_type: p.payment_type,
      paid_at: p.paid_at?.toISOString() ?? null,
      received_at: p.received_at?.toISOString() ?? null,
      created_at: p.created_at.toISOString(),
      workflow_status: String(p.workflow_status ?? "confirmed")
    })),
    allowed_next_statuses: getAllowedNextStatuses(row.status, {
      omitBackward: true,
      orderType
    })
  };
}

export async function patchMobileExpeditorOrderStatus(
  tenantId: number,
  expeditorUserId: number,
  orderId: number,
  nextStatus: string,
  reason?: string | null
) {
  await assertExpeditorOwnsOrder(tenantId, expeditorUserId, orderId);
  const row = await updateOrderStatus(tenantId, orderId, nextStatus, expeditorUserId, "expeditor");

  // Vazvrat sababini jurnalga yozamiz (audit + keyinroq ko'rsatish uchun).
  const trimmedReason = reason != null && String(reason).trim() ? String(reason).trim().slice(0, 500) : null;
  if (nextStatus.trim() === "returned" && trimmedReason) {
    await prisma.orderChangeLog.create({
      data: {
        order_id: orderId,
        user_id: expeditorUserId,
        action: "return_reason",
        payload: { reason: trimmedReason, source: "mobile_expeditor" }
      }
    });
  }
  return row;
}

/** Yetkazishda to'lov konteksti. */
export async function getMobileExpeditorPaymentContext(
  tenantId: number,
  expeditorUserId: number,
  orderId: number
) {
  const cfg = await loadExpeditorMobileConfig(tenantId, expeditorUserId);
  assertExpeditorPaymentsAllowed(cfg);
  const order = await assertExpeditorOwnsOrder(tenantId, expeditorUserId, orderId);

  const entries = await loadPaymentMethodEntriesForResolve(tenantId);
  const methods = filterExpeditorPaymentMethods(mapPaymentMethods(entries), cfg.expeditor?.allowed_payment_method_ids);

  const debt = await prisma.order.findFirst({
    where: { id: orderId, tenant_id: tenantId },
    select: { total_sum: true }
  });

  const total = Number(debt?.total_sum ?? order.total_sum);
  const paid = await sumOrderPayments(tenantId, orderId, "confirmed");
  const pending = await sumOrderPayments(tenantId, orderId, "pending_confirmation");
  const remaining = Math.max(0, total - paid - pending);

  // Mijozning umumiy qarzi (boshqa yetkazilgan to'lanmagan zakazlar ham).
  const clientDebt = await getExpeditorClientOutstandingDebt(tenantId, order.client_id);
  // Maksimal qabul qilinadigan summa: shu zakaz qoldig'i yoki mijoz umumiy qarzidan kattasi.
  const maxPayable = Math.max(remaining, clientDebt);

  const pendingPayments = await prisma.payment.findMany({
    where: {
      tenant_id: tenantId,
      order_id: orderId,
      deleted_at: null,
      entry_kind: "payment",
      workflow_status: "pending_confirmation"
    },
    select: {
      id: true,
      amount: true,
      payment_type: true,
      received_at: true,
      created_at: true
    },
    orderBy: { created_at: "desc" }
  });

  return {
    order_id: orderId,
    client_id: order.client_id,
    order_total: total,
    paid_total: paid,
    pending_total: pending,
    remaining,
    client_debt: clientDebt,
    max_payable: maxPayable,
    pending_payments: pendingPayments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      payment_type: p.payment_type,
      received_at: p.received_at?.toISOString() ?? null,
      created_at: p.created_at.toISOString(),
      workflow_status: "pending_confirmation"
    })),
    currency_symbol: cfg.expeditor?.currency_symbol ?? "so'm",
    payment_methods: methods,
    strict_payment_method: cfg.expeditor?.delivery_payment_method_strict === true,
    accept_payment_for_order: cfg.expeditor?.accept_payment_for_order !== false,
    accept_payment_on_delivery: cfg.expeditor?.accept_payment_on_delivery !== false,
    accept_payment_from_debtors: cfg.expeditor?.accept_payment_from_debtors === true
  };
}

export async function createMobileExpeditorOrderPayment(
  tenantId: number,
  expeditorUserId: number,
  orderId: number,
  input: { payment_type: string; amount: number; note?: string | null }
) {
  const cfg = await loadExpeditorMobileConfig(tenantId, expeditorUserId);
  assertExpeditorPaymentsAllowed(cfg);
  const order = await assertExpeditorOwnsOrder(tenantId, expeditorUserId, orderId);

  const entries = await loadPaymentMethodEntriesForResolve(tenantId);
  const allowedKeys = new Set(paymentTypeStorageKeysFromMethodEntries(entries));
  const methods = filterExpeditorPaymentMethods(mapPaymentMethods(entries), cfg.expeditor?.allowed_payment_method_ids);
  const pt = input.payment_type.trim();
  if (!pt || !allowedKeys.has(pt)) throw new Error("BAD_PAYMENT_TYPE");
  if (cfg.expeditor?.allowed_payment_method_ids?.length) {
    const methodOk = methods.some((m) => m.payment_type === pt);
    if (!methodOk) throw new Error("BAD_PAYMENT_TYPE");
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("BAD_AMOUNT");

  const total = Number(order.total_sum);
  const paid = await sumOrderPayments(tenantId, orderId, "confirmed");
  const pending = await sumOrderPayments(tenantId, orderId, "pending_confirmation");
  const remaining = Math.max(0, total - paid - pending);
  // Chegara: shu zakaz qoldig'i yoki mijozning umumiy qarzi (qaysi katta bo'lsa).
  // Shunda zakaz to'liq to'langan bo'lsa ham (qoldiq 0), dastavchik mijoz
  // qarzdorligini yig'a oladi.
  const clientDebt = await getExpeditorClientOutstandingDebt(tenantId, order.client_id);
  const maxPayable = Math.max(remaining, clientDebt);
  if (input.amount > maxPayable + 0.01) throw new Error("BAD_AMOUNT");

  const now = new Date();
  const amountDec = new Prisma.Decimal(input.amount);
  const payment = await prisma.payment.create({
    data: {
      tenant_id: tenantId,
      client_id: order.client_id,
      order_id: orderId,
      amount: amountDec,
      payment_type: pt,
      note: input.note?.trim() || null,
      created_by_user_id: expeditorUserId,
      cash_desk_id: null,
      workflow_status: "pending_confirmation",
      received_at: now,
      paid_at: null,
      confirmed_at: null,
      entry_kind: "payment",
      expeditor_user_id: expeditorUserId,
      ledger_agent_id: order.agent_id ?? null
    }
  });

  await appendClientAuditLog(tenantId, order.client_id, expeditorUserId, "client.payment", {
    payment_id: payment.id,
    amount: input.amount,
    payment_type: pt,
    order_id: orderId,
    workflow_status: "pending_confirmation",
    source: "mobile_expeditor"
  });

  // Bu zakaz bo'yicha kassir qaytargan (taymerli) to'lov bo'lsa — endi
  // to'g'rilab qayta yuborildi. Faol grantlarni yopamiz (banner va teskari
  // taymer ekspeditorda yo'qoladi) va eski rad etilgan to'lovni arxivga
  // ko'chiramiz — shunda u «Отклонено» bo'lib qolmaydi, faqat yangi (mana
  // shu) oddiy to'lov ro'yxatda ko'rinadi. Rad etilgan to'lov balansga
  // ta'sir qilmagani uchun arxivlash balans-neytral.
  const closingGrants = await prisma.paymentEditGrant.findMany({
    where: {
      tenant_id: tenantId,
      access_user_id: expeditorUserId,
      status: "active",
      payment: { order_id: orderId, workflow_status: "rejected", deleted_at: null }
    },
    select: { payment_id: true }
  });
  const oldRejectedPaymentIds = [...new Set(closingGrants.map((g) => g.payment_id))];

  await prisma.paymentEditGrant.updateMany({
    where: {
      tenant_id: tenantId,
      access_user_id: expeditorUserId,
      status: "active",
      payment: { order_id: orderId }
    },
    data: { status: "completed", completed_at: now }
  });

  if (oldRejectedPaymentIds.length > 0) {
    await prisma.payment.updateMany({
      where: {
        id: { in: oldRejectedPaymentIds },
        tenant_id: tenantId,
        workflow_status: "rejected",
        deleted_at: null
      },
      data: {
        workflow_status: "deleted",
        deleted_at: now,
        delete_reason_ref: "Исправлено экспедитором (создана новая оплата)"
      }
    });
  }

  void invalidateDashboard(tenantId);

  return {
    payment_id: payment.id,
    amount: input.amount,
    payment_type: pt,
    workflow_status: "pending_confirmation"
  };
}

/** Qisman / to'liq qaytarish — holat `returned`. */
export async function createMobileExpeditorPartialReturn(
  tenantId: number,
  expeditorUserId: number,
  orderId: number,
  input: {
    reason: string;
    note?: string | null;
    items?: Array<{ order_item_id: number; qty: number }>;
  }
) {
  const cfg = await loadExpeditorMobileConfig(tenantId, expeditorUserId);
  if (cfg.orders?.allow_partial_return_edit === false) throw new Error("RETURN_DISABLED");

  const order = await assertExpeditorOwnsOrder(tenantId, expeditorUserId, orderId);
  if (order.status !== "delivered") throw new Error("BAD_STATUS");

  const reason = input.reason.trim();
  if (!reason) throw new Error("BAD_REASON");

  let itemsNote = "";
  if (input.items?.length) {
    const orderItems = await prisma.orderItem.findMany({
      where: { order_id: orderId, order: { tenant_id: tenantId } },
      select: {
        id: true,
        qty: true,
        product: { select: { sku: true, name: true } }
      }
    });
    const byId = new Map(orderItems.map((i) => [i.id, i]));
    const lines: string[] = [];
    for (const row of input.items) {
      const line = byId.get(row.order_item_id);
      if (!line) throw new Error("BAD_RETURN_ITEM");
      const maxQty = Number(line.qty);
      if (!Number.isFinite(row.qty) || row.qty <= 0 || row.qty > maxQty) {
        throw new Error("BAD_RETURN_QTY");
      }
      lines.push(`${line.product.sku} ${line.product.name}: ${row.qty}/${maxQty}`);
    }
    itemsNote = lines.join("; ");
  }

  const noteParts = [`qaytarish: ${reason}`];
  if (itemsNote) noteParts.push(`qatorlar: ${itemsNote}`);
  if (input.note?.trim()) noteParts.push(input.note.trim());
  const noteLine = `[${noteParts.join(" | ")}]`;
  const nextComment = order.comment?.trim() ? `${order.comment.trim()}\n${noteLine}` : noteLine;
  await prisma.order.update({
    where: { id: orderId },
    data: { comment: nextComment }
  });

  return updateOrderStatus(tenantId, orderId, "returned", expeditorUserId, "expeditor");
}

/** Avtomobildan qayta yuklash — `delivered` → `delivering`. */
export async function createMobileExpeditorReloadFromVehicle(
  tenantId: number,
  expeditorUserId: number,
  orderId: number,
  input: { note?: string | null }
) {
  const cfg = await loadExpeditorMobileConfig(tenantId, expeditorUserId);
  if (cfg.orders?.allow_reload_from_vehicle === false) throw new Error("RELOAD_DISABLED");

  const order = await assertExpeditorOwnsOrder(tenantId, expeditorUserId, orderId);
  if (order.status !== "delivered") throw new Error("BAD_STATUS");

  if (input.note?.trim()) {
    const noteLine = `[dogruzka] ${input.note.trim()}`;
    const nextComment = order.comment?.trim() ? `${order.comment.trim()}\n${noteLine}` : noteLine;
    await prisma.order.update({
      where: { id: orderId },
      data: { comment: nextComment }
    });
  }

  const updated = await updateOrderStatus(
    tenantId,
    orderId,
    "delivering",
    expeditorUserId,
    "expeditor"
  );
  return { id: updated.id, status: updated.status, number: updated.number };
}

/**
 * Ekspeditor o'zi shakllantirgan qaytarish hujjatlari (vozvratnaya nakladnaya).
 * Dastavchik omborga TOPSHIRADIGAN mahsulotlar ro'yxati (miqdor bilan) va
 * zavsklad qabul holati (`pending` → `posted`/`cancelled`) shu yerda ko'rinadi.
 */
export async function listMobileExpeditorReturns(
  tenantId: number,
  expeditorUserId: number
) {
  const rows = await prisma.salesReturn.findMany({
    where: { tenant_id: tenantId, created_by_user_id: expeditorUserId },
    orderBy: { created_at: "desc" },
    take: 100,
    select: {
      id: true,
      number: true,
      status: true,
      created_at: true,
      accepted_at: true,
      refund_amount: true,
      order: { select: { number: true } },
      client: { select: { name: true } },
      lines: {
        orderBy: { id: "asc" },
        select: { qty: true, product: { select: { sku: true, name: true } } }
      }
    }
  });

  const statusLabel = (s: string): string =>
    s === "pending"
      ? "Qabul kutilmoqda"
      : s === "posted"
        ? "Qabul qilindi"
        : s === "cancelled"
          ? "Rad etildi"
          : s;

  return {
    data: rows.map((r) => {
      const totalQty = r.lines.reduce((a, ln) => a + Number(ln.qty), 0);
      return {
        id: r.id,
        number: r.number,
        status: r.status,
        status_label: statusLabel(r.status),
        created_at: r.created_at.toISOString(),
        accepted_at: r.accepted_at ? r.accepted_at.toISOString() : null,
        order_number: r.order?.number ?? null,
        client_name: r.client?.name ?? null,
        refund_amount: r.refund_amount ? r.refund_amount.toString() : null,
        total_qty: totalQty,
        items: r.lines.map((ln) => ({
          sku: ln.product.sku,
          name: ln.product.name,
          qty: ln.qty.toString()
        }))
      };
    })
  };
}

// ─── «Возврат с полки по заказу» (return_by_order) ──────────────────────────

/**
 * Ekspeditorga biriktirilgan yetkazilgan (delivered) zakazlar — sozlamadagi
 * `return_filter` (balans/davr) shartiga mos va to'liq qaytarilmaganlari.
 * «По заказу» rejimida zakazni tanlash uchun ro'yxat.
 */
export async function listMobileExpeditorReturnByOrderOrders(
  tenantId: number,
  expeditorUserId: number
) {
  const cfg = await loadExpeditorMobileConfig(tenantId, expeditorUserId);
  if (cfg.orders?.allow_return_from_shelf !== true) throw new Error("RETURN_DISABLED");

  const delivered = await prisma.order.findMany({
    where: {
      tenant_id: tenantId,
      expeditor_user_id: expeditorUserId,
      status: "delivered",
      order_type: "order"
    },
    select: {
      id: true,
      number: true,
      total_sum: true,
      created_at: true,
      client_id: true,
      client: { select: { name: true } }
    },
    orderBy: { created_at: "desc" }
  });
  if (delivered.length === 0) return { orders: [], filter_mode: null as string | null };

  const byClient = new Map<number, typeof delivered>();
  for (const o of delivered) {
    const arr = byClient.get(o.client_id) ?? [];
    arr.push(o);
    byClient.set(o.client_id, arr);
  }

  type OrderProduct = {
    product_id: number;
    name: string;
    sku: string;
    category_id: number | null;
    category_name: string | null;
  };
  const out: Array<{
    id: number;
    number: string;
    client_id: number;
    client_name: string;
    total_sum: number;
    created_at: string;
    remaining_paid_qty: number;
    products: OrderProduct[];
  }> = [];
  let filterMode: string | null = null;

  for (const [clientId, orders] of byClient) {
    let eligible;
    try {
      eligible = await listClientOrderPickBalancesWithMeta(tenantId, clientId);
    } catch {
      continue;
    }
    filterMode = eligible.filter_meta?.filter_mode ?? filterMode;
    const balById = new Map(eligible.balances.map((b) => [b.order_id, b]));
    for (const o of orders) {
      const bal = balById.get(o.id);
      if (!bal) continue;
      out.push({
        id: o.id,
        number: o.number,
        client_id: clientId,
        client_name: o.client?.name ?? "",
        total_sum: Number(o.total_sum),
        created_at: o.created_at.toISOString(),
        remaining_paid_qty: bal.remaining_paid_qty,
        products: []
      });
    }
  }

  // Filtr (kategoriya / tovar) uchun har bir zakaz tarkibini yuklaymiz.
  const eligibleIds = out.map((o) => o.id);
  if (eligibleIds.length > 0) {
    const items = await prisma.orderItem.findMany({
      where: { order_id: { in: eligibleIds } },
      select: {
        order_id: true,
        product_id: true,
        product: {
          select: {
            name: true,
            sku: true,
            category_id: true,
            category: { select: { name: true } }
          }
        }
      }
    });
    const byOrder = new Map<number, OrderProduct[]>();
    for (const it of items) {
      const arr = byOrder.get(it.order_id) ?? [];
      if (!arr.some((p) => p.product_id === it.product_id)) {
        arr.push({
          product_id: it.product_id,
          name: it.product?.name ?? "",
          sku: it.product?.sku ?? "",
          category_id: it.product?.category_id ?? null,
          category_name: it.product?.category?.name ?? null
        });
      }
      byOrder.set(it.order_id, arr);
    }
    for (const o of out) {
      o.products = byOrder.get(o.id) ?? [];
    }
  }

  out.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return { orders: out, filter_mode: filterMode };
}

/** Bitta zakaz tarkibi — qaytarish mumkin bo'lgan mahsulotlar (qoldiq, narx, bonus). */
export async function getMobileExpeditorReturnByOrderComposition(
  tenantId: number,
  expeditorUserId: number,
  orderId: number
) {
  const cfg = await loadExpeditorMobileConfig(tenantId, expeditorUserId);
  if (cfg.orders?.allow_return_from_shelf !== true) throw new Error("RETURN_DISABLED");

  const order = await assertExpeditorOwnsOrder(tenantId, expeditorUserId, orderId);
  if (order.status !== "delivered") throw new Error("BAD_STATUS");

  // Filter (balans/davr) + status tekshiruvi shu yerda amalga oshadi.
  const cdata = await getClientReturnsData(
    tenantId,
    order.client_id,
    undefined,
    undefined,
    orderId
  );

  // Mahsulot kategoriyalari (Method 2 — kategoriya bo'yicha akkordeon uchun).
  const productIds = [...new Set(cdata.items.map((it) => it.product_id))];
  const catRows = productIds.length
    ? await prisma.product.findMany({
        where: { tenant_id: tenantId, id: { in: productIds } },
        select: { id: true, category_id: true, category: { select: { name: true } } }
      })
    : [];
  const catById = new Map(
    catRows.map((p) => [
      p.id,
      { category_id: p.category_id ?? null, category_name: p.category?.name ?? null }
    ])
  );

  const items = cdata.items
    .filter((it) => Number(it.qty) > 0)
    .map((it) => {
      const price = Number(it.price);
      const maxQty = Number(it.qty);
      const cat = catById.get(it.product_id);
      return {
        product_id: it.product_id,
        sku: it.sku,
        name: it.name,
        unit: it.unit,
        is_bonus: it.is_bonus,
        price,
        max_qty: maxQty,
        line_total: it.is_bonus ? 0 : price * maxQty,
        category_id: cat?.category_id ?? null,
        category_name: cat?.category_name ?? null
      };
    });

  const paidValue = items
    .filter((i) => !i.is_bonus)
    .reduce((s, i) => s + i.line_total, 0);
  const bonusQty = items
    .filter((i) => i.is_bonus)
    .reduce((s, i) => s + i.max_qty, 0);
  const ord = cdata.orders[0];

  // ─── Peresort (almashtirish) variantlari ──────────────────────────────────
  // Interchangeable (almashtiriladigan) guruh bo'yicha: har bir zakaz mahsuloti
  // uchun shu GURUHDAGI BARCHA faol «aka-uka» mahsulotlar (zakazda bo'lishi shart
  // emas — fizik boshqa mahsulotni qaytarish mumkin). Hisob manba mahsulot
  // bo'yicha; manzil createPeriodReturn'da `return_as_product_id` orqali yoziladi.
  const siblingsMap = await loadInterchangeableSiblingsByProductId(tenantId);
  const peresortEnabled = siblingsMap.size > 0;
  const peresort: Record<string, Array<{
    id: number;
    name: string;
    sku: string;
  }>> = {};
  if (peresortEnabled) {
    const productIdsInOrder = [...new Set(items.map((i) => i.product_id))];
    // Barcha kerakli «aka-uka» id'larni yig'amiz va FAQAT faol mahsulot nomi/sku
    // ni yuklaymiz (noaktiv/o'chirilganlar variantlardan tushib qoladi).
    const sibIds = new Set<number>();
    for (const pid of productIdsInOrder) {
      for (const s of siblingsMap.get(pid) ?? []) sibIds.add(s.id);
    }
    const sibInfo = new Map<number, { name: string; sku: string }>();
    if (sibIds.size > 0) {
      const rows = await prisma.product.findMany({
        where: { tenant_id: tenantId, id: { in: [...sibIds] }, is_active: true },
        select: { id: true, name: true, sku: true }
      });
      for (const r of rows) sibInfo.set(r.id, { name: r.name, sku: r.sku });
    }
    for (const pid of productIdsInOrder) {
      const sibs = siblingsMap.get(pid);
      if (!sibs || sibs.length === 0) continue;
      const options = sibs
        .filter((s) => sibInfo.has(s.id))
        .map((s) => ({
          id: s.id,
          name: sibInfo.get(s.id)!.name,
          sku: sibInfo.get(s.id)!.sku
        }));
      if (options.length > 0) peresort[String(pid)] = options;
    }
  }

  return {
    order: { id: order.id, number: ord?.number ?? String(order.id) },
    client_id: order.client_id,
    items,
    paid_value: paidValue,
    bonus_qty_total: bonusQty,
    max_returnable_value: Number(cdata.max_returnable_value),
    client_balance: Number(cdata.client_balance),
    peresort_enabled: peresortEnabled,
    peresort
  };
}

/**
 * «Возврат с полки по заказу» yaratish — web bilan bir xil logika
 * (`createPeriodReturn`, order-scoped): SalesReturn + mirror order, savdo/bonus
 * hisobi, balansga refund, filter/qty validatsiyalari.
 */
export async function createMobileExpeditorReturnByOrder(
  tenantId: number,
  expeditorUserId: number,
  orderId: number,
  input: {
    lines: Array<{
      product_id: number;
      qty?: number;
      paid_qty?: number;
      bonus_qty?: number;
      return_qty?: number;
      /** Peresort: bonusni shu interchangeable mahsulotga yo'naltirish. */
      bonus_target_product_id?: number;
    }>;
    note?: string | null;
    reason?: string | null;
  }
) {
  const cfg = await loadExpeditorMobileConfig(tenantId, expeditorUserId);
  if (cfg.orders?.allow_return_from_shelf !== true) throw new Error("RETURN_DISABLED");

  const order = await assertExpeditorOwnsOrder(tenantId, expeditorUserId, orderId);
  if (order.status !== "delivered") throw new Error("BAD_STATUS");

  // Ikki rejim:
  //  - AUTO («По заказу» / «Полный заказ»): faqat `return_qty` (savdo) yuboriladi;
  //    bonus haqqini va bo'linishni tizim markazdan (preview) hisoblaydi.
  //  - MANUAL («По продуктам»): foydalanuvchi `paid_qty`/`bonus_qty` ni qo'lda
  //    kiritadi — ular AYNAN hurmat qilinadi (avto-hisob/«долг» yo'q).
  const autoReq = new Map<number, { return_qty: number; target?: number }>();
  const manualReq = new Map<number, { paid_qty: number; bonus_qty: number; target?: number }>();
  for (const l of input.lines) {
    const target =
      l.bonus_target_product_id != null && l.bonus_target_product_id > 0
        ? l.bonus_target_product_id
        : undefined;
    if (l.return_qty != null && l.return_qty > 0) {
      const cur = autoReq.get(l.product_id) ?? { return_qty: 0 };
      cur.return_qty += l.return_qty;
      if (target != null) cur.target = target;
      autoReq.set(l.product_id, cur);
      continue;
    }
    const paid = l.paid_qty ?? 0;
    const bonus = l.bonus_qty ?? 0;
    if (paid > 0 || bonus > 0) {
      const cur = manualReq.get(l.product_id) ?? { paid_qty: 0, bonus_qty: 0 };
      cur.paid_qty += paid;
      cur.bonus_qty += bonus;
      if (target != null) cur.target = target;
      manualReq.set(l.product_id, cur);
      continue;
    }
    // Eski mijozlar (legacy `qty`) — AUTO sifatida qaraladi.
    const legacy = l.qty ?? 0;
    if (legacy > 0) {
      const cur = autoReq.get(l.product_id) ?? { return_qty: 0 };
      cur.return_qty += legacy;
      if (target != null) cur.target = target;
      autoReq.set(l.product_id, cur);
    }
  }
  if (autoReq.size === 0 && manualReq.size === 0) throw new Error("EMPTY_LINES");

  // Peresort (almashtirish): manba mahsulot → agent tanlagan fizik qaytariladigan
  // boshqa (interchangeable guruhdagi) mahsulot. Hisob-kitob manba bo'yicha
  // qoladi; manzil `return_as_product_id` orqali createPeriodReturn'ga uzatiladi
  // (u yerda yakuniy qator manzil mahsulotga qayta nomlanadi). Shu sabab guruhdagi
  // istalgan mahsulot (zakazda bo'lmasa ham) qaytarish manzili bo'la oladi.
  const targetByProduct = new Map<number, number>();
  for (const [pid, v] of autoReq) if (v.target != null && v.target !== pid) targetByProduct.set(pid, v.target);
  for (const [pid, v] of manualReq) if (v.target != null && v.target !== pid) targetByProduct.set(pid, v.target);

  const merged = new Map<number, { paid: number; bonus: number }>();
  const addMerged = (pid: number, paid: number, bonus: number) => {
    const c = merged.get(pid) ?? { paid: 0, bonus: 0 };
    c.paid += paid;
    c.bonus += bonus;
    merged.set(pid, c);
  };
  let totalDebt = 0;

  // AUTO — markaziy hisob: savdo/bonus bo'linishi + bonus haqqi (eligibility).
  if (autoReq.size > 0) {
    const preview = await previewPolkiAutoBonusReverse(tenantId, {
      client_id: order.client_id,
      order_id: orderId,
      lines: Array.from(autoReq.entries()).map(([product_id, v]) => ({
        product_id,
        return_qty: v.return_qty
      }))
    });
    for (const pl of preview.lines) {
      if (pl.paid_qty + pl.bonus_qty > 0) addMerged(pl.product_id, pl.paid_qty, pl.bonus_qty);
      // Peresort endi qarz yaratmaydi (manzil teng qiymatli) — faqat bonus
      // kamchiligi (eligibility) qarzini olamiz.
      totalDebt += Math.max(0, pl.bonus_debt_amount - pl.peresort_debt_amount);
    }
  }

  // MANUAL — foydalanuvchi kiritgan savdo/bonus aynan hurmat qilinadi.
  if (manualReq.size > 0) {
    for (const [pid, v] of manualReq) {
      if (v.paid_qty + v.bonus_qty > 0) addMerged(pid, v.paid_qty, v.bonus_qty);
    }
  }

  const lines = Array.from(merged.entries())
    .filter(([, v]) => v.paid + v.bonus > 0)
    .map(([product_id, v]) => {
      const tgt = targetByProduct.get(product_id);
      return {
        product_id,
        paid_qty: v.paid,
        bonus_qty: v.bonus,
        ...(tgt != null ? { return_as_product_id: tgt } : {})
      };
    });
  if (lines.length === 0) throw new Error("EMPTY_LINES");

  return createPeriodReturn(
    tenantId,
    {
      client_id: order.client_id,
      order_id: orderId,
      lines,
      note: input.note ?? null,
      refusal_reason_ref: input.reason ?? null,
      bonus_debt_amount: totalDebt > 0 ? totalDebt : undefined,
      skip_order_scoped_reconcile: true
    },
    expeditorUserId
  );
}

/**
 * «Возврат с полки по заказу» oldindan hisoblash — tizimning bonus mexanizmi
 * (umumiy qoidalar) bo'yicha. Kiritilgan miqdorlar uchun savdo/bonus bo'linishi
 * va bonus kamchiligini (mijoz balansiga/qarzga o'tuvchi summa) qaytaradi.
 */
export async function previewMobileExpeditorReturnByOrder(
  tenantId: number,
  expeditorUserId: number,
  orderId: number,
  lines: Array<{ product_id: number; return_qty: number }>
) {
  const cfg = await loadExpeditorMobileConfig(tenantId, expeditorUserId);
  if (cfg.orders?.allow_return_from_shelf !== true) throw new Error("RETURN_DISABLED");

  const order = await assertExpeditorOwnsOrder(tenantId, expeditorUserId, orderId);
  if (order.status !== "delivered") throw new Error("BAD_STATUS");

  const effective = lines.filter((l) => l.return_qty > 0);
  if (effective.length === 0) {
    return {
      lines: [],
      totals: {
        paid_qty: 0,
        bonus_qty: 0,
        bonus_debt_qty: 0,
        bonus_debt_amount: "0",
        refund_amount: "0"
      },
      warnings: [] as string[]
    };
  }

  return previewPolkiAutoBonusReverse(tenantId, {
    client_id: order.client_id,
    order_id: orderId,
    lines: effective
  });
}

/** Mijoz koordinatasi (config ruxsat bersa). */
export async function patchMobileExpeditorClientLocation(
  tenantId: number,
  expeditorUserId: number,
  clientId: number,
  patch: { latitude: number; longitude: number }
) {
  const cfg = await loadExpeditorMobileConfig(tenantId, expeditorUserId);
  if (cfg.client?.can_change_client_location !== true) throw new Error("LOCATION_FORBIDDEN");

  const orderLink = await prisma.order.findFirst({
    where: {
      tenant_id: tenantId,
      expeditor_user_id: expeditorUserId,
      client_id: clientId
    },
    select: { id: true }
  });
  if (!orderLink) throw new Error("NOT_FOUND");

  await updateClientFields(
    tenantId,
    clientId,
    {
      latitude: patch.latitude,
      longitude: patch.longitude
    },
    expeditorUserId
  );

  const row = await prisma.client.findFirst({
    where: { id: clientId, tenant_id: tenantId },
    select: { id: true, latitude: true, longitude: true }
  });
  if (!row) throw new Error("NOT_FOUND");
  return {
    id: row.id,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null
  };
}
