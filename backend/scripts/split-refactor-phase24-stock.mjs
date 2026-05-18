/**
 * v4 — stock.service bosqich 2: import, recommended, by-date, receipt, material.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const stock = path.join(root, "../src/modules/stock");
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

const lines = read(backupPath);
const hdr = `import ExcelJS from "exceljs";
import XLSX from "xlsx";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getRedisForApp, invalidateStock } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { applyStockReceipt } from "./stock.movements";

`;

w(
  path.join(stock, "stock.import.helpers.ts"),
  `${hdr}
${slice(lines, 841, 1090)}
`
);

w(
  path.join(stock, "stock.recommended.ts"),
  `${hdr}
${slice(lines, 1092, 1407)}
`
);

w(
  path.join(stock, "stock.by-date.ts"),
  `${hdr}
${slice(lines, 1409, 1655)}
`
);

w(
  path.join(stock, "stock.receipt-report.ts"),
  `${hdr}
${slice(lines, 1657, 2076)}
`
);

let receiptImport = `${hdr}
${slice(lines, 2077, 2219)}
`;
receiptImport = receiptImport.replace(
  /^async function importPostupleniya2StockReceiptFromSheet/m,
  "export async function importPostupleniya2StockReceiptFromSheet"
);
w(path.join(stock, "stock.receipt-import.ts"), receiptImport);

w(
  path.join(stock, "stock.import.xlsx.ts"),
  `${hdr}
import { importPostupleniya2StockReceiptFromSheet } from "./stock.receipt-import";

${slice(lines, 2220, 2385)}
`
);

w(
  path.join(stock, "stock.material-report.ts"),
  `${hdr}
${slice(lines, 2386, lines.length)}
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
export * from "./stock.import.helpers";
export * from "./stock.recommended";
export * from "./stock.by-date";
export * from "./stock.receipt-report";
export * from "./stock.receipt-import";
export * from "./stock.import.xlsx";
export * from "./stock.material-report";
`
);

console.log("Phase 24 stock split done.");
