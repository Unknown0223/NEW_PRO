/**
 * Cron bilan bir xil yo‘l: faqat consignment=true agent,
 * yopilish daqiqasidan oldin ochiq, aynan shu daqiqada jadval vaqti yoziladi.
 * Sinovdan keyin agent bayrog‘i va status qatori tiklanadi.
 */
import { prisma } from "../src/config/database";
import { reconcileTenantCurrentAndPreviousClosures } from "../src/modules/consignment/consignment-month-closure.service";
import {
  parseConsignmentCloseSchedule,
  utcConsignmentPeriodCloseAt
} from "../src/modules/consignment/consignment-settings";
import { loadTimezoneFromSettingsJson } from "../src/modules/tenant-settings/tenant-timezone";

async function status(tenantId: number, agentId: number, year: number, month: number) {
  return prisma.agentConsignmentMonthStatus.findUnique({
    where: {
      tenant_id_agent_user_id_year_month: {
        tenant_id: tenantId,
        agent_user_id: agentId,
        year,
        month
      }
    }
  });
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: "aksit" } });
  if (!tenant) throw new Error("tenant aksit topilmadi");

  const schedule = parseConsignmentCloseSchedule(tenant.settings);
  const tz = loadTimezoneFromSettingsJson(tenant.settings);
  const year = 2026;
  const month = 10;
  const closeAt = utcConsignmentPeriodCloseAt(year, month, schedule, tz);

  const agent = await prisma.user.findFirst({
    where: { tenant_id: tenant.id, role: "agent", is_active: true },
    select: { id: true, name: true, consignment: true },
    orderBy: { id: "asc" }
  });
  if (!agent) throw new Error("faol agent yo‘q");

  const existing = await status(tenant.id, agent.id, year, month);

  await prisma.user.update({ where: { id: agent.id }, data: { consignment: false } });
  try {
    await reconcileTenantCurrentAndPreviousClosures(tenant.id, new Date(closeAt.getTime() + 60_000));
    const skipped = await status(tenant.id, agent.id, year, month);
    if (!existing && skipped) {
      throw new Error("consignment o‘chiq agent yopildi");
    }

    await prisma.user.update({ where: { id: agent.id }, data: { consignment: true } });

    await reconcileTenantCurrentAndPreviousClosures(tenant.id, new Date(closeAt.getTime() - 60_000));
    const early = await status(tenant.id, agent.id, year, month);
    if (!existing && early?.period_closed_at) {
      throw new Error(`1 daqiqa oldin yopildi: ${early.period_closed_at.toISOString()}`);
    }

    await reconcileTenantCurrentAndPreviousClosures(tenant.id, closeAt);
    const closed = await status(tenant.id, agent.id, year, month);
    const got = closed?.period_closed_at?.toISOString() ?? null;
    if (got !== closeAt.toISOString()) {
      throw new Error(`kutilgan ${closeAt.toISOString()}, chiqdi ${got}`);
    }

    await reconcileTenantCurrentAndPreviousClosures(tenant.id, new Date());
    const again = await status(tenant.id, agent.id, year, month);
    if (again?.period_closed_at?.toISOString() !== closeAt.toISOString()) {
      throw new Error("qayta tekshiruv yopilish vaqtini o‘zgartirdi");
    }

    console.log(
      JSON.stringify({
        ok: true,
        path: "cron",
        tenant: tenant.slug,
        timezone: tz,
        schedule,
        local: "2026-10-25 17:30 Asia/Tashkent",
        closeAt: closeAt.toISOString(),
        agentId: agent.id,
        agentName: agent.name,
        skipped_when_flag_off: !existing && skipped == null,
        early_stayed_open: early?.period_closed_at == null,
        period_closed_at: got,
        still_same_after_rerun: true
      })
    );
  } finally {
    await prisma.user.update({
      where: { id: agent.id },
      data: { consignment: agent.consignment }
    });
    if (!existing) {
      await prisma.agentConsignmentMonthStatus.deleteMany({
        where: { tenant_id: tenant.id, agent_user_id: agent.id, year, month }
      });
    } else {
      await prisma.agentConsignmentMonthStatus.update({
        where: { id: existing.id },
        data: {
          period_closed_at: existing.period_closed_at,
          debt_cleared_at: existing.debt_cleared_at
        }
      });
    }
    const left = await prisma.user.count({
      where: { tenant_id: tenant.id, role: "agent", is_active: true, consignment: true }
    });
    const row = await status(tenant.id, agent.id, year, month);
    console.log(
      JSON.stringify({
        restored: true,
        consignment_agents_left: left,
        october_row_left: row != null
      })
    );
    await prisma.$disconnect();
  }
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
