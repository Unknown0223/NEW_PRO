import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { type PaymentMethodEntryDto } from "../tenant-settings/finance-refs";
import {
  loadDeliveryDebtByClient,
  mergeLedgerWithUnpaidDelivered
} from "../client-balances/client-balances.service";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";
import { PAYMENT_COUNTS_FOR_RECEIVABLE_NET } from "../client-balances/client-balances.constants";

import type { AgentBalanceCard } from "./client-balance-ledger.types";

export async function buildLedgerAgentCards(
  tenantId: number,
  clientId: number,
  _sprLabels: string[],
  _paymentMethodEntries: PaymentMethodEntryDto[]
): Promise<{ agent_cards: AgentBalanceCard[] }> {
  const receivableStatuses = [...ORDER_STATUSES_OUTSTANDING_RECEIVABLE];

  /** Faqat yetkazilgan savdo zakazlari — to‘lanmagan qoldiq (taqsimlar bilan). */
  const remainingByAgent = await prisma.$queryRaw<
    Array<{ agent_id: number | null; agent_name: string | null; agent_code: string | null; remaining: Prisma.Decimal }>
  >`
    SELECT o.agent_id,
      ag.name AS agent_name,
      ag.code AS agent_code,
      SUM(GREATEST(o.total_sum - COALESCE(al.sum_amt, 0), 0))::decimal(15,2) AS remaining
    FROM orders o
    LEFT JOIN (
      SELECT pa.order_id, SUM(pa.amount)::decimal(15,2) AS sum_amt
      FROM payment_allocations pa
      WHERE pa.tenant_id = ${tenantId}
      GROUP BY pa.order_id
    ) al ON al.order_id = o.id
    LEFT JOIN users ag ON ag.id = o.agent_id
    WHERE o.tenant_id = ${tenantId}
      AND o.client_id = ${clientId}
      AND o.status IN (${Prisma.join([...ORDER_STATUSES_OUTSTANDING_RECEIVABLE])})
      AND o.order_type = 'order'
      AND GREATEST(o.total_sum - COALESCE(al.sum_amt, 0), 0) > 0
    GROUP BY o.agent_id, ag.name, ag.code
    ORDER BY ag.name ASC NULLS LAST
  `;

  /** Все агенты, которые встречаются в ведомости (заказы + платежи), чтобы карточки совпадали с таблицей. */
  const ledgerAgentKeys = await prisma.$queryRaw<
    Array<{ agent_id: number | null; agent_name: string | null; agent_code: string | null }>
  >`
    WITH src AS (
      SELECT o.agent_id AS agent_id, ag.name AS agent_name, ag.code AS agent_code
      FROM orders o
      LEFT JOIN users ag ON ag.id = o.agent_id
      WHERE o.tenant_id = ${tenantId}
        AND o.client_id = ${clientId}
        AND o.status IN (${Prisma.join(receivableStatuses)})
        AND o.order_type = 'order'
      UNION ALL
      SELECT COALESCE(p.ledger_agent_id, ord.agent_id, c.agent_id) AS agent_id,
        COALESCE(lag.name, oag.name, cag.name) AS agent_name,
        COALESCE(lag.code, oag.code, cag.code) AS agent_code
      FROM client_payments p
      JOIN clients c ON c.id = p.client_id AND c.tenant_id = ${tenantId}
      LEFT JOIN orders ord ON ord.id = p.order_id AND ord.tenant_id = ${tenantId}
      LEFT JOIN users lag ON lag.id = p.ledger_agent_id
      LEFT JOIN users oag ON oag.id = ord.agent_id
      LEFT JOIN users cag ON cag.id = c.agent_id
      WHERE p.client_id = ${clientId}
        AND p.tenant_id = ${tenantId}
        AND p.deleted_at IS NULL
        ${PAYMENT_COUNTS_FOR_RECEIVABLE_NET}
    )
    SELECT agent_id,
      MAX(NULLIF(TRIM(agent_name), '')) AS agent_name,
      MAX(agent_code) AS agent_code
    FROM src
    GROUP BY agent_id
  `;

  const agentKey = (id: number | null) => (id == null ? "null" : String(id));

  const debtByPriceType = await prisma.$queryRaw<
    Array<{ agent_id: number | null; price_type: string; debt: Prisma.Decimal }>
  >`
    SELECT o.agent_id,
      CASE
        WHEN NULLIF(TRIM(o.price_type), '') IS NULL THEN 'Naxt'
        WHEN TRIM(o.price_type) ~* '^d0_' THEN 'Naxt'
        ELSE TRIM(o.price_type)
      END AS price_type,
      SUM(o.total_sum)::decimal(15,2) AS debt
    FROM orders o
    WHERE o.tenant_id = ${tenantId}
      AND o.client_id = ${clientId}
      AND o.status IN (${Prisma.join(receivableStatuses)})
      AND o.order_type = 'order'
      AND o.total_sum <> 0
    GROUP BY o.agent_id, 2
  `;
  const priceTypeByAgent = new Map<string, { label: string; amount: string }[]>();
  for (const row of debtByPriceType) {
    const k = agentKey(row.agent_id);
    const list = priceTypeByAgent.get(k) ?? [];
    list.push({ label: row.price_type, amount: new Prisma.Decimal(row.debt).neg().toString() });
    priceTypeByAgent.set(k, list);
  }

  const cardByAgentKey = new Map<string, AgentBalanceCard>();

  const priceLines = (id: number | null) =>
    priceTypeByAgent.get(agentKey(id)) ?? [{ label: "Naxt", amount: "0" }];

  for (const row of remainingByAgent) {
    cardByAgentKey.set(agentKey(row.agent_id), {
      agent_id: row.agent_id,
      agent_name: row.agent_name?.trim() || "Без агента",
      agent_code: row.agent_code ?? null,
      remaining_on_orders: row.remaining.toString(),
      payment_by_type: priceLines(row.agent_id),
      ledger_general_debt_total: "0",
      ledger_general_payment_total: "0"
    });
  }

  for (const row of ledgerAgentKeys) {
    const k = agentKey(row.agent_id);
    if (cardByAgentKey.has(k)) continue;
    cardByAgentKey.set(k, {
      agent_id: row.agent_id,
      agent_name: row.agent_name?.trim() || "Без агента",
      agent_code: row.agent_code ?? null,
      remaining_on_orders: "0",
      payment_by_type: priceLines(row.agent_id),
      ledger_general_debt_total: "0",
      ledger_general_payment_total: "0"
    });
  }

  const agent_cards: AgentBalanceCard[] = Array.from(cardByAgentKey.values()).sort((a, b) => {
    const an = a.agent_name.trim() || "";
    const bn = b.agent_name.trim() || "";
    if (!an && bn) return 1;
    if (an && !bn) return -1;
    return an.localeCompare(bn, "ru", { sensitivity: "base" });
  });
  return { agent_cards };
}
