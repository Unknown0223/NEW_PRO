/**
 * Qo‘lda перечисление (source=manual) — bank/1C import emas.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { withTransaction } from "../../lib/db-context";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { createPendingPaymentFromInbox } from "./bank-transfer-inbox.actions";
import { appendInboxEvent } from "./bank-transfer-inbox.helpers";
import { getBankTransferInboxDetail } from "./bank-transfer-inbox.service";

async function assertActiveClient(tenantId: number, clientId: number) {
  const c = await prisma.client.findFirst({
    where: {
      id: clientId,
      tenant_id: tenantId,
      merged_into_client_id: null,
      is_active: true
    },
    select: { id: true }
  });
  if (!c) throw new Error("BAD_CLIENT");
  return c;
}

/**
 * Inbox source=manual + client + (ixtiyoriy) pending payment.
 */
export async function createManualBankTransfer(
  tenantId: number,
  input: {
    amount: number;
    client_id: number;
    comment: string;
    paid_at?: string | null;
    payer_name?: string | null;
    cash_desk_id?: number | null;
    payment_type?: string | null;
    create_payment?: boolean;
  },
  actorUserId: number | null
) {
  const cmt = input.comment.trim();
  if (!cmt) throw new Error("COMMENT_REQUIRED");
  await assertActiveClient(tenantId, input.client_id);
  const uid =
    actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;

  let paidAt: Date | null = null;
  if (input.paid_at != null && String(input.paid_at).trim()) {
    const d = new Date(String(input.paid_at).trim());
    if (Number.isNaN(d.getTime())) throw new Error("BAD_PAID_AT");
    paidAt = d;
  }

  const cashDeskId =
    input.cash_desk_id != null && input.cash_desk_id > 0 ? input.cash_desk_id : null;
  if (cashDeskId) {
    const desk = await prisma.cashDesk.findFirst({
      where: { id: cashDeskId, tenant_id: tenantId, is_active: true },
      select: { accepts_client_payments: true }
    });
    if (!desk) throw new Error("BAD_CASH_DESK");
    if (!desk.accepts_client_payments) throw new Error("CASH_DESK_NO_CLIENT_PAYMENTS");
  }

  const inboxId = await withTransaction(async (tx) => {
    const externalId = `manual-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const row = await tx.bankTransferInbox.create({
      data: {
        tenant_id: tenantId,
        source: "manual",
        external_id: externalId,
        amount: input.amount,
        currency: "UZS",
        paid_at: paidAt,
        payer_name: input.payer_name?.trim() || null,
        purpose: cmt,
        status: "matched",
        matched_client_id: input.client_id,
        assigned_client_id: input.client_id,
        match_field: "manual",
        cash_desk_id: cashDeskId,
        created_by_user_id: uid,
        raw_payload: {
          entry_channel: "manual",
          comment: cmt
        } as Prisma.InputJsonValue
      }
    });

    await appendInboxEvent(tx, {
      tenantId,
      inboxId: row.id,
      eventType: "manual_created",
      actorUserId: uid,
      comment: cmt,
      toClientId: input.client_id,
      payload: { channel: "manual", source: "manual" }
    });

    return row.id;
  });

  if (input.create_payment !== false) {
    await createPendingPaymentFromInbox(tenantId, inboxId, actorUserId, {
      cash_desk_id: cashDeskId,
      payment_type: input.payment_type
    });
  }

  if (uid) {
    await appendTenantAuditEvent({
      tenantId,
      actorUserId: uid,
      entityType: AuditEntityType.finance,
      entityId: String(inboxId),
      action: "bank_transfer.manual_create",
      payload: {
        inbox_id: inboxId,
        client_id: input.client_id,
        channel: "manual",
        amount: input.amount
      }
    });
  }

  return getBankTransferInboxDetail(tenantId, inboxId);
}
