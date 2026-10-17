/**
 * Backfill: agent.supervisor_user_id → SVR slot.supervisee_agent_slot_ids + sync
 *
 * Usage:
 *   npx tsx scripts/backfill-supervisee-agent-slots.ts --dry-run
 *   npx tsx scripts/backfill-supervisee-agent-slots.ts
 *   npx tsx scripts/backfill-supervisee-agent-slots.ts --tenant=test1
 */
import { PrismaClient } from "@prisma/client";
import { backfillSuperviseeAgentSlotsFromUsers } from "../src/modules/work-slots/work-slots.supervisor-team";

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

  let totalSlots = 0;
  let totalLinks = 0;

  for (const t of tenants) {
    if (dryRun) {
      const agents = await prisma.user.count({
        where: {
          tenant_id: t.id,
          role: "agent",
          is_active: true,
          supervisor_user_id: { not: null }
        }
      });
      console.log(`[${t.slug}] dry-run: agents with supervisor_user_id=${agents}`);
      continue;
    }

    const r = await backfillSuperviseeAgentSlotsFromUsers(t.id);
    console.log(
      `[${t.slug}] slots_updated=${r.slots_updated} links_synced=${r.links_synced}`
    );
    totalSlots += r.slots_updated;
    totalLinks += r.links_synced;
  }

  if (!dryRun) {
    console.log(`DONE slots_updated=${totalSlots} links_synced=${totalLinks}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
