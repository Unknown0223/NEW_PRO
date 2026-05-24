import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pay = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/payments");
const lines = fs.readFileSync(path.join(pay, "payment-allocations.service.backup.ts"), "utf8").split(/\r?\n/);
const slice = (a, b) => lines.slice(a - 1, b).join("\n");

const hdr = `import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";
`;

let helpers = slice(67, 99);
helpers = helpers
  .replace(/^async function assertTenantAccess/m, "export async function assertTenantAccess")
  .replace(/^async function getAllocatedForOrder/m, "export async function getAllocatedForOrder")
  .replace(/^async function getAllocatedForPayment/m, "export async function getAllocatedForPayment");

fs.writeFileSync(
  path.join(pay, "payment-allocations.helpers.ts"),
  `${hdr}
import type { AllocationMode } from "./payment-allocations.types";

export function normalizeAllocationMode(raw: AllocationMode | undefined): AllocationMode {
  return raw === "cash" || raw === "consignment" ? raw : "none";
}

export function dueSortTime(order: {
  consignment_due_date?: Date | null;
  created_at?: Date | null;
}): number {
  return (order.consignment_due_date ?? order.created_at ?? new Date(0)).getTime();
}

${helpers}
`
);

const candidateType = `type AllocationCandidateOrder = {
  id: number;
  number: string;
  total_sum: Prisma.Decimal;
  created_at: Date;
  consignment_due_date: Date | null;
  is_consignment: boolean;
};
`;

fs.writeFileSync(
  path.join(pay, "payment-allocations.open.ts"),
  `${hdr}
import type { AllocationMode, OpenAllocationOrderRow } from "./payment-allocations.types";
import {
  dueSortTime,
  getAllocatedForOrder,
  normalizeAllocationMode
} from "./payment-allocations.helpers";

${candidateType}

${slice(103, 177)}

${slice(179, 250).replace(/^async function getCandidateOrdersForAllocation/m, "export async function getCandidateOrdersForAllocation")}
`
);

const allocHdr = `${hdr}
import type { AllocationMode, PaymentAllocationRow } from "./payment-allocations.types";
import {
  assertTenantAccess,
  getAllocatedForOrder,
  getAllocatedForPayment,
  normalizeAllocationMode
} from "./payment-allocations.helpers";
import { getCandidateOrdersForAllocation } from "./payment-allocations.open";
`;

fs.writeFileSync(path.join(pay, "payment-allocations.allocate.ts"), `${allocHdr}${slice(252, 390)}\n`);

fs.writeFileSync(
  path.join(pay, "payment-allocations.read.ts"),
  `${hdr}
import type { PaymentAllocationRow } from "./payment-allocations.types";
import { assertTenantAccess } from "./payment-allocations.helpers";

${slice(394, 423)}
`
);

fs.writeFileSync(
  path.join(pay, "payment-allocations.batch.ts"),
  `${hdr}
import type { PaymentAllocationRow } from "./payment-allocations.types";
import { assertTenantAccess } from "./payment-allocations.helpers";
import { allocatePayment } from "./payment-allocations.allocate";

${slice(427, 451)}
`
);

fs.writeFileSync(
  path.join(pay, "payment-allocations.aging.ts"),
  `${hdr}
import type { AgingBucket, ClientAgingOptions } from "./payment-allocations.types";
import { assertTenantAccess } from "./payment-allocations.helpers";

${slice(455, lines.length)}
`
);

fs.writeFileSync(
  path.join(pay, "payment-allocations.service.ts"),
  `/** Payment allocations — barrel (FIFO, aging). */
export * from "./payment-allocations.types";
export * from "./payment-allocations.helpers";
export * from "./payment-allocations.open";
export * from "./payment-allocations.allocate";
export * from "./payment-allocations.read";
export * from "./payment-allocations.batch";
export * from "./payment-allocations.aging";
`
);

console.log("phase15 allocations split done");
