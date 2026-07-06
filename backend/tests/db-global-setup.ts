import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

/** CI / lokal integratsiya run ID — test ma'lumotlari prefiksi uchun. */
process.env.VITEST_TEST_RUN_ID = process.env.VITEST_TEST_RUN_ID ?? randomUUID().slice(0, 8);

/**
 * Integratsiya testlari seed (`test1`, SKU-001, agent) ga bog‘liq.
 * Faqat DB ulanishi yetarli emas — bo‘sh DB da marker `0` bo‘ladi (testlar skip).
 */
export default async function globalSetup() {
  const marker = join(__dirname, ".db-integration-ready");
  let ready = "0";
  try {
    try {
      execSync("npx prisma migrate deploy", {
        cwd: join(__dirname, ".."),
        stdio: "pipe",
        env: process.env
      });
    } catch {
      // DB yo‘q yoki migrate muvaffaqiyatsiz — seed tekshiruvi keyin skip qiladi
    }

    const prisma = new PrismaClient();
    await prisma.$connect();
    await prisma.$executeRawUnsafe(`SET statement_timeout = '120s'`);
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
    if (tenant && product && agent) {
      await prisma.refreshToken.updateMany({
        where: { tenant_id: tenant.id, revoked_at: null },
        data: { revoked_at: new Date() }
      });
      const sku2 = await prisma.product.findFirst({
        where: { tenant_id: tenant.id, sku: "SKU-002" }
      });
      if (sku2) {
        await prisma.bonusRule.updateMany({
          where: { tenant_id: tenant.id, name: "[seed] Chegirma 10%" },
          data: { once_per_client: false, product_ids: [sku2.id] }
        });
      }
      await prisma.user.updateMany({
        where: { tenant_id: tenant.id },
        data: { max_sessions: 50 }
      });
      await prisma.user.updateMany({
        where: { tenant_id: tenant.id, login: "agent", role: "agent" },
        data: { app_access: true, is_active: true }
      });
      const agentUser = await prisma.user.findFirst({
        where: { tenant_id: tenant.id, login: "agent", role: "agent" }
      });
      if (agentUser?.agent_entitlements && typeof agentUser.agent_entitlements === "object") {
        const ent = agentUser.agent_entitlements as Record<string, unknown>;
        const mobile = (ent.mobile_config as Record<string, unknown> | undefined) ?? {};
        await prisma.user.update({
          where: { id: agentUser.id },
          data: {
            agent_entitlements: {
              ...ent,
              mobile_config: {
                ...mobile,
                sync: { allowed_window_from: "00:00", allowed_window_to: "23:59" }
              }
            }
          }
        });
      }
      await prisma.bonusRule.updateMany({
        where: { tenant_id: tenant.id, name: "[seed] Min summa 500 000" },
        data: { discount_pct: null }
      });
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          settings: {
            return_filter: {
              period_enabled: false,
              period_unit: "day",
              period_value: 30,
              balance_zero_enabled: false
            }
          } as object
        }
      });
    }
    await prisma.$disconnect();
    ready = tenant && product && agent ? "1" : "0";
  } catch {
    ready = "0";
  }
  writeFileSync(marker, ready, "utf8");
}
