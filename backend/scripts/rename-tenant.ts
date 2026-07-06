/**
 * Tenant display name yangilash (slug o‘zgarmaydi).
 *
 *   npx tsx scripts/rename-tenant.ts test1 "Tizimdan foydalanish"
 */
import { prisma } from "../prisma/seed/helpers";

async function main() {
  const slug = (process.argv[2] ?? "test1").trim();
  const name = (process.argv[3] ?? "Tizimdan foydalanish").trim();
  if (!slug || !name) {
    console.error("Usage: npx tsx scripts/rename-tenant.ts <slug> <display-name>");
    process.exit(1);
  }

  const row = await prisma.tenant.update({
    where: { slug },
    data: { name },
    select: { id: true, slug: true, name: true }
  });
  console.log(`OK: tenant #${row.id} slug=${row.slug} name="${row.name}"`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
