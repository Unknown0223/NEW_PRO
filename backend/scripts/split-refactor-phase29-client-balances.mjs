/**
 * v4 — client-balances.service bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const mod = path.join(root, "../src/modules/client-balances");
const mainPath = path.join(mod, "client-balances.service.ts");
const backupPath = path.join(mod, "client-balances.service.backup.ts");

function read(p) {
  return fs.readFileSync(p, "utf8").split(/\r?\n/);
}
function slice(lines, a, b) {
  return lines.slice(a - 1, b).join("\n");
}
function w(p, c) {
  fs.writeFileSync(p, c.endsWith("\n") ? c : `${c}\n`);
}

const lines = read(mainPath);
if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(mainPath, backupPath);
}

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
`;

w(path.join(mod, "client-balances.types.ts"), slice(lines, 12, 121));

w(
  path.join(mod, "client-balances.constants.ts"),
  `import { Prisma } from "@prisma/client";

${slice(lines, 146, 148)}

${slice(lines, 336, 350)}
`
);

let dateBody = slice(lines, 123, 145) + "\n" + slice(lines, 150, 207);
dateBody = dateBody
  .replace(/^function parseIsoDateStartUtc/m, "export function parseIsoDateStartUtc")
  .replace(/^export function parseIsoDateEndUtc/m, "export function parseIsoDateEndUtc")
  .replace(/^function parseYmd/m, "function parseYmd")
  .replace(/^function localDateStartToUtc/m, "function localDateStartToUtc")
  .replace(/^function localDateEndToUtc/m, "function localDateEndToUtc")
  .replace(/^function makePerfMarker/m, "export function makePerfMarker");
w(
  path.join(mod, "client-balances.date.ts"),
  `${hdr.replace("ORDER_STATUSES", "// ORDER_STATUSES")}
import {
  ORDER_CREATED_UTC_OFFSET_HOURS,
  BALANCE_PERF_LOG
} from "./client-balances.constants";

${dateBody}
`.replace("// ORDER_STATUSES\nimport {\n  ORDER_CREATED", "import {\n  ORDER_CREATED")
);

// Fix date hdr - remove order-status import from date file
w(
  path.join(mod, "client-balances.date.ts"),
  `import { Prisma } from "@prisma/client";
import {
  ORDER_CREATED_UTC_OFFSET_HOURS,
  BALANCE_PERF_LOG
} from "./client-balances.constants";

${dateBody}
`
);

w(
  path.join(mod, "client-balances.where.ts"),
  `${hdr}
import type { ClientBalanceListQuery } from "./client-balances.types";
import { parseIsoDateEndUtc, parseIsoDateStartUtc } from "./client-balances.date";

${slice(lines, 209, 334)}
`
);

let payData = `${hdr}
import {
  agentInclude,
  LARGE_CLIENT_IDS_CHUNK,
  PAYMENT_COUNTS_FOR_RECEIVABLE_NET
} from "./client-balances.constants";
import { parseIsoDateEndUtc } from "./client-balances.date";
import type { ClientBalancePaymentTypeSummary } from "./client-balances.types";

${slice(lines, 352, 639)}
`;
payData = payData
  .replace(/^function paymentAmountsForSpravochnik/m, "function paymentAmountsForSpravochnik")
  .replace(/^async function loadTenantPaymentTypeLabels/m, "async function loadTenantPaymentTypeLabels")
  .replace(/^async function loadUnpaidOrderBalanceRawByAgentPaymentRef/m, "export async function loadUnpaidOrderBalanceRawByAgentPaymentRef")
  .replace(/^function processUnpaidAgentPayRefRows/m, "export function processUnpaidAgentPayRefRows");
w(path.join(mod, "client-balances.payments.data.ts"), payData);

let payUtil = `${hdr}
import type { ClientBalanceListQuery, ClientBalancePaymentTypeSummary } from "./client-balances.types";

${slice(lines, 640, 721)}
`;
payUtil = payUtil
  .replace(/^function paymentAmountsForOrderDebtByMethod/m, "function paymentAmountsForOrderDebtByMethod")
  .replace(/^function normPayTypeKey/m, "export function normPayTypeKey")
  .replace(/^function readSortDir/m, "export function readSortDir")
  .replace(/^function moneySortValueFromPaymentAmounts/m, "export function moneySortValueFromPaymentAmounts")
  .replace(/^function compareNumForSort/m, "export function compareNumForSort");
w(path.join(mod, "client-balances.payments.util.ts"), payUtil);

let payAgg = `${hdr}
import { LARGE_CLIENT_IDS_CHUNK } from "./client-balances.constants";
import type { ClientBalancePaymentTypeSummary } from "./client-balances.types";
import { normPayTypeKey, sqlIntIdToNumber } from "./client-balances.payments.util";
import { PAYMENT_COUNTS_FOR_RECEIVABLE_NET } from "./client-balances.constants";
import { parseIsoDateEndUtc } from "./client-balances.date";
import type { PaymentMethodEntryDto } from "../tenant-settings/finance-refs";

${slice(lines, 723, 809)}
`;
payAgg = payAgg
  .replace(/^function sprNormKeyForBuckets/m, "function sprNormKeyForBuckets")
  .replace(/^function foldPaymentBucketMap/m, "function foldPaymentBucketMap")
  .replace(/^function buildSummaryPaymentByType/m, "function buildSummaryPaymentByType");
w(path.join(mod, "client-balances.payments.aggregate.ts"), payAgg);

w(
  path.join(mod, "client-balances.ledger.ts"),
  `${hdr}
import { LARGE_CLIENT_IDS_CHUNK } from "./client-balances.constants";
import { sqlIntIdToNumber } from "./client-balances.payments.util";

${slice(lines, 811, 905)}
`
);

w(
  path.join(mod, "client-balances.delivery.ts"),
  `${hdr}
import { LARGE_CLIENT_IDS_CHUNK } from "./client-balances.constants";
import { buildOrderCreatedLocalDateClause } from "./client-balances.date";
import { sqlIntIdToNumber } from "./client-balances.payments.util";
import type { OrderItemSummary } from "./client-balances.types";

${slice(lines, 907, 1090)}
`.replace(
    'import type { OrderItemSummary } from "./client-balances.types";\n\n',
    ""
  )
);

// Fix delivery - remove wrong import
let del = fs.readFileSync(path.join(mod, "client-balances.delivery.ts"), "utf8");
del = del.replace('import type { OrderItemSummary } from "./client-balances.types";\n\n', "");
w(path.join(mod, "client-balances.delivery.ts"), del);

w(
  path.join(mod, "client-balances.mappers.ts"),
  `${hdr}
import { agentInclude } from "./client-balances.constants";
import type { ClientBalancePaymentTypeSummary, ClientBalanceRow } from "./client-balances.types";
import type { DeliveryDebtInfo } from "./client-balances.delivery";
import { resolvePaymentMethodRefToLabel, type PaymentMethodEntryDto } from "../tenant-settings/finance-refs";

${slice(lines, 1092, 1249)}
`
);

w(
  path.join(mod, "client-balances.territory.ts"),
  `${hdr}
import type { ClientBalanceTerritoryOptions } from "./client-balances.types";
import { buildClientWhere } from "./client-balances.where";
import type { ClientBalanceListQuery } from "./client-balances.types";

${slice(lines, 1251, 1316)}
`
);

const reportImports = `${hdr}
import type {
  AgentBalanceRow,
  ClientBalanceListQuery,
  ClientBalanceListResponse,
  ClientBalanceRow
} from "./client-balances.types";
import { agentInclude } from "./client-balances.constants";
import { buildClientWhere, buildOrderCreatedLocalDateClause } from "./client-balances.where";
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
`;

w(
  path.join(mod, "client-balances.report.ts"),
  `${reportImports}

${slice(lines, 1318, lines.length)}
`
);

w(
  path.join(mod, "client-balances.service.ts"),
  `/**
 * Domain: Client balances (spravochnik, konsignatsiya, delivery qarz).
 */
