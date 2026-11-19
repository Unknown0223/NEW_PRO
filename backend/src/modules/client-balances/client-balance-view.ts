/**
 * ClientBalanceView — mijoz balansi o‘qish (ADR-006).
 * Yozuv (`applyDelta`) bilan aralashtirilmasin.
 * FE `ClientBalanceViewMode` (hisobot tab) — boshqa tushuncha.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  loadBalancesAsOf,
  loadLedgerCardNetByClient
} from "./client-balances.ledger";
import {
  loadDeliveryDebtByClient,
  mergeLedgerWithUnpaidDelivered
} from "./client-balances.delivery";

/** O‘qish kindi (UI report tab emas). */
export type ClientBalanceViewMode = "card_net" | "ledger_merged";

/** @deprecated ADR-006: `ClientBalanceViewMode` ishlating. */
export type ClientBalanceViewKind = ClientBalanceViewMode;

export type LoadClientBalanceViewOpts = {
  /**
   * Shu vaqtgacha hisob. Berilmasa — cheksiz / joriy holat
   * (`card_net`: barcha tarix; `ledger_merged`: joriy `client_balances` qatori).
   */
  asOfEnd?: Date | null;
};

async function loadCurrentLedgerBalances(
  tenantId: number,
  clientIds: number[]
): Promise<Map<number, Prisma.Decimal>> {
  const out = new Map<number, Prisma.Decimal>();
  for (const id of clientIds) out.set(id, new Prisma.Decimal(0));
  if (clientIds.length === 0) return out;

  const rows = await prisma.clientBalance.findMany({
    where: { tenant_id: tenantId, client_id: { in: clientIds } },
    select: { client_id: true, balance: true }
  });
  for (const r of rows) {
    out.set(r.client_id, r.balance);
  }
  return out;
}

async function loadLedgerMergedByClient(
  tenantId: number,
  clientIds: number[],
  asOfEnd: Date | null
): Promise<Map<number, Prisma.Decimal>> {
  if (clientIds.length === 0) return new Map();

  const ledgerByClient =
    asOfEnd != null
      ? await loadBalancesAsOf(tenantId, clientIds, asOfEnd)
      : await loadCurrentLedgerBalances(tenantId, clientIds);

  const deliveryMap = await loadDeliveryDebtByClient(tenantId, clientIds);

  const out = new Map<number, Prisma.Decimal>();
  for (const id of clientIds) {
    const ledger = ledgerByClient.get(id) ?? new Prisma.Decimal(0);
    out.set(id, mergeLedgerWithUnpaidDelivered(ledger, deliveryMap.get(id)));
  }
  return out;
}

/**
 * Mijozlar uchun tanlangan mode bo‘yicha balans Map.
 * - `card_net` → `loadLedgerCardNetByClient` (asOfEnd null = cheksiz)
 * - `ledger_merged` → ledger + unpaid delivered merge
 */
export async function loadClientBalanceView(
  tenantId: number,
  clientIds: number[],
  mode: ClientBalanceViewMode,
  opts?: LoadClientBalanceViewOpts
): Promise<Map<number, Prisma.Decimal>> {
  const asOfEnd = opts?.asOfEnd ?? null;

  if (mode === "card_net") {
    return loadLedgerCardNetByClient(tenantId, clientIds, asOfEnd);
  }
  if (mode === "ledger_merged") {
    return loadLedgerMergedByClient(tenantId, clientIds, asOfEnd);
  }

  throw new Error(`ClientBalanceView: unsupported mode ${String(mode)}`);
}
