import { Prisma } from "@prisma/client";
import type { OpeningBalanceListQuery, OpeningBalanceListRow } from "./opening-balances.types";
import {
  intersectRequestedAgentIds,
  type ScopedReportActor
} from "../access/access-agent-scope";

function parseUtcDayStart(isoDate: string | undefined): Date | undefined {
  if (!isoDate?.trim()) return undefined;
  const d = new Date(`${isoDate.trim()}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseUtcDayEnd(isoDate: string | undefined): Date | undefined {
  if (!isoDate?.trim()) return undefined;
  const d = new Date(`${isoDate.trim()}T23:59:59.999Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export const listInclude = {
  client: {
    select: {
      id: true,
      name: true,
      agent_id: true,
      agent: { select: { id: true, name: true, code: true } }
    }
  },
  cash_desk: { select: { name: true } },
  deleted_by: { select: { id: true, name: true } }
} satisfies Prisma.ClientOpeningBalanceEntryInclude;

export function mapRow(r: Prisma.ClientOpeningBalanceEntryGetPayload<{ include: typeof listInclude }>): OpeningBalanceListRow {
  const bt = String(r.balance_type);
  const label = bt === "debt" ? "Долг" : bt === "surplus" ? "Излишек" : bt;
  const ag = r.client.agent;
  const dbid = r.deleted_by_user_id ?? null;
  return {
    id: r.id,
    created_at: r.created_at.toISOString(),
    client_id: r.client_id,
    client_name: r.client.name,
    agent_id: ag?.id ?? r.client.agent_id ?? null,
    agent_name: ag?.name ?? null,
    trade_direction: r.trade_direction?.trim() || null,
    cash_desk_name: r.cash_desk?.name ?? null,
    balance_type: bt,
    balance_type_label: label,
    payment_type: r.payment_type,
    amount: r.amount.toString(),
    note: r.note,
    paid_at: r.paid_at ? r.paid_at.toISOString() : null,
    deleted_at: r.deleted_at ? r.deleted_at.toISOString() : null,
    deleted_by_user_id: dbid,
    deleted_by_name: r.deleted_by?.name ?? null,
    delete_reason_ref: r.delete_reason_ref?.trim() || null
  };
}

export function buildWhere(
  tenantId: number,
  q: OpeningBalanceListQuery,
  actor?: ScopedReportActor
): Prisma.ClientOpeningBalanceEntryWhereInput {
  const andParts: Prisma.ClientOpeningBalanceEntryWhereInput[] = [{ tenant_id: tenantId }];

  if (q.archive) {
    andParts.push({ deleted_at: { not: null } });
  } else {
    andParts.push({ deleted_at: null });
  }

  if (q.client_ids != null && q.client_ids.length > 0) {
    andParts.push({ client_id: { in: q.client_ids } });
  }

  const df = parseUtcDayStart(q.date_from);
  const dt = parseUtcDayEnd(q.date_to);
  if (df || dt) {
    const field = q.date_field === "paid_at" ? "paid_at" : "created_at";
    andParts.push({
      [field]: {
        ...(df ? { gte: df } : {}),
        ...(dt ? { lte: dt } : {})
      }
    } as Prisma.ClientOpeningBalanceEntryWhereInput);
  }

  if (q.payment_type?.trim()) {
    andParts.push({ payment_type: q.payment_type.trim() });
  }
  if (q.trade_direction?.trim()) {
    andParts.push({ trade_direction: q.trade_direction.trim() });
  }
  const agentScope = actor
    ? intersectRequestedAgentIds(q.agent_id != null && q.agent_id > 0 ? [q.agent_id] : undefined, actor)
    : {
        agentIds: q.agent_id != null && q.agent_id > 0 ? [q.agent_id] : [],
        restricted: false
      };
  if (agentScope.restricted) {
    if (agentScope.agentIds.length === 0) {
      andParts.push({ id: { in: [] } });
    } else {
      andParts.push({ client: { agent_id: { in: agentScope.agentIds } } });
    }
  } else if (agentScope.agentIds.length > 0) {
    andParts.push({
      client: {
        agent_id:
          agentScope.agentIds.length === 1 ? agentScope.agentIds[0] : { in: agentScope.agentIds }
      }
    });
  }
  if (q.cash_desk_ids != null && q.cash_desk_ids.length > 0) {
    andParts.push({ cash_desk_id: { in: q.cash_desk_ids } });
  }
  if (q.balance_type === "debt" || q.balance_type === "surplus") {
    andParts.push({ balance_type: q.balance_type });
  }

  if (q.amount_min != null || q.amount_max != null) {
    const decMin =
      q.amount_min != null && Number.isFinite(q.amount_min) ? new Prisma.Decimal(q.amount_min) : undefined;
    const decMax =
      q.amount_max != null && Number.isFinite(q.amount_max) ? new Prisma.Decimal(q.amount_max) : undefined;
    andParts.push({
      amount: {
        ...(decMin != null ? { gte: decMin } : {}),
        ...(decMax != null ? { lte: decMax } : {})
      }
    });
  }

  const s = q.search?.trim();
  if (s) {
    andParts.push({
      OR: [
        { note: { contains: s, mode: "insensitive" } },
        { client: { name: { contains: s, mode: "insensitive" } } },
        { payment_type: { contains: s, mode: "insensitive" } }
      ]
    });
  }

  return { AND: andParts };
}
