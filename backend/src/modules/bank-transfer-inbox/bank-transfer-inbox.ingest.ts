/**
 * Domain: Bank Transfer Inbox — ingest + matcher.
 * Balance не меняется; Payment создаётся отдельно после assign/match.
 */
import { Prisma } from "@prisma/client";
import type { BankTransferIngestBody, BankTransferIngestItem } from "../../contracts/bank-transfer-inbox.schemas";
import { withTransaction, type DbTransaction } from "../../lib/db-context";
import { prisma } from "../../config/database";
import {
  matchBankTransferPayer,
  normalizeAccount,
  normalizeClientCode,
  normalizeDigits,
  type MatchCandidate,
  type MatcherClientRow
} from "./bank-transfer-inbox.matcher";

export type IngestResultItem = {
  external_id: string | null;
  status: "created" | "skipped_duplicate" | "error";
  inbox_id?: number;
  match_status?: string;
  error?: string;
};

async function loadMatcherClients(tenantId: number): Promise<MatcherClientRow[]> {
  const rows = await prisma.client.findMany({
    where: { tenant_id: tenantId, merged_into_client_id: null },
    select: {
      id: true,
      warehouse_id: true,
      bank_account: true,
      inn: true,
      client_pinfl: true,
      client_code: true,
      is_active: true
    }
  });
  return rows;
}

function parsePaidAt(raw: string | null | undefined): Date | null {
  if (raw == null || !String(raw).trim()) return null;
  const d = new Date(String(raw).trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

async function appendEvent(
  tx: DbTransaction,
  args: {
    tenantId: number;
    inboxId: number;
    eventType: string;
    actorUserId: number | null;
    comment?: string | null;
    fromClientId?: number | null;
    toClientId?: number | null;
    payload?: Record<string, unknown>;
  }
) {
  await tx.bankTransferInboxEvent.create({
    data: {
      tenant_id: args.tenantId,
      inbox_id: args.inboxId,
      event_type: args.eventType,
      comment: args.comment ?? null,
      from_client_id: args.fromClientId ?? null,
      to_client_id: args.toClientId ?? null,
      actor_user_id: args.actorUserId,
      payload: (args.payload ?? {}) as Prisma.InputJsonValue
    }
  });
}

function applyMatchFields(item: BankTransferIngestItem, clients: MatcherClientRow[]) {
  const result = matchBankTransferPayer(
    {
      payer_bank_account: item.payer_bank_account,
      payer_inn: item.payer_inn,
      payer_pinfl: item.payer_pinfl,
      payer_client_code: item.payer_client_code,
      payer_name: item.payer_name
    },
    clients
  );
  return result;
}

export async function ingestBankTransfers(
  tenantId: number,
  body: BankTransferIngestBody,
  actorUserId: number | null
): Promise<{ results: IngestResultItem[]; created: number; skipped: number }> {
  const clients = await loadMatcherClients(tenantId);
  const uid =
    actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;
  const results: IngestResultItem[] = [];
  let created = 0;
  let skipped = 0;

  for (const item of body.items) {
    const externalId =
      item.external_id != null && String(item.external_id).trim()
        ? String(item.external_id).trim().slice(0, 128)
        : null;

    try {
      if (externalId) {
        const existing = await prisma.bankTransferInbox.findFirst({
          where: { tenant_id: tenantId, source: body.source, external_id: externalId },
          select: { id: true }
        });
        if (existing) {
          skipped += 1;
          results.push({
            external_id: externalId,
            status: "skipped_duplicate",
            inbox_id: existing.id
          });
          continue;
        }
      }

      const match = applyMatchFields(item, clients);
      const candidates = match.candidates as MatchCandidate[];

      const row = await withTransaction(async (tx) => {
        const inbox = await tx.bankTransferInbox.create({
          data: {
            tenant_id: tenantId,
            status: match.status,
            source: body.source,
            external_id: externalId,
            amount: new Prisma.Decimal(item.amount),
            currency: (item.currency?.trim() || "UZS").slice(0, 8),
            paid_at: parsePaidAt(item.paid_at),
            payer_name: item.payer_name?.trim() || null,
            payer_inn: normalizeDigits(item.payer_inn),
            payer_pinfl: normalizeDigits(item.payer_pinfl),
            payer_bank_account: normalizeAccount(item.payer_bank_account),
            payer_bank_mfo: item.payer_bank_mfo?.trim() || null,
            payer_client_code: normalizeClientCode(item.payer_client_code),
            purpose: item.purpose?.trim() || null,
            raw_payload: (item.raw ?? item) as Prisma.InputJsonValue,
            match_candidates: candidates as unknown as Prisma.InputJsonValue,
            match_field: match.match_field,
            matched_client_id: match.matched_client_id,
            assigned_client_id: match.matched_client_id,
            cash_desk_id:
              item.cash_desk_id != null && item.cash_desk_id > 0 ? item.cash_desk_id : null,
            created_by_user_id: uid
          }
        });

        await appendEvent(tx, {
          tenantId,
          inboxId: inbox.id,
          eventType: "ingested",
          actorUserId: uid,
          payload: { source: body.source, external_id: externalId }
        });
        await appendEvent(tx, {
          tenantId,
          inboxId: inbox.id,
          eventType: match.status,
          actorUserId: uid,
          toClientId: match.matched_client_id,
          payload: {
            match_field: match.match_field,
            candidates
          }
        });

        return inbox;
      });

      created += 1;
      results.push({
        external_id: externalId,
        status: "created",
        inbox_id: row.id,
        match_status: match.status
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ERR";
      if (msg.includes("Unique constraint") || msg.includes("bank_transfer_inbox_tenant_id_source")) {
        skipped += 1;
        results.push({ external_id: externalId, status: "skipped_duplicate" });
        continue;
      }
      results.push({ external_id: externalId, status: "error", error: msg });
    }
  }

  return { results, created, skipped };
}
