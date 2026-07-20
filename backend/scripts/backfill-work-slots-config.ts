/**
 * Faol slot_user_links bo‘yicha user joy sozlamalarini WorkSlot ga ko‘chiradi
 * (faqat slot maydoni bo‘sh bo‘lsa).
 *
 * Usage:
 *   npx.cmd tsx scripts/backfill-work-slots-config.ts
 *   npx.cmd tsx scripts/backfill-work-slots-config.ts --dry-run
 *   npx.cmd tsx scripts/backfill-work-slots-config.ts --all
 */
import { PrismaClient } from "@prisma/client";
import { buildSlotConfigFromUser } from "../src/modules/work-slots/work-slots.config-mirror";

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const allTenants = process.argv.includes("--all");

  const tenants = allTenants
    ? await prisma.tenant.findMany({ select: { id: true, slug: true } })
    : await prisma.tenant.findMany({
        where: { slug: "test1" },
        select: { id: true, slug: true }
      });

  let updated = 0;
  let skipped = 0;

  for (const t of tenants) {
    const links = await prisma.slotUserLink.findMany({
      where: { tenant_id: t.id, ended_at: null },
      select: {
        slot_id: true,
        user: {
          select: {
            territory: true,
            warehouse_id: true,
            return_warehouse_id: true,
            price_type: true,
            agent_price_types: true,
            agent_entitlements: true,
            consignment: true,
            consignment_limit_amount: true,
            consignment_ignore_previous_months_debt: true,
            consignment_close_day: true,
            consignment_close_hour: true,
            consignment_close_minute: true,
            supervisor_user_id: true,
            warehouse_staff_entitlements: true,
            expeditor_assignment_rules: true,
            cash_desk_links: {
              take: 1,
              select: { cash_desk_id: true }
            }
          }
        },
        slot: {
          select: {
            id: true,
            slot_code: true,
            territory: true,
            warehouse_id: true,
            cash_desk_id: true
          }
        }
      }
    });

    for (const link of links) {
      const slot = link.slot;
      const user = link.user;
      const already =
        (slot.territory != null && slot.territory.trim() !== "") ||
        slot.warehouse_id != null ||
        slot.cash_desk_id != null;
      if (already) {
        skipped += 1;
        continue;
      }

      const patch = buildSlotConfigFromUser({
        ...user,
        cash_desk_id: user.cash_desk_links[0]?.cash_desk_id ?? null
      });

      console.log(
        `[${t.slug}] slot ${slot.slot_code} (#${slot.id}) ← user warehouse=${user.warehouse_id} territory=${user.territory ?? "-"}`
      );
      if (!dryRun) {
        await prisma.workSlot.update({ where: { id: slot.id }, data: patch });
      }
      updated += 1;
    }
  }

  console.log(
    `\nDone. ${dryRun ? "DRY-RUN " : ""}updated=${updated} skipped_already_filled=${skipped}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
