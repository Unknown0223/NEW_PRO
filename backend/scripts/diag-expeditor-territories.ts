import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const exps = await prisma.user.findMany({
    where: { tenant_id: 1, role: "expeditor", is_active: true },
    select: {
      id: true,
      name: true,
      login: true,
      territory: true,
      expeditor_assignment_rules: true
    },
    take: 30,
    orderBy: { id: "asc" }
  });

  const links = await prisma.slotUserLink.findMany({
    where: { tenant_id: 1, ended_at: null, user_id: { in: exps.map((e) => e.id) } },
    select: {
      user_id: true,
      slot: {
        select: {
          id: true,
          slot_code: true,
          slot_type: true,
          territory: true,
          territories: true,
          deleted_at: true
        }
      }
    }
  });

  const byUser = new Map<number, (typeof links)[number]["slot"]>();
  for (const l of links) {
    if (l.slot.deleted_at) continue;
    byUser.set(l.user_id, l.slot);
  }

  const rows = exps.map((e) => {
    const s = byUser.get(e.id);
    const rules =
      e.expeditor_assignment_rules &&
      typeof e.expeditor_assignment_rules === "object" &&
      !Array.isArray(e.expeditor_assignment_rules)
        ? (e.expeditor_assignment_rules as Record<string, unknown>)
        : {};
    const ruleTerr = Array.isArray(rules.territories) ? rules.territories : [];
    return {
      id: e.id,
      name: e.name,
      login: e.login,
      user_territory: e.territory,
      rule_territories: ruleTerr,
      slot_code: s?.slot_code ?? null,
      slot_type: s?.slot_type ?? null,
      slot_territory_primary: s?.territory ?? null,
      slot_territories_count: Array.isArray(s?.territories) ? s!.territories.length : 0,
      slot_territories_preview: Array.isArray(s?.territories) ? s!.territories.slice(0, 4) : [],
      mismatch_multi_hidden:
        Array.isArray(s?.territories) &&
        s!.territories.length > 1 &&
        (e.territory == null || e.territory === s!.territories[0])
    };
  });

  const slots = await prisma.workSlot.findMany({
    where: { tenant_id: 1, deleted_at: null, slot_type: "expeditor" },
    select: { id: true, slot_code: true, territory: true, territories: true },
    take: 40,
    orderBy: { id: "asc" }
  });

  console.log(
    JSON.stringify(
      {
        expeditor_users: rows.length,
        with_slot: rows.filter((r) => r.slot_code).length,
        with_user_territory: rows.filter((r) => !!r.user_territory).length,
        with_multi_slot_terr: rows.filter((r) => r.slot_territories_count > 1).length,
        rows,
        expeditor_slots: slots.map((s) => ({
          id: s.id,
          code: s.slot_code,
          primary: s.territory,
          n: s.territories?.length ?? 0,
          preview: (s.territories ?? []).slice(0, 4)
        }))
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
