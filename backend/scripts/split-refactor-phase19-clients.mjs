/**
 * v3 — clients bosqich 3: detail + write.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const clients = path.join(root, "../src/modules/clients");
const mainPath = path.join(clients, "clients.service.ts");

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

w(
  path.join(clients, "clients.detail.ts"),
  `import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE } from "../orders/order-status";
import {
  loadDeliveryDebtByClient,
  mergeLedgerWithUnpaidDelivered
} from "../client-balances/client-balances.service";
import type { ClientListRow } from "./clients.types";
import { parseContactPersonsJson } from "./clients.helpers";
import {
  agentAssignmentSelectFields,
  mapAgentAssignmentsToApi,
  mergeAgentDisplayFromAssignments
} from "./clients.agent-assignments";
import {
  buildClientReconciliationPdfBufferFromLoaded,
  loadClientReconciliation
} from "./client-reconciliation-data";
import { appendClientAuditLog } from "./clients.audit";

${slice(lines, 85, 393)}
`
);

w(
  path.join(clients, "clients.write.ts"),
  `import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  applyTerritoryAutoAssignAfterAddressChange,
  clientUpdateTouchesAddress
} from "../work-slots/work-slots.territory-auto";
import type { AgentAssignmentPatch, ContactPersonSlot } from "./clients.types";
import { normalizePhoneDigits } from "./clients.types";
import { CONTACT_SLOTS, contactPersonsToJson } from "./clients.helpers";
import {
  replaceClientAgentAssignments,
  syncAssignmentSlotOneWithClientRow
} from "./clients.agent-assignments";
import { appendClientAuditLog } from "./clients.audit";
import type { ClientDetailRow } from "./clients.detail";
import { getClientDetail } from "./clients.detail";

${slice(lines, 395, 822)}
`
);

const head = slice(lines, 1, 84);
const tail = slice(lines, 824, lines.length);

w(
  mainPath,
  `${head}
export * from "./clients.detail";
export * from "./clients.write";
${tail}
`
);

console.log("Phase 19 clients detail+write done.");
