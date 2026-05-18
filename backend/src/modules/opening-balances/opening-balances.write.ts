import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";

import { appendClientAuditLog } from "../clients/clients.service";
import { invalidateDashboard } from "../../lib/redis-cache";
import type { CreateOpeningBalanceInput, OpeningBalanceListRow } from "./opening-balances.types";
import { listInclude, mapRow } from "./opening-balances.shared";

export async function createOpeningBalance(
  tenantId: number,
  input: CreateOpeningBalanceInput,
  actorUserId: number | null
): Promise<OpeningBalanceListRow> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("BAD_AMOUNT");
  const pt = input.payment_type.trim();
  if (!pt) throw new Error("BAD_PAYMENT_TYPE");
  if (input.balance_type !== "debt" && input.balance_type !== "surplus") throw new Error("BAD_BALANCE_TYPE");

  const client = await prisma.client.findFirst({
    where: { id: input.client_id, tenant_id: tenantId, merged_into_client_id: null }
  });
  if (!client) throw new Error("BAD_CLIENT");

  let cashDeskId: number | null = null;
  if (input.cash_desk_id != null && input.cash_desk_id > 0) {
    const desk = await prisma.cashDesk.findFirst({
      where: { id: input.cash_desk_id, tenant_id: tenantId, is_active: true }
    });
    if (!desk) throw new Error("BAD_CASH_DESK");
    cashDeskId = desk.id;
  }

  const amountDec = new Prisma.Decimal(input.amount);
  const delta = input.balance_type === "surplus" ? amountDec : amountDec.neg();
  const uid =
    actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;

  let paidAt: Date | null = null;
  if (input.paid_at != null && String(input.paid_at).trim()) {
    const parsed = new Date(String(input.paid_at).trim());
    if (!Number.isNaN(parsed.getTime())) paidAt = parsed;
  }

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.clientOpeningBalanceEntry.create({
      data: {
        tenant_id: tenantId,
        client_id: input.client_id,
        balance_type: input.balance_type,
        amount: amountDec,
        payment_type: pt,
        cash_desk_id: cashDeskId,
        trade_direction: input.trade_direction?.trim() || null,
        note: input.note?.trim() || null,
        paid_at: paidAt,
        created_by_user_id: uid
      }
    });

    const bal = await tx.clientBalance.upsert({
      where: { tenant_id_client_id: { tenant_id: tenantId, client_id: input.client_id } },
      create: { tenant_id: tenantId, client_id: input.client_id, balance: delta },
      update: { balance: { increment: delta } }
    });
    await tx.clientBalanceMovement.create({
      data: {
        client_balance_id: bal.id,
        delta,
        note: `Начальный баланс #${created.id}`,
        user_id: uid
      }
    });

    return tx.clientOpeningBalanceEntry.findFirstOrThrow({
      where: { id: created.id },
      include: listInclude
    });
  });

  await appendClientAuditLog(tenantId, input.client_id, actorUserId, "client.opening_balance", {
    entry_id: row.id,
    amount: input.amount,
    balance_type: input.balance_type,
    payment_type: pt
  });

  void invalidateDashboard(tenantId);
  return mapRow(row);
}

export async function deleteOpeningBalance(
  tenantId: number,
  entryId: number,
  actorUserId: number | null,
  reasonRef?: string | null
): Promise<void> {
  let clientId = 0;
  const note =
    reasonRef != null && String(reasonRef).trim() ? String(reasonRef).trim().slice(0, 128) : null;
  const uid =
    actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const entry = await tx.clientOpeningBalanceEntry.findFirst({
      where: { id: entryId, tenant_id: tenantId }
    });
    if (!entry) throw new Error("NOT_FOUND");
    if (entry.deleted_at != null) throw new Error("ALREADY_VOIDED");
    clientId = entry.client_id;

    const amountDec = entry.amount;
    const reverseDelta = entry.balance_type === "surplus" ? amountDec.neg() : amountDec;

    const bal = await tx.clientBalance.findUnique({
      where: { tenant_id_client_id: { tenant_id: tenantId, client_id: entry.client_id } }
    });
    if (bal) {
      await tx.clientBalance.update({
        where: { id: bal.id },
        data: { balance: { increment: reverseDelta } }
      });
      await tx.clientBalanceMovement.create({
        data: {
          client_balance_id: bal.id,
          delta: reverseDelta,
          note: `Начальный баланс #${entry.id} в архив`,
          user_id: uid
        }
      });
    }

    await tx.clientOpeningBalanceEntry.update({
      where: { id: entryId },
      data: {
        deleted_at: now,
        deleted_by_user_id: uid,
        delete_reason_ref: note
      }
    });
  });

  await appendClientAuditLog(tenantId, clientId, actorUserId, "client.opening_balance.void", {
    entry_id: entryId,
    soft: true,
    ...(note ? { reason: note } : {})
  });

  void invalidateDashboard(tenantId);
}

export async function restoreOpeningBalance(
  tenantId: number,
  entryId: number,
  actorUserId: number | null
): Promise<OpeningBalanceListRow> {
  const uid =
    actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;

  const row = await prisma.$transaction(async (tx) => {
    const entry = await tx.clientOpeningBalanceEntry.findFirst({
      where: { id: entryId, tenant_id: tenantId }
    });
    if (!entry) throw new Error("NOT_FOUND");
    if (entry.deleted_at == null) throw new Error("NOT_VOIDED");

    const amountDec = entry.amount;
    const delta = entry.balance_type === "surplus" ? amountDec : amountDec.neg();

    const bal = await tx.clientBalance.upsert({
      where: { tenant_id_client_id: { tenant_id: tenantId, client_id: entry.client_id } },
      create: { tenant_id: tenantId, client_id: entry.client_id, balance: delta },
      update: { balance: { increment: delta } }
    });
    await tx.clientBalanceMovement.create({
      data: {
        client_balance_id: bal.id,
        delta,
        note: `Начальный баланс #${entry.id} восстановлен`,
        user_id: uid
      }
    });

    await tx.clientOpeningBalanceEntry.update({
      where: { id: entryId },
      data: { deleted_at: null, deleted_by_user_id: null, delete_reason_ref: null }
    });

    return tx.clientOpeningBalanceEntry.findFirstOrThrow({
      where: { id: entryId },
      include: listInclude
    });
  });

  await appendClientAuditLog(tenantId, row.client_id, actorUserId, "client.opening_balance.restore", {
    entry_id: entryId
  });

  void invalidateDashboard(tenantId);
  return mapRow(row);
}
