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
import type {
  AgentBalanceRow,
  ClientBalanceListQuery,
  ClientBalanceListResponse,
  ClientBalanceRow
} from "./client-balances.types";
import { agentInclude } from "./client-balances.constants";
import { buildOrderCreatedLocalDateClause } from "./client-balances.date";
import { buildClientWhere } from "./client-balances.where";
import type { DeliveryDebtInfo } from "./client-balances.delivery";
import { makePerfMarker, parseIsoDateEndUtc } from "./client-balances.date";
import {
  loadPaymentNetNormByClient,
  loadTenantPaymentRefs,
  loadUnpaidOrderBalanceRawByPaymentRef,
  processUnpaidPayRefRows
} from "./client-balances.payments.data";
import {
  buildSummaryOverpaymentsByType,
  compareNumForSort,
  moneySortValueFromPaymentAmounts,
  paymentAmountsNetMinusUnpaid,
  readSortDir
} from "./client-balances.payments.util";
import {
  loadBalancesAsOf,
  loadLastDeliveryByClient,
  loadLastPaymentByClient,
  loadLedgerCardNetByClient
} from "./client-balances.ledger";
import {
  loadDeliveryDebtByClient,
  loadUnpaidDeliveredOrderDebtRows
} from "./client-balances.delivery";
import { mapClientRow, mapDeliveryOrderRow } from "./client-balances.mappers";
import type { ClientBalancesReportContext } from "./client-balances.report.context";
import { loadDebtSplitByClient } from "./client-debt-by-agent";

export async function listClientBalancesReportFiltered(
  ctx: ClientBalancesReportContext
): Promise<ClientBalanceListResponse> {
  const { tenantId, q, perf, page, limit, asOfEnd, odFrom, odTo } = ctx;
  const bfEarly = q.balance_filter?.trim() ?? "";
  const whereBase = await buildClientWhere(tenantId, q, { skipBalanceFilter: true });
    const allMinimal = await prisma.client.findMany({
      where: whereBase,
      select: {
        id: true,
        name: true,
        client_balances: { take: 1, select: { balance: true } }
      },
      orderBy: { name: "asc" }
    });
    const baseIds = allMinimal.map((c) => c.id);
    perf("clients-balance-filter.base-loaded", { baseIds: baseIds.length, filter: bfEarly });
    const [deliveryMap, balAsOfAll, cardNetByClient] = await Promise.all([
      loadDeliveryDebtByClient(tenantId, baseIds, odFrom, odTo),
      asOfEnd && baseIds.length > 0 ? loadBalancesAsOf(tenantId, baseIds, asOfEnd) : Promise.resolve(null),
      loadLedgerCardNetByClient(tenantId, baseIds)
    ]);
    perf("clients-balance-filter.derived-loaded", { deliveryMap: deliveryMap.size });

    const netOf = (id: number) => cardNetByClient.get(id) ?? new Prisma.Decimal(0);

    const eligible = allMinimal.filter((row) => {
      const n = netOf(row.id);
      if (bfEarly === "debt") return n.lt(0);
      return n.gt(0);
    });

    let sumMerged = new Prisma.Decimal(0);
    for (const row of eligible) sumMerged = sumMerged.add(netOf(row.id));
    const totalBalanceStr = sumMerged.toString();

    const eligibleIds = eligible.map((r) => r.id);
    const { labels: sprLabels, entries: pmEntries } = await loadTenantPaymentRefs(tenantId);
    const [payNormEligible, rawUnpaidEligible] = await Promise.all([
      loadPaymentNetNormByClient(tenantId, eligibleIds, asOfEnd, pmEntries),
      loadUnpaidOrderBalanceRawByPaymentRef(tenantId, eligibleIds, odFrom, odTo)
    ]);
    const { byClient: unpaidByMethod } = processUnpaidPayRefRows(
      rawUnpaidEligible,
      pmEntries,
      sprLabels
    );
    const summaryPaymentByType = buildSummaryOverpaymentsByType(
      sprLabels,
      eligible.map((row) => ({
        balance: netOf(row.id),
        payNorm: payNormEligible.get(row.id),
        unpaidNorm: unpaidByMethod.get(row.id)
      }))
    );

    const sortBy = q.sort_by?.trim() ?? "";
    const sortDir = readSortDir(q);
    let orderedEligible = eligible;
    if (sortBy === "balance") {
      orderedEligible = [...eligible].sort((a, b) => {
        const aBal = Number(netOf(a.id).toString());
        const bBal = Number(netOf(b.id).toString());
        return compareNumForSort(aBal, bBal, sortDir);
      });
    } else if (sortBy.startsWith("pay:")) {
      orderedEligible = [...eligible].sort((a, b) => {
        const aBal = netOf(a.id);
        const bBal = netOf(b.id);
        const aAmounts = paymentAmountsNetMinusUnpaid(
          sprLabels,
          payNormEligible.get(a.id),
          unpaidByMethod.get(a.id),
          aBal
        );
        const bAmounts = paymentAmountsNetMinusUnpaid(
          sprLabels,
          payNormEligible.get(b.id),
          unpaidByMethod.get(b.id),
          bBal
        );
        const aVal = moneySortValueFromPaymentAmounts(aAmounts, sortBy, sprLabels);
        const bVal = moneySortValueFromPaymentAmounts(bAmounts, sortBy, sprLabels);
        return compareNumForSort(aVal, bVal, sortDir);
      });
    }

    const total = orderedEligible.length;
    const sliceRows = orderedEligible.slice((page - 1) * limit, page * limit);
    const sliceIds = sliceRows.map((r) => r.id);

    const [clients, pagePayNorm, lastPays, lastOrds, pageBalAsOf, debtSplits] = await Promise.all([
      (async () => {
        if (sliceIds.length === 0) return [];
        return prisma.client.findMany({
          where: { id: { in: sliceIds } },
          select: {
            id: true,
            name: true,
            is_active: true,
            legal_name: true,
            client_code: true,
            inn: true,
            phone: true,
            license_until: true,
            agent: { select: agentInclude.select },
            client_balances: { take: 1, select: { balance: true } }
          }
        });
      })(),
      loadPaymentNetNormByClient(tenantId, sliceIds, asOfEnd, pmEntries),
      loadLastPaymentByClient(tenantId, sliceIds, asOfEnd),
      loadLastDeliveryByClient(tenantId, sliceIds),
      asOfEnd && sliceIds.length > 0 ? loadBalancesAsOf(tenantId, sliceIds, asOfEnd) : Promise.resolve(null),
      sliceIds.length > 0 ? loadDebtSplitByClient(tenantId, sliceIds) : Promise.resolve(new Map())
    ]);
    const orderMap = new Map(clients.map((c) => [c.id, c]));
    const orderedClients = sliceIds.map((id) => orderMap.get(id)!).filter(Boolean);

    const data: ClientBalanceRow[] = orderedClients.map((c) => {
      const displayBal = netOf(c.id);
      return mapClientRow(
        c,
        paymentAmountsNetMinusUnpaid(
          sprLabels,
          pagePayNorm.get(c.id) ?? payNormEligible.get(c.id),
          unpaidByMethod.get(c.id),
          displayBal
        ),
        lastPays.get(c.id),
        lastOrds.get(c.id),
        pageBalAsOf?.get(c.id) ?? null,
        null,
        null,
        debtSplits.get(c.id) ?? null
      );
    });

    return {
      view: "clients",
      data,
      total,
      page,
      limit,
      summary: { balance: totalBalanceStr, payment_by_type: summaryPaymentByType }
    };
}
