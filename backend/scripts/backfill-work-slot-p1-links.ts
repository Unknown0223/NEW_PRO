/**
 * P1 backfill: sales_kpi_plan_targets / kpi_group_agents / agent_route_days / orders → work_slot_id
 *
 * Usage:
 *   npx tsx scripts/backfill-work-slot-p1-links.ts --dry-run
 *   npx tsx scripts/backfill-work-slot-p1-links.ts
 *   npx tsx scripts/backfill-work-slot-p1-links.ts --tenant=test1
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");
const tenantArg = process.argv.find((a) => a.startsWith("--tenant="))?.slice("--tenant=".length);

async function main() {
  const tenants = await prisma.tenant.findMany({
    where: {
      is_active: true,
      ...(tenantArg ? { slug: tenantArg } : {})
    },
    select: { id: true, slug: true }
  });
  if (tenants.length === 0) {
    console.log("NO_TENANTS");
    return;
  }

  let targets = 0;
  let groups = 0;
  let routes = 0;
  let orders = 0;

  for (const t of tenants) {
    const links = await prisma.slotUserLink.findMany({
      where: { tenant_id: t.id, ended_at: null },
      select: { user_id: true, slot_id: true }
    });
    console.log(`[${t.slug}] active links=${links.length}`);

    for (const l of links) {
      if (dryRun) {
        const tc = await prisma.salesKpiPlanTarget.count({
          where: { tenant_id: t.id, user_id: l.user_id, work_slot_id: null }
        });
        const gc = await prisma.kpiGroupAgent.count({
          where: {
            user_id: l.user_id,
            work_slot_id: null,
            kpi_group: { tenant_id: t.id }
          }
        });
        const rc = await prisma.agentRouteDay.count({
          where: { tenant_id: t.id, agent_id: l.user_id, work_slot_id: null }
        });
        targets += tc;
        groups += gc;
        routes += rc;
        continue;
      }

      const tr = await prisma.salesKpiPlanTarget.updateMany({
        where: { tenant_id: t.id, user_id: l.user_id, work_slot_id: null },
        data: { work_slot_id: l.slot_id }
      });
      targets += tr.count;

      const groupIds = (
        await prisma.kpiGroup.findMany({ where: { tenant_id: t.id }, select: { id: true } })
      ).map((g) => g.id);
      if (groupIds.length) {
        const gr = await prisma.kpiGroupAgent.updateMany({
          where: {
            user_id: l.user_id,
            work_slot_id: null,
            kpi_group_id: { in: groupIds }
          },
          data: { work_slot_id: l.slot_id }
        });
        groups += gr.count;
      }

      const rr = await prisma.agentRouteDay.updateMany({
        where: { tenant_id: t.id, agent_id: l.user_id, work_slot_id: null },
        data: { work_slot_id: l.slot_id }
      });
      routes += rr.count;
    }

    // Orders: link covering created_at, else current active
    if (!dryRun) {
      const updatedHist = await prisma.$executeRaw`
        UPDATE orders o
        SET work_slot_id = sul.slot_id
        FROM slot_user_links sul
        WHERE o.tenant_id = ${t.id}
          AND o.work_slot_id IS NULL
          AND o.agent_id IS NOT NULL
          AND sul.tenant_id = o.tenant_id
          AND sul.user_id = o.agent_id
          AND sul.started_at <= o.created_at
          AND (sul.ended_at IS NULL OR sul.ended_at > o.created_at)
      `;
      orders += Number(updatedHist) || 0;

      const updatedActive = await prisma.$executeRaw`
        UPDATE orders o
        SET work_slot_id = sul.slot_id
        FROM slot_user_links sul
        WHERE o.tenant_id = ${t.id}
          AND o.work_slot_id IS NULL
          AND o.agent_id IS NOT NULL
          AND sul.tenant_id = o.tenant_id
          AND sul.user_id = o.agent_id
          AND sul.ended_at IS NULL
      `;
      orders += Number(updatedActive) || 0;
    } else {
      const oc = await prisma.order.count({
        where: { tenant_id: t.id, work_slot_id: null, agent_id: { not: null } }
      });
      orders += oc;
    }
  }

  console.log(
    JSON.stringify({
      dryRun,
      targets,
      groups,
      routes,
      orders,
      tenants: tenants.map((x) => x.slug)
    })
  );
  console.log(dryRun ? "DRY_RUN_DONE" : "BACKFILL_DONE");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
