import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";
import {
  paymentTypesFromMethodEntries,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries,
  resolvePaymentMethodRefToLabel,
  type PaymentMethodEntryDto
} from "../tenant-settings/finance-refs";

import {
  agentInclude,
  LARGE_CLIENT_IDS_CHUNK,
  PAYMENT_COUNTS_FOR_RECEIVABLE_NET
} from "./client-balances.constants";
import { buildOrderCreatedLocalDateClause, parseIsoDateEndUtc } from "./client-balances.date";
import { sprNormKeyForBuckets } from "./client-balances.payments.aggregate";
import { normPayTypeKey, sqlIntIdToNumber } from "./client-balances.payments.util";
import type { ClientBalancePaymentTypeSummary } from "./client-balances.types";

/**
 * client_id → (normPayTypeKey → net).
 * `client_payments.payment_type` saqlanishi kod (masalan `cash`) yoki nom bo‘lishi mumkin;
 * spravochnik ustunlari esa `payment_method_entries[].name` — ikkalasini ham katalog nomiga map qilamiz.
 */
export async function loadPaymentNetNormByClient(
  tenantId: number,
  clientIds: number[],
  asOfEnd: Date | null,
  entries: PaymentMethodEntryDto[]
): Promise<Map<number, Map<string, Prisma.Decimal>>> {
  const map = new Map<number, Map<string, Prisma.Decimal>>();
  if (clientIds.length === 0) return map;

  const chunkSize = LARGE_CLIENT_IDS_CHUNK;
  for (let i = 0; i < clientIds.length; i += chunkSize) {
    const chunk = clientIds.slice(i, i + chunkSize);
    const dateClause = asOfEnd
      ? Prisma.sql`AND COALESCE(p.paid_at, p.created_at) <= ${asOfEnd}`
      : Prisma.empty;

    const rows = await prisma.$queryRaw<
      Array<{ client_id: number; payment_type: string; net: Prisma.Decimal }>
    >`
      SELECT p.client_id, p.payment_type,
        SUM(CASE WHEN p.entry_kind = 'payment' THEN p.amount
                 WHEN p.entry_kind = 'client_expense' THEN -p.amount
                 ELSE 0 END)::decimal(15,2) AS net
      FROM client_payments p
      WHERE p.tenant_id = ${tenantId}
        AND p.client_id IN (${Prisma.join(chunk)})
        AND p.deleted_at IS NULL
        ${PAYMENT_COUNTS_FOR_RECEIVABLE_NET}
        ${dateClause}
      GROUP BY p.client_id, p.payment_type
    `;
    for (const r of rows) {
      const cid = sqlIntIdToNumber(r.client_id);
      if (!Number.isFinite(cid)) continue;
      const resolved =
        resolvePaymentMethodRefToLabel(r.payment_type, entries) ?? (r.payment_type ?? "").trim();
      const nk = normPayTypeKey(resolved);
      let inner = map.get(cid);
      if (!inner) {
        inner = new Map();
        map.set(cid, inner);
      }
      const cur = inner.get(nk) ?? new Prisma.Decimal(0);
      inner.set(nk, cur.add(r.net));
    }
  }
  return map;
}

function paymentAmountsForSpravochnik(
  sprLabels: string[],
  netNorm: Map<string, Prisma.Decimal> | undefined
): ClientBalancePaymentTypeSummary[] {
  if (sprLabels.length === 0) return [];
  const m = netNorm ?? new Map<string, Prisma.Decimal>();
  return sprLabels.map((l) => {
    const nk = normPayTypeKey(l);
    const amt = m.get(nk) ?? new Prisma.Decimal(0);
    return { label: l.trim(), amount: amt.toString() };
  });
}

/** Sozlamalar → to‘lov usullari (nomlar + katalog `payment_method_ref` bilan moslash uchun). */
export async function loadTenantPaymentRefs(tenantId: number): Promise<{
  labels: string[];
  entries: PaymentMethodEntryDto[];
}> {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const settings = row?.settings as Record<string, unknown> | null | undefined;
  const ref = settings?.references as Record<string, unknown> | undefined;
  if (!ref || typeof ref !== "object") {
    return { labels: [], entries: [] };
  }
  const currency_entries = resolveCurrencyEntries(ref);
  const methods = resolvePaymentMethodEntries(ref, currency_entries);
  return {
    labels: paymentTypesFromMethodEntries(methods),
    entries: methods
  };
}

