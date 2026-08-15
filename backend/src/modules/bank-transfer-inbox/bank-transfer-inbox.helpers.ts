/**
 * Shared helpers for Bank Transfer Inbox.
 */
import { Prisma } from "@prisma/client";
import type { DbTransaction } from "../../lib/db-context";

export const MIN_COMMENT = 3;

/** UI / API: qo‘lda vs bank/1C/excel (tasdiqlash kutadi). */
export type TransferChannel = "manual" | "bank_verified";

export const BANK_VERIFIED_SOURCES = ["excel", "csv", "bank_api", "one_c"] as const;

export function resolveTransferChannel(source: string): TransferChannel {
  return source === "manual" ? "manual" : "bank_verified";
}

/** Payment.note dagi `[bank_transfer_inbox #… channel=… source=…]` belgisidan kanal. */
export function parseTransferChannelFromPaymentNote(
  note: string | null | undefined
): { channel: TransferChannel; source: string } | null {
  const raw = (note ?? "").trim();
  if (!raw || !raw.includes("bank_transfer_inbox")) return null;
  const channelMatch = raw.match(/\bchannel=(manual|bank_verified)\b/i);
  const sourceMatch = raw.match(/\bsource=([a-z0-9_]+)\b/i);
  if (channelMatch) {
    const channel = channelMatch[1]!.toLowerCase() as TransferChannel;
    const source = sourceMatch?.[1]?.toLowerCase() ?? (channel === "manual" ? "manual" : "bank_api");
    return { channel, source };
  }
  if (sourceMatch) {
    const source = sourceMatch[1]!.toLowerCase();
    return { channel: resolveTransferChannel(source), source };
  }
  return { channel: "bank_verified", source: "bank_api" };
}

export function sourcesForChannel(channel: TransferChannel | undefined | null): string[] | null {
  if (!channel) return null;
  if (channel === "manual") return ["manual"];
  return [...BANK_VERIFIED_SOURCES];
}

export const clientBriefSelect = { select: { id: true, name: true, client_code: true } } as const;

export async function appendInboxEvent(
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

export function mapInboxRow(r: {
  id: number;
  status: string;
  source: string;
  external_id: string | null;
  amount: Prisma.Decimal;
  currency: string;
  paid_at: Date | null;
  payer_name: string | null;
  payer_inn: string | null;
  payer_pinfl: string | null;
  payer_bank_account: string | null;
  payer_bank_mfo: string | null;
  payer_client_code: string | null;
  purpose: string | null;
  match_field: string | null;
  matched_client_id: number | null;
  assigned_client_id: number | null;
  payment_id: number | null;
  cash_desk_id: number | null;
  created_at: Date;
  updated_at: Date;
  assigned_client?: { id: number; name: string; client_code: string | null } | null;
  matched_client?: { id: number; name: string; client_code: string | null } | null;
}) {
  return {
    id: r.id,
    status: r.status,
    source: r.source,
    /** Derived: manual | bank_verified (excel/csv/bank_api/one_c). */
    channel: resolveTransferChannel(r.source),
    external_id: r.external_id,
    amount: Number(r.amount),
    currency: r.currency,
    paid_at: r.paid_at?.toISOString() ?? null,
    payer_name: r.payer_name,
    payer_inn: r.payer_inn,
    payer_pinfl: r.payer_pinfl,
    payer_bank_account: r.payer_bank_account,
    payer_bank_mfo: r.payer_bank_mfo,
    payer_client_code: r.payer_client_code,
    purpose: r.purpose,
    match_field: r.match_field,
    matched_client_id: r.matched_client_id,
    assigned_client_id: r.assigned_client_id,
    payment_id: r.payment_id,
    cash_desk_id: r.cash_desk_id,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
    assigned_client: r.assigned_client
      ? {
          id: r.assigned_client.id,
          name: r.assigned_client.name,
          client_code: r.assigned_client.client_code
        }
      : null,
    matched_client: r.matched_client
      ? {
          id: r.matched_client.id,
          name: r.matched_client.name,
          client_code: r.matched_client.client_code
        }
      : null
  };
}
