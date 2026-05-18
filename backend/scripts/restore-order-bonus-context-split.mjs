import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/orders");
const backup = fs.readFileSync(path.join(dir, "order-bonus-apply.backup.ts"), "utf8").split(/\r?\n/);

function slice(a, b) {
  return backup.slice(a - 1, b).join("\n");
}

const header = slice(1, 12);

let matchBody = slice(211, 503);
matchBody = matchBody
  .replace(/^async function loadAvailableQtyByProductId/m, "export async function loadAvailableQtyByProductId")
  .replace(/^function ruleBlockedByOncePerClient/m, "export function ruleBlockedByOncePerClient")
  .replace(/^function resolveSumRuleGiftProductId/m, "export function resolveSumRuleGiftProductId")
  .replace(/^const activeRuleWhere/m, "export const activeRuleWhere")
  .replace(/^function pickGiftFromAllowedList/m, "export function pickGiftFromAllowedList");

fs.writeFileSync(
  path.join(dir, "order-bonus-context.fetch.ts"),
  `${header}

${slice(15, 209)}
`
);

fs.writeFileSync(
  path.join(dir, "order-bonus-context.match.ts"),
  `${header}
import type { OrderAgentBonusContext, ProductLite } from "./order-bonus-context.fetch";
import {
  effectivePurchasedQtyForQtyRule,
  effectiveSubtotalForSumMinRule,
  ruleMatchesClient,
  ruleNeedsOrderContext
} from "./order-bonus-context.fetch";

${matchBody}
`
);

fs.writeFileSync(
  path.join(dir, "order-bonus-context.prereq.ts"),
  `${header}
import {
  bonusRuleInclude,
  computeQtyBonusForRuleRow,
  mapBonusRuleFull,
  type BonusRuleRow
} from "../bonus-rules/bonus-rules.service";
import { Prisma as PrismaClient } from "@prisma/client";
import {
  effectivePurchasedQtyForQtyRule,
  effectiveSubtotalForSumMinRule,
  ruleMatchesClient,
  ruleNeedsOrderContext
} from "./order-bonus-context.fetch";
import {
  QTY_AGGREGATE_PURCHASED_PID,
  resolveQtyGiftProductId,
  resolveSumRuleGiftProductId,
  ruleBlockedByOncePerClient,
  ruleHasPurchaseScope,
  ruleMatchesOrderAgentScope,
  ruleMatchesOrderProductScope,
  ruleMatchesProduct,
  type OrderBonusPrereqEnv,
  type QtyGiftResolveContext
} from "./order-bonus-context.match";

${slice(505, 632)}
`
);

fs.writeFileSync(
  path.join(dir, "order-bonus-context.ts"),
  `/** Bonus context — barrel (fetch + match + prereq). */
export * from "./order-bonus-context.fetch";
export * from "./order-bonus-context.match";
export * from "./order-bonus-context.prereq";
`
);

console.log("restored");
