/**
 * v4 — returns-enhanced.service bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const mod = path.join(root, "../src/modules/returns");
const mainPath = path.join(mod, "returns-enhanced.service.ts");
const backupPath = path.join(mod, "returns-enhanced.service.backup.ts");

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

const hdr = `import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../../config/database";
import { emitOrderUpdated } from "../../lib/order-event-bus";
import { invalidateDashboard, invalidateStock } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { assertReturnProductsInterchangeableStrict } from "../products/product-catalog.service";
import { canTransitionOrderStatus, normalizeOrderType } from "../orders/order-status";
`;

w(
  path.join(mod, "returns-enhanced.types.ts"),
  `${slice(lines, 10, 123)}
${slice(lines, 1827, 1834)}
`.replace(/^function effectiveReturnPriceType/m, "export function effectiveReturnPriceType")
);

let helpers = `${hdr}
import type { OrderItemSummary } from "./returns-enhanced.types";

${slice(lines, 127, 255)}
`;
helpers = helpers
  .replace(/^function localDayStart/m, "export function localDayStart")
  .replace(/^function localDayEnd/m, "export function localDayEnd")
  .replace(/^function R\(/m, "export function R(")
  .replace(/^function formatAdjustedQtyString/m, "export function formatAdjustedQtyString")
  .replace(/^function splitReturnLinePaidBonus/m, "export function splitReturnLinePaidBonus")
  .replace(/^function adjustOrderItemsQtyAfterPriorReturns/m, "export function adjustOrderItemsQtyAfterPriorReturns");
w(path.join(mod, "returns-enhanced.helpers.ts"), helpers);

w(
  path.join(mod, "returns-enhanced.warehouse.ts"),
  `${hdr}

${slice(lines, 259, 275)}
`
);

let polki = `${hdr}
import { effectiveReturnPriceType } from "./returns-enhanced.types";
import { R } from "./returns-enhanced.helpers";

${slice(lines, 277, 376)}
`;
polki = polki.replace(/^async function createPolkiMirrorZayavka/m, "export async function createPolkiMirrorZayavka");
w(path.join(mod, "returns-enhanced.polki.ts"), polki);

w(
  path.join(mod, "returns-enhanced.client-data.ts"),
  `${hdr}
import type { ClientReturnsData, OrderItemSummary } from "./returns-enhanced.types";
import { adjustOrderItemsQtyAfterPriorReturns, localDayEnd, localDayStart, R } from "./returns-enhanced.helpers";

${slice(lines, 379, 715)}
`
);

let compute = `${hdr}
import type {
  CreatePeriodReturnBatchLine,
  CreatePeriodReturnLine,
  OrderItemSummary
} from "./returns-enhanced.types";
import { R } from "./returns-enhanced.helpers";

${slice(lines, 723, 976)}
`;
compute = compute
  .replace(/^function scaleReturnLinesToMaxRefund/m, "export function scaleReturnLinesToMaxRefund")
  .replace(/^function physicalQtyFromPeriodLine/m, "export function physicalQtyFromPeriodLine")
  .replace(/^function assertPeriodLineModes/m, "export function assertPeriodLineModes")
  .replace(/^function assertBatchLineModes/m, "export function assertBatchLineModes")
  .replace(/^function priceByProductFromItems/m, "export function priceByProductFromItems")
  .replace(/^function buildPaidBonusAvailability/m, "export function buildPaidBonusAvailability")
  .replace(/^function validateExplicitReturnAgainstItems/m, "export function validateExplicitReturnAgainstItems");
w(path.join(mod, "returns-enhanced.compute.ts"), compute);

const createImports = `import type { CreatePeriodReturnInput, PeriodReturnResult } from "./returns-enhanced.types";
import { effectiveReturnPriceType } from "./returns-enhanced.types";
import { MAX_RETURN_ITEMS } from "./returns-enhanced.types";
import { adjustOrderItemsQtyAfterPriorReturns, R } from "./returns-enhanced.helpers";
import { findReturnWarehouse } from "./returns-enhanced.warehouse";
import { createPolkiMirrorZayavka } from "./returns-enhanced.polki";
import { getClientReturnsData } from "./returns-enhanced.client-data";
import {
  assertPeriodLineModes,
  computeReturnSplitFromOrderSnapshot,
  physicalQtyFromPeriodLine,
  priceByProductFromItems,
  scaleReturnLinesToMaxRefund,
  validateExplicitReturnAgainstItems,
  validateReturnQty
} from "./returns-enhanced.compute";
import { autoMarkReturnedOrders } from "./returns-enhanced.auto-mark";
`;

w(
  path.join(mod, "returns-enhanced.create-period.ts"),
  `${hdr}
${createImports}

${slice(lines, 980, 1309)}
`
);

const batchImports = `import type {
  CreatePeriodReturnBatchInput,
  PeriodReturnBatchResult,
  PeriodReturnResult
} from "./returns-enhanced.types";
import { effectiveReturnPriceType } from "./returns-enhanced.types";
import { MAX_RETURN_ITEMS } from "./returns-enhanced.types";
import { adjustOrderItemsQtyAfterPriorReturns, R } from "./returns-enhanced.helpers";
import { findReturnWarehouse } from "./returns-enhanced.warehouse";
import { createPolkiMirrorZayavka } from "./returns-enhanced.polki";
import { getClientReturnsData } from "./returns-enhanced.client-data";
import {
  assertBatchLineModes,
  computeReturnSplitFromOrderSnapshot,
  physicalQtyFromPeriodLine,
  priceByProductFromItems,
  scaleReturnLinesToMaxRefund,
  validateExplicitReturnAgainstItems,
  validateReturnQty
} from "./returns-enhanced.compute";
import { autoMarkReturnedOrders } from "./returns-enhanced.auto-mark";
`;

w(
  path.join(mod, "returns-enhanced.create-batch.ts"),
  `${hdr}
${batchImports}

${slice(lines, 1312, 1717)}
`
);

let autoMark = `${hdr}
import { localDayEnd, localDayStart } from "./returns-enhanced.helpers";

${slice(lines, 1721, 1823)}
`;
autoMark = autoMark.replace(/^async function autoMarkReturnedOrders/m, "export async function autoMarkReturnedOrders");
w(path.join(mod, "returns-enhanced.auto-mark.ts"), autoMark);

w(
  path.join(mod, "returns-enhanced.full-return.ts"),
  `${hdr}
import type { FullReturnInput, PeriodReturnResult } from "./returns-enhanced.types";
// FullReturnInput in types; PeriodReturnResult for return shape
import { effectiveReturnPriceType } from "./returns-enhanced.types";
import { R } from "./returns-enhanced.helpers";
import { findReturnWarehouse } from "./returns-enhanced.warehouse";

${slice(lines, 1836, 2000)}
`
);

w(
  path.join(mod, "returns-enhanced.service.ts"),
  `/**
 * Domain: Polki / davr vozvratlari (enhanced).
 */
export * from "./returns-enhanced.types";
export * from "./returns-enhanced.helpers";
export * from "./returns-enhanced.warehouse";
export * from "./returns-enhanced.polki";
export * from "./returns-enhanced.client-data";
export * from "./returns-enhanced.compute";
export * from "./returns-enhanced.create-period";
export * from "./returns-enhanced.create-batch";
export * from "./returns-enhanced.auto-mark";
export * from "./returns-enhanced.full-return";
`
);

console.log("Phase 28 returns-enhanced split done.");
