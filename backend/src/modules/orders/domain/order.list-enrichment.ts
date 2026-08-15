import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/database";

const PO_ZAKAZU_RE = /По\s+заказу\s+(\S+)/i;

export type OrderListMetaRow = {
  source_order_numbers: string[];
  source_order_ids: number[];
  returned_at: string | null;
  expected_ship_date: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  list_created_at: string | null;
  creation_channel: "web" | "mobile";
  created_by: string | null;
  created_by_role: string | null;
};

function parseExchangeSourceIds(exchangeMeta: unknown): number[] {
  if (exchangeMeta == null || typeof exchangeMeta !== "object" || Array.isArray(exchangeMeta)) {
    return [];
  }
  const raw = (exchangeMeta as Record<string, unknown>).source_order_ids;
  if (!Array.isArray(raw)) return [];
  const ids = raw
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n > 0);
  return [...new Set(ids)];
}

function parseSourceFromComment(comment: string | null): string | null {
  if (!comment?.trim()) return null;
  const m = PO_ZAKAZU_RE.exec(comment);
  return m?.[1]?.trim() || null;
}

function roleToChannel(role: string | null | undefined): "web" | "mobile" {
  const r = (role ?? "").toLowerCase();
  // Agent va ekspeditor (dastavchik) — mobil ilovadan yaratadi.
  if (r.includes("agent") || r.includes("expeditor")) return "mobile";
  return "web";
}

/**
 * Ro‘yxat uchun qo‘shimcha maydonlar: manba zakaz, qaytish/otgruzka sanalari, yaratilish kanali.
 */
export async function loadOrdersListMetaEnrichment(
  tenantId: number,
  rows: Array<{
    id: number;
    order_type: string;
    comment: string | null;
    exchange_meta: unknown;
    agent_id: number | null;
    created_at: Date;
    status: string;
  }>
): Promise<Map<number, OrderListMetaRow>> {
  const out = new Map<number, OrderListMetaRow>();
  if (rows.length === 0) return out;

  const ids = rows.map((r) => r.id);

  const statusRows = await prisma.orderStatusLog.findMany({
    where: { order_id: { in: ids }, superseded_at: null },
    orderBy: [{ order_id: "asc" }, { created_at: "asc" }],
    select: {
      order_id: true,
      to_status: true,
      created_at: true,
      user: { select: { login: true, name: true, role: true } }
    }
  });

  const confirmedAt = new Map<number, Date>();
  const deliveringAt = new Map<number, Date>();
  const deliveredAt = new Map<number, Date>();
  const returnedAt = new Map<number, Date>();
  const firstLogUser = new Map<
    number,
    { login: string | null; name: string | null; role: string | null }
  >();

  for (const log of statusRows) {
    if (!firstLogUser.has(log.order_id) && log.user) {
      firstLogUser.set(log.order_id, {
        login: log.user.login,
        name: log.user.name,
        role: log.user.role
      });
    }
    if (log.to_status === "confirmed" && !confirmedAt.has(log.order_id)) {
      confirmedAt.set(log.order_id, log.created_at);
    }
    if (log.to_status === "delivering" && !deliveringAt.has(log.order_id)) {
      deliveringAt.set(log.order_id, log.created_at);
    }
    if (log.to_status === "delivered" && !deliveredAt.has(log.order_id)) {
      deliveredAt.set(log.order_id, log.created_at);
    }
    if (log.to_status === "returned" && !returnedAt.has(log.order_id)) {
      returnedAt.set(log.order_id, log.created_at);
    }
  }

  const sourceIdSet = new Set<number>();
  const commentNumberByOrderId = new Map<number, string>();

  for (const r of rows) {
    const fromMeta = parseExchangeSourceIds(r.exchange_meta);
    for (const sid of fromMeta) sourceIdSet.add(sid);
    const fromComment = parseSourceFromComment(r.comment);
    if (fromComment) commentNumberByOrderId.set(r.id, fromComment);
  }

  const numberById = new Map<number, string>();
  if (sourceIdSet.size > 0) {
    const sourceOrders = await prisma.order.findMany({
      where: { tenant_id: tenantId, id: { in: [...sourceIdSet] } },
      select: { id: true, number: true }
    });
    for (const o of sourceOrders) {
      numberById.set(o.id, o.number);
    }
  }

  const unresolvedNumbers = new Set<string>(commentNumberByOrderId.values());
  const numberToId = new Map<string, number>();
  if (unresolvedNumbers.size > 0) {
    const byNumber = await prisma.order.findMany({
      where: {
        tenant_id: tenantId,
        number: { in: [...unresolvedNumbers] }
      },
      select: { id: true, number: true }
    });
    for (const o of byNumber) {
      numberToId.set(o.number, o.id);
    }
  }

  const agentIds = [...new Set(rows.map((r) => r.agent_id).filter((id): id is number => id != null && id > 0))];
  const agentRoleById = new Map<number, string>();
  if (agentIds.length > 0) {
    const agents = await prisma.user.findMany({
      where: { tenant_id: tenantId, id: { in: agentIds } },
      select: { id: true, role: true }
    });
    for (const u of agents) {
      agentRoleById.set(u.id, u.role);
    }
  }

  for (const r of rows) {
    const metaIds = parseExchangeSourceIds(r.exchange_meta);
    const metaNumbers = metaIds
      .map((id) => numberById.get(id))
      .filter((n): n is string => Boolean(n));

    const commentNum = commentNumberByOrderId.get(r.id);
    let sourceNumbers: string[] = [];
    let sourceIds: number[] = [];

    if (commentNum) {
      sourceNumbers = [commentNum];
      const rid = numberToId.get(commentNum);
      if (rid != null) sourceIds = [rid];
    } else if (metaNumbers.length > 0) {
      sourceNumbers = metaNumbers;
      sourceIds = metaIds;
    }

    const firstUser = firstLogUser.get(r.id);
    const agentRole = r.agent_id != null ? agentRoleById.get(r.agent_id) : undefined;
    const channel = firstUser?.role
      ? roleToChannel(firstUser.role)
      : roleToChannel(agentRole);

    const isReturnType =
      r.order_type === "return" ||
      r.order_type === "return_by_order" ||
      r.order_type === "partial_return";
    const retAt =
      returnedAt.get(r.id) ??
      (isReturnType || r.status === "returned" ? r.created_at : undefined);

    const creatorLabel =
      firstUser?.login?.trim() ||
      firstUser?.name?.trim() ||
      null;

    out.set(r.id, {
      source_order_numbers: sourceNumbers ?? [],
      source_order_ids: sourceIds,
      returned_at: retAt?.toISOString() ?? null,
      expected_ship_date: confirmedAt.get(r.id)?.toISOString() ?? null,
      shipped_at: deliveringAt.get(r.id)?.toISOString() ?? null,
      delivered_at: deliveredAt.get(r.id)?.toISOString() ?? null,
      list_created_at: r.created_at.toISOString(),
      creation_channel: channel,
      created_by: creatorLabel,
      created_by_role: firstUser?.role ?? agentRole ?? null
    });
  }

  return out;
}