async function loadTenantPaymentTypeLabels(tenantId: number): Promise<string[]> {
  const { labels } = await loadTenantPaymentRefs(tenantId);
  return labels;
}

/**
 * Yetkazilgan, yopilmagan zakazlar: `orders.payment_method_ref` bo‘yicha qoldiq (mijoz bo‘yicha).
 * `consignmentOnly` — konsignatsiya filtri (konsignatsiya hisoboti).
 */
export async function loadUnpaidOrderBalanceRawByPaymentRef(
  tenantId: number,
  clientIds: number[],
  orderDateFrom: string | null | undefined,
  orderDateTo: string | null | undefined,
  opts?: { consignmentOnly?: boolean }
): Promise<Array<{ client_id: number; pref_raw: string | null; sum_unpaid: Prisma.Decimal }>> {
  if (clientIds.length === 0) return [];
  const orderDateClause = buildOrderCreatedLocalDateClause(orderDateFrom ?? null, orderDateTo ?? null);
  const consignmentClause =
    opts?.consignmentOnly === true
      ? Prisma.sql`AND (
          o.is_consignment = true
          OR EXISTS (
            SELECT 1 FROM users ag
            WHERE ag.id = o.agent_id AND ag.tenant_id = o.tenant_id AND ag.consignment = true
          )
        )`
      : Prisma.empty;

  const out: Array<{ client_id: number; pref_raw: string | null; sum_unpaid: Prisma.Decimal }> = [];
  const chunkSize = LARGE_CLIENT_IDS_CHUNK;
  for (let i = 0; i < clientIds.length; i += chunkSize) {
    const chunk = clientIds.slice(i, i + chunkSize);
    const rows = await prisma.$queryRaw<
      Array<{
        client_id: number;
        pref_raw: string | null;
        sum_unpaid: Prisma.Decimal;
      }>
    >`
      WITH cand AS (
        SELECT o.id, o.client_id, o.total_sum, o.payment_method_ref
        FROM orders o
        WHERE o.tenant_id = ${tenantId}
          AND o.order_type = 'order'
          AND o.status IN (${Prisma.join([...ORDER_STATUSES_OUTSTANDING_RECEIVABLE])})
          AND o.client_id IN (${Prisma.join(chunk)})
          ${orderDateClause}
          ${consignmentClause}
      ),
      alloc AS (
        SELECT pa.order_id, SUM(pa.amount)::decimal(15,2) AS allocated
        FROM payment_allocations pa
        WHERE pa.tenant_id = ${tenantId}
          AND pa.order_id IN (SELECT id FROM cand)
        GROUP BY pa.order_id
      ),
      joined AS (
        SELECT
          c.client_id,
          NULLIF(TRIM(COALESCE(c.payment_method_ref, '')), '') AS pref_raw,
          GREATEST(c.total_sum - COALESCE(a.allocated, 0), 0)::decimal(15,2) AS unpaid
        FROM cand c
        LEFT JOIN alloc a ON a.order_id = c.id
      )
      SELECT client_id, pref_raw,
        SUM(unpaid)::decimal(15,2) AS sum_unpaid
      FROM joined
      WHERE unpaid > 0
      GROUP BY client_id, pref_raw
    `;
    out.push(...rows);
  }
  return out;
}

/** Agent bo‘yicha yopilmagan yetkazilgan zakazlar (filtrlangan mijozlar orasida). */
export async function loadUnpaidOrderBalanceRawByAgentPaymentRef(
  tenantId: number,
  clientIds: number[],
  orderDateFrom: string | null | undefined,
  orderDateTo: string | null | undefined
): Promise<Array<{ agent_id: number | null; pref_raw: string | null; sum_unpaid: Prisma.Decimal }>> {
  if (clientIds.length === 0) return [];
  const orderDateClause = buildOrderCreatedLocalDateClause(orderDateFrom ?? null, orderDateTo ?? null);
  const out: Array<{ agent_id: number | null; pref_raw: string | null; sum_unpaid: Prisma.Decimal }> = [];
  const chunkSize = LARGE_CLIENT_IDS_CHUNK;
  for (let i = 0; i < clientIds.length; i += chunkSize) {
    const chunk = clientIds.slice(i, i + chunkSize);
    const rows = await prisma.$queryRaw<
      Array<{
        agent_id: number | null;
        pref_raw: string | null;
        sum_unpaid: Prisma.Decimal;
      }>
    >`
      WITH cand AS (
        SELECT o.id, o.agent_id, o.total_sum, o.payment_method_ref
        FROM orders o
        WHERE o.tenant_id = ${tenantId}
          AND o.order_type = 'order'
          AND o.status IN (${Prisma.join([...ORDER_STATUSES_OUTSTANDING_RECEIVABLE])})
          AND o.client_id IN (${Prisma.join(chunk)})
          ${orderDateClause}
      ),
      alloc AS (
        SELECT pa.order_id, SUM(pa.amount)::decimal(15,2) AS allocated
        FROM payment_allocations pa
        WHERE pa.tenant_id = ${tenantId}
          AND pa.order_id IN (SELECT id FROM cand)
        GROUP BY pa.order_id
      ),
      joined AS (
        SELECT
          c.agent_id,
          NULLIF(TRIM(COALESCE(c.payment_method_ref, '')), '') AS pref_raw,
          GREATEST(c.total_sum - COALESCE(a.allocated, 0), 0)::decimal(15,2) AS unpaid
        FROM cand c
        LEFT JOIN alloc a ON a.order_id = c.id
      )
      SELECT agent_id, pref_raw,
        SUM(unpaid)::decimal(15,2) AS sum_unpaid
      FROM joined
      WHERE unpaid > 0
      GROUP BY agent_id, pref_raw
    `;
    out.push(...rows);
  }
  return out;
}

