/**
 * v4 — expeditor-returns-report.service bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const mod = path.join(root, "../src/modules/reports");
const mainPath = path.join(mod, "expeditor-returns-report.service.ts");
const backupPath = path.join(mod, "expeditor-returns-report.service.backup.ts");

function read(p) {
  return fs.readFileSync(p, "utf8").split(/\r?\n/);
}
function slice(lines, a, b) {
  return lines.slice(a - 1, b).join("\n");
}
function w(p, c) {
  fs.writeFileSync(p, c.endsWith("\n") ? c : `${c}\n`);
}
function exportFns(body) {
  return body
    .replace(/^function ordersCoreCte/m, "export function ordersCoreCte")
    .replace(/^function scopeCte/m, "export function scopeCte")
    .replace(/^function unitQtySql/m, "export function unitQtySql")
    .replace(/^function aggProductSearchSql/m, "export function aggProductSearchSql")
    .replace(/^function aggClientSearchSql/m, "export function aggClientSearchSql")
    .replace(/^function mapOrderRow/m, "export function mapOrderRow")
    .replace(/^function buildExpeditorOrderWhereSql/m, "export function buildExpeditorOrderWhereSql")
    .replace(/^function sortOrdersSql/m, "export function sortOrdersSql")
    .replace(/^function decStr/m, "export function decStr")
    .replace(/^function dateFilterExpr/m, "export function dateFilterExpr")
    .replace(/^function orderTypeLabelRu/m, "export function orderTypeLabelRu");
}

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(mainPath, backupPath);
}
const lines = read(backupPath);

const hdr = `import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES, ORDER_TYPES, ORDER_TYPE_LABELS } from "../orders/order-status";
import {
  paymentMethodStorageKey,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries
} from "../tenant-settings/finance-refs";
import type { ReportActor } from "./client-sales-4-report.service";
import { mergeTerritoryFilterOptions } from "./territory-nodes";
`;

const hdrXlsx = `${hdr}import * as XLSX from "xlsx";
`;

w(path.join(mod, "expeditor-returns.types.ts"), slice(lines, 36, 69));

w(
  path.join(mod, "expeditor-returns.helpers.ts"),
  `${hdr}import type { ExpeditorReturnsFilters, ExpeditorReturnsUnitMode } from "./expeditor-returns.types";

${exportFns(`${slice(lines, 71, 270)}\n\n${slice(lines, 451, 542)}\n\n${slice(lines, 589, 688)}`)}
`
);

w(
  path.join(mod, "expeditor-returns.parse.ts"),
  `${slice(lines, 272, 337)}
`
);

w(
  path.join(mod, "expeditor-returns.filters.ts"),
  `${hdr}import type { ExpeditorReturnsFilters } from "./expeditor-returns.types";

${slice(lines, 366, 449)}
`
);

w(
  path.join(mod, "expeditor-returns.orders.ts"),
  `${hdr}import type { ExpeditorReturnsFilters } from "./expeditor-returns.types";
import {
  decStr,
  mapOrderRow,
  ordersCoreCte,
  sortOrdersSql
} from "./expeditor-returns.helpers";

${slice(lines, 339, 364)}

${slice(lines, 544, 587)}
`
);

w(
  path.join(mod, "expeditor-returns.aggregates.ts"),
  `${hdr}import type { ExpeditorReturnsFilters } from "./expeditor-returns.types";
import {
  aggClientSearchSql,
  aggProductSearchSql,
  decStr,
  scopeCte,
  unitQtySql
} from "./expeditor-returns.helpers";

${slice(lines, 623, 636)}

${slice(lines, 690, 905)}
`
);

w(
  path.join(mod, "expeditor-returns.export.ts"),
  `${hdrXlsx}import type { ExpeditorReturnsFilters } from "./expeditor-returns.types";
import { getExpeditorReturnsByClients } from "./expeditor-returns.aggregates";
import { getExpeditorReturnsByProducts } from "./expeditor-returns.aggregates";
import { getExpeditorReturnsOrders } from "./expeditor-returns.orders";

${slice(lines, 906, 1000)}
`
);

w(
  path.join(mod, "expeditor-returns-report.service.ts"),
  `/**
 * Domain: Expeditor returns report.
 */
export * from "./expeditor-returns.types";
export { parseExpeditorReturnsQuery } from "./expeditor-returns.parse";
export * from "./expeditor-returns.filters";
export * from "./expeditor-returns.orders";
export * from "./expeditor-returns.aggregates";
export * from "./expeditor-returns.export";
`
);

console.log("Phase 42 expeditor-returns split done.");
