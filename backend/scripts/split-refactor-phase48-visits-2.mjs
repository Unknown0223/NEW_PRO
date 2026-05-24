/**
 * visits-2-report.service bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mod = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/reports");
const backupPath = path.join(mod, "visits-2-report.service.backup.ts");
const srcPath = path.join(mod, "visits-2-report.service.ts");

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
    .replace(/^async function /gm, "export async function ")
    .replace(/^const EXPORT_CAP/gm, "export const EXPORT_CAP")
    .replace(/^const WEEKDAY_LABEL_RU/gm, "export const WEEKDAY_LABEL_RU");
}

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(srcPath, backupPath);
}
const lines = read(backupPath);

const hdr = `import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { ReportActor } from "./client-sales-4-report.service";
import { mergeTerritoryFilterOptions } from "./territory-nodes";
`;

w(path.join(mod, "visits-2.types.ts"), `${slice(lines, 20, 36)}\n\n${slice(lines, 335, 353)}`);

w(
  path.join(mod, "visits-2.helpers.ts"),
  `${hdr}import type { Visits2Filters } from "./visits-2.types";
import { EXPORT_CAP } from "./visits-2.constants";

${exportFns(slice(lines, 50, 232))}
`
);

w(path.join(mod, "visits-2.constants.ts"), exportFns(slice(lines, 38, 48)));

w(
  path.join(mod, "visits-2.parse.ts"),
  `import type { Visits2Filters } from "./visits-2.types";
import { intList, intListUnique, strList } from "./visits-2.helpers";

${slice(lines, 233, 267)}
`
);

w(
  path.join(mod, "visits-2.filters.ts"),
  `${hdr}import type { ReportActor } from "./client-sales-4-report.service";

${slice(lines, 268, 334)}
`
);

w(
  path.join(mod, "visits-2.core.ts"),
  `${hdr}import type { Visits2Filters, Visits2ReportPayload } from "./visits-2.types";
import type { ReportActor } from "./client-sales-4-report.service";
import { buildActorClientScopeSql, buildClientFilterSql, orderByRaw } from "./visits-2.helpers";
import { EXPORT_CAP } from "./visits-2.constants";

${exportFns(slice(lines, 355, 437))}
`
);

w(
  path.join(mod, "visits-2.report.ts"),
  `${hdr}import type { Visits2Filters } from "./visits-2.types";
import type { ReportActor } from "./client-sales-4-report.service";
import { runVisits2Core } from "./visits-2.core";

${slice(lines, 438, 454)}
`
);

w(
  path.join(mod, "visits-2.export.ts"),
  `${hdr}import * as XLSX from "xlsx";
import type { ReportActor } from "./client-sales-4-report.service";
import { parseVisits2Query } from "./visits-2.parse";
import { getVisits2Report } from "./visits-2.report";

${slice(lines, 455, 491)}
`
);

w(
  path.join(mod, "visits-2-report.service.ts"),
  `export * from "./visits-2.types";
export * from "./visits-2.constants";
export * from "./visits-2.helpers";
export * from "./visits-2.parse";
export * from "./visits-2.filters";
export * from "./visits-2.core";
export * from "./visits-2.report";
export * from "./visits-2.export";
export { formatVisitWeekdaysJson } from "./visits-2.helpers";
`
);

console.log("Phase 48 visits-2 split done.");
