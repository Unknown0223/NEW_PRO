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
  buildSummaryNetMinusUnpaid,
  compareNumForSort,
  moneySortValueFromPaymentAmounts,
  normPayTypeKey,
  paymentAmountsNetMinusUnpaid,
  readSortDir
} from "./client-balances.payments.util";
import { loadPaymentNetTotalsByTypeGlobally } from "./client-balances.payments.aggregate";
import { loadBalancesAsOf, loadLastDeliveryByClient, loadLastPaymentByClient } from "./client-balances.ledger";
import {
  loadDeliveryDebtByClient,
  loadUnpaidDeliveredOrderDebtRows,
  mergeLedgerWithUnpaidDelivered
} from "./client-balances.delivery";
import { mapClientRow, mapDeliveryOrderRow } from "./client-balances.mappers";
import type { ClientBalancesReportContext } from "./client-balances.report.context";
import { loadDebtSplitByClient } from "./client-debt-by-agent";

export async function listClientBalancesReportFiltered(
  ctx: ClientBalancesReportContext
): Promise<ClientBalanceListResponse> {
  const { tenantId, q, perf, page, limit, asOfEnd, odFrom, odTo } = ctx;
  const bfEarly = q.balance_filter?.trim() ?? "";
  const whereBase = buildClientWhere(tenantId, q, { skipBalanceFilter: true });
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
    const [deliveryMap, balAsOfAll] = await Promise.all([
      loadDeliveryDebtByClient(tenantId, baseIds, odFrom, odTo),
      asOfEnd && baseIds.length > 0 ? loadBalancesAsOf(tenantId, baseIds, asOfEnd) : Promise.resolve(null)
    ]);
    perf("clients-balance-filter.derived-loaded", { deliveryMap: deliveryMap.size });

    const ledgerOf = (row: (typeof allMinimal)[number]) =>
      balAsOfAll?.get(row.id) ?? row.client_balances[0]?.balance ?? new Prisma.Decimal(0);

    const eligible = allMinimal.filter((row) => {
      const l = ledgerOf(row);
      const unpaid = deliveryMap.get(row.id)?.debt ?? new Prisma.Decimal(0);
      if (bfEarly === "debt") return l.lt(0) || unpaid.gt(0);
      return l.gt(0) && unpaid.lte(0);
    });

    let sumMerged = new Prisma.Decimal(0);
    for (const row of eligible) {
      const l = ledgerOf(row);
      sumMerged = sumMerged.add(mergeLedgerWithUnpaidDelivered(l, deliveryMap.get(row.id)));
    }
    const totalBalanceStr = sumMerged.toString();

    const eligibleIds = eligible.map((r) => r.id);
    const { labels: sprLabels, entries: pmEntries } = await loadTenantPaymentRefs(tenantId);
    const [netGlobalByType, rawUnpaidEligible] = await Promise.all([
      loadPaymentNetTotalsByTypeGlobally(tenantId, eligibleIds, asOfEnd, pmEntries),
      loadUnpaidOrderBalanceRawByPaymentRef(tenantId, eligibleIds, odFrom, odTo)
    ]);
    const { byClient: unpaidByMethod, globalUnpaidNorm } = processUnpaidPayRefRows(
      rawUnpaidEligible,
      pmEntries,
      sprLabels
    );
    const summaryPaymentByType = buildSummaryNetMinusUnpaid(sprLabels, netGlobalByType, globalUnpaidNorm);

    const sortBy = q.sort_by?.trim() ?? "";
    const sortDir = readSortDir(q);
    let orderedEligible = eligible;
    if (sortBy === "balance") {
      orderedEligible = [...eligible].sort((a, b) => {
        const aBal = Number(
          mergeLedgerWithUnpaidDelivered(ledgerOf(a), deliveryMap.get(a.id)).toString()
        );
        const bBal = Number(
          mergeLedgerWithUnpaidDelivered(ledgerOf(b), deliveryMap.get(b.id)).toString()
        );
        return compareNumForSort(aBal, bBal, sortDir);
      });
    } else if (sortBy.startsWith("pay:")) {
      const payNormAll = await loadPaymentNetNormByClient(tenantId, eligibleIds, asOfEnd, pmEntries);
      orderedEligible = [...eligible].sort((a, b) => {
        const aAmounts = paymentAmountsNetMinusUnpaid(
          sprLabels,
          payNormAll.get(a.id),
          unpaidByMethod.get(a.id)
        );
        const bAmounts = paymentAmountsNetMinusUnpaid(
          sprLabels,
          payNormAll.get(b.id),
          unpaidByMethod.get(b.id)
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
      const blend = deliveryMap.get(c.id);
      const blendPass = blend && blend.debt.gt(0) ? blend : null;
      return mapClientRow(
        c,
        paymentAmountsNetMinusUnpaid(sprLabels, pagePayNorm.get(c.id), unpaidByMethod.get(c.id)),
        lastPays.get(c.id),
        lastOrds.get(c.id),
        pageBalAsOf?.get(c.id) ?? null,
        null,
        blendPass,
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
