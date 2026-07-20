/**
 * Neaktiv mahsulotlarni aktivlashtirish (import keyin ro‘yxatda ko‘rinishi uchun).
 * Ishga tushirish: npx tsx scripts/reactivate-products.ts
 */
import { prisma } from "../src/config/database";

const TENANT = process.env.IMPORT_TENANT_SLUG ?? "test1";

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT } });
  if (!tenant) throw new Error(`Tenant ${TENANT} topilmadi`);

  const before = await prisma.product.count({
    where: { tenant_id: tenant.id, is_active: false }
  });
  const result = await prisma.product.updateMany({
    where: { tenant_id: tenant.id, is_active: false },
    data: { is_active: true }
  });
  const active = await prisma.product.count({
    where: { tenant_id: tenant.id, is_active: true }
  });
  console.log(
    JSON.stringify(
      { tenant: TENANT, reactivated: result.count, wereInactive: before, activeNow: active },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
