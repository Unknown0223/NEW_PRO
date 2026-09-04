import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";

import { appendClientAuditLog } from "../clients/clients.service";
import { invalidateDashboard } from "../../lib/redis-cache";
import { createPayment } from "../payments/payment.create";
import { deletePayment, restorePayment } from "../payments/payment.balance.void";
import type { CreateOpeningBalanceInput, OpeningBalanceListRow } from "./opening-balances.types";
import { listInclude, mapRow } from "./opening-balances.shared";

/** Клиент баланси / қидирув учун стандарт изоҳ (ledger payment.note). */
export function openingBalanceLedgerNote(
  entryId: number,
  balanceType: "debt" | "surplus"
): string {
  const kind = balanceType === "debt" ? "задолженность" : "предоплата";
  return `Добавлено через начальный баланс #${entryId} (${kind})`;
}

function noteMatchesEntry(note: string | null | undefined, entryId: number): boolean {
  if (!note) return false;
  return note.toLowerCase().includes(`начальный баланс #${entryId}`);
}

async function findLinkedPayment(
  tenantId: number,
  clientId: number,
  entryId: number,
  voided: boolean
) {
  const rows = await prisma.payment.findMany({
    where: {
      tenant_id: tenantId,
      client_id: clientId,
      deleted_at: voided ? { not: null } : null
    },
    orderBy: { id: "desc" },
    take: 40,
    select: { id: true, note: true, deleted_at: true }
  });
  return rows.find((p) => noteMatchesEntry(p.note, entryId)) ?? null;
}

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
    where: { id: input.client_id, tenant_id: tenantId, merged_into_client_id: null },
    select: { id: true, agent_id: true }
  });
  if (!client) throw new Error("BAD_CLIENT");
  const ledgerAgentId =
    input.ledger_agent_id != null && input.ledger_agent_id > 0
      ? input.ledger_agent_id
      : client.agent_id;
  if (ledgerAgentId == null || ledgerAgentId < 1) throw new Error("BAD_CLIENT_AGENT");

  let cashDeskId: number | null = null;
  if (input.cash_desk_id != null && input.cash_desk_id > 0) {
    const desk = await prisma.cashDesk.findFirst({
      where: { id: input.cash_desk_id, tenant_id: tenantId, is_active: true }
    });
    if (!desk) throw new Error("BAD_CASH_DESK");
    cashDeskId = desk.id;
  }

  const amountDec = new Prisma.Decimal(input.amount);
  const uid =
    actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;

  let paidAt = new Date();
  if (input.paid_at != null && String(input.paid_at).trim()) {
    const parsed = new Date(String(input.paid_at).trim());
    if (!Number.isNaN(parsed.getTime())) paidAt = parsed;
  }

  const userNote = input.note?.trim() || null;

  const created = await prisma.clientOpeningBalanceEntry.create({
    data: {
      tenant_id: tenantId,
      client_id: input.client_id,
      balance_type: input.balance_type,
      amount: amountDec,
      payment_type: pt,
      cash_desk_id: cashDeskId,
      trade_direction: input.trade_direction?.trim() || null,
      note: userNote,
      paid_at: paidAt,
      created_by_user_id: uid
    }
  });

  const ledgerNote = openingBalanceLedgerNote(created.id, input.balance_type);
  const paymentNote = userNote ? `${ledgerNote}. ${userNote}` : ledgerNote;

  try {
    await createPayment(
      tenantId,
      {
        client_id: input.client_id,
        amount: input.amount,
        payment_type: pt,
        cash_desk_id: cashDeskId,
        paid_at: paidAt.toISOString(),
        note: paymentNote,
        entry_kind: input.balance_type === "surplus" ? "payment" : "client_expense",
        ledger_agent_id: ledgerAgentId,
        ledger_agent_allow_inactive: true
      },
      actorUserId
    );
  } catch (e) {
    await prisma.clientOpeningBalanceEntry.delete({ where: { id: created.id } }).catch(() => undefined);
    throw e;
  }

  const row = await prisma.clientOpeningBalanceEntry.findFirstOrThrow({
    where: { id: created.id },
    include: listInclude
  });

  await appendClientAuditLog(tenantId, input.client_id, actorUserId, "client.opening_balance", {
    entry_id: row.id,
    amount: input.amount,
    balance_type: input.balance_type,
    payment_type: pt,
    ledger_note: ledgerNote
  });

  void invalidateDashboard(tenantId);
  return mapRow(row);
}

