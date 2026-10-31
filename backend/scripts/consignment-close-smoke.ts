/**
 * Aksit jadvali bo‘yicha: yopilish daqiqasidan 1 daqiqa oldin yopilmaydi,
 * hozir (jadval o‘tgan) yopiladi. Agent bayrog‘i va status qatori tiklanadi.
 */
import { prisma } from "../src/config/database";
import { reconcileAgentConsignmentMonthClosure } from "../src/modules/consignment/consignment-month-closure.service";
import {
  parseConsignmentCloseSchedule,
  utcConsignmentPeriodCloseAt
} from "../src/modules/consignment/consignment-settings";
import { loadTimezoneFromSettingsJson } from "../src/modules/tenant-settings/tenant-timezone";

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: "aksit" } });
  if (!tenant) throw new Error("tenant aksit topilmadi");

  const schedule = parseConsignmentCloseSchedule(tenant.settings);
  const tz = loadTimezoneFromSettingsJson(tenant.settings);
  const year = 2026;
  const month = 10;
  const closeAt = utcConsignmentPeriodCloseAt(year, month, schedule, tz);
  const now = new Date();
  if (!(now >= closeAt)) {
    throw new Error(`hali yopilish vaqti kelmagan: ${closeAt.toISOString()}`);
  }

  const agent = await prisma.user.findFirst({
    where: { tenant_id: tenant.id, role: "agent", is_active: true },
    select: { id: true, name: true, consignment: true },
    orderBy: { id: "asc" }
  });
  if (!agent) throw new Error("faol agent yo‘q");

  const existing = await prisma.agentConsignmentMonthStatus.findUnique({
    where: {
      tenant_id_agent_user_id_year_month: {
        tenant_id: tenant.id,
        agent_user_id: agent.id,
        year,
        month
      }
    }
  });

  await prisma.user.update({ where: { id: agent.id }, data: { consignment: true } });
  try {
    const early = await reconcileAgentConsignmentMonthClosure(
      tenant.id,
      agent.id,
      year,
      month,
      schedule,
      new Date(closeAt.getTime() - 60_000),
      tz
    );
    if (existing?.period_closed_at == null && early.period_closed_at != null) {
      throw new Error(`1 daqiqa oldin yopildi: ${early.period_closed_at.toISOString()}`);
    }

    const snap = await reconcileAgentConsignmentMonthClosure(
      tenant.id,
      agent.id,
      year,
      month,
      schedule,
      now,
      tz
    );
    const got = snap.period_closed_at?.toISOString() ?? null;
    if (got !== closeAt.toISOString()) {
      throw new Error(`kutilgan ${closeAt.toISOString()}, chiqdi ${got}`);
    }

    console.log(
      JSON.stringify({
        ok: true,
        tenant: tenant.slug,
        timezone: tz,
        schedule,
        closeAt: closeAt.toISOString(),
        agentId: agent.id,
        agentName: agent.name,
        period_closed_at: got,
        debt_cleared_at: snap.debt_cleared_at?.toISOString() ?? null,
        early_stayed_open: early.period_closed_at == null
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
    await prisma.$disconnect();
  }
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
