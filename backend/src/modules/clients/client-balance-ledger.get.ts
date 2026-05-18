import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  paymentTypesFromMethodEntries,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries,
  resolvePaymentMethodRefToLabel,
  type PaymentMethodEntryDto
} from "../tenant-settings/finance-refs";
import {
  loadDeliveryDebtByClient,
  mergeLedgerWithUnpaidDelivered
} from "../client-balances/client-balances.service";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";

import type { AgentBalanceCard, ClientBalanceLedgerResponse, ClientLedgerQuery, UnionRaw } from "./client-balance-ledger.types";
import {
  buildLedgerAgentSqlClauses,
  buildNetNormFromRows,
  loadTenantLedgerPaymentContext,
  mapUnionToLedgerRow,
  paymentAmountsForSpravochnik,
  resolveLedgerAgentFilter,
  territoryLabel
} from "./client-balance-ledger.helpers";
import { buildLedgerAgentCards } from "./client-balance-ledger.agents";

import { fetchClientBalanceLedgerTable } from "./client-balance-ledger.get-table";

export async function getClientBalanceLedger(
  tenantId: number,
  clientId: number,
  q: ClientLedgerQuery
): Promise<ClientBalanceLedgerResponse> {

  const client = await prisma.client.findFirst({
    where: { id: clientId, tenant_id: tenantId, merged_into_client_id: null },
    select: {
      id: true,
      name: true,
      phone: true,
      client_code: true,
      region: true,
      city: true,
      district: true,
      agent_id: true
    }
  });
  if (!client) {
    throw new Error("NOT_FOUND");
  }

  const { sprLabels, paymentMethodEntries } = await loadTenantLedgerPaymentContext(tenantId);

  const [balRow, deliveryMap] = await Promise.all([
    prisma.clientBalance.findUnique({
      where: { tenant_id_client_id: { tenant_id: tenantId, client_id: clientId } },
      select: { balance: true }
    }),
    loadDeliveryDebtByClient(tenantId, [clientId])
  ]);
  const ledgerDec = balRow?.balance ?? new Prisma.Decimal(0);
  const account_balance = mergeLedgerWithUnpaidDelivered(
    ledgerDec,
    deliveryMap.get(clientId)
  ).toString();
  const { agent_cards } = await buildLedgerAgentCards(tenantId, clientId, sprLabels, paymentMethodEntries);
  const excluded = ["cancelled", "returned"] as const;
  const page = Math.max(1, q.page);
  const maxLimit = q.ledger_detail ? 5000 : 100;
  const limit = Math.min(maxLimit, Math.max(1, q.limit));
  const offset = (page - 1) * limit;
  const includeLedgerDetail = Boolean(q.ledger_detail);
  const rankedCte = includeLedgerDetail
    ? Prisma.sql`,
  ranked AS (
    SELECT b.*,
      SUM(COALESCE(b.debt_amount,0) + COALESCE(b.payment_amount,0)) OVER (
        ORDER BY b.sort_at ASC, b.order_id ASC NULLS LAST, b.payment_id ASC NULLS LAST
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      )::decimal(15,2) AS balance_after
    FROM base b
  )`
    : Prisma.empty;
  const fromTable = includeLedgerDetail ? Prisma.raw("ranked") : Prisma.raw("base");

  const df = q.date_from ?? null;
  const dt = q.date_to_end ?? null;
  const searchRaw = (q.search ?? "").trim();
  const searchSafe = searchRaw.replace(/[%_\\]/g, "").trim();
  const searchPat = searchSafe.length > 0 ? `%${searchSafe}%` : null;

  const orderDateClause =
    df && dt
      ? Prisma.sql`AND o.created_at >= ${df} AND o.created_at <= ${dt}`
      : df
        ? Prisma.sql`AND o.created_at >= ${df}`
        : dt
          ? Prisma.sql`AND o.created_at <= ${dt}`
          : Prisma.empty;

  const payDateClause =
    df && dt
      ? Prisma.sql`AND COALESCE(p.paid_at, p.created_at) >= ${df} AND COALESCE(p.paid_at, p.created_at) <= ${dt}`
      : df
        ? Prisma.sql`AND COALESCE(p.paid_at, p.created_at) >= ${df}`
        : dt
          ? Prisma.sql`AND COALESCE(p.paid_at, p.created_at) <= ${dt}`
          : Prisma.empty;

  const orderSearchClause =
    searchPat != null
      ? Prisma.sql`AND (
          o.number ILIKE ${searchPat}
          OR CAST(o.id AS TEXT) ILIKE ${searchPat}
        )`
      : Prisma.empty;

  const paySearchClause =
    searchPat != null
      ? Prisma.sql`AND (
          CAST(p.id AS TEXT) ILIKE ${searchPat}
          OR COALESCE(p.note, '') ILIKE ${searchPat}
          OR COALESCE(p.payment_type, '') ILIKE ${searchPat}
        )`
      : Prisma.empty;

  const kind = q.ledger_kind ?? "all";
  const kindWhere =
    kind === "debt"
      ? Prisma.sql`WHERE (u.row_kind = 'order' OR (u.row_kind = 'payment' AND u.entry_kind = 'client_expense'))`
      : kind === "payment"
        ? Prisma.sql`WHERE u.row_kind = 'payment' AND u.entry_kind = 'payment'`
        : Prisma.empty;

  const { agentIds: ledgerAgentIds, includeNoAgent: ledgerIncludeNoAgent } = resolveLedgerAgentFilter(q);
  const { orderAgentClause, payAgentClause } = buildLedgerAgentSqlClauses(ledgerAgentIds, ledgerIncludeNoAgent);

  const payKindClauseForTypeBreakdown =
    kind === "payment"
      ? Prisma.sql`AND p.entry_kind = 'payment'`
      : kind === "debt"
        ? Prisma.sql`AND p.entry_kind = 'client_expense'`
        : Prisma.empty;

  const payNetRowsFiltered = await prisma.$queryRaw<Array<{ payment_type: string; net: Prisma.Decimal }>>`
    SELECT p.payment_type,
      SUM(CASE WHEN p.entry_kind = 'payment' THEN p.amount
               WHEN p.entry_kind = 'client_expense' THEN -p.amount
               ELSE 0 END)::decimal(15,2) AS net
    FROM client_payments p
    JOIN clients c ON c.id = p.client_id AND c.tenant_id = ${tenantId}
    LEFT JOIN orders ord ON ord.id = p.order_id AND ord.tenant_id = ${tenantId}
    WHERE p.tenant_id = ${tenantId}
      AND p.client_id = ${clientId}
      AND p.deleted_at IS NULL
      ${payDateClause}
      ${paySearchClause}
      ${payAgentClause}
      ${payKindClauseForTypeBreakdown}
    GROUP BY p.payment_type
  `;
  const summary_payment_by_type = paymentAmountsForSpravochnik(
    sprLabels,
    buildNetNormFromRows(payNetRowsFiltered, paymentMethodEntries)
  );

  const agentTotalsSqlBody = (orderAgent: Prisma.Sql, payAgent: Prisma.Sql) => Prisma.sql`
    SELECT
      u.ledger_agent_id,
      SUM(
        CASE
          WHEN u.debt_amount IS NOT NULL AND u.debt_amount <> 0 THEN ABS(u.debt_amount)
          ELSE 0::decimal(15,2)
        END
      )::decimal(15,2) AS gen_debt,
      SUM(
        CASE
          WHEN u.payment_amount IS NOT NULL AND u.payment_amount > 0 THEN u.payment_amount
          ELSE 0::decimal(15,2)
        END
      )::decimal(15,2) AS gen_pay
    FROM (
      SELECT
        o.agent_id AS ledger_agent_id,
        'order'::text AS row_kind,
        'order'::text AS entry_kind,
        (-(o.total_sum))::decimal(15,2) AS debt_amount,
        NULL::decimal(15,2) AS payment_amount
      FROM orders o
      WHERE o.tenant_id = ${tenantId}
        AND o.client_id = ${clientId}
        AND o.status NOT IN (${Prisma.join(excluded)})
        AND o.order_type = 'order'
        ${orderDateClause}
        ${orderSearchClause}
        ${orderAgent}

      UNION ALL

      SELECT
        COALESCE(p.ledger_agent_id, ord.agent_id, c.agent_id) AS ledger_agent_id,
        'payment'::text AS row_kind,
        p.entry_kind AS entry_kind,
        CASE WHEN p.entry_kind = 'client_expense' THEN p.amount ELSE NULL END AS debt_amount,
        CASE WHEN p.entry_kind = 'payment' THEN p.amount ELSE NULL END AS payment_amount
      FROM client_payments p
      JOIN clients c ON c.id = p.client_id AND c.tenant_id = ${tenantId}
      LEFT JOIN orders ord ON ord.id = p.order_id AND ord.tenant_id = ${tenantId}
      WHERE p.tenant_id = ${tenantId}
        AND p.client_id = ${clientId}
        AND p.deleted_at IS NULL
        ${payDateClause}
        ${paySearchClause}
        ${payAgent}
    ) u
    ${kindWhere}
    GROUP BY u.ledger_agent_id
  `;

  /** Итоги по агентам с фильтром по агенту — как у строк таблицы и net balance. */
  const agentGeneralTotals = await prisma.$queryRaw<
    Array<{ ledger_agent_id: number | null; gen_debt: Prisma.Decimal; gen_pay: Prisma.Decimal }>
  >(agentTotalsSqlBody(orderAgentClause, payAgentClause));

  /** Карточки агентов: суммы без фильтра по агенту (дата/поиск/kind сохраняются), иначе невыбранные агенты показывают 0. */
  const agentGeneralTotalsForCards = await prisma.$queryRaw<
    Array<{ ledger_agent_id: number | null; gen_debt: Prisma.Decimal; gen_pay: Prisma.Decimal }>
  >(agentTotalsSqlBody(Prisma.empty, Prisma.empty));

  let ledgerNetSum = new Prisma.Decimal(0);
  for (const r of agentGeneralTotals) {
    ledgerNetSum = ledgerNetSum.add(r.gen_pay.sub(r.gen_debt));
  }
  const ledger_net_balance = ledgerNetSum.toString();

  const ledgerTotalsByAgentKey = new Map<string, { gen_debt: Prisma.Decimal; gen_pay: Prisma.Decimal }>();
  for (const r of agentGeneralTotalsForCards) {
    const k = r.ledger_agent_id == null ? "null" : String(r.ledger_agent_id);
    ledgerTotalsByAgentKey.set(k, { gen_debt: r.gen_debt, gen_pay: r.gen_pay });
  }

  const agent_cards_with_ledger_totals: AgentBalanceCard[] = agent_cards.map((c) => {
    const k = c.agent_id == null ? "null" : String(c.agent_id);
    const t = ledgerTotalsByAgentKey.get(k);
    return {
      ...c,
      ledger_general_debt_total: t?.gen_debt.toString() ?? "0",
      ledger_general_payment_total: t?.gen_pay.toString() ?? "0"
    };
  });
  const { rows, total } = await fetchClientBalanceLedgerTable({
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
  });

  return {
    client: {
      id: client.id,
      name: client.name,
      phone: client.phone,
      client_code: client.client_code,
      territory_label: territoryLabel(client),
      agent_id: client.agent_id ?? null
    },
    account_balance,
    ledger_net_balance,
    summary_payment_by_type,
    agent_cards: agent_cards_with_ledger_totals,
    rows,
    total,
    page,
    limit
  };
}
