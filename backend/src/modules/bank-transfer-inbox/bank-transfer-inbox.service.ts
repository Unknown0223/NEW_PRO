/**
 * Domain: Bank Transfer Inbox — list / detail / counts.
 * Действия: `bank-transfer-inbox.actions.ts`. Баланс — только через confirmPendingPayment.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { invalidateDashboard } from "../../lib/redis-cache";
import { clientBriefSelect, mapInboxRow, sourcesForChannel } from "./bank-transfer-inbox.helpers";
import type { TransferChannel } from "./bank-transfer-inbox.helpers";

export type InboxListQuery = {
  page: number;
  limit: number;
  /** UI tab: new=matched, ambiguous, unmatched, pending, done */
  tab?: "new" | "ambiguous" | "unmatched" | "pending" | "done" | "all";
  search?: string;
  /** manual | bank_verified — filter by entry channel */
  channel?: TransferChannel;
};

function tabToStatuses(tab: InboxListQuery["tab"]): string[] | null {
  if (!tab || tab === "all") return null;
  if (tab === "new") return ["matched"];
  if (tab === "done") return ["done", "ignored"];
  return [tab];
}

export async function listBankTransferInbox(tenantId: number, q: InboxListQuery) {
  const page = Math.max(1, q.page);
  const limit = Math.min(100, Math.max(1, q.limit));
  const statuses = tabToStatuses(q.tab);
  const channelSources = sourcesForChannel(q.channel);
  const where: Prisma.BankTransferInboxWhereInput = {
    tenant_id: tenantId,
    ...(statuses ? { status: { in: statuses } } : {}),
    ...(channelSources ? { source: { in: channelSources } } : {})
  };
  if (q.search?.trim()) {
    const s = q.search.trim();
    where.OR = [
      { payer_name: { contains: s, mode: "insensitive" } },
      { payer_inn: { contains: s } },
      { payer_bank_account: { contains: s } },
      { payer_client_code: { contains: s } },
      { external_id: { contains: s } },
      { purpose: { contains: s, mode: "insensitive" } }
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.bankTransferInbox.count({ where }),
    prisma.bankTransferInbox.findMany({
      where,
      orderBy: [{ paid_at: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        assigned_client: clientBriefSelect,
        matched_client: clientBriefSelect
      }
    })
  ]);

  return {
    data: rows.map(mapInboxRow),
    meta: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) }
  };
}

export async function getBankTransferInboxDetail(tenantId: number, inboxId: number) {
  const row = await prisma.bankTransferInbox.findFirst({
    where: { id: inboxId, tenant_id: tenantId },
    include: {
      assigned_client: clientBriefSelect,
      matched_client: clientBriefSelect,
      events: {
        orderBy: { created_at: "asc" },
        take: 200
      }
    }
  });
  if (!row) return null;

  const candidateIds = Array.isArray(row.match_candidates)
    ? (row.match_candidates as { client_id?: number }[])
        .map((c) => Number(c.client_id))
        .filter((id) => Number.isFinite(id) && id > 0)
    : [];
  const candidateClients =
    candidateIds.length > 0
      ? await prisma.client.findMany({
          where: { tenant_id: tenantId, id: { in: [...new Set(candidateIds)] } },
          select: {
            id: true,
            name: true,
            client_code: true,
            inn: true,
            bank_account: true,
            warehouse_id: true
          }
        })
      : [];

  return {
    ...mapInboxRow(row),
    raw_payload: row.raw_payload,
    match_candidates: row.match_candidates,
    candidate_clients: candidateClients,
    events: row.events.map((e) => ({
      id: e.id,
      event_type: e.event_type,
      comment: e.comment,
      from_client_id: e.from_client_id,
      to_client_id: e.to_client_id,
      actor_user_id: e.actor_user_id,
      payload: e.payload,
      created_at: e.created_at.toISOString()
    }))
  };
}

/** После confirm payment — пометить inbox done. */
export async function markInboxDoneIfPaymentConfirmed(tenantId: number, paymentId: number) {
  const inbox = await prisma.bankTransferInbox.findFirst({
    where: { tenant_id: tenantId, payment_id: paymentId }
  });
  if (!inbox) return;
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, tenant_id: tenantId },
    select: { workflow_status: true }
  });
  if (payment?.workflow_status !== "confirmed") return;
  if (inbox.status === "done") return;
  await prisma.bankTransferInbox.update({
    where: { id: inbox.id },
    data: { status: "done" }
  });
  void invalidateDashboard(tenantId);
}

export async function getInboxTabCounts(tenantId: number, channel?: TransferChannel) {
  const channelSources = sourcesForChannel(channel);
  const groups = await prisma.bankTransferInbox.groupBy({
    by: ["status"],
    where: {
      tenant_id: tenantId,
      ...(channelSources ? { source: { in: channelSources } } : {})
    },
    _count: { _all: true }
  });
  const map = Object.fromEntries(groups.map((g) => [g.status, g._count._all]));
  return {
    new: map.matched ?? 0,
    ambiguous: map.ambiguous ?? 0,
    unmatched: map.unmatched ?? 0,
    pending: map.pending ?? 0,
    done: (map.done ?? 0) + (map.ignored ?? 0)
  };
}

export {
  assignInboxClient,
  commentInboxItem,
  createPendingPaymentFromInbox,
  ignoreInboxItem,
  reassignInboxClient
} from "./bank-transfer-inbox.actions";
