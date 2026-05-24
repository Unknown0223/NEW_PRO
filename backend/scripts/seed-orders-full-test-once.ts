/**
 * Bir martalik to'liq orders test-seed.
 *
 * Ishga tushirish:
 *   npm run seed:orders-full-test-once --prefix backend
 */
import "dotenv/config";
import { prisma } from "../src/config/database";
import { runSeedOrdersFullTest } from "./lib/seed-orders-full-test-run";

async function main() {
  await runSeedOrdersFullTest();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
