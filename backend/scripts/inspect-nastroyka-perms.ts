import { prisma } from "../src/config/database";

async function main() {
  const rows = await prisma.permission.findMany({
    where: {
      OR: [
        { key: { contains: "nastroyka_utverzhdayushchih" } },
        { section: { contains: "nastroyka" } },
        { description: { contains: "nastroyka" } }
      ]
    },
    select: {
      id: true,
      tenant_id: true,
      key: true,
      module: true,
      section: true,
      description: true,
      action: true
    },
    take: 80
  });
  for (const r of rows) {
    console.log(
      JSON.stringify({
        key: r.key,
        module: r.module,
        section: r.section,
        action: r.action,
        description: r.description
      })
    );
  }
  console.log("count", rows.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
