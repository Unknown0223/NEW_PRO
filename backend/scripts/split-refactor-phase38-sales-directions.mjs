/**
 * v4 — sales-directions.service bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const mod = path.join(root, "../src/modules/sales-directions");
const mainPath = path.join(mod, "sales-directions.service.ts");
const backupPath = path.join(mod, "sales-directions.service.backup.ts");

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

const hdr = `import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";
`;

w(
  path.join(mod, "sales-directions.shared.ts"),
  `${slice(lines, 5, 20)}
`.replace(/^function normCode/m, "export function normCode").replace(/^function sortRu/m, "export function sortRu")
);

w(
  path.join(mod, "sales-directions.labels.ts"),
  `${hdr}import { salesRefStoredValue, sortRu } from "./sales-directions.shared";

${slice(lines, 22, 46)}
`
);

w(
  path.join(mod, "sales-directions.trade.ts"),
  `${hdr}import { normCode } from "./sales-directions.shared";

${slice(lines, 48, 194)}
`
);

w(
  path.join(mod, "sales-directions.channels.ts"),
  `${hdr}import { normCode } from "./sales-directions.shared";

${slice(lines, 196, 330)}
`
);

w(path.join(mod, "sales-directions.kpi.types.ts"), slice(lines, 332, 357));

const userFioFn = slice(lines, 359, 361);

let kpiBody = slice(lines, 363, 594);
kpiBody = kpiBody
  .replace(/^function userFio/m, "function userFio")
  .replace(/^async function assertKpiProductIds/m, "async function assertKpiProductIds")
  .replace(/^async function assertKpiAgentUserIds/m, "async function assertKpiAgentUserIds");

w(
  path.join(mod, "sales-directions.kpi.ts"),
  `${hdr}import type { KpiGroupDetailRow, KpiGroupListRow } from "./sales-directions.kpi.types";
import { normCode } from "./sales-directions.shared";

${userFioFn}

${kpiBody}
`
);

w(
  path.join(mod, "sales-directions.service.ts"),
  `/**
 * Domain: trade directions, sales channels, KPI groups.
 */
export * from "./sales-directions.shared";
export * from "./sales-directions.labels";
export * from "./sales-directions.trade";
export * from "./sales-directions.channels";
export * from "./sales-directions.kpi.types";
export * from "./sales-directions.kpi";
`
);

console.log("Phase 38 sales-directions split done.");
