/**
 * Diagnostika: tenant settings.references dagi payment_method_entries /
 * price_type_entries va product_prices.price_type kalitlarini ko‘rsatish.
 * Ishga tushirish:
 *   npx tsx scripts/inspect-price-type-refs.ts
 */
import { prisma } from "../src/config/database";

const TENANT = process.env.IMPORT_TENANT_SLUG ?? "test1";

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT } });
  if (!tenant) throw new Error(`Tenant ${TENANT} topilmadi`);

  const settings = (tenant.settings ?? {}) as Record<string, unknown>;
  const refs = (settings.references ?? {}) as Record<string, unknown>;

  console.log("=== payment_method_entries ===");
  console.log(JSON.stringify(refs.payment_method_entries ?? null, null, 2));
  console.log("=== price_type_entries ===");
  console.log(JSON.stringify(refs.price_type_entries ?? null, null, 2));
  console.log("=== payment_types (legacy) ===");
  console.log(JSON.stringify(refs.payment_types ?? null, null, 2));

  const rows = await prisma.productPrice.findMany({
    where: { tenant_id: tenant.id },
    distinct: ["price_type"],
    select: { price_type: true },
    orderBy: { price_type: "asc" }
  });
  console.log("=== distinct product_prices.price_type ===");
  console.log(JSON.stringify(rows.map((r) => r.price_type), null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
