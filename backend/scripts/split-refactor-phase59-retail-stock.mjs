/**
 * retail-stock.service bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const stock = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/stock");
const backupPath = path.join(stock, "retail-stock.service.backup.ts");
const srcPath = path.join(stock, "retail-stock.service.ts");

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
  return body.replace(/^function /gm, "export function ").replace(/^type /gm, "export type ");
}

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(srcPath, backupPath);
}
const lines = read(backupPath);

w(
  path.join(stock, "retail-stock.types.ts"),
  `${slice(lines, 1, 4)}

${slice(lines, 5, 62).replace(/^type /gm, "export type ")}
`
);

w(
  path.join(stock, "retail-stock.helpers.ts"),
  `${slice(lines, 1, 4)}

import type { RetailStockListQuery } from "./retail-stock.types";

${exportFns(slice(lines, 64, 138))}
`
);

w(
  path.join(stock, "retail-stock.list.ts"),
  `${slice(lines, 1, 4)}

import type { RetailStockCategoryRow, RetailStockDetailedRow, RetailStockListQuery, RetailStockListResult } from "./retail-stock.types";
import { buildWhere, clampLimit, clampPage, toDecimal } from "./retail-stock.helpers";

${slice(lines, 140, 265)}
`
);

w(
  path.join(stock, "retail-stock.template.ts"),
  `${slice(lines, 1, 4)}

${slice(lines, 266, 359)}
`
);

w(
  path.join(stock, "retail-stock.import-helpers.ts"),
  `${slice(lines, 1, 4)}

${exportFns(slice(lines, 302, 358))}
`
);

w(
  path.join(stock, "retail-stock.import.ts"),
  `${slice(lines, 1, 4)}

import { parseImportDateCell } from "./retail-stock.helpers";
import {
  headerIndexByAliases,
  normalizeHeader,
  numFromCell,
  resolveClientId,
  resolveProductId,
  strFromCell,
  type RetailImportResult
} from "./retail-stock.import-helpers";

${slice(lines, 360, 484)}
`
);

w(
  path.join(stock, "retail-stock.export.ts"),
  `${slice(lines, 1, 4)}

import type { RetailStockCategoryRow, RetailStockDetailedRow, RetailStockListQuery } from "./retail-stock.types";
import { listRetailStock } from "./retail-stock.list";

${slice(lines, 485, 546)}
`
);

w(
  path.join(stock, "retail-stock.service.ts"),
  `export * from "./retail-stock.types";
export * from "./retail-stock.helpers";
export * from "./retail-stock.list";
export * from "./retail-stock.template";
export * from "./retail-stock.import-helpers";
export * from "./retail-stock.import";
export * from "./retail-stock.export";
`
);

console.log("Phase 59 retail-stock split done.");
