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

import { LARGE_CLIENT_IDS_CHUNK, DISCOUNT_SETTLEMENT_PAY_TYPE_KEY } from "./client-balances.constants";
import type { ClientBalancePaymentTypeSummary } from "./client-balances.types";
import { normPayTypeKey, sqlIntIdToNumber } from "./client-balances.payments.util";
import { PAYMENT_COUNTS_FOR_RECEIVABLE_NET } from "./client-balances.constants";
import { parseIsoDateEndUtc } from "./client-balances.date";

export function sprNormKeyForBuckets(nk: string, sprLabels: string[]): string {
  if (sprLabels.length === 0) return nk;
  const firstNk = normPayTypeKey(sprLabels[0]);
  const t = nk.trim() ? normPayTypeKey(nk) : firstNk;
  const ok = sprLabels.some((l) => normPayTypeKey(l) === t);
  return ok ? t : firstNk;
}

function foldPaymentBucketMap(
  sprLabels: string[],
  src: Map<string, Prisma.Decimal> | undefined
): Map<string, Prisma.Decimal> {
  if (sprLabels.length === 0) return src ?? new Map();
  const out = new Map<string, Prisma.Decimal>();
  const m = src ?? new Map();
  for (const [k, v] of m) {
    const dest = sprNormKeyForBuckets(k, sprLabels);
    out.set(dest, (out.get(dest) ?? new Prisma.Decimal(0)).add(v));
  }
  return out;
}

/**
 * Filtrlangan mijozlar bo‘yicha `payment_type` bo‘yicha yig‘indi.
 * Kalitlar — katalogdagi ko‘rinadigan nom (`payment_method_entries[].name`), kod/id bilan moslashadi.
 */
export async function loadPaymentNetTotalsByTypeGlobally(
  tenantId: number,
  clientIds: number[],
  asOfEnd: Date | null,
  entries: PaymentMethodEntryDto[]
): Promise<Map<string, Prisma.Decimal>> {
  const merged = new Map<string, Prisma.Decimal>();
  if (clientIds.length === 0) return merged;
  const chunkSize = LARGE_CLIENT_IDS_CHUNK;
  for (let i = 0; i < clientIds.length; i += chunkSize) {
    const chunk = clientIds.slice(i, i + chunkSize);
    const dateClause = asOfEnd
      ? Prisma.sql`AND COALESCE(p.paid_at, p.created_at) <= ${asOfEnd}`
      : Prisma.empty;
    const rows = await prisma.$queryRaw<
      Array<{ payment_type: string; entry_kind: string; net: Prisma.Decimal }>
    >`
      SELECT p.payment_type, p.entry_kind,
        SUM(CASE WHEN p.entry_kind IN ('payment', 'discount_settlement') THEN p.amount
                 WHEN p.entry_kind = 'client_expense' THEN -p.amount
                 ELSE 0 END)::decimal(15,2) AS net
      FROM client_payments p
      WHERE p.tenant_id = ${tenantId}
        AND p.client_id IN (${Prisma.join(chunk)})
        AND p.deleted_at IS NULL
        ${PAYMENT_COUNTS_FOR_RECEIVABLE_NET}
        ${dateClause}
      GROUP BY p.payment_type, p.entry_kind
    `;
    for (const r of rows) {
      const catalogKey =
        String(r.entry_kind ?? "") === "discount_settlement"
          ? DISCOUNT_SETTLEMENT_PAY_TYPE_KEY
          : (resolvePaymentMethodRefToLabel(r.payment_type, entries) ?? (r.payment_type ?? "").trim());
      const cur = merged.get(catalogKey) ?? new Prisma.Decimal(0);
      merged.set(catalogKey, cur.add(r.net));
    }
  }
  return merged;
}

function buildSummaryPaymentByType(
  spravochnikLabels: string[],
  netByExactType: Map<string, Prisma.Decimal>
): ClientBalancePaymentTypeSummary[] {
  const netNorm = new Map<string, Prisma.Decimal>();
  for (const [k, v] of netByExactType) {
    const nk = normPayTypeKey(k);
    const prev = netNorm.get(nk) ?? new Prisma.Decimal(0);
    netNorm.set(nk, prev.add(v));
  }

  /** Только справочник тенанта: без автодобавления типов из оплат (лишние карточки не нужны). */
  if (spravochnikLabels.length === 0) {
    return [];
  }

  const out: ClientBalancePaymentTypeSummary[] = [];
  for (const l of spravochnikLabels) {
    const nk = normPayTypeKey(l);
    const amt = netNorm.get(nk) ?? new Prisma.Decimal(0);
    out.push({ label: l.trim(), amount: amt.toString() });
  }
  return out;
}
