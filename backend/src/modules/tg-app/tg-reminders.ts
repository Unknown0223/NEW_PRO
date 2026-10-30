import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { logger } from "../../config/logger";
import { resolveBotTenant } from "./tg-identity";
import { notifyClientRaw, notifyStaffTelegram } from "./tg-notify";
import { esc, fmtDate, money } from "./tg-ui.pure";

type DueRow = { client_id: number; agent_id: number | null; number: string; due: Date; unpaid: Prisma.Decimal };

/** Muddati 2 kun ichida yoki o'tib ketgan konsignatsiya qarzlari (faqat Telegram ulangan mijozlar / xodimlar). */
async function loadDue(tenantId: number): Promise<DueRow[]> {
  const until = new Date(Date.now() + 2 * 86400_000);
  return prisma.$queryRaw<DueRow[]>`
    SELECT o.client_id, o.agent_id, o.number, o.consignment_due_date AS due,
      GREATEST(o.total_sum - COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa
        WHERE pa.tenant_id = ${tenantId} AND pa.order_id = o.id), 0), 0)::decimal(15,2) AS unpaid
    FROM orders o
    WHERE o.tenant_id = ${tenantId} AND o.order_type = 'order' AND o.is_consignment = true
      AND o.status = 'delivered' AND o.consignment_due_date IS NOT NULL AND o.consignment_due_date <= ${until}
      AND (
        EXISTS (SELECT 1 FROM tg_client_links l WHERE l.tenant_id = ${tenantId} AND l.client_id = o.client_id AND l.status = 'active')
        OR EXISTS (SELECT 1 FROM telegram_staff_links s WHERE s.tenant_id = ${tenantId} AND s.user_id = o.agent_id)
      )
    LIMIT 5000
  `;
}

/** Kunlik eslatma: mijozga — o'z qarzlari, agentga — mijozlari bo'yicha. Eski eslatma yangisi bilan almashtiriladi. */
export async function runConsignmentReminders(): Promise<{ clients: number; agents: number }> {
  const tenant = await resolveBotTenant();
  if (!tenant) return { clients: 0, agents: 0 };
  const rows = (await loadDue(tenant.id)).filter((r) => Number(r.unpaid) > 0.009);
  const now = Date.now();
  const byClient = new Map<number, DueRow[]>();
  const byAgent = new Map<number, DueRow[]>();
  for (const r of rows) {
    byClient.set(r.client_id, [...(byClient.get(r.client_id) ?? []), r]);
    if (r.agent_id) byAgent.set(r.agent_id, [...(byAgent.get(r.agent_id) ?? []), r]);
  }

  for (const [clientId, list] of byClient) {
    const overdue = list.filter((r) => r.due.getTime() < now);
    const total = list.reduce((s, r) => s + Number(r.unpaid), 0);
    const lines = list.slice(0, 8).map((r) => `${r.due.getTime() < now ? "🔴" : "🟡"} №${esc(r.number)} · ${money(r.unpaid)} · ${fmtDate(r.due)}`);
    await notifyClientRaw(
      tenant.id,
      clientId,
      "reminder",
      {
        uz: `⏰ <b>Konsignatsiya to‘lovi eslatmasi</b>\nJami: <b>${money(total)}</b>${overdue.length ? ` · muddati o‘tgan: ${overdue.length}` : ""}\n\n${lines.join("\n")}`,
        ru: `⏰ <b>Напоминание об оплате консигнации</b>\nИтого: <b>${money(total)}</b>${overdue.length ? ` · просрочено: ${overdue.length}` : ""}\n\n${lines.join("\n")}`
      },
      "rem:cons"
    ).catch((e) => logger.debug({ err: e }, "client reminder failed"));
  }

  for (const [agentId, list] of byAgent) {
    const overdue = list.filter((r) => r.due.getTime() < now);
    const total = list.reduce((s, r) => s + Number(r.unpaid), 0);
    await notifyStaffTelegram(
      tenant.id,
      agentId,
      "consignment",
      {
        uz: `⏰ <b>Konsignatsiya muddatlari</b>\n${list.length} ta nakladnoy · ${money(total)}\n🔴 Muddati o‘tgan: ${overdue.length}\n\nBatafsil: 🧾 Konsignatsiyam`,
        ru: `⏰ <b>Сроки консигнации</b>\n${list.length} накладных · ${money(total)}\n🔴 Просрочено: ${overdue.length}\n\nПодробнее: 🧾 Моя консигнация`
      },
      "rem:agent-cons"
    ).catch((e) => logger.debug({ err: e }, "agent reminder failed"));
  }
  return { clients: byClient.size, agents: byAgent.size };
}
