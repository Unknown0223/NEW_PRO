import { prisma } from "../../config/database";
import { withTransaction } from "../../lib/db-context";
import { appendClientAuditLog } from "../clients/clients.audit";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { resolveConfiguredBankTransferPaymentType } from "../tenant-settings/finance-refs";
import { loadPaymentMethodEntriesForResolve } from "../tenant-settings/tenant-settings.profile.read";
import { getBankTransferInboxDetail } from "./bank-transfer-inbox.service";
import { appendInboxEvent, MIN_COMMENT, resolveTransferChannel } from "./bank-transfer-inbox.helpers";

async function assertActiveClient(tenantId: number, clientId: number) {
  const c = await prisma.client.findFirst({
    where: {
      id: clientId,
      tenant_id: tenantId,
      merged_into_client_id: null,
      is_active: true
    },
    select: { id: true, name: true }
  });
  if (!c) throw new Error("BAD_CLIENT");
  return c;
}

async function resolveInboxPaymentType(tenantId: number, explicit: string | null | undefined): Promise<string> {
  const trimmed = explicit?.trim();
  if (trimmed) return trimmed.slice(0, 64);
  const entries = await loadPaymentMethodEntriesForResolve(tenantId);
  return resolveConfiguredBankTransferPaymentType(entries);
}

export async function createPendingPaymentFromInbox(
  tenantId: number,
  inboxId: number,
  actorUserId: number | null,
  opts?: { cash_desk_id?: number | null; payment_type?: string | null }
) {
  const uid =
    actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;

  const pt = await resolveInboxPaymentType(tenantId, opts?.payment_type);

  const paymentId = await withTransaction(async (tx) => {
    const inbox = await tx.bankTransferInbox.findFirst({
      where: { id: inboxId, tenant_id: tenantId }
    });
    if (!inbox) throw new Error("NOT_FOUND");
    if (inbox.payment_id) throw new Error("PAYMENT_EXISTS");
    if (inbox.status === "ignored" || inbox.status === "done") throw new Error("BAD_STATUS");
    const clientId = inbox.assigned_client_id ?? inbox.matched_client_id;
    if (!clientId) throw new Error("NO_CLIENT");

    const cashDeskId =
      opts?.cash_desk_id != null && opts.cash_desk_id > 0
        ? opts.cash_desk_id
        : inbox.cash_desk_id;
    if (cashDeskId) {
      const desk = await tx.cashDesk.findFirst({
        where: { id: cashDeskId, tenant_id: tenantId, is_active: true },
        select: { accepts_client_payments: true }
      });
      if (!desk) throw new Error("BAD_CASH_DESK");
      if (!desk.accepts_client_payments) throw new Error("CASH_DESK_NO_CLIENT_PAYMENTS");
    }

    const eventAt = inbox.paid_at ?? new Date();
    const channel = resolveTransferChannel(inbox.source);
    const noteParts = [
      `[bank_transfer_inbox #${inbox.id} channel=${channel} source=${inbox.source}]`,
      inbox.purpose?.trim() || null,
      inbox.external_id ? `ext=${inbox.external_id}` : null
    ].filter(Boolean);

    const payment = await tx.payment.create({
      data: {
        tenant_id: tenantId,
        client_id: clientId,
        amount: inbox.amount,
        payment_type: pt,
        note: noteParts.join(" "),
        created_by_user_id: uid,
        cash_desk_id: cashDeskId,
        workflow_status: "pending_confirmation",
        paid_at: eventAt,
        received_at: eventAt,
        confirmed_at: null,
        entry_kind: "payment",
        number: inbox.external_id?.trim().slice(0, 64) || null
      }
    });

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        number: payment.number?.trim() || String(payment.id)
      }
    });

    await tx.bankTransferInbox.update({
      where: { id: inbox.id },
      data: {
        payment_id: payment.id,
        status: "pending",
        assigned_client_id: clientId,
        cash_desk_id: cashDeskId
      }
    });

    await appendInboxEvent(tx, {
      tenantId,
      inboxId: inbox.id,
      eventType: "payment_created",
      actorUserId: uid,
      toClientId: clientId,
      payload: { payment_id: payment.id, payment_type: pt, channel, source: inbox.source }
    });

    return payment.id;
  });

  const linked = await prisma.bankTransferInbox.findFirst({
    where: { id: inboxId, tenant_id: tenantId },
    select: { assigned_client_id: true }
  });
  if (linked?.assigned_client_id) {
    await appendClientAuditLog(
      tenantId,
      linked.assigned_client_id,
      actorUserId,
      "client.bank_transfer_pending",
      { inbox_id: inboxId, payment_id: paymentId }
    );
  }

  if (uid) {
    await appendTenantAuditEvent({
      tenantId,
      actorUserId: uid,
      entityType: AuditEntityType.finance,
      entityId: String(paymentId),
      action: "bank_transfer.payment_created",
      payload: { inbox_id: inboxId, payment_id: paymentId, payment_type: pt }
    });
  }

  return getBankTransferInboxDetail(tenantId, inboxId);
}