export function processUnpaidPayRefRows(
  rows: Array<{ client_id: number; pref_raw: string | null; sum_unpaid: Prisma.Decimal }>,
  entries: PaymentMethodEntryDto[],
  sprLabels: string[]
): {
  byClient: Map<number, Map<string, Prisma.Decimal>>;
  globalUnpaidNorm: Map<string, Prisma.Decimal>;
} {
  const firstNk = sprLabels.length > 0 ? normPayTypeKey(sprLabels[0]) : "";
  const byClient = new Map<number, Map<string, Prisma.Decimal>>();
  const globalUnpaidNorm = new Map<string, Prisma.Decimal>();

  const bump = (m: Map<string, Prisma.Decimal>, nk: string, v: Prisma.Decimal) => {
    m.set(nk, (m.get(nk) ?? new Prisma.Decimal(0)).add(v));
  };

  for (const r of rows) {
    if (sprLabels.length === 0) continue;
    const cid = sqlIntIdToNumber(r.client_id);
    if (!Number.isFinite(cid)) continue;
    const label = resolvePaymentMethodRefToLabel(r.pref_raw, entries);
    const rawNk = label ? normPayTypeKey(label) : firstNk;
    if (!label && !firstNk) continue;
    const nk = sprNormKeyForBuckets(rawNk, sprLabels);

    let inner = byClient.get(cid);
    if (!inner) {
      inner = new Map();
      byClient.set(cid, inner);
    }
    bump(inner, nk, r.sum_unpaid);
    bump(globalUnpaidNorm, nk, r.sum_unpaid);
  }
  return { byClient, globalUnpaidNorm };
}

export function processUnpaidAgentPayRefRows(
  rows: Array<{ agent_id: number | null; pref_raw: string | null; sum_unpaid: Prisma.Decimal }>,
  entries: PaymentMethodEntryDto[],
  sprLabels: string[]
): Map<number | null, Map<string, Prisma.Decimal>> {
  const firstNk = sprLabels.length > 0 ? normPayTypeKey(sprLabels[0]) : "";
  const byAgent = new Map<number | null, Map<string, Prisma.Decimal>>();
  const bump = (m: Map<string, Prisma.Decimal>, nk: string, v: Prisma.Decimal) => {
    m.set(nk, (m.get(nk) ?? new Prisma.Decimal(0)).add(v));
  };
  for (const r of rows) {
    if (sprLabels.length === 0) continue;
    const label = resolvePaymentMethodRefToLabel(r.pref_raw, entries);
    const rawNk = label ? normPayTypeKey(label) : firstNk;
    if (!label && !firstNk) continue;
    const nk = sprNormKeyForBuckets(rawNk, sprLabels);
    const aid =
      r.agent_id == null ? null : (() => {
        const n = sqlIntIdToNumber(r.agent_id);
        return Number.isFinite(n) ? n : null;
      })();
    let inner = byAgent.get(aid);
    if (!inner) {
      inner = new Map();
      byAgent.set(aid, inner);
    }
    bump(inner, nk, r.sum_unpaid);
  }
  return byAgent;
}

/** Kirim (`client_payments`) − yopilmagan zakazlar bo‘yicha shu usulga «tushadigan» qarz. */
