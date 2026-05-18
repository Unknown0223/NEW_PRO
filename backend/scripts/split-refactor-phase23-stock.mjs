/**
 * v4 — stock.service bosqich 1: types, list, balances, movements.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const stock = path.join(root, "../src/modules/stock");
const mainPath = path.join(stock, "stock.service.ts");
const backupPath = path.join(stock, "stock.service.backup.ts");

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

const hdr = `import ExcelJS from "exceljs";
import XLSX from "xlsx";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getRedisForApp, invalidateStock } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
`;

w(
  path.join(stock, "stock.types.ts"),
  `${hdr}
${slice(lines, 13, 131)}
`
);

w(
  path.join(stock, "stock.list.ts"),
  `${hdr}
import type { StockRow } from "./stock.types";

${slice(lines, 26, 87)}
`
);

let balHelpers = `${hdr}
import type {
  StockBalanceByWhRow,
  StockBalanceQtyMode,
  StockBalanceSummaryRow,
  StockBalanceTotals,
  StockBalanceValuationRow,
  WarehouseStockPurpose
} from "./stock.types";

${slice(lines, 133, 380)}
`;
balHelpers = balHelpers
  .replace(/^type BalanceFilterOpts/m, "export type BalanceFilterOpts")
  .replace(/^async function fetchWarehouseIdsForBalances/m, "export async function fetchWarehouseIdsForBalances")
  .replace(/^function buildProductWhere/m, "export function buildProductWhere")
  .replace(/^async function fetchRawBalanceLines/m, "export async function fetchRawBalanceLines")
  .replace(/^function aggregateByProduct/m, "export function aggregateByProduct")
  .replace(/^function filterAggByQtyMode/m, "export function filterAggByQtyMode")
  .replace(/^function filterWhByQtyMode/m, "export function filterWhByQtyMode")
  .replace(/^function sortAggRows/m, "export function sortAggRows")
  .replace(/^function totalsFromAgg/m, "export function totalsFromAgg")
  .replace(/^function linesToByWarehouseRows/m, "export function linesToByWarehouseRows")
  .replace(/^function sortByWhRows/m, "export function sortByWhRows")
  .replace(/^function totalsFromByWh/m, "export function totalsFromByWh");
w(path.join(stock, "stock.balances.helpers.ts"), balHelpers);

w(
  path.join(stock, "stock.balances.ts"),
  `${hdr}
import type {
  StockBalanceByWhRow,
  StockBalancesListResponse,
  StockBalanceSummaryRow,
  StockBalanceTotals,
  StockBalanceValuationRow
} from "./stock.types";
import {
  type BalanceFilterOpts,
  aggregateByProduct,
  fetchRawBalanceLines,
  filterAggByQtyMode,
  filterWhByQtyMode,
  linesToByWarehouseRows,
  sortAggRows,
  sortByWhRows,
  totalsFromAgg,
  totalsFromByWh
} from "./stock.balances.helpers";

${slice(lines, 382, 658)}
`
);

w(
  path.join(stock, "stock.movements.ts"),
  `${hdr}
${slice(lines, 660, 839)}
`
);

w(
  path.join(stock, "stock.service.ts"),
  `/**
 * Domain: Stock (qoldiqlar, harakatlar, inventarizatsiya).
 * Boundary: route → RBAC; servis → Prisma + raw SQL, Redis invalidatsiya.
 */
export * from "./stock.types";
export * from "./stock.list";
export * from "./stock.balances.helpers";
export * from "./stock.balances";
export * from "./stock.movements";
${slice(lines, 841, lines.length)}
`
);

console.log("Phase 23 stock split (partial) done.");