export async function assignInboxClient(
  tenantId: number,
  inboxId: number,
  clientId: number,
  comment: string,
  actorUserId: number | null,
  opts?: { create_payment?: boolean; cash_desk_id?: number | null; payment_type?: string | null }
) {
  const cmt = comment.trim();
  if (cmt.length < MIN_COMMENT) throw new Error("COMMENT_REQUIRED");
  await assertActiveClient(tenantId, clientId);
  const uid =
    actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;

  await withTransaction(async (tx) => {
    const inbox = await tx.bankTransferInbox.findFirst({
      where: { id: inboxId, tenant_id: tenantId }
    });
    if (!inbox) throw new Error("NOT_FOUND");
    if (inbox.status === "done" || inbox.status === "ignored") throw new Error("BAD_STATUS");
    if (inbox.payment_id) throw new Error("PAYMENT_EXISTS");

    const fromId = inbox.assigned_client_id;
    await tx.bankTransferInbox.update({
      where: { id: inbox.id },
      data: {
        assigned_client_id: clientId,
        matched_client_id: inbox.matched_client_id ?? clientId,
        status: "matched"
      }
    });
    await appendInboxEvent(tx, {
      tenantId,
      inboxId: inbox.id,
      eventType: fromId && fromId !== clientId ? "reassigned" : "assigned",
      actorUserId: uid,
      comment: cmt,
      fromClientId: fromId,
      toClientId: clientId
    });
  });

  if (opts?.create_payment !== false) {
    await createPendingPaymentFromInbox(tenantId, inboxId, actorUserId, {
      cash_desk_id: opts?.cash_desk_id,
      payment_type: opts?.payment_type
    });
  }

  const detail = await getBankTransferInboxDetail(tenantId, inboxId);
  const fromClient = detail?.events
    ?.slice()
    .reverse()
    .find((e) => e.event_type === "assigned" || e.event_type === "reassigned");

  await appendClientAuditLog(tenantId, clientId, actorUserId, "client.bank_transfer_assign", {
    inbox_id: inboxId,
    comment: cmt,
    from_client_id: fromClient?.from_client_id ?? null
  });

  if (uid) {
    await appendTenantAuditEvent({
      tenantId,
      actorUserId: uid,
      entityType: AuditEntityType.finance,
      entityId: String(inboxId),
      action: "bank_transfer.assign",
      payload: { inbox_id: inboxId, client_id: clientId, comment: cmt }
    });
  }

  return detail;
}

