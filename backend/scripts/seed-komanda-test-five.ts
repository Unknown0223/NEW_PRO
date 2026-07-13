/**
 * KOMANDA bo‘limi uchun test holati (alohida ishga tushirish).
 * Asosiy seed ham shu modulni chaqiradi — `npm run db:seed`
 *
 * Ishga tushirish: npm run seed:komanda-test-five
 * Kirish: login test_komanda_ag_01 … parol test123456
 */

import "dotenv/config";
import { prisma } from "../prisma/seed/helpers";
import { seedKomandaTestFive } from "../prisma/seed/seed-komanda-test-five";

const TENANT_SLUG = process.env.IMPORT_TENANT_SLUG?.trim() || "test1";

async function main() {
  await seedKomandaTestFive(TENANT_SLUG);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
