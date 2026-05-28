import { prisma } from "../../config/database";
import { ruleMatchesOrderContext } from "./order-automation.engine";
import type { OrderRuleContext } from "./order-automation.types";

export type OrderRestrictedError = Error & {
  rule_id: number;
  rule_name: string;
  message: string;
};

export function orderRestrictedError(ruleId: number, ruleName: string): OrderRestrictedError {
  const err = new Error("ORDER_RESTRICTED") as OrderRestrictedError;
  err.rule_id = ruleId;
  err.rule_name = ruleName;
  return err;
}

/** Faol restriction qoidalaridan birinchi mosini topadi va bloklaydi. */
export async function assertOrderNotRestricted(
  tenantId: number,
  ctx: OrderRuleContext
): Promise<void> {
  const rules = await prisma.orderRestrictionRule.findMany({
    where: { tenant_id: tenantId, is_active: true },
    orderBy: { id: "asc" }
  });
  for (const rule of rules) {
    if (ruleMatchesOrderContext(rule, ctx)) {
      throw orderRestrictedError(rule.id, rule.name);
    }
  }
}
