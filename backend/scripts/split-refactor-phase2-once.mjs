/**
 * Reja 2-bosqich: 400+ qatorli fayllarni bo‘lish
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "../src/modules");

function readLines(p) {
  return fs.readFileSync(p, "utf8").split(/\r?\n/);
}
function slice(lines, a, b) {
  return lines.slice(a - 1, b).join("\n");
}
function write(p, content) {
  fs.writeFileSync(p, content.endsWith("\n") ? content : content + "\n");
}

// --- order.meta → order.lines + order.meta ---
const metaPath = path.join(root, "orders/domain/order.meta.ts");
const metaLines = readLines(metaPath);
const metaHeader = slice(metaLines, 1, 68);

const linesImports = `${metaHeader}
import {
  bonusGiftMapToJson,
  enrichOrderDetailRow,
  parseBonusGiftSelectionsJson,
  roundOrderMoney,
  validateBonusGiftOverrides
} from "./order.detail-mappers";
import {
  orderDetailInclude,
  type OrderDetailLoaded,
  type OrderDetailRow,
  type UpdateOrderLinesInput
} from "./order.types";
`;

write(
  path.join(root, "orders/domain/order.lines.ts"),
  `${linesImports}
export const ORDER_LINES_EDITABLE_STATUSES = new Set(["new", "confirmed"]);

${slice(metaLines, 72, 402)}
`
);

const metaImports = `${metaHeader}
import { ORDER_LINES_EDITABLE_STATUSES } from "./order.lines";
import { enrichOrderDetailRow } from "./order.detail-mappers";
import {
  orderDetailInclude,
  type OrderDetailLoaded,
  type OrderDetailRow,
  type UpdateOrderMetaInput
} from "./order.types";
import { assertOrderWarehouseBlockAssignment } from "./order.detail-mappers";
`;

write(
  path.join(root, "orders/domain/order.meta.ts"),
  `${metaImports}

${slice(metaLines, 408, metaLines.length)}
`
);

// --- order-bonus-rules → context + discount + qty-sum ---
const bonusPath = path.join(root, "orders/order-bonus-rules.ts");
const bonusLines = readLines(bonusPath);
const bonusHeader = slice(bonusLines, 1, 12);

const contextBody = slice(bonusLines, 13, 631);
write(
  path.join(root, "orders/order-bonus-context.ts"),
  `${bonusHeader}

${contextBody}
`
);

const discountBody = slice(bonusLines, 633, 730);
write(
  path.join(root, "orders/order-bonus-discount.ts"),
  `${bonusHeader}
import type { ProductLite } from "./order-bonus-context";
import {
  type BonusRuleRow,
  type OrderAgentBonusContext,
  type OrderBonusPrereqEnv,
  type PaidLineDraft,
  ruleBlockedByOncePerClient,
  ruleMatchesClient,
  ruleMatchesOrderAgentScope,
  ruleMatchesOrderProductScope,
  ruleNeedsOrderContext,
  ruleTreeSatisfiedForOrder,
  roundMoney
} from "./order-bonus-context";

${discountBody}
`
);

const qtySumBody = slice(bonusLines, 732, bonusLines.length);
write(
  path.join(root, "orders/order-bonus-qty-sum.ts"),
  `${bonusHeader}
import { getProductPrice } from "../products/product-prices.service";
import {
  type BonusLineDraft,
  type BonusRuleRow,
  type OrderAgentBonusContext,
  type OrderBonusPrereqEnv,
  type PaidLineDraft,
  type ProductLite,
  effectivePurchasedQtyForQtyRule,
  effectiveSubtotalForSumMinRule,
  fetchClientMonthMerchandiseSubtotalExclOrder,
  loadAvailableQtyByProductId,
  ruleBlockedByOncePerClient,
  ruleMatchesClient,
  ruleMatchesOrderAgentScope,
  ruleMatchesOrderProductScope,
  ruleTreeSatisfiedForOrder,
  roundMoney,
  QTY_AGGREGATE_PURCHASED_PID
} from "./order-bonus-context";

${qtySumBody}
`
);

write(
  path.join(root, "orders/order-bonus-rules.ts"),
  `/** Bonus rules — barrel (context + discount + qty/sum). */
