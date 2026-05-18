/**
 * client-sales-2-report.service bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mod = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/reports");
const backupPath = path.join(mod, "client-sales-2-report.service.backup.ts");
const srcPath = path.join(mod, "client-sales-2-report.service.ts");

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
  return body.replace(/^function /gm, "export function ");
}

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(srcPath, backupPath);
}
const lines = read(backupPath);

const hdr = `import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getRedisForApp } from "../../lib/redis-cache";
import { ORDER_STATUSES, ORDER_TYPES } from "../orders/order-status";
import {
  paymentMethodStorageKey,
  priceTypeEntriesFromUnknown,
  priceTypeKey,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries,
  resolvePaymentMethodRefToLabel
} from "../tenant-settings/finance-refs";
import { mergeTerritoryFilterOptions } from "./territory-nodes";
`;

let cs2Types = slice(lines, 6, 48);
cs2Types = cs2Types
  .replace(/^type DateType/m, "export type DateType")
  .replace(/^type ClientActivity/m, "export type ClientActivity")
  .replace(/^type ConsignmentMode/m, "export type ConsignmentMode");
w(path.join(mod, "client-sales-2.types.ts"), cs2Types);

w(
  path.join(mod, "client-sales-2.where.ts"),
  `${hdr}import type { ClientSales2Filters, ReportActor } from "./client-sales-2.types";
import { intList, numOr, parseDate, strList } from "./client-sales-2.helpers";

${exportFns(slice(lines, 75, 266))}
`
);

w(
  path.join(mod, "client-sales-2.helpers.ts"),
  `import { Prisma } from "@prisma/client";

${exportFns(slice(lines, 49, 74))}
`
);

w(
  path.join(mod, "client-sales-2.parse.ts"),
  `import type { ClientSales2Filters, ConsignmentMode } from "./client-sales-2.types";
import { intList, numOr, strList } from "./client-sales-2.helpers";

${slice(lines, 267, 311)}
`
);

w(
  path.join(mod, "client-sales-2.filters.ts"),
  `${hdr}import type { ReportActor } from "./client-sales-2.types";

${slice(lines, 312, 456)}
`
);

w(
  path.join(mod, "client-sales-2.report.ts"),
  `${hdr}import type { ClientSales2Filters, ReportActor } from "./client-sales-2.types";
import { buildClientScopeSql, buildOrderWhereSql, productFilterSql } from "./client-sales-2.where";

${slice(lines, 457, 715)}
`
);

w(
  path.join(mod, "client-sales-2.export.ts"),
  `${hdr}import * as XLSX from "xlsx";
import type { ReportActor } from "./client-sales-2.types";
import { parseClientSales2Query } from "./client-sales-2.parse";
import { getClientSales2Report } from "./client-sales-2.report";

${slice(lines, 716, 771)}
`
);

w(
  path.join(mod, "client-sales-2-report.service.ts"),
  `export * from "./client-sales-2.types";
export * from "./client-sales-2.helpers";
export * from "./client-sales-2.where";
export * from "./client-sales-2.parse";
export * from "./client-sales-2.filters";
export * from "./client-sales-2.report";
export * from "./client-sales-2.export";
`
);

console.log("Phase 46 client-sales-2 split done.");
