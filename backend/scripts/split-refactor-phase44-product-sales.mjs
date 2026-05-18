/**
 * v4 — product-sales-report.service bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const mod = path.join(root, "../src/modules/reports");
const backupPath = path.join(mod, "product-sales-report.service.backup.ts");

function read(p) {
  return fs.readFileSync(p, "utf8").split(/\r?\n/);
}
function slice(lines, a, b) {
  return lines.slice(a - 1, b).join("\n");
}
function w(p, c) {
  fs.writeFileSync(p, c.endsWith("\n") ? c : `${c}\n`);
}

if (!fs.existsSync(backupPath)) {
  throw new Error("Run backup copy first");
}
const lines = read(backupPath);

const hdr = `import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES, ORDER_TYPES, ORDER_TYPE_LABELS } from "../orders/order-status";
import {
  paymentMethodStorageKey,
  priceTypeEntriesFromUnknown,
  priceTypeKey,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries,
  resolvePaymentMethodRefToLabel
} from "../tenant-settings/finance-refs";
import type { ReportActor } from "./client-sales-4-report.service";
`;

const hdrFilters = `${hdr}import { getRedisForApp } from "../../lib/redis-cache";
import { mergeTerritoryFilterOptions } from "./territory-nodes";
`;

w(path.join(mod, "product-sales.types.ts"), slice(lines, 17, 47));

let utilsBody = slice(lines, 49, 103);
utilsBody = utilsBody
  .replace(/^function /gm, "export function ")
  .replace(/^const KNOWN_ORDER_TYPES/gm, "export const KNOWN_ORDER_TYPES")
  .replace(/^const ORDER_STATUS_LABEL_RU/gm, "export const ORDER_STATUS_LABEL_RU");

w(
  path.join(mod, "product-sales.helpers.ts"),
  `import { Prisma } from "@prisma/client";
import { ORDER_TYPES, ORDER_TYPE_LABELS } from "../orders/order-status";

${utilsBody}
`
);

let whereBody = slice(lines, 105, 308);
whereBody = whereBody.replace(/^function /gm, "export function ").replace(/^const STATUS_CTE/gm, "export const STATUS_CTE");

w(
  path.join(mod, "product-sales.where.ts"),
  `${hdr}import type { ProductSalesReportFilters } from "./product-sales.types";
import { parseDate, parseDateEnd, sqlInStrings, strList } from "./product-sales.helpers";

${whereBody}
`
);

const statusCte = `export const STATUS_CTE = Prisma.sql\`
  status_logs AS (
    SELECT
      sl.order_id,
      MIN(CASE WHEN sl.to_status = 'delivering' THEN sl.created_at END) AS shipped_at,
      MIN(CASE WHEN sl.to_status = 'delivered' THEN sl.created_at END) AS delivered_at
    FROM order_status_logs sl
    GROUP BY sl.order_id
  )\`;`;

let aggBody = `${statusCte}\n\n${slice(lines, 368, 371)}\n\n${slice(lines, 537, 726)}`;
aggBody = aggBody
  .replace(/^async function runProductAggCore/m, "export async function runProductAggCore")
  .replace(/^function rowToDto/m, "export function rowToDto")
  .replace(/^function decStr/m, "export function decStr")
  .replace(/^type RowRaw /m, "export type RowRaw ");

w(
  path.join(mod, "product-sales.agg.ts"),
  `${hdr}import type { ProductSalesReportFilters } from "./product-sales.types";
import {
  buildOrderWhereSql,
  productFilterSql,
  sortOrderSql
} from "./product-sales.where";

${aggBody}
`
);

w(
  path.join(mod, "product-sales.parse.ts"),
  `import type { ProductSalesReportFilters } from "./product-sales.types";
import { intList, parseOrderTypesParam, strList } from "./product-sales.helpers";

${slice(lines, 320, 366)}
`
);

w(
  path.join(mod, "product-sales.filters.ts"),
  `${hdrFilters}import { KNOWN_ORDER_TYPES, ORDER_STATUS_LABEL_RU, orderTypeLabelRu } from "./product-sales.helpers";

${slice(lines, 373, 535)}
`
);

w(
  path.join(mod, "product-sales.report.ts"),
  `${hdr}import type { ProductSalesReportFilters } from "./product-sales.types";
import { decStr, rowToDto, runProductAggCore, STATUS_CTE } from "./product-sales.agg";
import { buildOrderWhereSql, productFilterSql } from "./product-sales.where";

${slice(lines, 728, 845)}
`
);

let exportBody = slice(lines, 847, 909);
exportBody = exportBody.replace(/^const EXPORT_MAX/gm, "export const EXPORT_MAX");

w(
  path.join(mod, "product-sales.export.ts"),
  `import * as XLSX from "xlsx";
import type { ReportActor } from "./client-sales-4-report.service";
import { rowToDto, runProductAggCore } from "./product-sales.agg";
import { parseProductSalesReportQuery } from "./product-sales.parse";

${exportBody}
`
);

w(
  path.join(mod, "product-sales-report.service.ts"),
  `export * from "./product-sales.types";
export * from "./product-sales.helpers";
export * from "./product-sales.where";
export * from "./product-sales.agg";
export * from "./product-sales.parse";
export * from "./product-sales.filters";
export * from "./product-sales.report";
export * from "./product-sales.export";
`
);

console.log("Phase 44 product-sales split done.");
