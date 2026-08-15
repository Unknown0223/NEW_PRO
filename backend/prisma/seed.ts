import "dotenv/config";

import { prisma as seedPrisma } from "./seed/helpers";
import { prisma as appPrisma } from "../src/config/database";
import { closeAppRedis } from "../src/lib/redis-cache";
import { seedDemoTenant } from "./seed/seed-demo";
import { seedKomandaTestFive } from "./seed/seed-komanda-test-five";
import { seedTest1Tenant } from "./seed/seed-test1";

async function shutdown() {
  await Promise.allSettled([seedPrisma.$disconnect(), appPrisma.$disconnect()]);
  await closeAppRedis();
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "true") {
    throw new Error("SeedBlockedInProduction");
  }
  console.log("[seed] test1 tenant…");
  await seedTest1Tenant();
  console.log("[seed] komanda (5×6 foydalanuvchi + bog‘lanishlar)…");
  await seedKomandaTestFive("test1");
  console.log("[seed] demo tenant…");
  await seedDemoTenant();
  console.log("[seed] tayyor");
}

main()
  .then(async () => {
    await shutdown();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error("[seed] xato:", e);
    await shutdown();
    process.exit(1);
  });
