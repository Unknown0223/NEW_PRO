import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const staff = path.join(root, "../src/modules/staff");
const payments = path.join(root, "../src/modules/payments");
const dash = path.join(root, "../src/modules/dashboard");

function read(p) {
  return fs.readFileSync(p, "utf8").split(/\r?\n/);
}
function slice(lines, a, b) {
  return lines.slice(a - 1, b).join("\n");
}
function w(p, c) {
  fs.writeFileSync(p, c.endsWith("\n") ? c : `${c}\n`);
}

// --- staff.patches.field ---
const pf = read(path.join(staff, "staff.patches.field.ts"));
const pfH = slice(pf, 1, 59);

w(
  path.join(staff, "staff.patches.field.agent.ts"),
  `${pfH}
${slice(pf, 62, 240)}
`
);

w(
  path.join(staff, "staff.patches.field.supervisor.ts"),
  `${pfH}
import { applyAgentPatchInDb } from "./staff.patches.field.agent";

${slice(pf, 242, 406)}
`
);

w(
  path.join(staff, "staff.patches.field.roles.ts"),
  `${pfH}

${slice(pf, 407, pf.length)}
`
);

w(
  path.join(staff, "staff.patches.field.ts"),
  `/** Staff field patches — barrel. */
export * from "./staff.patches.field.agent";
export * from "./staff.patches.field.supervisor";
export * from "./staff.patches.field.roles";
`
);

// --- payment.query ---
const pq = read(path.join(payments, "payment.query.ts"));
const pqH = slice(pq, 1, 16);

w(
  path.join(payments, "payment.query.types.ts"),
  `${pqH}
import type { PaymentAllocationRow } from "./payment-allocations.service";

${slice(pq, 18, 133)}
${slice(pq, 435, 444)}
`
);

w(
  path.join(payments, "payment.query.mappers.ts"),
  `${pqH}
import type { PaymentListQuery, PaymentListRow } from "./payment.query.types";

${slice(pq, 135, 433)}
`
);

w(
  path.join(payments, "payment.query.update.ts"),
  `${pqH}
import type { PaymentDetailPayload, UpdatePaymentInput } from "./payment.query.types";
import { getPaymentDetail } from "./payment.query.read";
import { paymentListInclude } from "./payment.query.mappers";

${slice(pq, 450, 639)}
`
);

w(
  path.join(payments, "payment.query.read.ts"),
  `${pqH}
import type { PaymentDetailPayload, PaymentListQuery, PaymentListRow } from "./payment.query.types";
import {
  buildPaymentListWhere,
  mapPaymentToListRow,
  paymentListInclude
} from "./payment.query.mappers";

${slice(pq, 641, pq.length)}
`
);

w(
  path.join(payments, "payment.query.ts"),
  `/** Payments query — barrel. */
export * from "./payment.query.types";
export * from "./payment.query.mappers";
export * from "./payment.query.update";
export * from "./payment.query.read";
`
);

// Export helpers used by read / update
let mappers = fs.readFileSync(path.join(payments, "payment.query.mappers.ts"), "utf8");
mappers = mappers
  .replace(/^function parseUtcDayStart/m, "export function parseUtcDayStart")
  .replace(/^function parseUtcDayEnd/m, "export function parseUtcDayEnd")
  .replace(/^function buildPaymentListWhere/m, "export function buildPaymentListWhere");
fs.writeFileSync(path.join(payments, "payment.query.mappers.ts"), mappers);

// move buildPaymentListOrderBy from read file if it ended up in read slice - check
// read slice 641-end includes buildPaymentListOrderBy at 676 - it's IN read slice
// mappers has 135-433 which ends before buildPaymentListOrderBy at 676
// So buildPaymentListOrderBy is only in read - read imports from mappers but it's defined in read file

// --- dashboard.sales ---
const sl = read(path.join(dash, "dashboard.sales.ts"));
const slH = slice(sl, 1, 32);

w(
  path.join(dash, "dashboard.sales.types.ts"),
  `${slice(sl, 71, 157)}
`
);

w(
  path.join(dash, "dashboard.sales.scope.ts"),
  `${slH}
import type { SalesDashboardFilters } from "./dashboard.sales.types";
import { normalizeFromYmd, normalizeToYmd } from "./dashboard.finance";

${slice(sl, 34, 68)}

${slice(sl, 159, 287)}
`
);

// Export scope helpers for snapshot
let scope = fs.readFileSync(path.join(dash, "dashboard.sales.scope.ts"), "utf8");
scope = scope
  .replace(/^function salesDateExprByType/m, "export function salesDateExprByType")
  .replace(/^function buildSalesTerritoryAliasClause/m, "export function buildSalesTerritoryAliasClause")
  .replace(/^function salesProductExistsClause/m, "export function salesProductExistsClause")
  .replace(/^function salesOrderScopeSql/m, "export function salesOrderScopeSql")
  .replace(/^function salesProductJoinFilter/m, "export function salesProductJoinFilter")
  .replace(/^async function resolveSalesTerritoryTerms/m, "export async function resolveSalesTerritoryTerms");
fs.writeFileSync(path.join(dash, "dashboard.sales.scope.ts"), scope);

w(
  path.join(dash, "dashboard.sales.snapshot.ts"),
  `${slH}
import type { SalesDashboardFilters, SalesDashboardSnapshot } from "./dashboard.sales.types";
import {
  resolveSalesTerritoryTerms,
  salesOrderScopeSql,
  salesProductJoinFilter
} from "./dashboard.sales.scope";

${slice(sl, 289, sl.length)}
`
);

w(
  path.join(dash, "dashboard.sales.ts"),
  `/** Sales dashboard — barrel. */
export * from "./dashboard.sales.types";
export * from "./dashboard.sales.scope";
export * from "./dashboard.sales.snapshot";
`
);

// --- dashboard.finance ---
const fn = read(path.join(dash, "dashboard.finance.ts"));
const fnH = slice(fn, 1, 31);

w(
  path.join(dash, "dashboard.finance.types.ts"),
  `${slice(fn, 33, 108)}
`
);

w(
  path.join(dash, "dashboard.finance.scope.ts"),
  `${fnH}
import type { FinanceDashboardFilters } from "./dashboard.finance.types";

${slice(fn, 110, 280)}
`
);

let fscope = fs.readFileSync(path.join(dash, "dashboard.finance.scope.ts"), "utf8");
fscope = fscope
  .replace(/^function financeDateExprByType/m, "export function financeDateExprByType")
  .replace(/^function financeOrderScopeSql/m, "export function financeOrderScopeSql")
  .replace(/^function financeClientFilterSql/m, "export function financeClientFilterSql");
fs.writeFileSync(path.join(dash, "dashboard.finance.scope.ts"), fscope);

w(
  path.join(dash, "dashboard.finance.snapshot.ts"),
  `${fnH}
import type { FinanceDashboardFilters, FinanceDashboardSnapshot } from "./dashboard.finance.types";
import { financeClientFilterSql, financeOrderScopeSql } from "./dashboard.finance.scope";

${slice(fn, 282, fn.length)}
`
);

w(
  path.join(dash, "dashboard.finance.ts"),
  `/** Finance dashboard — barrel. */
export * from "./dashboard.finance.types";
export * from "./dashboard.finance.scope";
export * from "./dashboard.finance.snapshot";
`
);

console.log("phase7 done");
