/**
 * Reja 2-bosqich: web-agents, snapshot-visits, create-tx stock, bonus match
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staff = path.join(__dirname, "../src/modules/staff");
const dash = path.join(__dirname, "../src/modules/dashboard");
const ordersDomain = path.join(__dirname, "../src/modules/orders/domain");
const orders = path.join(__dirname, "../src/modules/orders");

function read(p) {
  return fs.readFileSync(p, "utf8").split(/\r?\n/);
}
function slice(lines, a, b) {
  return lines.slice(a - 1, b).join("\n");
}
function write(p, c) {
  fs.writeFileSync(p, c.endsWith("\n") ? c : `${c}\n`);
}

// --- staff web-agents bulk / roles ---
const agents = read(path.join(staff, "staff.patches.web-agents.ts"));
const agentsHeader = slice(agents, 1, 18);

write(
  path.join(staff, "staff.patches.web-agents-bulk.ts"),
  `${agentsHeader}

${slice(agents, 20, 314)}
`
);

write(
  path.join(staff, "staff.patches.web-agents-roles.ts"),
  `${agentsHeader}

${slice(agents, 316, agents.length)}
`
);

write(
  path.join(staff, "staff.patches.web-agents.ts"),
  `/** Agent bulk + role patches — barrel. */
export * from "./staff.patches.web-agents-bulk";
export * from "./staff.patches.web-agents-roles";
`
);

// --- dashboard snapshot visits ---
const snap = read(path.join(dash, "dashboard.supervisor.snapshot.ts"));
const snapHeader = slice(snap, 1, 48);

write(
  path.join(dash, "dashboard.supervisor.snapshot-visits.ts"),
  `${snapHeader}
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { bigToNum, clampPct, decToString } from "./dashboard.helpers";
import type {
  SupervisorVisitOutsideDetail,
  SupervisorVisitPlanDetail,
  SupervisorVisitRow
} from "./dashboard.supervisor.scope";

export type SupervisorVisitAndSalesBlocks = {
  salesAgg: Array<{ s: Prisma.Decimal }>;
  cashAgg: Array<{ s: Prisma.Decimal }>;
  paymentBreakdownRows: Array<{ method: string; s: Prisma.Decimal }>;
  mappedVisitRows: SupervisorVisitRow[];
  totals: Omit<SupervisorVisitRow, "agent_id" | "agent_name" | "supervisor_id" | "supervisor_name">;
};

export async function loadSupervisorVisitAndSalesBlocks(
  orderScope: Prisma.Sql,
  visitScope: Prisma.Sql,
  planScope: Prisma.Sql
): Promise<SupervisorVisitAndSalesBlocks> {
${slice(snap, 65, 486).replace(/^/gm, "  ")}
}
`
);

write(
  path.join(dash, "dashboard.supervisor.snapshot.ts"),
  `${snapHeader}
import { loadSupervisorProductAnalyticsBlocks } from "./dashboard.supervisor.snapshot-products";
import { loadSupervisorVisitAndSalesBlocks } from "./dashboard.supervisor.snapshot-visits";

export async function getSupervisorDashboardSnapshot(
  tenantId: number,
  filters: SupervisorDashboardFilters
): Promise<SupervisorDashboardSnapshot> {
${slice(snap, 54, 64)}

  const { salesAgg, cashAgg, paymentBreakdownRows, mappedVisitRows, totals } =
    await loadSupervisorVisitAndSalesBlocks(orderScope, visitScope, planScope);

  const { product_analytics, product_matrix } = await loadSupervisorProductAnalyticsBlocks(orderScope);

${slice(snap, 491, snap.length)}
`
);

// --- order.create-tx stock ---
const tx = read(path.join(ordersDomain, "order.create-tx.ts"));
const txHeader = slice(tx, 1, 50);

write(
  path.join(ordersDomain, "order.create-tx.stock.ts"),
  `${txHeader}
import type { CreateOrderTxParams } from "./order.create-tx";

export async function applyCreateOrderStockInTransaction(
  tx: Prisma.TransactionClient,
  p: CreateOrderTxParams,
  paidAfterDisc: CreateOrderTxParams["lineData"],
  bonusCreates: Array<{
    product_id: number;
    qty: Prisma.Decimal;
    price: Prisma.Decimal;
    total: Prisma.Decimal;
    is_bonus: true;
  }>,
  orderType: CreateOrderTxParams["orderType"],
  isInboundShelfReturn: boolean
): Promise<void> {
  const { tenantId, input } = p;
${slice(tx, 213, 395).replace(/^/gm, "  ")}
}
`
);

write(
  path.join(ordersDomain, "order.create-tx.ts"),
  `${txHeader}
import { applyCreateOrderStockInTransaction } from "./order.create-tx.stock";

${slice(tx, 52, 212)}

  await applyCreateOrderStockInTransaction(
    tx,
    p,
    paidAfterDisc,
    bonusCreates,
    orderType,
    isInboundShelfReturn
  );

${slice(tx, 396, tx.length)}
`
);

// --- order-bonus-context.match scope / gifts ---
const match = read(path.join(orders, "order-bonus-context.match.ts"));
const matchHeader = slice(match, 1, 19);

write(
  path.join(orders, "order-bonus-context.match-scope.ts"),
  `${matchHeader}

${slice(match, 21, 164)}
`
);

write(
  path.join(orders, "order-bonus-context.match-gifts.ts"),
  `${matchHeader}
import type { OrderAgentBonusContext, ProductLite } from "./order-bonus-context.fetch";
import { ruleMatchesClient, ruleNeedsOrderContext } from "./order-bonus-context.fetch";
import {
  ruleHasPurchaseScope,
  ruleMatchesOrderAgentScope,
  ruleMatchesOrderProductScope
} from "./order-bonus-context.match-scope";

${slice(match, 166, match.length)}
`
);

write(
  path.join(orders, "order-bonus-context.match.ts"),
  `/** Bonus rule matching — barrel. */
export * from "./order-bonus-context.match-scope";
export * from "./order-bonus-context.match-gifts";
`
);

console.log("phase5 done");
