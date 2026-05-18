import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { resolvePaymentMethodRefToLabel, type PaymentMethodEntryDto } from "../tenant-settings/finance-refs";
import type { ClientLedgerRow, UnionRaw } from "./client-balance-ledger.types";
import { mapUnionToLedgerRow } from "./client-balance-ledger.helpers";

export type LedgerTableQueryCtx = {
  tenantId: number;
  clientId: number;
  excluded: readonly string[];
  orderDateClause: import("@prisma/client").Prisma.Sql;
  payDateClause: import("@prisma/client").Prisma.Sql;
  orderSearchClause: import("@prisma/client").Prisma.Sql;
  paySearchClause: import("@prisma/client").Prisma.Sql;
  kindWhere: import("@prisma/client").Prisma.Sql;
  orderAgentClause: import("@prisma/client").Prisma.Sql;
  payAgentClause: import("@prisma/client").Prisma.Sql;
  rankedCte: import("@prisma/client").Prisma.Sql;
  fromTable: import("@prisma/client").Prisma.Sql;
  limit: number;
  offset: number;
  paymentMethodEntries: PaymentMethodEntryDto[];
};

export async function fetchClientBalanceLedgerTable(
  ctx: LedgerTableQueryCtx
): Promise<{ rows: ClientLedgerRow[]; total: number }> {
  const {
    tenantId,
    clientId,
    excluded,
    orderDateClause,
    payDateClause,
    orderSearchClause,
    paySearchClause,
    kindWhere,
    orderAgentClause,
    payAgentClause,
    rankedCte,
    fromTable,
    limit,
    offset,
    paymentMethodEntries
  } = ctx;
  const [countRow] = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(*)::bigint AS cnt FROM (
      SELECT 'order'::text AS row_kind, 'order'::text AS entry_kind
      FROM orders o
      WHERE o.tenant_id = ${tenantId}
        AND o.client_id = ${clientId}
        AND o.status NOT IN (${Prisma.join(excluded)})
        AND o.order_type = 'order'
        ${orderDateClause}
        ${orderSearchClause}
        ${orderAgentClause}
      UNION ALL
      SELECT 'payment'::text AS row_kind, p.entry_kind
      FROM client_payments p
      JOIN clients c ON c.id = p.client_id AND c.tenant_id = ${tenantId}
      LEFT JOIN orders ord ON ord.id = p.order_id AND ord.tenant_id = ${tenantId}
      WHERE p.tenant_id = ${tenantId}
        AND p.client_id = ${clientId}
        AND p.deleted_at IS NULL
        ${payDateClause}
        ${paySearchClause}
        ${payAgentClause}
    ) u
    ${kindWhere}
  `;
  const total = Number(countRow?.cnt ?? 0n);

  const unionRows = await prisma.$queryRaw<UnionRaw[]>`
    WITH base AS (
      SELECT * FROM (
        SELECT
          'order'::text AS row_kind,
          o.created_at AS sort_at,
          o.id AS order_id,
          NULL::int AS payment_id,
          o.number AS order_number,
          (-(o.total_sum))::decimal(15,2) AS debt_amount,
          NULL::decimal(15,2) AS payment_amount,
          NULLIF(TRIM(o.payment_method_ref), '')::text AS payment_type,
          (o.is_consignment OR COALESCE(ag.consignment, false)) AS is_consignment,
          ag.name AS agent_name,
          ex.name AS expeditor_name,
          NULL::text AS cash_desk_name,
          o.comment AS note,
          COALESCE(
            (
              SELECT COALESCE(NULLIF(TRIM(cu.name), ''), cu.login)::text
              FROM order_change_logs ocl
              JOIN users cu ON cu.id = ocl.user_id
              WHERE ocl.order_id = o.id AND ocl.user_id IS NOT NULL
              ORDER BY ocl.created_at ASC NULLS LAST, ocl.id ASC
              LIMIT 1
            ),
            (
              SELECT COALESCE(NULLIF(TRIM(su.name), ''), su.login)::text
              FROM order_status_logs osl
              JOIN users su ON su.id = osl.user_id
              WHERE osl.order_id = o.id AND osl.user_id IS NOT NULL
              ORDER BY osl.created_at ASC NULLS LAST, osl.id ASC
              LIMIT 1
            )
          ) AS created_by_login,
          'order'::text AS entry_kind,
          NULL::text AS order_payment_method_ref
        FROM orders o
        LEFT JOIN users ag ON ag.id = o.agent_id
        LEFT JOIN users ex ON ex.id = o.expeditor_user_id
        WHERE o.tenant_id = ${tenantId}
          AND o.client_id = ${clientId}
          AND o.status NOT IN (${Prisma.join(excluded)})
          AND o.order_type = 'order'
          ${orderDateClause}
          ${orderSearchClause}
          ${orderAgentClause}

        UNION ALL

        SELECT
          'payment'::text AS row_kind,
          COALESCE(p.paid_at, p.created_at) AS sort_at,
          p.order_id AS order_id,
          p.id AS payment_id,
          NULL::text AS order_number,
          CASE WHEN p.entry_kind = 'client_expense' THEN p.amount ELSE NULL END AS debt_amount,
          CASE WHEN p.entry_kind = 'payment' THEN p.amount ELSE NULL END AS payment_amount,
          p.payment_type,
          CASE
            WHEN ord.id IS NOT NULL THEN (ord.is_consignment OR COALESCE(oag.consignment, false))
            ELSE NULL
          END AS is_consignment,
          COALESCE(lag.name, oag.name, cag.name) AS agent_name,
          pex.name AS expeditor_name,
          cd.name AS cash_desk_name,
          p.note,
          COALESCE(NULLIF(TRIM(u.name), ''), u.login)::text AS created_by_login,
          p.entry_kind,
          NULLIF(TRIM(ord.payment_method_ref), '')::text AS order_payment_method_ref
        FROM client_payments p
        JOIN clients c ON c.id = p.client_id AND c.tenant_id = ${tenantId}
        LEFT JOIN orders ord ON ord.id = p.order_id AND ord.tenant_id = ${tenantId}
        LEFT JOIN users lag ON lag.id = p.ledger_agent_id
        LEFT JOIN users oag ON oag.id = ord.agent_id
        LEFT JOIN users cag ON cag.id = c.agent_id
        LEFT JOIN users pex ON pex.id = p.expeditor_user_id
        LEFT JOIN cash_desks cd ON cd.id = p.cash_desk_id
        LEFT JOIN users u ON u.id = p.created_by_user_id
        WHERE p.tenant_id = ${tenantId}
          AND p.client_id = ${clientId}
          AND p.deleted_at IS NULL
          ${payDateClause}
          ${paySearchClause}
          ${payAgentClause}
      ) u
      ${kindWhere}
    )
    ${rankedCte}
    SELECT * FROM ${fromTable}
    ORDER BY sort_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const rows = unionRows.map((raw) => {
    const row = mapUnionToLedgerRow(raw);
    const pt = row.payment_type?.trim() ?? "";
    const resolvedPt = pt ? resolvePaymentMethodRefToLabel(pt, paymentMethodEntries) : null;

    let order_payment_method_label: string | null = null;
    if (row.row_kind === "payment") {
      const orf = raw.order_payment_method_ref?.trim() ?? "";
      if (orf) {
        order_payment_method_label = resolvePaymentMethodRefToLabel(orf, paymentMethodEntries);
      }
    }

    return {
      ...row,
      payment_type: resolvedPt,
      order_payment_method_label
    };
  });
  return { rows, total };
}
