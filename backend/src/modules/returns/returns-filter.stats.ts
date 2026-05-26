import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  buildOrderCreatedAtFilter,
  resolveReturnEligibleWindow,
  subtractReturnPeriod
} from "./returns-filter.service";
import { returnFilterMetaEnriched, type ReturnFilterStats } from "./returns-filter.explain";
import type { ReturnFilterMeta } from "./returns-filter.types";
import { POLKI_SOURCE_ORDER_STATUS } from "./returns-enhanced.client-data.shared";
import {
  loadDeliveryDebtByClient,
  mergeLedgerWithUnpaidDelivered
} from "../client-balances/client-balances.service";
import { computeLedgerRunningBalance } from "./returns-filter.balance-zero";

async function countDeliveredOrders(
  tenantId: number,
  clientId: number,
  createdAt?: Prisma.DateTimeFilter
): Promise<number> {
  return prisma.order.count({
    where: {
      tenant_id: tenantId,
      client_id: clientId,
      status: POLKI_SOURCE_ORDER_STATUS,
      ...(createdAt ? { created_at: createdAt } : {})
    }
  });
}

export async function buildReturnFilterMetaForClient(
  tenantId: number,
  clientId: number,
  now: Date = new Date()
): Promise<{ window: Awaited<ReturnType<typeof resolveReturnEligibleWindow>>; meta: ReturnFilterMeta }> {
  const window = await resolveReturnEligibleWindow(tenantId, clientId, now);

  const [bal, deliveryMap, ledgerNet] = await Promise.all([
    prisma.clientBalance.findUnique({
      where: { tenant_id_client_id: { tenant_id: tenantId, client_id: clientId } },
      select: { balance: true }
    }),
    loadDeliveryDebtByClient(tenantId, [clientId]),
    computeLedgerRunningBalance(tenantId, clientId, now)
  ]);

  const ledgerBalance = bal?.balance ?? new Prisma.Decimal(0);
  const deliveryInfo = deliveryMap.get(clientId);
  const accountBalance = mergeLedgerWithUnpaidDelivered(ledgerBalance, deliveryInfo);

  let deliveredInPeriod: number | null = null;
  if (window.settings.period_enabled) {
    const periodFrom = subtractReturnPeriod(now, window.settings.period_value, window.settings.period_unit);
    deliveredInPeriod = await countDeliveredOrders(tenantId, clientId, {
      gte: periodFrom,
      lte: now
    });
  }

  const afterFilter = window.empty
    ? 0
    : await countDeliveredOrders(tenantId, clientId, buildOrderCreatedAtFilter(window));

  const stats: ReturnFilterStats = {
    client_balance: accountBalance.toString(),
    ledger_balance: ledgerBalance.toString(),
    unpaid_delivered_total: (deliveryInfo?.debt ?? new Prisma.Decimal(0)).toString(),
    ledger_net_balance: ledgerNet.toString(),
    delivered_in_period: deliveredInPeriod,
    delivered_after_filter: afterFilter
  };

  return { window, meta: returnFilterMetaEnriched(window, stats) };
}
