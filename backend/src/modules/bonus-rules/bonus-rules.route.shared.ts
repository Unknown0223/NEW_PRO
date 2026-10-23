import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../config/database";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { ensureAnyPermission } from "../access/ensure-any-permission";

export const catalogRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;

type BonusRuleAction = "view" | "create" | "update" | "delete";

/** `sum` / `discount` — «Скидки», `qty` — «Бонусы» (alohida ruxsat bo'limlari). */
export function bonusRuleSectionKey(type: string): "settings.skidki" | "settings.bonusy" {
  return type === "sum" || type === "discount" ? "settings.skidki" : "settings.bonusy";
}

async function ensureSectionsAction(
  request: FastifyRequest,
  reply: FastifyReply,
  types: Iterable<string>,
  action: BonusRuleAction
): Promise<boolean> {
  const sections = new Set([...types].map(bonusRuleSectionKey));
  for (const section of sections) {
    if (!(await ensureAnyPermission(request, reply, [`${section}.${action}`]))) return false;
  }
  return true;
}

export function ensureBonusRuleTypePermission(
  request: FastifyRequest,
  reply: FastifyReply,
  type: string,
  action: BonusRuleAction
): Promise<boolean> {
  return ensureSectionsAction(request, reply, [type], action);
}

/** Mavjud qoidalar turi bo'yicha (tahrir, faollik, o'chirish, ommaviy) — har bir tur bo'limining ruxsati kerak. */
export async function ensureBonusRuleIdsPermission(
  request: FastifyRequest,
  reply: FastifyReply,
  tenantId: number,
  ids: number[],
  action: BonusRuleAction
): Promise<boolean> {
  const rows = await prisma.bonusRule.findMany({
    where: { tenant_id: tenantId, id: { in: ids } },
    select: { type: true }
  });
  return ensureSectionsAction(request, reply, rows.map((r) => r.type), action);
}
