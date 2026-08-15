import { prisma } from "../src/config/database";

async function main() {
  const rows = await prisma.permission.findMany({
    where: {
      OR: [
        { key: "plans.nastroyka_utverzhdayushchih.approve" },
        { key: { endsWith: ".approve" }, module: "plans" },
        { description: null, key: { contains: "nastroyka" } }
      ]
    },
    select: {
      tenant_id: true,
      key: true,
      module: true,
      section: true,
      description: true,
      _count: { select: { users: true, roles: true } }
    }
  });
  console.log(JSON.stringify(rows, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
