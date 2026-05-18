/**
 * Mavjud agentlar uchun WorkSlot + SlotUserLink yaratish.
 * Ishlatish: npx tsx scripts/backfill-work-slots.ts [--tenant-id=N] [--dry]
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slotCodeForUser(code: string | null, userId: number, branch: string | null): string {
  const c = (code ?? "").trim().toUpperCase();
  if (c.length >= 2) return c.slice(0, 32);
  const b = (branch ?? "MAIN").trim().toUpperCase().replace(/\s+/g, "-").slice(0, 8) || "MAIN";
  return `A-${b}-${userId}`.slice(0, 32);
}

async function main() {
  const dry = process.argv.includes("--dry");
  const tenantArg = process.argv.find((a) => a.startsWith("--tenant-id="));
  const tenantFilter = tenantArg ? parseInt(tenantArg.split("=")[1]!, 10) : null;

  const tenants = await prisma.tenant.findMany({
    where: tenantFilter != null ? { id: tenantFilter } : undefined,
    select: { id: true, slug: true }
  });

  let createdSlots = 0;
  let createdLinks = 0;

  for (const t of tenants) {
    const agents = await prisma.user.findMany({
      where: { tenant_id: t.id, role: "agent", is_active: true },
      select: {
        id: true,
        code: true,
        branch: true,
        trade_direction_id: true,
        name: true
      }
    });

    for (const ag of agents) {
      const existingLink = await prisma.slotUserLink.findFirst({
        where: { tenant_id: t.id, user_id: ag.id, ended_at: null },
        select: { id: true }
      });
      if (existingLink) continue;

      let code = slotCodeForUser(ag.code, ag.id, ag.branch);
      let suffix = 0;
      while (
        await prisma.workSlot.findFirst({
          where: { tenant_id: t.id, slot_code: code },
          select: { id: true }
        })
      ) {
        suffix += 1;
        code = `${slotCodeForUser(ag.code, ag.id, ag.branch)}-${suffix}`.slice(0, 32);
      }

      if (dry) {
        console.log(`[dry] tenant=${t.slug} user=${ag.id} slot=${code}`);
        continue;
      }

      const slot = await prisma.workSlot.create({
        data: {
          tenant_id: t.id,
          slot_code: code,
          label: ag.name?.trim() || null,
          branch_code: ag.branch?.trim() || null,
          direction_id: ag.trade_direction_id,
          slot_type: "agent",
          is_active: true
        }
      });
      createdSlots += 1;

      await prisma.slotUserLink.create({
        data: {
          tenant_id: t.id,
          slot_id: slot.id,
          user_id: ag.id
        }
      });
      createdLinks += 1;
    }
  }

  console.log(`Done. slots=${createdSlots} links=${createdLinks} dry=${dry}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
