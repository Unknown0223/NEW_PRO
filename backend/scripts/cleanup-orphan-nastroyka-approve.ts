/**
 * Noto‘g‘ri / bo‘sh description li «nastroyka_utverzhdayushchih» orphanlarni tozalash.
 *   npx tsx scripts/cleanup-orphan-nastroyka-approve.ts
 */
import { prisma } from "../src/config/database";

const ORPHAN_KEYS = [
  "plans.nastroyka_utverzhdayushchih.approve",
  "access.grant.plans.nastroyka_utverzhdayushchih.approve"
];

async function main() {
  const orphans = await prisma.permission.findMany({
    where: {
      OR: [
        { key: { in: ORPHAN_KEYS } },
        {
          key: { startsWith: "access.grant.plans.nastroyka_utverzhdayushchih." },
          description: null
        }
      ]
    },
    select: { id: true, tenant_id: true, key: true }
  });
  if (orphans.length === 0) {
    console.log("Orphan yo‘q");
    return;
  }
  const ids = orphans.map((o) => o.id);
  const rp = await prisma.rolePermission.deleteMany({ where: { permission_id: { in: ids } } });
  const up = await prisma.userPermission.deleteMany({ where: { permission_id: { in: ids } } });
  const del = await prisma.permission.deleteMany({ where: { id: { in: ids } } });
  console.log(
    `O‘chirildi: permissions=${del.count}, role_links=${rp.count}, user_links=${up.count}`
  );
  for (const o of orphans) {
    console.log(`  - tenant ${o.tenant_id}: ${o.key}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
