/**
 * agent-orders-report.service bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mod = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/reports");
const backupPath = path.join(mod, "agent-orders-report.service.backup.ts");
const srcPath = path.join(mod, "agent-orders-report.service.ts");

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
import { ORDER_STATUSES, ORDER_TYPES } from "../orders/order-status";
import {
  paymentMethodStorageKey,
  priceTypeEntriesFromUnknown,
  priceTypeKey,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries,
  resolvePaymentMethodRefToLabel
} from "../tenant-settings/finance-refs";
`;

let typesBody = slice(lines, 13, 76);
typesBody = typesBody.replace(/^type TerritoryNode/m, "export type TerritoryNode").replace(/^type DateType/m, "export type DateType");
w(path.join(mod, "agent-orders.types.ts"), typesBody);

w(
  path.join(mod, "agent-orders.helpers.ts"),
  `${hdr}import type { AgentOrdersFilters, TerritoryNode } from "./agent-orders.types";

${exportFns(slice(lines, 55, 76))}

${exportFns(slice(lines, 120, 181))}

${exportFns(slice(lines, 340, 516))}
`
);

w(
  path.join(mod, "agent-orders.parse.ts"),
  `${hdr.replace("ORDER_STATUSES, ORDER_TYPES", "ORDER_TYPES")}
import type { AgentOrdersFilters, TerritoryNode } from "./agent-orders.types";
import { intList, strList } from "./agent-orders.helpers";

${slice(lines, 77, 119)}
`
);

w(
  path.join(mod, "agent-orders.filters.ts"),
  `${hdr}import type { AgentOrdersFilters, TerritoryNode } from "./agent-orders.types";
import { buildTerritoryIndexFromNodes, parseTerritoryNodes } from "./agent-orders.helpers";

${slice(lines, 182, 339)}
`
);

w(
  path.join(mod, "agent-orders.report.ts"),
  `${hdr}import type { AgentOrdersFilters, TerritoryNode } from "./agent-orders.types";
import { buildFilterSql } from "./agent-orders.helpers";

${slice(lines, 518, 822)}
`
);

w(
  path.join(mod, "agent-orders-report.service.ts"),
  `export * from "./agent-orders.types";
export * from "./agent-orders.helpers";
export * from "./agent-orders.parse";
export * from "./agent-orders.filters";
export * from "./agent-orders.report";
`
);

console.log("Phase 45 agent-orders split done.");
