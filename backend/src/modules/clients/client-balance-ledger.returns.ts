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

/**
 * Zakaz-hujjat sifatidagi vozvrat (`return` / `return_by_order` / `partial_return`)
 * holati `returned` bo‘lsa — qarzdan ayiriladi.
 * Posted sales_return yoki shu zakazga bog‘langan refund to‘lov allaqachon
 * ledjerga kirgan bo‘lsa, ikkinchi marta ayirilmaydi.
 */
export function finishedReturnOrderWhereSql(args: {
  tenantId: number;
  clientId: number;
  dateClause: Prisma.Sql;
  agentClause: Prisma.Sql;
}): Prisma.Sql {
  const { tenantId, clientId, dateClause, agentClause } = args;
  return Prisma.sql`
    o.tenant_id = ${tenantId}
    AND o.client_id = ${clientId}
    AND o.order_type IN ('return', 'return_by_order', 'partial_return')
    AND o.status = 'returned'
    AND COALESCE(o.total_sum, 0) > 0
    AND NOT EXISTS (
      SELECT 1 FROM sales_returns sr
      WHERE sr.tenant_id = o.tenant_id
        AND sr.status = 'posted'
        AND COALESCE(sr.refund_amount, 0) > 0
        AND (sr.mirror_order_id = o.id OR sr.order_id = o.id)
    )
    AND NOT EXISTS (
      SELECT 1 FROM client_payments p
      WHERE p.tenant_id = o.tenant_id
        AND p.client_id = o.client_id
        AND p.deleted_at IS NULL
        AND p.entry_kind = 'refund'
        AND p.order_id = o.id
    )
    ${dateClause}
    ${agentClause}
  `;
}

export function finishedReturnOrderCreditUnionSql(args: {
  tenantId: number;
  clientId: number;
  dateClause: Prisma.Sql;
  agentClause: Prisma.Sql;
}): Prisma.Sql {
  return Prisma.sql`
    SELECT
      o.agent_id AS ledger_agent_id,
      'payment'::text AS row_kind,
      'refund'::text AS entry_kind,
      NULL::decimal(15,2) AS debt_amount,
      (o.total_sum)::decimal(15,2) AS payment_amount
    FROM orders o
    WHERE ${finishedReturnOrderWhereSql(args)}
  `;
}

export function finishedReturnOrderLedgerUnionSql(args: {
  tenantId: number;
  clientId: number;
  dateClause: Prisma.Sql;
  agentClause: Prisma.Sql;
}): Prisma.Sql {
  return Prisma.sql`
    SELECT
      'payment'::text AS row_kind,
      o.created_at AS sort_at,
      o.id AS order_id,
      NULL::int AS payment_id,
      o.number AS order_number,
      NULL::decimal(15,2) AS debt_amount,
      (o.total_sum)::decimal(15,2) AS payment_amount,
      'balance'::text AS payment_type,
      (o.is_consignment OR COALESCE(ag.consignment, false)) AS is_consignment,
      ag.name AS agent_name,
      ex.name AS expeditor_name,
      NULL::text AS cash_desk_name,
      ('Возврат · ' || COALESCE(o.number, CAST(o.id AS text)))::text AS note,
      NULL::text AS created_by_login,
      'refund'::text AS entry_kind,
      NULLIF(TRIM(o.payment_method_ref), '')::text AS order_payment_method_ref
    FROM orders o
    LEFT JOIN users ag ON ag.id = o.agent_id
    LEFT JOIN users ex ON ex.id = o.expeditor_user_id
    WHERE ${finishedReturnOrderWhereSql(args)}
  `;
}

export function finishedReturnOrderCountSql(args: {
  tenantId: number;
  clientId: number;
  dateClause: Prisma.Sql;
  agentClause: Prisma.Sql;
}): Prisma.Sql {
  return Prisma.sql`
    SELECT 'payment'::text AS row_kind, 'refund'::text AS entry_kind
    FROM orders o
    WHERE ${finishedReturnOrderWhereSql(args)}
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
