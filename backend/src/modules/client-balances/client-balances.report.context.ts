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
  paymentAmountsNetMinusUnpaid
} from "./client-balances.payments.util";
import { loadPaymentNetTotalsByTypeGlobally } from "./client-balances.payments.aggregate";
import {
  compareNumForSort,
  moneySortValueFromPaymentAmounts,
  normPayTypeKey,
  readSortDir
} from "./client-balances.payments.util";
import { loadBalancesAsOf, loadLastDeliveryByClient, loadLastPaymentByClient } from "./client-balances.ledger";
import {
  loadDeliveryDebtByClient,
  loadUnpaidDeliveredOrderDebtRows,
  mergeLedgerWithUnpaidDelivered
} from "./client-balances.delivery";
import { mapClientRow, mapDeliveryOrderRow } from "./client-balances.mappers";


export type ClientBalancesReportContext = {
  tenantId: number;
  q: ClientBalanceListQuery;
  perf: ReturnType<typeof makePerfMarker>;
  page: number;
  limit: number;
  asOfEnd: Date | null;
  odFrom: string | null;
  odTo: string | null;
  skipBal: boolean;
  where: ReturnType<typeof buildClientWhere>;
};

export function buildClientBalancesReportContext(
  tenantId: number,
  q: ClientBalanceListQuery
): ClientBalancesReportContext {
  const perf = makePerfMarker(`client-balances t=${tenantId} view=${q.view}`);
  const page = Math.max(1, q.page);
  const maxL = q.allow_large_export ? 5000 : 200;
  const limit = Math.min(maxL, Math.max(1, q.limit));
  const asOfRaw = q.balance_as_of?.trim();
  const asOfEnd = asOfRaw ? parseIsoDateEndUtc(asOfRaw) : null;
  const odFrom = q.order_date_from?.trim() || null;
  const odTo = q.order_date_to?.trim() || null;
  const skipBal = q.view === "clients_delivery";
  const where = buildClientWhere(tenantId, q, { skipBalanceFilter: skipBal });
  perf("where-ready", { page, limit, hasSearch: Boolean(q.search?.trim()) });
  return { tenantId, q, perf, page, limit, asOfEnd, odFrom, odTo, skipBal, where };
}
