import { prisma } from "../../config/database";
import { logger } from "../../config/logger";
import { notifyUsers } from "../payroll/payroll.notify";

export type BonusRuleChange = "created" | "updated" | "activated" | "deactivated";

const TITLE: Record<BonusRuleChange, string> = {
  created: "🎁 Новый бонус",
  updated: "🎁 Бонус изменён",
  activated: "🎁 Бонус включён",
  deactivated: "⛔ Бонус отключён"
};

function fmt(d: Date | null | undefined): string {
  if (!d) return "";
  const x = new Date(d);
  return `${String(x.getUTCDate()).padStart(2, "0")}.${String(x.getUTCMonth() + 1).padStart(2, "0")}.${x.getUTCFullYear()}`;
}

/**
 * Bonus qoidasi o'zgarganda dala xodimlariga (agent + supervayzer).
 * Tanlangan mijozlarga tegishli qoida — faqat shu mijozlar agentlari va ularning supervayzerlariga.
 */
export async function notifyBonusRuleChange(tenantId: number, ruleId: number, change: BonusRuleChange, actorUserId: number | null): Promise<void> {
  try {
    const rule = await prisma.bonusRule.findFirst({
      where: { id: ruleId, tenant_id: tenantId },
      select: { id: true, name: true, valid_from: true, valid_to: true, target_all_clients: true, selected_client_ids: true }
    });
    if (!rule) return;
    let recipients: number[];
    if (!rule.target_all_clients && rule.selected_client_ids.length > 0) {
      const clients = await prisma.client.findMany({
        where: { tenant_id: tenantId, id: { in: rule.selected_client_ids }, agent_id: { not: null } },
        select: { agent: { select: { id: true, supervisor_user_id: true, is_active: true } } }
      });
      const ids = new Set<number>();
      for (const c of clients) {
        if (!c.agent?.is_active) continue;
        ids.add(c.agent.id);
        if (c.agent.supervisor_user_id) ids.add(c.agent.supervisor_user_id);
      }
      recipients = [...ids];
    } else {
      const users = await prisma.user.findMany({
        where: { tenant_id: tenantId, is_active: true, role: { in: ["agent", "supervisor"] } },
        select: { id: true },
        take: 2000
      });
      recipients = users.map((u) => u.id);
    }
    if (actorUserId) recipients = recipients.filter((id) => id !== actorUserId);
    if (recipients.length === 0) return;
    const period = rule.valid_from || rule.valid_to ? `Период: ${fmt(rule.valid_from) || "…"} — ${fmt(rule.valid_to) || "…"}` : null;
    await notifyUsers(tenantId, recipients, {
      title: `${TITLE[change]}: ${rule.name}`.slice(0, 200),
      body: period,
      href: `/settings/bonus-rules/${rule.id}/edit`
    });
  } catch (e) {
    logger.warn({ err: e, tenantId, ruleId }, "bonus rule notify failed");
  }
}
