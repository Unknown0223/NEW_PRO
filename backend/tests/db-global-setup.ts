import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * Integratsiya testlari seed (`test1`, SKU-001, agent) ga bog‘liq.
 * Faqat DB ulanishi yetarli emas — bo‘sh DB da marker `0` bo‘ladi (testlar skip).
 */
export default async function globalSetup() {
  const marker = join(__dirname, ".db-integration-ready");
  let ready = "0";
  try {
    const prisma = new PrismaClient();
    await prisma.$connect();
    const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
    const product =
      tenant &&
      (await prisma.product.findFirst({
        where: { tenant_id: tenant.id, sku: "SKU-001", is_active: true }
      }));
    const agent =
      tenant &&
      (await prisma.user.findFirst({
        where: { tenant_id: tenant.id, login: "agent", role: "agent", is_active: true }
      }));
    await prisma.$disconnect();
    ready = tenant && product && agent ? "1" : "0";
  } catch {
    ready = "0";
  }
  writeFileSync(marker, ready, "utf8");
}
