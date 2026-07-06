import { prisma } from "../../config/database";

/** Qoida kamida bitta zakazda qo‘llangan bo‘lsa — faqat `valid_to` va `is_active` tahrirlanadi. */
export async function bonusRuleHasBeenUsed(tenantId: number, ruleId: number): Promise<boolean> {
  const byIds = await prisma.order.findFirst({
    where: {
      tenant_id: tenantId,
      applied_auto_bonus_rule_ids: { has: ruleId }
    },
    select: { id: true }
  });
  if (byIds) return true;

  const bySnapshot = await prisma.$queryRaw<{ id: number }[]>`
    SELECT o.id
    FROM orders o
    WHERE o.tenant_id = ${tenantId}
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(o.applied_bonus_rules_snapshot) AS elem
        WHERE (elem->>'rule_id')::int = ${ruleId}
      )
    LIMIT 1
  `;
  return bySnapshot.length > 0;
}
