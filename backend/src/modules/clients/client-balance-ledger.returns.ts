import { Prisma } from "@prisma/client";

/**
 * Posted sales_returns that still lack a matching client_payments(refund) row.
 * (Accept endi payment yozadi; eski qabul qilingan vazvratlar uchun.)
 */
export function salesReturnRefundLedgerUnionSql(args: {
  tenantId: number;
  clientId: number;
  dateClause: Prisma.Sql;
  agentClause: Prisma.Sql;
}): Prisma.Sql {
  const { tenantId, clientId, dateClause, agentClause } = args;
  return Prisma.sql`
    SELECT
      'payment'::text AS row_kind,
      COALESCE(sr.accepted_at, sr.created_at) AS sort_at,
      sr.order_id AS order_id,
      NULL::int AS payment_id,
      sr.number AS order_number,
      NULL::decimal(15,2) AS debt_amount,
      (sr.refund_amount)::decimal(15,2) AS payment_amount,
      'balance'::text AS payment_type,
      CASE
        WHEN ord.id IS NOT NULL THEN (ord.is_consignment OR COALESCE(oag.consignment, false))
        ELSE NULL
      END AS is_consignment,
      COALESCE(oag.name, cag.name) AS agent_name,
      NULL::text AS expeditor_name,
      NULL::text AS cash_desk_name,
      ('Возврат · ' || sr.number)::text AS note,
      COALESCE(NULLIF(TRIM(cu.name), ''), cu.login)::text AS created_by_login,
      'refund'::text AS entry_kind,
      NULLIF(TRIM(ord.payment_method_ref), '')::text AS order_payment_method_ref
    FROM sales_returns sr
    JOIN clients c ON c.id = sr.client_id AND c.tenant_id = ${tenantId}
    LEFT JOIN orders ord ON ord.id = sr.order_id AND ord.tenant_id = ${tenantId}
    LEFT JOIN users oag ON oag.id = ord.agent_id
    LEFT JOIN users cag ON cag.id = c.agent_id
    LEFT JOIN users cu ON cu.id = COALESCE(sr.accepted_by_user_id, sr.created_by_user_id)
    WHERE sr.tenant_id = ${tenantId}
      AND sr.client_id = ${clientId}
      AND sr.status = 'posted'
      AND COALESCE(sr.refund_amount, 0) > 0
      AND NOT EXISTS (
        SELECT 1 FROM client_payments p
        WHERE p.tenant_id = sr.tenant_id
          AND p.client_id = sr.client_id
          AND p.deleted_at IS NULL
          AND p.entry_kind = 'refund'
          AND (
            p.note = ('Возврат · ' || sr.number)
            OR p.note = ('Vazvrat: ' || sr.number)
          )
      )
      ${dateClause}
      ${agentClause}
  `;
}

export function salesReturnRefundLedgerCountSql(args: {
  tenantId: number;
  clientId: number;
  dateClause: Prisma.Sql;
  agentClause: Prisma.Sql;
}): Prisma.Sql {
  const { tenantId, clientId, dateClause, agentClause } = args;
  return Prisma.sql`
    SELECT 'payment'::text AS row_kind, 'refund'::text AS entry_kind
    FROM sales_returns sr
    JOIN clients c ON c.id = sr.client_id AND c.tenant_id = ${tenantId}
    LEFT JOIN orders ord ON ord.id = sr.order_id AND ord.tenant_id = ${tenantId}
    WHERE sr.tenant_id = ${tenantId}
      AND sr.client_id = ${clientId}
      AND sr.status = 'posted'
      AND COALESCE(sr.refund_amount, 0) > 0
      AND NOT EXISTS (
        SELECT 1 FROM client_payments p
        WHERE p.tenant_id = sr.tenant_id
          AND p.client_id = sr.client_id
          AND p.deleted_at IS NULL
          AND p.entry_kind = 'refund'
          AND (
            p.note = ('Возврат · ' || sr.number)
            OR p.note = ('Vazvrat: ' || sr.number)
          )
      )
      ${dateClause}
      ${agentClause}
  `;
}

export function buildSalesReturnDateClause(dateFrom: Date | null, dateTo: Date | null): Prisma.Sql {
  if (!dateFrom && !dateTo) return Prisma.empty;
  if (dateFrom && dateTo) {
    return Prisma.sql`AND COALESCE(sr.accepted_at, sr.created_at) >= ${dateFrom} AND COALESCE(sr.accepted_at, sr.created_at) <= ${dateTo}`;
  }
  if (dateFrom) {
    return Prisma.sql`AND COALESCE(sr.accepted_at, sr.created_at) >= ${dateFrom}`;
  }
  return Prisma.sql`AND COALESCE(sr.accepted_at, sr.created_at) <= ${dateTo!}`;
}

export function buildSalesReturnAgentClause(
  agentIds: number[],
  includeNoAgent: boolean
): Prisma.Sql {
  const ids = [...new Set(agentIds.filter((x) => x > 0))];
  const hasIds = ids.length > 0;
  if (!hasIds && !includeNoAgent) return Prisma.empty;
  if (!hasIds && includeNoAgent) {
    return Prisma.sql`AND COALESCE(ord.agent_id, c.agent_id) IS NULL`;
  }
  const idList = Prisma.join(ids.map((id) => Prisma.sql`${id}`));
  if (hasIds && !includeNoAgent) {
    return Prisma.sql`AND COALESCE(ord.agent_id, c.agent_id) IN (${idList})`;
  }
  return Prisma.sql`AND (
    COALESCE(ord.agent_id, c.agent_id) IS NULL
    OR COALESCE(ord.agent_id, c.agent_id) IN (${idList})
  )`;
}
