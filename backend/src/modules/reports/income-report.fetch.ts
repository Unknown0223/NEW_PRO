import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  enrichScopedReportActor,
  resolveAllowedAgentIdsForActor
} from "../access/access-agent-scope";
import type { AccessCtx, IncomeReportQuery, IncomeRow } from "./income-report.types";

async function resolveAllowedAgentIds(tenantId: number, ctx: AccessCtx): Promise<number[] | null> {
  const actor = await enrichScopedReportActor(tenantId, {
    userId: ctx.userId ?? null,
    role: ctx.role || ""
  });
  return resolveAllowedAgentIdsForActor(actor);
}

export async function fetchIncomeRows(tenantId: number, query: IncomeReportQuery, ctx: AccessCtx): Promise<IncomeRow[]> {
  const from = new Date(query.from);
  const to = new Date(query.to);
  const allowedAgentIds = await resolveAllowedAgentIds(tenantId, ctx);
  const requestClause =
    query.request_type === "regular"
      ? Prisma.sql`AND COALESCE(o.is_consignment, false) = false`
      : query.request_type === "consignment"
        ? Prisma.sql`AND COALESCE(o.is_consignment, false) = true`
        : Prisma.empty;
  const expeditorClause = query.expeditor_id ? Prisma.sql`AND p.expeditor_user_id = ${query.expeditor_id}` : Prisma.empty;
  const agentClause = query.agent_id ? Prisma.sql`AND COALESCE(p.ledger_agent_id, o.agent_id, c.agent_id) = ${query.agent_id}` : Prisma.empty;
  const cashDeskClause = query.cash_desk_id ? Prisma.sql`AND p.cash_desk_id = ${query.cash_desk_id}` : Prisma.empty;
  const categoryClause = query.client_category ? Prisma.sql`AND c.category = ${query.client_category}` : Prisma.empty;
  const paymentTypeClause = query.payment_type ? Prisma.sql`AND p.payment_type = ${query.payment_type}` : Prisma.empty;
  const tradeDirectionClause = query.trade_direction ? Prisma.sql`AND ua.trade_direction = ${query.trade_direction}` : Prisma.empty;
  const territory1Clause = query.territory_1 ? Prisma.sql`AND c.region = ${query.territory_1}` : Prisma.empty;
  const territory2Clause = query.territory_2 ? Prisma.sql`AND c.district = ${query.territory_2}` : Prisma.empty;
  const territory3Clause = query.territory_3 ? Prisma.sql`AND c.city = ${query.territory_3}` : Prisma.empty;
  const scopeClause =
    allowedAgentIds == null
      ? Prisma.empty
      : allowedAgentIds.length === 0
        ? Prisma.sql`AND 1 = 0`
        : Prisma.sql`AND COALESCE(p.ledger_agent_id, o.agent_id, c.agent_id) IN (${Prisma.join(allowedAgentIds)})`;

  const rows = await prisma.$queryRaw<IncomeRow[]>`
    SELECT
      p.payment_type,
      p.amount::numeric(15,2) AS amount,
      c.region AS territory_1,
      c.district AS territory_2,
      c.city AS territory_3,
      c.id AS client_id,
      c.name AS client_name,
      COALESCE(p.ledger_agent_id, o.agent_id, c.agent_id) AS agent_id,
      ua.name AS agent_name
    FROM client_payments p
    JOIN clients c ON c.id = p.client_id
    LEFT JOIN orders o ON o.id = p.order_id
    LEFT JOIN users ua ON ua.id = COALESCE(p.ledger_agent_id, o.agent_id, c.agent_id)
    WHERE p.tenant_id = ${tenantId}
      AND p.deleted_at IS NULL
      AND p.entry_kind = 'payment'
      AND p.workflow_status = 'confirmed'
      AND COALESCE(p.paid_at, p.received_at, p.confirmed_at, p.created_at) >= ${from}
      AND COALESCE(p.paid_at, p.received_at, p.confirmed_at, p.created_at) <= ${to}
      ${requestClause}
      ${expeditorClause}
      ${agentClause}
      ${cashDeskClause}
      ${categoryClause}
      ${paymentTypeClause}
      ${tradeDirectionClause}
      ${territory1Clause}
      ${territory2Clause}
      ${territory3Clause}
      ${scopeClause}
  `;
  return rows;
}

export function asNum(v: Prisma.Decimal): number {
  return Number(v ?? 0);
}