export * from "./client-balances.types";
export * from "./client-balances.constants";
export * from "./client-balances.date";
export * from "./client-balances.where";
export * from "./client-balances.payments.data";
export * from "./client-balances.payments.util";
export * from "./client-balances.payments.aggregate";
export * from "./client-balances.ledger";
export * from "./client-balances.delivery";
export * from "./client-balances.mappers";
export * from "./client-balances.territory";
export * from "./client-balances.report";
`
);

// Export payment functions from data + util + aggregate
for (const [file, names] of [
  [
    "client-balances.payments.data.ts",
    [
      "loadPaymentNetNormByClient",
      "loadTenantPaymentRefs",
      "loadUnpaidOrderBalanceRawByPaymentRef",
      "processUnpaidPayRefRows"
    ]
  ],
  [
    "client-balances.payments.util.ts",
    ["paymentAmountsNetMinusUnpaid", "buildSummaryNetMinusUnpaid"]
  ],
  ["client-balances.payments.aggregate.ts", ["loadPaymentNetTotalsByTypeGlobally"]],
  ["client-balances.ledger.ts", []],
  ["client-balances.delivery.ts", ["loadDeliveryDebtByClient", "mergeLedgerWithUnpaidDelivered"]]
]) {
  let s = fs.readFileSync(path.join(mod, file), "utf8");
  for (const name of names) {
    s = s.replace(new RegExp(`^(export )?async function ${name}`), `export async function ${name}`);
    s = s.replace(new RegExp(`^export async function ${name}`), `export async function ${name}`);
    s = s.replace(new RegExp(`^(export )?function ${name}`), `export function ${name}`);
  }
  if (file === "client-balances.ledger.ts") {
    s = s
      .replace(/^async function loadBalancesAsOf/m, "export async function loadBalancesAsOf")
      .replace(/^async function loadLastPaymentByClient/m, "export async function loadLastPaymentByClient")
      .replace(/^async function loadLastDeliveryByClient/m, "export async function loadLastDeliveryByClient");
  }
  if (file === "client-balances.delivery.ts") {
    s = s.replace(/^async function loadUnpaidDeliveredOrderDebtRows/m, "export async function loadUnpaidDeliveredOrderDebtRows");
  }
  if (file === "client-balances.payments.data.ts") {
    s = s.replace(
      /^function paymentAmountsNetMinusUnpaid/m,
      "export function paymentAmountsNetMinusUnpaid"
    );
    s = s.replace(/^function buildSummaryNetMinusUnpaid/m, "export function buildSummaryNetMinusUnpaid");
  }
  if (file === "client-balances.payments.aggregate.ts") {
    s = s.replace(
      /^async function loadPaymentNetTotalsByTypeGlobally/m,
      "export async function loadPaymentNetTotalsByTypeGlobally"
    );
    s = s.replace(/^function buildSummaryPaymentByType/m, "function buildSummaryPaymentByType");
  }
  w(path.join(mod, file), s);
}

console.log("Phase 29 client-balances split done.");
