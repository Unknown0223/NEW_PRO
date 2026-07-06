/**
 * Mobil ekspeditor — yetkazishda to'lov qabul qilish.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendClientAuditLog } from "../clients/clients.service";
import { invalidateDashboard } from "../../lib/redis-cache";
import {
  paymentMethodStorageKey,
  paymentTypeStorageKeysFromMethodEntries,
  type PaymentMethodEntryDto
} from "../tenant-settings/finance-refs";
import { loadPaymentMethodEntriesForResolve } from "../tenant-settings/tenant-settings.profile.read";
import type { AgentMobileConfigV1 } from "../staff/agent-mobile-config.types";
import { loadDeliveryDebtByClient } from "../client-balances/client-balances.delivery";
import {
  assertExpeditorOwnsOrder,
  loadExpeditorMobileConfig
} from "./mobile.expeditor.orders.service";

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
