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

export async function listClientBalancesReportDelivery(
  ctx: ClientBalancesReportContext
): Promise<ClientBalanceListResponse> {
  const { tenantId, q, perf, page, limit, asOfEnd, odFrom, odTo, where } = ctx;
    const idRows = await prisma.client.findMany({ where, select: { id: true } });
    const ids = idRows.map((r) => r.id);
    perf("delivery.ids-loaded", { ids: ids.length });
    const filterOid =
      q.delivery_order_id != null && q.delivery_order_id > 0 ? q.delivery_order_id : null;
    let orderRows = await loadUnpaidDeliveredOrderDebtRows(tenantId, ids, odFrom, odTo, filterOid);
    perf("delivery.orders-loaded", { orderRows: orderRows.length, filterOrderId: filterOid });
    const bf = q.balance_filter?.trim();
    if (bf === "credit") {
      orderRows = [];
    }
    const paymentRefs = await loadTenantPaymentRefs(tenantId);
    const sprDelivery = paymentRefs.labels;
    const pmEntriesDelivery = paymentRefs.entries;
    const sortBy = q.sort_by?.trim() ?? "";
    const sortDir = readSortDir(q);
    if (sortBy === "balance") {
      orderRows.sort((a, b) => compareNumForSort(Number(a.unpaid.neg().toString()), Number(b.unpaid.neg().toString()), sortDir));
    } else if (sortBy.startsWith("pay:")) {
      const wanted = normPayTypeKey(sortBy.slice(4));
      const firstNk = sprDelivery.length > 0 ? normPayTypeKey(sprDelivery[0]) : "";
      orderRows.sort((a, b) => {
        const aLabel = resolvePaymentMethodRefToLabel(a.payment_method_ref, pmEntriesDelivery);
        const bLabel = resolvePaymentMethodRefToLabel(b.payment_method_ref, pmEntriesDelivery);
        const aNk = aLabel ? normPayTypeKey(aLabel) : firstNk;
        const bNk = bLabel ? normPayTypeKey(bLabel) : firstNk;
        const aVal = aNk === wanted ? Number(a.unpaid.neg().toString()) : 0;
        const bVal = bNk === wanted ? Number(b.unpaid.neg().toString()) : 0;
        return compareNumForSort(aVal, bVal, sortDir);
      });
    }
    const total = orderRows.length;
    const pageSlice = orderRows.slice((page - 1) * limit, page * limit);
    const sliceClientIds = [...new Set(pageSlice.map((r) => r.client_id))];

    let sumUnpaid = new Prisma.Decimal(0);
    for (const r of orderRows) {
      sumUnpaid = sumUnpaid.add(r.unpaid);
    }
    const totalBalanceStr = sumUnpaid.neg().toString();

    const distinctClientIdsForSummary = [...new Set(orderRows.map((r) => r.client_id))];

    const [[clients, lastPays], netTotalsMap, rawUnpaidSummary] = await Promise.all([
      Promise.all([
        (async () => {
          if (sliceClientIds.length === 0) return [];
          return prisma.client.findMany({
            where: { id: { in: sliceClientIds } },
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
        loadLastPaymentByClient(tenantId, sliceClientIds, asOfEnd)
      ]),
      loadPaymentNetTotalsByTypeGlobally(tenantId, distinctClientIdsForSummary, asOfEnd, pmEntriesDelivery),
      loadUnpaidOrderBalanceRawByPaymentRef(tenantId, distinctClientIdsForSummary, odFrom, odTo)
    ]);
    perf("delivery.summary-built", {
      pageSlice: pageSlice.length,
      distinctClients: distinctClientIdsForSummary.length
    });
    const { globalUnpaidNorm: globalUnpaidDelivery } = processUnpaidPayRefRows(
      rawUnpaidSummary,
      pmEntriesDelivery,
      sprDelivery
    );
    const paymentByTypeDelivery = buildSummaryNetMinusUnpaid(
      sprDelivery,
      netTotalsMap,
      globalUnpaidDelivery
    );
    const clientById = new Map(clients.map((c) => [c.id, c]));

    const data: ClientBalanceRow[] = [];
    for (const od of pageSlice) {
      const c = clientById.get(od.client_id);
      if (!c) continue;
      data.push(
        mapDeliveryOrderRow(c, od, sprDelivery, pmEntriesDelivery, lastPays.get(od.client_id))
      );
    }

    return {
      view: "clients_delivery",
      data,
      total,
      page,
      limit,
      summary: { balance: totalBalanceStr, payment_by_type: paymentByTypeDelivery }
    };
}
