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

import type { ClientBalancePaymentTypeSummary, ClientLedgerQuery, ClientLedgerRow } from "./client-balance-ledger.types";
import type { UnionRaw } from "./client-balance-ledger.types";

export function resolveLedgerAgentFilter(q: ClientLedgerQuery): { agentIds: number[]; includeNoAgent: boolean } {
  const fromArr = (q.filter_agent_ids ?? []).filter((x) => Number.isFinite(x) && x > 0);
  let agentIds = [...new Set(fromArr)];
  const leg = q.filter_agent_id;
  if (agentIds.length === 0 && leg != null && leg > 0) agentIds = [leg];
  return { agentIds, includeNoAgent: Boolean(q.filter_no_agent) };
}

export function buildLedgerAgentSqlClauses(
  agentIds: number[],
  includeNoAgent: boolean
): { orderAgentClause: Prisma.Sql; payAgentClause: Prisma.Sql } {
  const ids = [...new Set(agentIds.filter((x) => x > 0))];
  const hasIds = ids.length > 0;
  const fn = includeNoAgent;

  if (!hasIds && !fn) {
    return { orderAgentClause: Prisma.empty, payAgentClause: Prisma.empty };
  }

  if (!hasIds && fn) {
    return {
      orderAgentClause: Prisma.sql`AND o.agent_id IS NULL`,
      payAgentClause: Prisma.sql`AND COALESCE(p.ledger_agent_id, ord.agent_id, c.agent_id) IS NULL`
    };
  }

  const idList = Prisma.join(ids.map((id) => Prisma.sql`${id}`));

  if (hasIds && !fn) {
    return {
      orderAgentClause: Prisma.sql`AND o.agent_id IN (${idList})`,
      payAgentClause: Prisma.sql`AND COALESCE(p.ledger_agent_id, ord.agent_id, c.agent_id) IN (${idList})`
    };
  }

  return {
    orderAgentClause: Prisma.sql`AND (o.agent_id IS NULL OR o.agent_id IN (${idList}))`,
    payAgentClause: Prisma.sql`AND (
      COALESCE(p.ledger_agent_id, ord.agent_id, c.agent_id) IS NULL
      OR COALESCE(p.ledger_agent_id, ord.agent_id, c.agent_id) IN (${idList})
    )`
  };
}

export function normPayTypeKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function loadTenantLedgerPaymentContext(tenantId: number): Promise<{
  sprLabels: string[];
  paymentMethodEntries: PaymentMethodEntryDto[];
}> {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const settings = row?.settings as Record<string, unknown> | null | undefined;
  const ref = settings?.references as Record<string, unknown> | undefined;
  if (!ref || typeof ref !== "object") {
    return { sprLabels: [], paymentMethodEntries: [] };
  }
  const currency_entries = resolveCurrencyEntries(ref);
  const paymentMethodEntries = resolvePaymentMethodEntries(ref, currency_entries);
  return {
    sprLabels: paymentTypesFromMethodEntries(paymentMethodEntries),
    paymentMethodEntries
  };
}

export function paymentAmountsForSpravochnik(
  sprLabels: string[],
  netNorm: Map<string, Prisma.Decimal>
): ClientBalancePaymentTypeSummary[] {
  if (sprLabels.length === 0) return [];
  return sprLabels.map((l) => {
    const nk = normPayTypeKey(l);
    const amt = netNorm.get(nk) ?? new Prisma.Decimal(0);
    return { label: l.trim(), amount: amt.toString() };
  });
}

export function buildNetNormFromRows(
  rows: Array<{ payment_type: string; net: Prisma.Decimal }>,
  entries: PaymentMethodEntryDto[]
): Map<string, Prisma.Decimal> {
  const netNorm = new Map<string, Prisma.Decimal>();
  for (const r of rows) {
    const resolved =
      resolvePaymentMethodRefToLabel(r.payment_type, entries) ?? (r.payment_type ?? "").trim();
    const nk = normPayTypeKey(resolved);
    const prev = netNorm.get(nk) ?? new Prisma.Decimal(0);
    netNorm.set(nk, prev.add(r.net));
  }
  return netNorm;
}

export function territoryLabel(c: {
  region: string | null;
  city: string | null;
  district: string | null;
}): string | null {
  const parts = [c.region, c.city, c.district].map((x) => (x ?? "").trim()).filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}


function isBonusDebtNote(note: string | null | undefined): boolean {
  const n = (note ?? "").trim();
  return n === "Долг бонус" || n.startsWith("Долг бонус ·");
}

export function mapUnionToLedgerRow(r: UnionRaw): ClientLedgerRow {
  const rk = r.row_kind === "order" ? "order" : "payment";
  const bonusDebtPayment = rk === "payment" && isBonusDebtNote(r.note);
  let type_label: string;
  if (rk === "order") {
    type_label = `Заказ (${r.order_number ?? r.order_id})`;
  } else if (bonusDebtPayment) {
    type_label = "Долг бонус";
  } else if (String(r.entry_kind ?? "") === "client_expense") {
    type_label = `Расход (${r.payment_id})`;
  } else {
    type_label = `Оплата (${r.payment_id})`;
  }

  const type_code: 1 | 2 = rk === "order" ? 1 : 2;
  let operation_type_code = "1";
  if (rk === "order") {
    operation_type_code = "7";
  } else if (bonusDebtPayment) {
    operation_type_code = "2";
  } else if (String(r.entry_kind ?? "") === "client_expense") {
    operation_type_code = "2";
  }

  const order_kind_label = rk === "order" ? "Заказ" : null;
  const comment_primary =
    rk === "order"
      ? "Удержание долга по заказу"
      : bonusDebtPayment
        ? "Долг бонус (возврат с полки)"
        : rk === "payment" && String(r.entry_kind) === "client_expense"
          ? "Расход клиента"
          : null;
  const comment_transaction = (r.note ?? "").trim() || null;

  const created_by_display =
    rk === "payment"
      ? (r.created_by_login?.trim() || null)
      : (r.created_by_login?.trim() || r.expeditor_name?.trim() || r.agent_name?.trim() || null);

  return {
    row_kind: rk,
    sort_at: r.sort_at.toISOString(),
    order_id: r.order_id,
    payment_id: r.payment_id,
    order_number: r.order_number,
    type_label,
    debt_amount: r.debt_amount != null ? r.debt_amount.toString() : null,
    payment_amount: r.payment_amount != null ? r.payment_amount.toString() : null,
    payment_type: r.payment_type,
    agent_name: r.agent_name,
    expeditor_name: r.expeditor_name,
    is_consignment: r.is_consignment,
    cash_desk_name: r.cash_desk_name,
    note: r.note,
    created_by_login: r.created_by_login,
    entry_kind: r.entry_kind,
    type_code,
    operation_type_code,
    order_kind_label,
    comment_primary,
    comment_transaction,
    created_by_display,
    balance_after: r.balance_after != null ? r.balance_after.toString() : null,
    order_payment_method_label: null
  };
}
