/**
 * v4 — warehouse-transfers.service bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const mod = path.join(root, "../src/modules/stock");
const mainPath = path.join(mod, "warehouse-transfers.service.ts");
const backupPath = path.join(mod, "warehouse-transfers.service.backup.ts");

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

const hdr = `import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { invalidateStock } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
`;

let helpersBody = `${slice(lines, 109, 114)}\n\n${slice(lines, 116, 187)}`;
helpersBody = helpersBody
  .replace(/^async function assertTransferExists/m, "export async function assertTransferExists")
  .replace(/^async function assertWarehouseForTenant/m, "export async function assertWarehouseForTenant")
  .replace(/^function validateWarehouseDisjoint/m, "export function validateWarehouseDisjoint")
  .replace(/^async function assertSourceStockForLines/m, "export async function assertSourceStockForLines")
  .replace(/^function generateTransferNumber/m, "export function generateTransferNumber");

w(
  path.join(mod, "warehouse-transfers.types.ts"),
  `${slice(lines, 11, 103)}

export type ReceiveAdjustment = {
  product_id: number;
  received_qty?: number | null;
};
`
);

w(path.join(mod, "warehouse-transfers.shared.ts"), `${hdr}\n${helpersBody}\n`);

w(
  path.join(mod, "warehouse-transfers.create.ts"),
  `${hdr}import type { CreateTransferInput } from "./warehouse-transfers.types";
import {
  assertSourceStockForLines,
  assertWarehouseForTenant,
  generateTransferNumber,
  validateWarehouseDisjoint
} from "./warehouse-transfers.shared";

${slice(lines, 193, 266)}
`
);

w(
  path.join(mod, "warehouse-transfers.list.ts"),
  `${hdr}import type { GetTransfersOptions, TransferListRow } from "./warehouse-transfers.types";

${slice(lines, 268, 380)}
`
);

w(
  path.join(mod, "warehouse-transfers.read.ts"),
  `${hdr}import { buildTransferPdf } from "./warehouse-transfers-pdf";
import type { TransferDetail, TransferLineRow, TransferPdfResult } from "./warehouse-transfers.types";

${slice(lines, 382, 499)}
`
);

w(
  path.join(mod, "warehouse-transfers.update.ts"),
  `${hdr}import type { UpdateTransferInput } from "./warehouse-transfers.types";
import {
  assertSourceStockForLines,
  assertTransferExists,
  assertWarehouseForTenant,
  validateWarehouseDisjoint
} from "./warehouse-transfers.shared";

${slice(lines, 505, 608)}
`
);

w(
  path.join(mod, "warehouse-transfers.lifecycle.ts"),
  `${hdr}import type { ReceiveAdjustment } from "./warehouse-transfers.types";
import {
  assertSourceStockForLines,
  assertTransferExists
} from "./warehouse-transfers.shared";

${slice(lines, 614, 704)}

${slice(lines, 710, 887)}
`
);

w(
  path.join(mod, "warehouse-transfers.service.ts"),
  `/**
 * Domain: inter-warehouse stock transfers.
 */
export * from "./warehouse-transfers.types";
export * from "./warehouse-transfers.shared";
export * from "./warehouse-transfers.create";
export * from "./warehouse-transfers.list";
export * from "./warehouse-transfers.read";
export * from "./warehouse-transfers.update";
export * from "./warehouse-transfers.lifecycle";
`
);

console.log("Phase 40 warehouse-transfers split done.");
