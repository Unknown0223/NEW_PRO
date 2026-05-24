/**
 * order-bonus-apply.backup.ts → order-bonus-rules.ts + order-bonus-resolve.ts + barrel
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ordersDir = path.join(__dirname, "../src/modules/orders");
const backupPath = path.join(ordersDir, "order-bonus-apply.backup.ts");

if (!fs.existsSync(backupPath)) {
  throw new Error("Run after order-bonus-apply.backup.ts exists (copy from original monolith).");
}

const lines = fs.readFileSync(backupPath, "utf8").split(/\r?\n/);
function slice(a, b) {
  return lines.slice(a - 1, b).join("\n");
}

const header = slice(1, 12);

const exportPrivates = [
  "fetchClientMonthMerchandiseSubtotalExclOrder",
  "fetchClientMonthPaidQtyAggregateExclOrder",
  "fetchClientMonthPaidQtyByProductExclOrder",
  "loadAvailableQtyByProductId",
  "findWinningDiscountRuleWithPrereqs",
  "roundMoney"
];

let rulesBody = slice(13, 1103);
for (const name of exportPrivates) {
  rulesBody = rulesBody.replace(
    new RegExp(`^(async )?function ${name}\\b`, "m"),
    `export $1function ${name}`
  );
}
rulesBody = rulesBody.replace(/^type ProductLite/m, "export type ProductLite");
rulesBody = rulesBody.replace(/^const activeRuleWhere/m, "export const activeRuleWhere");

fs.writeFileSync(
  path.join(ordersDir, "order-bonus-rules.ts"),
  `${header}

${rulesBody}
`
);

const resolveImports = `import { Prisma, Prisma as PrismaClient } from "@prisma/client";
import { bonusRuleInclude, mapBonusRuleFull, type BonusRuleRow } from "../bonus-rules/bonus-rules.service";
import { resolveBonusSlotTakeCount, type BonusStackPolicy } from "./bonus-stack-policy";
import {
  activeRuleWhere,
  applyDiscountWithRule,
  BONUS_SUM_THRESHOLD_TIMEZONE,
  buildSumBonusDraft,
  fetchClientMonthMerchandiseSubtotalExclOrder,
  fetchClientMonthPaidQtyAggregateExclOrder,
  fetchClientMonthPaidQtyByProductExclOrder,
  findQtyBonusPeeks,
  findWinningDiscountRuleWithPrereqs,
  findWinningSumPeek,
  loadAvailableQtyByProductId,
  materializeQtyPeeks,
  roundMoney,
  type BonusLineDraft,
  type OrderAgentBonusContext,
  type OrderBonusPrereqEnv,
  type PaidLineDraft,
  type ProductLite,
  type QtyBonusPeek,
  type SumBonusPeek
} from "./order-bonus-rules";

`;

const resolveBody = slice(1104, lines.length);

fs.writeFileSync(
  path.join(ordersDir, "order-bonus-resolve.ts"),
  `${resolveImports}${resolveBody}
`
);

fs.writeFileSync(
  path.join(ordersDir, "order-bonus-apply.ts"),
  `/** Bonus apply — backward-compatible barrel. */
export * from "./order-bonus-rules";
export * from "./order-bonus-resolve";
`
);

console.log("Bonus split done.");
