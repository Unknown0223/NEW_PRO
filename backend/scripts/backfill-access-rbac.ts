import { prisma } from "../src/config/database";

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, tenant_id: true, role: true }
  });
  let roleCount = 0;
  let linkCount = 0;
  for (const u of users) {
    const role = await prisma.role.upsert({
      where: { tenant_id_key: { tenant_id: u.tenant_id, key: u.role } },
      create: { tenant_id: u.tenant_id, key: u.role, name: u.role, is_system: true },
      update: {}
    });
    roleCount += 1;
    await prisma.userRole.upsert({
      where: { user_id_role_id: { user_id: u.id, role_id: role.id } },
      create: { user_id: u.id, role_id: role.id },
      update: {}
    });
    linkCount += 1;
  }
  // eslint-disable-next-line no-console
  console.log(`Backfill done. rolesTouched=${roleCount} linksTouched=${linkCount}`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
