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

import type { AgentBalanceCard } from "./client-balance-ledger.types";
import { normPayTypeKey, paymentAmountsForSpravochnik } from "./client-balance-ledger.helpers";

export async function buildLedgerAgentCards(
  tenantId: number,
  clientId: number,
  sprLabels: string[],
  paymentMethodEntries: PaymentMethodEntryDto[]
): Promise<{ agent_cards: AgentBalanceCard[] }> {
  const excluded = ["cancelled", "returned"] as const;

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

  /**
   * Kartochkalar «Способ оплаты» bo‘linmasi jadvaldagi to‘lov qatori bilan bir xil agentga bog‘lanadi:
   * COALESCE(zakaz.agent_id, mijoz.agent_id) — payment_allocations emas (aks holda jadval bilan ziddiyat).
   */
  const payNetByLedgerAgent = await prisma.$queryRaw<
    Array<{ agent_id: number | null; payment_type: string; net: Prisma.Decimal }>
  >`
    SELECT COALESCE(p.ledger_agent_id, ord.agent_id, c.agent_id) AS agent_id,
      p.payment_type,
      SUM(CASE WHEN p.entry_kind = 'payment' THEN p.amount
               WHEN p.entry_kind = 'client_expense' THEN -p.amount
               ELSE 0 END)::decimal(15,2) AS net
    FROM client_payments p
    JOIN clients c ON c.id = p.client_id AND c.tenant_id = ${tenantId}
    LEFT JOIN orders ord ON ord.id = p.order_id AND ord.tenant_id = ${tenantId}
    WHERE p.tenant_id = ${tenantId}
      AND p.client_id = ${clientId}
      AND p.deleted_at IS NULL
    GROUP BY COALESCE(p.ledger_agent_id, ord.agent_id, c.agent_id), p.payment_type
  `;

  const agentPayMap = new Map<number | null, Map<string, Prisma.Decimal>>();
  for (const r of payNetByLedgerAgent) {
    const aid = r.agent_id ?? null;
    let inner = agentPayMap.get(aid);
    if (!inner) {
      inner = new Map();
      agentPayMap.set(aid, inner);
    }
    const resolved =
      resolvePaymentMethodRefToLabel(r.payment_type, paymentMethodEntries) ?? (r.payment_type ?? "").trim();
    const nk = normPayTypeKey(resolved);
    const cur = inner.get(nk) ?? new Prisma.Decimal(0);
    inner.set(nk, cur.add(r.net));
  }

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
        AND o.status NOT IN (${Prisma.join(excluded)})
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
    )
    SELECT agent_id,
      MAX(NULLIF(TRIM(agent_name), '')) AS agent_name,
      MAX(agent_code) AS agent_code
    FROM src
    GROUP BY agent_id
  `;

  const cardByAgentKey = new Map<string, AgentBalanceCard>();

  const agentKey = (id: number | null) => (id == null ? "null" : String(id));

  for (const row of remainingByAgent) {
    const aid = row.agent_id ?? null;
    const netForAgent = agentPayMap.get(aid) ?? new Map();
    cardByAgentKey.set(agentKey(row.agent_id), {
      agent_id: row.agent_id,
      agent_name: row.agent_name?.trim() || "Без агента",
      agent_code: row.agent_code ?? null,
      remaining_on_orders: row.remaining.toString(),
      payment_by_type: paymentAmountsForSpravochnik(sprLabels, netForAgent),
      ledger_general_debt_total: "0",
      ledger_general_payment_total: "0"
    });
  }

  for (const row of ledgerAgentKeys) {
    const k = agentKey(row.agent_id);
    if (cardByAgentKey.has(k)) continue;
    const aid = row.agent_id ?? null;
    const netForAgent = agentPayMap.get(aid) ?? new Map();
    cardByAgentKey.set(k, {
      agent_id: row.agent_id,
      agent_name: row.agent_name?.trim() || "Без агента",
      agent_code: row.agent_code ?? null,
      remaining_on_orders: "0",
      payment_by_type: paymentAmountsForSpravochnik(sprLabels, netForAgent),
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