export * from "./order-bonus-context";
export * from "./order-bonus-discount";
export * from "./order-bonus-qty-sum";
`
);

// Fix context: export types and helpers used by discount/qty-sum
let ctx = fs.readFileSync(path.join(root, "orders/order-bonus-context.ts"), "utf8");
const exportFns = [
  "fetchClientMonthMerchandiseSubtotalExclOrder",
  "fetchClientMonthPaidQtyAggregateExclOrder",
  "fetchClientMonthPaidQtyByProductExclOrder",
  "loadAvailableQtyByProductId",
  "findWinningDiscountRuleWithPrereqs",
  "ensurePrereqRule",
  "ruleTreeSatisfiedForOrder",
  "ruleMatchesAsStandaloneAutoBonusForOrder",
  "ruleBlockedByOncePerClient",
  "ruleMatchesClient",
  "ruleMatchesOrderAgentScope",
  "ruleMatchesOrderProductScope",
  "ruleNeedsOrderContext",
  "pickGiftFromAllowedList",
  "resolveQtyGiftProductId",
  "buildBonusGiftSwapOptions",
  "validateBonusGiftOverrides"
];
for (const name of exportFns) {
  ctx = ctx.replace(new RegExp(`^(async )?function ${name}\\b`, "m"), `export $1function ${name}`);
}
ctx = ctx.replace(/^function ruleBlockedByOncePerClient/m, "export function ruleBlockedByOncePerClient");
ctx = ctx.replace(/^function ruleMatchesClient/m, "export function ruleMatchesClient");
ctx = ctx.replace(/^function ruleMatchesOrderAgentScope/m, "export function ruleMatchesOrderAgentScope");
ctx = ctx.replace(/^function ruleMatchesOrderProductScope/m, "export function ruleMatchesOrderProductScope");
ctx = ctx.replace(/^function ruleNeedsOrderContext/m, "export function ruleNeedsOrderContext");
ctx = ctx.replace(/^function ruleTreeSatisfiedForOrder/m, "export function ruleTreeSatisfiedForOrder");
ctx = ctx.replace(/^async function ensurePrereqRule/m, "export async function ensurePrereqRule");
ctx = ctx.replace(/^function ruleMatchesAsStandaloneAutoBonusForOrder/m, "export function ruleMatchesAsStandaloneAutoBonusForOrder");
ctx = ctx.replace(/^export type OrderBonusPrereqEnv/m, "export type OrderBonusPrereqEnv");
ctx = ctx.replace(/^export const activeRuleWhere/m, "export const activeRuleWhere");
if (!ctx.includes("export const QTY_AGGREGATE")) {
  ctx = ctx.replace(/^export const QTY_AGGREGATE_PURCHASED_PID/m, "export const QTY_AGGREGATE_PURCHASED_PID");
}
fs.writeFileSync(path.join(root, "orders/order-bonus-context.ts"), ctx);

// --- staff.crud → crud + patches ---
const crudPath = path.join(root, "staff/staff.crud.ts");
const crudLines = readLines(crudPath);
const crudHeaderEnd = 59; // through shared imports
const crudHeader = slice(crudLines, 1, crudHeaderEnd);

write(
  path.join(root, "staff/staff.crud.ts"),
  `${crudHeader}

${slice(crudLines, 60, 714)}
`
);

const patchesImports = `${slice(crudLines, 1, 59)}

import type {
  CreateStaffInput,
  StaffCreateResult,
  StaffKind,
  StaffRow
} from "./staff.shared";
import {
  SKLADCHIK_WAREHOUSE_LINK_ROLE,
  STAFF_KINDS_WITH_WORK_SLOT,
  applyTradeDirectionPatch,
  assertExpeditorMobileTradeDirections,
  assertWarehousesBelongToTenant,
  kindRole,
  mergePriceTypesForUser,
  normalizeAgentEntitlementsInput,
  normalizePositiveIntIds,
  normalizePriceTypes,
  parseEntitlements,
  parseExpeditorAssignmentRules,
  parsePriceTypesJson,
  refStringListFromTenantSettings,
  syncSkladchikWarehouseLinks,
  toFio,
  tradeDirectionDisplayFromRef,
  tradeDirectionForCreate,
  validateAgentEntitlements,
  validateExpeditorAssignmentRules
} from "./staff.shared";
import { getStaffRow } from "./staff.crud";
`;

write(
  path.join(root, "staff/staff.patches.ts"),
  `${patchesImports}

${slice(crudLines, 715, crudLines.length)}
`
);

// staff.service barrel
write(
  path.join(root, "staff/staff.service.ts"),
  `/** Staff domain — shared + CRUD + patches + kind re-export. */
export * from "./staff.shared";
export * from "./staff.crud";
export * from "./staff.patches";
export * from "./staff.agent";
export * from "./staff.expeditor";
export * from "./staff.operator";
export * from "./staff.skladchik";
export * from "./staff.core";
`
);

// domain index
write(
  path.join(root, "orders/domain/index.ts"),
  `export * from "./order.types";
export * from "./order.detail-mappers";
export * from "./order.query";
export * from "./order.lifecycle";
export * from "./order.lines";
export * from "./order.meta";
export * from "./order.nakladnoy";
export * from "./order.create";
`
);

console.log("Phase 2 split done. Run: cd backend && npx tsc --noEmit");
