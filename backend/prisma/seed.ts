import "dotenv/config";
import { prisma } from "./seed/helpers";
import { seedDemoTenant } from "./seed/seed-demo";
import { seedTest1Tenant } from "./seed/seed-test1";

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "true") {
    throw new Error("SeedBlockedInProduction");
  }
  await seedTest1Tenant();
  await seedDemoTenant();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
