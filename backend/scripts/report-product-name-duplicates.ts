/**
 * Tenant bo‘yicha mahsulot nom dublikatlari hisoboti (o‘chirmaydi).
 * Usage: npx tsx scripts/report-product-name-duplicates.ts [tenantSlug=test1]
 */
import { prisma } from "../src/config/database";
import { listProductNameDuplicates } from "../src/modules/products/products.duplicates";

async function main() {
  const slug = process.argv[2]?.trim() || "test1";
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    console.error(`Tenant topilmadi: ${slug}`);
    process.exit(1);
  }

  const groups = await listProductNameDuplicates(tenant.id);
  console.log(`Tenant: ${slug} (id=${tenant.id})`);
  console.log(`Nom dublikat guruhlari: ${groups.length}`);
  console.log("");

  if (groups.length === 0) {
    console.log("Dublikat yo‘q.");
    return;
  }

  for (const g of groups) {
    console.log(`— ${g.sample_name}`);
    for (const p of g.products) {
      console.log(
        `    id=${p.id}  sku=${p.sku}  active=${p.is_active}  name=${JSON.stringify(p.name)}`
      );
    }
  }

  console.log("");
  console.log(
    "Yo‘riqnoma: yangi dublikatlar create/import da bloklanadi. Mavjud juftliklarni qo‘lda birlashtiring yoki birini neaktiv qiling — avtomatik o‘chirish yo‘q."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
