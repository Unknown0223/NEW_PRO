import { prisma } from "../src/config/database";

async function main() {
  const t = await prisma.tenant.findUnique({ where: { slug: "test1" } });
  if (!t) throw new Error("no tenant");
  const total = await prisma.product.count({ where: { tenant_id: t.id } });
  const active = await prisma.product.count({ where: { tenant_id: t.id, is_active: true } });
  const inactive = await prisma.product.count({ where: { tenant_id: t.id, is_active: false } });
  const recent = await prisma.product.findMany({
    where: { tenant_id: t.id },
    orderBy: { id: "desc" },
    take: 20,
    select: {
      id: true,
      sku: true,
      name: true,
      is_active: true,
      category_id: true,
      unit: true,
      sort_order: true,
      created_at: true
    }
  });
  console.log(JSON.stringify({ total, active, inactive, recent }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
