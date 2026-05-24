/**
 * Bir martalik: tenantdagi barcha faol mahsulotlarni qaytarish interchangeable guruhiga qo‘shadi.
 * Ishlatish: npx tsx scripts/ensure-interchangeable-return-group.ts test1
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const slug = process.argv[2]?.trim() || "test1";
  const tenant = await prisma.tenant.findFirst({ where: { slug } });
  if (!tenant) {
    console.error(`Tenant topilmadi: ${slug}`);
    process.exit(1);
  }
  const products = await prisma.product.findMany({
    where: { tenant_id: tenant.id, is_active: true },
    select: { id: true }
  });
  const name = "Qaytarish — barcha mahsulotlar";
  let group = await prisma.interchangeableProductGroup.findFirst({
    where: { tenant_id: tenant.id, name }
  });
  if (!group) {
    group = await prisma.interchangeableProductGroup.create({
      data: { tenant_id: tenant.id, name, is_active: true }
    });
  } else {
    await prisma.interchangeableProductGroup.update({
      where: { id: group.id },
      data: { is_active: true }
    });
  }
  for (const { id: product_id } of products) {
    await prisma.interchangeableGroupProduct.upsert({
      where: { group_id_product_id: { group_id: group.id, product_id } },
      create: { group_id: group.id, product_id },
      update: {}
    });
  }
  console.log(
    `OK: tenant=${slug} group_id=${group.id} products=${products.length} (narx turi cheklovi yo‘q)`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
