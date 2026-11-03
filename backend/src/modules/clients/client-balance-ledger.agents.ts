import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  findPriceTypeEntry,
  resolvePaymentMethodRefToLabel,
  resolvePriceTypeKeyToLabel,
  type PaymentMethodEntryDto,
  type PriceTypeEntryDto
} from "../tenant-settings/finance-refs";
import { loadPriceTypeEntriesForResolve } from "../tenant-settings/tenant-settings.profile.read";
import { loadTenantLedgerPaymentContext } from "./client-balance-ledger.helpers";
import {
  loadDeliveryDebtByClient,
  mergeLedgerWithUnpaidDelivered
} from "../client-balances/client-balances.service";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";
import {
  PAYMENT_COUNTS_FOR_RECEIVABLE_NET,
  PAYMENT_NOT_RETURN_MIRROR
} from "../client-balances/client-balances.constants";

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
        ${PAYMENT_NOT_RETURN_MIRROR}
    )
    SELECT agent_id,
      MAX(NULLIF(TRIM(agent_name), '')) AS agent_name,
      MAX(agent_code) AS agent_code
    FROM src
    GROUP BY agent_id
  `;

  const agentKey = (id: number | null) => (id == null ? "null" : String(id));

  const cardByAgentKey = new Map<string, AgentBalanceCard>();

  const priceLines = (_id: number | null) => [] as { label: string; amount: string }[];

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

function priceTypeDebtLabel(
  priceType: string | null,
  methodRef: string | null,
  entries: PriceTypeEntryDto[],
  methods: PaymentMethodEntryDto[]
): string {
  const raw = (priceType ?? "").trim();
  const key = !raw || /^d0_/i.test(raw) ? "Naxt" : raw;
  const low = key.toLowerCase();
  if (low === "naxt" || low === "naqd" || low === "cash" || low === "наличные") return "Наличные";

  const entry = findPriceTypeEntry(key, entries);
  const fromEntry = entry?.name?.trim() ?? "";
  if (fromEntry && !/^\d+$/.test(fromEntry)) return fromEntry;
  const resolved = (resolvePriceTypeKeyToLabel(key, entries) ?? "").trim();
  if (resolved && !/^\d+$/.test(resolved) && resolved.toLowerCase() !== low) return resolved;

  const method = (resolvePaymentMethodRefToLabel(methodRef, methods) ?? "").trim();
  const methodLow = method.toLowerCase();
  if (methodLow === "naxt" || methodLow === "naqd" || methodLow === "cash" || methodLow === "наличные") {
    return "Наличные";
  }
  if (methodLow.includes("terminal") || methodLow.includes("термин")) return "Терминал";
  if (methodLow.includes("perech") || methodLow.includes("переч")) return "Перечисление";
  if (method && !/^\d+$/.test(method)) return method;
  return "Наличные";
}

/**
 * Kartochka qatorlari — barcha zakaz summalari emas.
 * To‘lovlar eski qarzdan yopiladi, qolgan qarz turi nomi bilan chiqadi.
 */
export async function attachRemainingDebtLines(
  tenantId: number,
  clientId: number,
  cards: AgentBalanceCard[]
): Promise<AgentBalanceCard[]> {
  if (cards.length === 0) return cards;

  const [entries, payCtx, orders, expenses] = await Promise.all([
    loadPriceTypeEntriesForResolve(tenantId),
    loadTenantLedgerPaymentContext(tenantId),
    prisma.order.findMany({
      where: {
        tenant_id: tenantId,
        client_id: clientId,
        status: { in: [...ORDER_STATUSES_OUTSTANDING_RECEIVABLE] },
        order_type: "order"
      },
      select: {
        id: true,
        agent_id: true,
        total_sum: true,
        price_type: true,
        payment_method_ref: true,
        created_at: true
      },
      orderBy: [{ created_at: "asc" }, { id: "asc" }]
    }),
    prisma.$queryRaw<Array<{ agent_id: number | null; amount: Prisma.Decimal; at: Date }>>`
      SELECT COALESCE(p.ledger_agent_id, ord.agent_id, c.agent_id) AS agent_id,
        p.amount,
        COALESCE(p.paid_at, p.created_at) AS at
      FROM client_payments p
      JOIN clients c ON c.id = p.client_id AND c.tenant_id = ${tenantId}
      LEFT JOIN orders ord ON ord.id = p.order_id AND ord.tenant_id = ${tenantId}
      WHERE p.tenant_id = ${tenantId}
        AND p.client_id = ${clientId}
        AND p.deleted_at IS NULL
        AND p.entry_kind = 'client_expense'
        ${PAYMENT_COUNTS_FOR_RECEIVABLE_NET}
    `
  ]);

  const methods = payCtx.paymentMethodEntries;
  type Item = { agentKey: string; at: number; seq: number; amount: Prisma.Decimal; label: string };
  const items: Item[] = [];
  for (const o of orders) {
    const amount = new Prisma.Decimal(o.total_sum);
    if (!amount.gt(0)) continue;
    items.push({
      agentKey: o.agent_id == null ? "null" : String(o.agent_id),
      at: o.created_at.getTime(),
      seq: o.id,
      amount,
      label: priceTypeDebtLabel(o.price_type, o.payment_method_ref, entries, methods)
    });
  }
  for (const ex of expenses) {
    const amount = new Prisma.Decimal(ex.amount);
    if (!amount.gt(0)) continue;
    const at = ex.at instanceof Date ? ex.at.getTime() : new Date(ex.at).getTime();
    items.push({
      agentKey: ex.agent_id == null ? "null" : String(ex.agent_id),
      at,
      seq: 0,
      amount,
      label: "Расход"
    });
  }

  return cards.map((card) => {
    const key = card.agent_id == null ? "null" : String(card.agent_id);
    const mine = items
      .filter((it) => it.agentKey === key)
      .sort((a, b) => a.at - b.at || a.seq - b.seq);
    let pool = new Prisma.Decimal(card.ledger_general_payment_total || "0");
    if (pool.lt(0)) pool = new Prisma.Decimal(0);
    const buckets = new Map<string, Prisma.Decimal>();
    for (const it of mine) {
      const use = pool.gte(it.amount) ? it.amount : pool;
      pool = pool.sub(use);
      const rem = it.amount.sub(use);
      if (rem.gt("0.009")) {
        buckets.set(it.label, (buckets.get(it.label) ?? new Prisma.Decimal(0)).add(rem));
      }
    }
    const payment_by_type = [...buckets.entries()].map(([label, amount]) => ({
      label,
      amount: amount.neg().toString()
    }));
    return { ...card, payment_by_type };
  });
}