export async function deleteOpeningBalance(
  tenantId: number,
  entryId: number,
  actorUserId: number | null,
  reasonRef?: string | null,
  opts?: { skipDashboardInvalidate?: boolean }
): Promise<void> {
  let clientId = 0;
  const note =
    reasonRef != null && String(reasonRef).trim() ? String(reasonRef).trim().slice(0, 128) : null;
  const uid =
    actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;
  const now = new Date();

  const entry = await prisma.clientOpeningBalanceEntry.findFirst({
    where: { id: entryId, tenant_id: tenantId }
  });
  if (!entry) throw new Error("NOT_FOUND");
  if (entry.deleted_at != null) throw new Error("ALREADY_VOIDED");
  clientId = entry.client_id;

  const linked = await findLinkedPayment(tenantId, entry.client_id, entry.id, false);
  if (linked) {
    await deletePayment(tenantId, linked.id, actorUserId, note ?? `Начальный баланс #${entry.id}`);
    await prisma.clientOpeningBalanceEntry.update({
      where: { id: entryId },
      data: {
        deleted_at: now,
        deleted_by_user_id: uid,
        delete_reason_ref: note
      }
    });
  } else {
    // Legacy yozuvlar (to‘lovsiz) — eski reverse delta.
    await prisma.$transaction(async (tx) => {
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
  }

  await appendClientAuditLog(tenantId, clientId, actorUserId, "client.opening_balance.void", {
    entry_id: entryId,
    soft: true,
    payment_id: linked?.id ?? null,
    ...(note ? { reason: note } : {})
  });

  if (!opts?.skipDashboardInvalidate) void invalidateDashboard(tenantId);
}

export async function restoreOpeningBalance(
  tenantId: number,
  entryId: number,
  actorUserId: number | null,
  opts?: { skipDashboardInvalidate?: boolean }
): Promise<OpeningBalanceListRow> {
  const entry = await prisma.clientOpeningBalanceEntry.findFirst({
    where: { id: entryId, tenant_id: tenantId }
  });
  if (!entry) throw new Error("NOT_FOUND");
  if (entry.deleted_at == null) throw new Error("NOT_VOIDED");

  const linked = await findLinkedPayment(tenantId, entry.client_id, entry.id, true);
  if (linked) {
    await restorePayment(tenantId, linked.id, actorUserId, `Начальный баланс #${entry.id}`);
    await prisma.clientOpeningBalanceEntry.update({
      where: { id: entryId },
      data: { deleted_at: null, deleted_by_user_id: null, delete_reason_ref: null }
    });
  } else {
    const uid =
      actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;
    await prisma.$transaction(async (tx) => {
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
    });
  }

  const row = await prisma.clientOpeningBalanceEntry.findFirstOrThrow({
    where: { id: entryId },
    include: listInclude
  });

  await appendClientAuditLog(tenantId, row.client_id, actorUserId, "client.opening_balance.restore", {
    entry_id: entryId,
    payment_id: linked?.id ?? null
  });

  if (!opts?.skipDashboardInvalidate) void invalidateDashboard(tenantId);
  return mapRow(row);
}

const BATCH_VOID_CONCURRENCY = 5;

async function runIdBatch(
  ids: number[],
  fn: (id: number) => Promise<unknown>
): Promise<{ ok: number[]; failed: { id: number; error: string }[] }> {
  const validIds = [...new Set(ids.filter((id) => Number.isFinite(id) && id >= 1))];
  const ok: number[] = [];
  const failed: { id: number; error: string }[] = [];
  for (let i = 0; i < validIds.length; i += BATCH_VOID_CONCURRENCY) {
    const chunk = validIds.slice(i, i + BATCH_VOID_CONCURRENCY);
    const results = await Promise.allSettled(chunk.map((id) => fn(id)));
    for (let j = 0; j < chunk.length; j++) {
      const id = chunk[j]!;
      const result = results[j]!;
      if (result.status === "fulfilled") ok.push(id);
      else {
        failed.push({
          id,
          error: result.reason instanceof Error ? result.reason.message : "ERR"
        });
      }
    }
  }
  return { ok, failed };
}

export async function deleteOpeningBalancesBatch(
  tenantId: number,
  ids: number[],
  actorUserId: number | null,
  reasonRef?: string | null
): Promise<{ ok: number[]; failed: { id: number; error: string }[] }> {
  const result = await runIdBatch(ids, (id) =>
    deleteOpeningBalance(tenantId, id, actorUserId, reasonRef, { skipDashboardInvalidate: true })
  );
  void invalidateDashboard(tenantId);
  return result;
}

export async function restoreOpeningBalancesBatch(
  tenantId: number,
  ids: number[],
  actorUserId: number | null
): Promise<{ ok: number[]; failed: { id: number; error: string }[] }> {
  const result = await runIdBatch(ids, (id) =>
    restoreOpeningBalance(tenantId, id, actorUserId, { skipDashboardInvalidate: true })
  );
  void invalidateDashboard(tenantId);
  return result;
}
