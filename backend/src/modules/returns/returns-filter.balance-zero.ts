import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE } from "../orders/order-status";

const ZERO_EPS = new Prisma.Decimal("0.005");
const EXCLUDED = [...ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE];

function isBalanceZero(v: Prisma.Decimal): boolean {
  return v.abs().lte(ZERO_EPS);
}

type LedgerEventRow = { sort_at: Date; delta: Prisma.Decimal };

/** Test va debug: ledger voqealaridan balans 0 nuqtasini topish. */
export function findLatestZeroFromLedgerEvents(
  events: LedgerEventRow[],
  searchFrom: Date | null,
  searchTo: Date
): Date | null {
  if (events.length === 0) return null;
  let running = new Prisma.Decimal(0);
  let latestZero: Date | null = null;
  for (const e of events) {
    running = running.add(e.delta);
    const inWindow =
      e.sort_at.getTime() <= searchTo.getTime() &&
      (searchFrom == null || e.sort_at.getTime() >= searchFrom.getTime());
    if (inWindow && isBalanceZero(running)) {
      latestZero = e.sort_at;
    }
  }
  return latestZero;
}

/**
 * Mijoz balans sahifasidagi «balance_after» bilan bir xil: zakazlar (−) + to‘lovlar (+) + rasxod (+).
 * ClientBalanceMovement alohida — u faqat l/s (to‘lov/rasxod) jurnalidir, zakaz qarzi kirmaydi.
 */
async function loadLedgerBalanceEvents(
  tenantId: number,
  clientId: number,
  searchTo: Date
): Promise<LedgerEventRow[]> {
  return prisma.$queryRaw<LedgerEventRow[]>`
    SELECT sort_at, delta FROM (
      SELECT
        o.created_at AS sort_at,
        (-(o.total_sum))::decimal(15,2) AS delta
      FROM orders o
      WHERE o.tenant_id = ${tenantId}
        AND o.client_id = ${clientId}
        AND o.order_type = 'order'
        AND o.status NOT IN (${Prisma.join(EXCLUDED)})
        AND o.created_at <= ${searchTo}

      UNION ALL

      SELECT
        COALESCE(p.paid_at, p.created_at) AS sort_at,
        (CASE
          WHEN p.entry_kind = 'payment' THEN p.amount
          ELSE p.amount
        END)::decimal(15,2) AS delta
      FROM client_payments p
      WHERE p.tenant_id = ${tenantId}
        AND p.client_id = ${clientId}
        AND p.deleted_at IS NULL
        AND COALESCE(p.paid_at, p.created_at) <= ${searchTo}
    ) u
    ORDER BY sort_at ASC
  `;
}

/**
 * Tanlangan oynadagi eng oxirgi «balance_after === 0» nuqtasi (mijoz balans jadvali bilan bir xil).
 */
export async function findLatestBalanceZeroAt(
  tenantId: number,
  clientId: number,
  searchFrom: Date | null,
  searchTo: Date
): Promise<Date | null> {
  const events = await loadLedgerBalanceEvents(tenantId, clientId, searchTo);
  return findLatestZeroFromLedgerEvents(events, searchFrom, searchTo);
}

/** Debug: joriy ledger yig‘indisi (zakaz + to‘lov). */
export async function computeLedgerRunningBalance(
  tenantId: number,
  clientId: number,
  asOf: Date = new Date()
): Promise<Prisma.Decimal> {
  const events = await loadLedgerBalanceEvents(tenantId, clientId, asOf);
  return events.reduce((acc, e) => acc.add(e.delta), new Prisma.Decimal(0));
}
