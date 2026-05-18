/**
 * client-balances.report.ts bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mod = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/client-balances");
const backupPath = path.join(mod, "client-balances.report.backup.ts");
const srcPath = path.join(mod, "client-balances.report.ts");

function read(p) {
  return fs.readFileSync(p, "utf8").split(/\r?\n/);
}
function slice(lines, a, b) {
  return lines.slice(a - 1, b).join("\n");
}
function w(p, c) {
  fs.writeFileSync(p, c.endsWith("\n") ? c : `${c}\n`);
}

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(srcPath, backupPath);
}
const lines = read(backupPath);

const hdr = `import { Prisma } from "@prisma/client";
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
`;

w(
  path.join(mod, "client-balances.report.context.ts"),
  `import type { ClientBalanceListQuery } from "./client-balances.types";
import { buildClientWhere } from "./client-balances.where";
import { makePerfMarker, parseIsoDateEndUtc } from "./client-balances.date";

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
  const perf = makePerfMarker(\`client-balances t=\${tenantId} view=\${q.view}\`);
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
`
);

w(
  path.join(mod, "client-balances.report.delivery.ts"),
  `${hdr}
export async function listClientBalancesReportDelivery(
  ctx: ClientBalancesReportContext
): Promise<ClientBalanceListResponse> {
  const { tenantId, q, perf, page, limit, asOfEnd, odFrom, odTo, where } = ctx;
${slice(lines, 66, 166)}
}
`
);

w(
  path.join(mod, "client-balances.report.filtered.ts"),
  `${hdr}
export async function listClientBalancesReportFiltered(
  ctx: ClientBalancesReportContext
): Promise<ClientBalanceListResponse> {
  const { tenantId, q, perf, page, limit, asOfEnd, odFrom, odTo } = ctx;
  const bfEarly = q.balance_filter?.trim() ?? "";
${slice(lines, 171, 303)}
}
`
);

w(
  path.join(mod, "client-balances.report.main.ts"),
  `${hdr}
export async function listClientBalancesReportMain(
  ctx: ClientBalancesReportContext
): Promise<ClientBalanceListResponse> {
  const { tenantId, q, perf, page, limit, asOfEnd, odFrom, odTo, where } = ctx;
${slice(lines, 306, 544)}
}
`
);

w(
  path.join(mod, "client-balances.report.ts"),
  `import type { ClientBalanceListQuery, ClientBalanceListResponse } from "./client-balances.types";
import { buildClientBalancesReportContext } from "./client-balances.report.context";
import { listClientBalancesReportDelivery } from "./client-balances.report.delivery";
import { listClientBalancesReportFiltered } from "./client-balances.report.filtered";
import { listClientBalancesReportMain } from "./client-balances.report.main";

export async function listClientBalancesReport(
  tenantId: number,
  q: ClientBalanceListQuery
): Promise<ClientBalanceListResponse> {
  const ctx = buildClientBalancesReportContext(tenantId, q);
  if (q.view === "clients_delivery") {
    return listClientBalancesReportDelivery(ctx);
  }
  const bfEarly = q.balance_filter?.trim() ?? "";
  if (q.view === "clients" && (bfEarly === "debt" || bfEarly === "credit")) {
    return listClientBalancesReportFiltered(ctx);
  }
  return listClientBalancesReportMain(ctx);
}
`
);

console.log("Phase 53 client-balances report split done.");
