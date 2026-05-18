/**
 * v4 — order-debts-report.service bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const mod = path.join(root, "../src/modules/reports");
const backupPath = path.join(mod, "order-debts-report.service.backup.ts");

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
  fs.copyFileSync(path.join(mod, "order-debts-report.service.ts"), backupPath);
}
const lines = read(backupPath);

const hdr = `import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  buildClientWhere,
  buildOrderCreatedLocalDateClause,
  loadTenantPaymentRefs,
  sqlIntIdToNumber,
  type ClientBalanceListQuery
} from "../client-balances/client-balances.service";
import { resolvePaymentMethodRefToLabel } from "../tenant-settings/finance-refs";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";
import type { OrderDebtsListQuery } from "./order-debts.types";

const PAYMENT_NOT_PENDING = Prisma.sql\`COALESCE(p.workflow_status, 'confirmed') <> 'pending_confirmation'\`;
`;

const hdrXlsx = `${hdr}import * as XLSX from "xlsx";
`;

w(
  path.join(mod, "order-debts.parse.ts"),
  `${hdr.replace("import type { OrderDebtsListQuery } from \"./order-debts.types\";\n\n", "")}
import type { OrderDebtsListQuery } from "./order-debts.types";

${slice(lines, 38, 111)}
`
);

let queryBody = slice(lines, 113, 421);
queryBody = queryBody
  .replace(/^async function /gm, "export async function ")
  .replace(/^function /gm, "export function ");
w(
  path.join(mod, "order-debts.query.ts"),
  `${hdr}
import { parseOrderDebtsListQuery } from "./order-debts.parse";

${queryBody}
`
);

w(
  path.join(mod, "order-debts.list.ts"),
  `${hdr}
import type { OrderDebtRow, OrderDebtsListResponse, RawOrderDebtRow } from "./order-debts.types";
import { parseOrderDebtsListQuery } from "./order-debts.parse";
import {
  clientIdsScopeClause,
  expeditorOrderClause,
  loadUnallocatedByClient,
  orderBySql,
  orderConsignmentDueClause,
  orderConsignmentModeSql,
  orderDebtsNeedsClientIdList,
  orderPaymentRefClause,
  readSort,
  shipmentDateClause,
  tableSearchClause,
  warehouseClause
} from "./order-debts.query";

${slice(lines, 423, 634)}
`
);

w(
  path.join(mod, "order-debts.export.ts"),
  `${hdrXlsx}
import type { OrderDebtRow } from "./order-debts.types";
import { listOrderDebtsReport } from "./order-debts.list";

${slice(lines, 635, 701)}
`
);

w(
  path.join(mod, "order-debts-report.service.ts"),
  `/**
 * Domain: Order debts report.
 */
export * from "./order-debts.types";
export { parseOrderDebtsListQuery } from "./order-debts.parse";
export * from "./order-debts.list";
export * from "./order-debts.export";
`
);

console.log("Phase 43 order-debts split done.");
