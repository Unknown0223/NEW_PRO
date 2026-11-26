/**
 * Lokal «По ценам» review: PRICES-SEED product + 2 applied schedules (current month).
 * Faqat localhost DB.
 *
 *   npx tsx scripts/seed-prices-report-demo.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  PRICES_SEED_NAME,
  PRICES_SEED_PRICE_TYPE,
  PRICES_SEED_SKU,
  isLocalDatabaseUrl
} from "../src/modules/reports/prices-report.seed-meta";

const prisma = new PrismaClient();

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!isLocalDatabaseUrl(dbUrl)) {
    throw new Error("seed-prices-report-demo: faqat localhost DATABASE_URL");
  }

  const slug = (process.env.IMPORT_TENANT_SLUG || process.env.SEED_TENANT_SLUG || "aksit").trim();
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) throw new Error(`Tenant topilmadi: ${slug}`);

  let product = await prisma.product.findFirst({
    where: { tenant_id: tenant.id, sku: PRICES_SEED_SKU },
    select: { id: true }
  });
  if (!product) {
    product = await prisma.product.create({
      data: {
        tenant_id: tenant.id,
        sku: PRICES_SEED_SKU,
        name: PRICES_SEED_NAME,
        unit: "dona",
        is_active: true
      },
      select: { id: true }
    });
  } else {
    await prisma.product.update({
      where: { id: product.id },
      data: { name: PRICES_SEED_NAME, is_active: true }
    });
  }

  await prisma.productPriceSchedule.deleteMany({
    where: { tenant_id: tenant.id, product_id: product.id }
  });

  const now = new Date();
  const d1 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 5, 10, 0, 0));
  const d2 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 15, 10, 0, 0));

  await prisma.productPriceSchedule.createMany({
    data: [
      {
        tenant_id: tenant.id,
        product_id: product.id,
        price_type: PRICES_SEED_PRICE_TYPE,
        price: 10000,
        currency: "UZS",
        effective_at: d1,
        status: "applied",
        applied_at: d1
      },
      {
        tenant_id: tenant.id,
        product_id: product.id,
        price_type: PRICES_SEED_PRICE_TYPE,
        price: 12000,
        currency: "UZS",
        effective_at: d2,
        status: "applied",
        applied_at: d2
      }
    ]
  });

  console.log(
    JSON.stringify({
      ok: true,
      tenant: slug,
      product_id: product.id,
      sku: PRICES_SEED_SKU,
      schedules: 2
    })
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
