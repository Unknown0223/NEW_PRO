import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendClientAuditLog } from "../clients/clients.service";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { invalidateDashboard } from "../../lib/redis-cache";
import type { CreatePaymentInput, PaymentListRow } from "./payment.query";
import { mapPaymentToListRow, paymentListInclude, resolveLedgerAgentId } from "./payment.query";
import {
  assertCashDeskAcceptsPurpose,
  finalizePaymentNumber,
  resolvePaymentDocNumber
} from "./payment.create.helpers";

export async function createClientExpense(
  tenantId: number,
  input: CreatePaymentInput,
  actorUserId: number | null
): Promise<PaymentListRow> {
  const { normalizeClientUuid } = await import("../orders/domain/order-idempotency.pure");
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("BAD_AMOUNT");
  }
  const pt = input.payment_type.trim();
  if (!pt) throw new Error("BAD_PAYMENT_TYPE");

  const client = await prisma.client.findFirst({
    where: { id: input.client_id, tenant_id: tenantId, merged_into_client_id: null }
  });
  if (!client) throw new Error("BAD_CLIENT");

  let cashDeskId: number | null = null;
  if (input.cash_desk_id != null && input.cash_desk_id > 0) {
    await assertCashDeskAcceptsPurpose(tenantId, input.cash_desk_id, "client_payment");
    cashDeskId = input.cash_desk_id;
  }

  let expeditorId: number | null = null;
  if (input.expeditor_user_id != null && input.expeditor_user_id > 0) {
    const ex = await prisma.user.findFirst({
      where: { id: input.expeditor_user_id, tenant_id: tenantId, is_active: true }
    });
    if (!ex) throw new Error("BAD_EXPEDITOR");
    const { assertExpeditorCanTakeNewWork } = await import("../work-slots/work-slots.expeditor-gate");
    await assertExpeditorCanTakeNewWork(tenantId, ex.id);
    expeditorId = ex.id;
  }

  const ledgerAgentId = await resolveLedgerAgentId(tenantId, input.ledger_agent_id, undefined, {
    requireActive: input.ledger_agent_allow_inactive ? false : true
  });

  const { assertFieldStaffBranchScopeForActor } = await import("../work-slots/work-slots.branch-scope");
  await assertFieldStaffBranchScopeForActor(tenantId, actorUserId, [
    client.agent_id,
    ledgerAgentId,
    input.expeditor_user_id
  ]);

  const amountDec = new Prisma.Decimal(input.amount);
  const uid =
    actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;

  let eventAt = new Date();
  if (input.paid_at != null && String(input.paid_at).trim()) {
    const parsed = new Date(String(input.paid_at).trim());
    if (!Number.isNaN(parsed.getTime())) {
      eventAt = parsed;
    }
  }

  const neg = amountDec.neg();
  const requestedNumber = resolvePaymentDocNumber(input.number);
  const expenseUuid = normalizeClientUuid(input.client_uuid);

  let row;
  try {
    row = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          tenant_id: tenantId,
          client_id: input.client_id,
          order_id: null,
          amount: amountDec,
          payment_type: pt,
          note: input.note?.trim() || null,
          created_by_user_id: uid,
          cash_desk_id: cashDeskId,
          workflow_status: "confirmed",
          paid_at: eventAt,
          received_at: eventAt,
          confirmed_at: eventAt,
          entry_kind: "client_expense",
          expeditor_user_id: expeditorId,
          ledger_agent_id: ledgerAgentId,
          number: requestedNumber,
          client_uuid: expenseUuid
        }
      });

      await finalizePaymentNumber(tx, p.id, requestedNumber);

      const bal = await tx.clientBalance.upsert({
        where: { tenant_id_client_id: { tenant_id: tenantId, client_id: input.client_id } },
        create: { tenant_id: tenantId, client_id: input.client_id, balance: neg },
        update: { balance: { decrement: amountDec } }
      });
      await tx.clientBalanceMovement.create({
        data: {
          client_balance_id: bal.id,
          delta: neg,
          note: `Расход клиента #${p.id}`,
          user_id: uid
        }
      });

      return tx.payment.findFirstOrThrow({
        where: { id: p.id },
        include: paymentListInclude(tenantId)
      });
    });
  } catch (e) {
    if (
      expenseUuid &&
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      const existing = await prisma.payment.findFirst({
        where: { tenant_id: tenantId, client_uuid: expenseUuid, deleted_at: null },
        include: paymentListInclude(tenantId)
      });
      if (existing) return mapPaymentToListRow(existing, tenantId);
    }
    throw e;
  }

  await appendClientAuditLog(tenantId, input.client_id, actorUserId, "client.client_expense", {
    payment_id: row.id,
    amount: input.amount,
    payment_type: pt
  });

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.finance,
    entityId: String(row.id),
    action: "payment.create",
    payload: {
      payment_id: row.id,
      client_id: input.client_id,
      amount: input.amount,
      payment_type: pt,
      entry_kind: "client_expense"
    }
  });

  void invalidateDashboard(tenantId);

  return mapPaymentToListRow(row, tenantId);
}
