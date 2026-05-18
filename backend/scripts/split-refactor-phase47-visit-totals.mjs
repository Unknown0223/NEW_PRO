/**
 * visit-totals-report.service bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mod = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/reports");
const backupPath = path.join(mod, "visit-totals-report.service.backup.ts");
const srcPath = path.join(mod, "visit-totals-report.service.ts");

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
    .replace(/^type DayMetricRow /m, "export type DayMetricRow ");
}

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(srcPath, backupPath);
}
const lines = read(backupPath);

const hdrCore = `import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { ReportActor } from "./client-sales-4-report.service";
import {
  orderScopeSql,
  planScopeSql,
  visitScopeSql,
  type SupervisorDashboardFilters
} from "../dashboard/dashboard.service";
import { ORDER_STATUSES } from "../orders/order-status";
`;

let typesBody = `${slice(lines, 18, 47)}\n\n${slice(lines, 183, 193)}\n\n${slice(lines, 339, 363)}`;
typesBody = typesBody
  .replace(/^const VISIT_TOTALS_ORDER_STATUS_IDS/gm, "export const VISIT_TOTALS_ORDER_STATUS_IDS")
  .replace(/^const MAX_RANGE_DAYS/gm, "export const MAX_RANGE_DAYS")
  .replace(/^const EXPORT_CAP/gm, "export const EXPORT_CAP")
  .replace(/^type DayMetricRow /m, "export type DayMetricRow ");

w(path.join(mod, "visit-totals.types.ts"), typesBody);

w(
  path.join(mod, "visit-totals.helpers.ts"),
  `${hdrCore}import type { DayMetricRow, VisitTotalsFilters, VisitTotalsRow } from "./visit-totals.types";
import { EXPORT_CAP, MAX_RANGE_DAYS, VISIT_TOTALS_ORDER_STATUS_IDS } from "./visit-totals.types";

${exportFns(slice(lines, 50, 182))}

${exportFns(slice(lines, 194, 338))}
`
);

w(
  path.join(mod, "visit-totals.parse.ts"),
  `import type { VisitTotalsFilters, VisitTotalsRow } from "./visit-totals.types";
import { VISIT_TOTALS_ORDER_STATUS_IDS } from "./visit-totals.types";
import { intList } from "./visit-totals.helpers";

${slice(lines, 365, 450)}
`
);

w(
  path.join(mod, "visit-totals.filters.ts"),
  `import { prisma } from "../../config/database";
import type { ReportActor } from "./client-sales-4-report.service";
import { VISIT_TOTALS_ORDER_STATUS_OPTIONS } from "./visit-totals.types";
import { agentLabel } from "./visit-totals.helpers";

${slice(lines, 451, 476)}
`
);

w(
  path.join(mod, "visit-totals.report.ts"),
  `${hdrCore}import type { VisitTotalsFilters, VisitTotalsPayload } from "./visit-totals.types";
import {
  dedupeVisitTotalsRows,
  fetchVisitTotalsForSingleDay,
  listAgentsForGrid,
  matchesSearch,
  rangeDayCount,
  sortRowsDefaultStable
} from "./visit-totals.helpers";

${slice(lines, 477, 560)}
`
);

w(
  path.join(mod, "visit-totals.export.ts"),
  `import * as XLSX from "xlsx";
import type { ReportActor } from "./client-sales-4-report.service";
import { EXPORT_CAP } from "./visit-totals.types";
import { parseVisitTotalsQuery } from "./visit-totals.parse";
import { getVisitTotalsReport } from "./visit-totals.report";

${slice(lines, 561, 611)}
`
);

w(
  path.join(mod, "visit-totals.compare.ts"),
  `${hdrCore}import {
  bigToNum,
  decToString,
  fetchVisitTotalsForSingleDay
} from "./visit-totals.helpers";

${slice(lines, 612, 662)}
`
);

w(
  path.join(mod, "visit-totals-report.service.ts"),
  `export * from "./visit-totals.types";
export * from "./visit-totals.helpers";
export * from "./visit-totals.parse";
export * from "./visit-totals.filters";
export * from "./visit-totals.report";
export * from "./visit-totals.export";
export * from "./visit-totals.compare";
`
);

console.log("Phase 47 visit-totals split done.");