/** Переназначение: только pending_confirmation (или ещё нет payment). */
export async function reassignInboxClient(
  tenantId: number,
  inboxId: number,
  newClientId: number,
  comment: string,
  actorUserId: number | null
) {
  const cmt = comment.trim();
  if (cmt.length < MIN_COMMENT) throw new Error("COMMENT_REQUIRED");
  await assertActiveClient(tenantId, newClientId);
  const uid =
    actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;

  let fromClientId: number | null = null;

  await withTransaction(async (tx) => {
    const inbox = await tx.bankTransferInbox.findFirst({
      where: { id: inboxId, tenant_id: tenantId }
    });
    if (!inbox) throw new Error("NOT_FOUND");

    if (inbox.payment_id) {
      const payment = await tx.payment.findFirst({
        where: { id: inbox.payment_id, tenant_id: tenantId, deleted_at: null }
      });
      if (!payment) throw new Error("PAYMENT_NOT_FOUND");
      if (payment.workflow_status === "confirmed") throw new Error("PAYMENT_CONFIRMED");
      if (payment.workflow_status !== "pending_confirmation") {
        throw new Error("PAYMENT_NOT_PENDING");
      }
      fromClientId = payment.client_id;
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          client_id: newClientId,
          note:
            payment.note != null && String(payment.note).trim()
              ? `${String(payment.note).trim()}\n[reassign] ${cmt}`
              : `[reassign] ${cmt}`
        }
      });
    }

    if (inbox.status === "ignored" || inbox.status === "done") throw new Error("BAD_STATUS");
    fromClientId = fromClientId ?? inbox.assigned_client_id;

    await tx.bankTransferInbox.update({
      where: { id: inbox.id },
      data: {
        assigned_client_id: newClientId,
        status: inbox.payment_id ? "pending" : "matched"
      }
    });

    await appendInboxEvent(tx, {
      tenantId,
      inboxId: inbox.id,
      eventType: "reassigned",
      actorUserId: uid,
      comment: cmt,
      fromClientId,
      toClientId: newClientId,
      payload: { payment_id: inbox.payment_id }
    });
  });

  if (fromClientId && fromClientId !== newClientId) {
    await appendClientAuditLog(
      tenantId,
      fromClientId,
      actorUserId,
      "client.bank_transfer_reassign_from",
      { inbox_id: inboxId, to_client_id: newClientId, comment: cmt }
    );
  }
  await appendClientAuditLog(tenantId, newClientId, actorUserId, "client.bank_transfer_reassign_to", {
    inbox_id: inboxId,
    from_client_id: fromClientId,
    comment: cmt
  });

  if (uid) {
    await appendTenantAuditEvent({
      tenantId,
      actorUserId: uid,
      entityType: AuditEntityType.finance,
      entityId: String(inboxId),
      action: "bank_transfer.reassign",
      payload: {
        inbox_id: inboxId,
        from_client_id: fromClientId,
        to_client_id: newClientId,
        comment: cmt
      }
    });
  }

  return getBankTransferInboxDetail(tenantId, inboxId);
}

export async function commentInboxItem(
  tenantId: number,
  inboxId: number,
  comment: string,
  actorUserId: number | null
) {
  const cmt = comment.trim();
  if (!cmt) throw new Error("COMMENT_REQUIRED");
  const uid =
    actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;

  await withTransaction(async (tx) => {
    const inbox = await tx.bankTransferInbox.findFirst({
      where: { id: inboxId, tenant_id: tenantId },
      select: { id: true }
    });
    if (!inbox) throw new Error("NOT_FOUND");
    await appendInboxEvent(tx, {
      tenantId,
      inboxId: inbox.id,
      eventType: "comment",
      actorUserId: uid,
      comment: cmt
    });
  });

  return getBankTransferInboxDetail(tenantId, inboxId);
}

export async function ignoreInboxItem(
  tenantId: number,
  inboxId: number,
  comment: string | null | undefined,
  actorUserId: number | null
) {
  const uid =
    actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;
  const cmt = comment?.trim() || null;

  await withTransaction(async (tx) => {
    const inbox = await tx.bankTransferInbox.findFirst({
      where: { id: inboxId, tenant_id: tenantId }
    });
    if (!inbox) throw new Error("NOT_FOUND");
    if (inbox.payment_id) {
      const payment = await tx.payment.findFirst({
        where: { id: inbox.payment_id, tenant_id: tenantId }
      });
      if (payment?.workflow_status === "confirmed") throw new Error("PAYMENT_CONFIRMED");
      if (payment?.workflow_status === "pending_confirmation") {
        throw new Error("HAS_PENDING_PAYMENT");
      }
    }
    await tx.bankTransferInbox.update({
      where: { id: inbox.id },
      data: {
        status: "ignored",
        ignored_at: new Date(),
        ignored_by_user_id: uid
      }
    });
    await appendInboxEvent(tx, {
      tenantId,
      inboxId: inbox.id,
      eventType: "ignored",
      actorUserId: uid,
      comment: cmt
    });
  });

  if (uid) {
    await appendTenantAuditEvent({
      tenantId,
      actorUserId: uid,
      entityType: AuditEntityType.finance,
      entityId: String(inboxId),
      action: "bank_transfer.ignore",
      payload: { inbox_id: inboxId, ...(cmt ? { comment: cmt } : {}) }
    });
  }

  return getBankTransferInboxDetail(tenantId, inboxId);
}
