/**
 * client-sales-4-report.service bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mod = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/reports");
const backupPath = path.join(mod, "client-sales-4-report.service.backup.ts");
const srcPath = path.join(mod, "client-sales-4-report.service.ts");

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
    .replace(/^function /gm, "export function ")
    .replace(/^const KNOWN_ORDER_TYPES/gm, "export const KNOWN_ORDER_TYPES");
}

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(srcPath, backupPath);
}
const lines = read(backupPath);

const hdr = `import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
`;

w(path.join(mod, "client-sales-4.types.ts"), slice(lines, 5, 28));

w(
  path.join(mod, "client-sales-4.helpers.ts"),
  `${hdr}import type { ClientSales4Filters, ReportActor } from "./client-sales-4.types";

${exportFns(slice(lines, 30, 204))}
`
);

w(
  path.join(mod, "client-sales-4.parse.ts"),
  `import type { ClientSales4Filters } from "./client-sales-4.types";
import { intList, parseOrderTypesParam, strList } from "./client-sales-4.helpers";

${slice(lines, 206, 237)}
`
);

w(
  path.join(mod, "client-sales-4.core.ts"),
  `${hdr}import type { ClientSales4Filters, ReportActor } from "./client-sales-4.types";
import { buildOrderWhereSql4, productFilterSql4 } from "./client-sales-4.helpers";

${exportFns(slice(lines, 239, 250))}
`
);

w(
  path.join(mod, "client-sales-4.filters.ts"),
  `${hdr}import type { ReportActor } from "./client-sales-4.types";
import { KNOWN_ORDER_TYPES } from "./client-sales-4.helpers";

${slice(lines, 252, 376)}
`
);

w(
  path.join(mod, "client-sales-4.report.ts"),
  `${hdr}import type { ClientSales4Filters, ReportActor } from "./client-sales-4.types";
import { cteBody } from "./client-sales-4.core";

${slice(lines, 378, 496)}
`
);

w(
  path.join(mod, "client-sales-4.export.ts"),
  `${hdr}import * as XLSX from "xlsx";
import type { ReportActor } from "./client-sales-4.types";
import { parseClientSales4Query } from "./client-sales-4.parse";
import { getClientSales4Report } from "./client-sales-4.report";

${slice(lines, 498, 525)}
`
);

w(
  path.join(mod, "client-sales-4-report.service.ts"),
  `export * from "./client-sales-4.types";
export * from "./client-sales-4.helpers";
export * from "./client-sales-4.parse";
export * from "./client-sales-4.core";
export * from "./client-sales-4.filters";
export * from "./client-sales-4.report";
export * from "./client-sales-4.export";
`
);

console.log("Phase 52 client-sales-4 split done.");
