/**
 * Production (Railway): bo'sh yoki tozalangan DB uchun minimal init.
 * — faqat bitta tenant + admin (+ RBAC, spravochniklar)
 * — demo mijozlar / agentlar / buyurtmalar YO'Q
 *
 *   railway login
 *   cd backend && railway link
 *   railway run npm run railway:prod-init
 *
 * Muhit:
 *   IMPORT_TENANT_SLUG=test1 (default)
 *   ADMIN_LOGIN=admin (default)
 *   ADMIN_PASSWORD=secret123 (default — prod da o'zgartiring!)
 *   AGENT_LOGIN=agent (default)
 *   AGENT_PASSWORD=111111 (default)
 *   ALLOW_RAILWAY_PROD_INIT=true (production da majburiy)
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { spawnSync } from "node:child_process";
import * as path from "node:path";
import { mergeDefaultReasonReferences, prisma } from "../prisma/seed/helpers";
import { defaultMobileConfigForRole } from "../src/modules/staff/agent-mobile-config.defaults";

const root = path.resolve(__dirname, "..");

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_RAILWAY_PROD_INIT !== "true") {
    throw new Error("Production: ALLOW_RAILWAY_PROD_INIT=true qo‘ying.");
  }

  const slug = (process.env.IMPORT_TENANT_SLUG || "test1").trim();
  const login = (process.env.ADMIN_LOGIN || "admin").trim();
  const password = (process.env.ADMIN_PASSWORD || "secret123").trim();
  const agentLogin = (process.env.AGENT_LOGIN || "agent").trim();
  const agentPassword = (process.env.AGENT_PASSWORD || "111111").trim();

  if (password.length < 6) {
    throw new Error("ADMIN_PASSWORD kamida 6 belgi.");
  }
  if (agentPassword.length < 6) {
    throw new Error("AGENT_PASSWORD kamida 6 belgi.");
  }

  console.log(`[railway-prod-init] tenant="${slug}" admin="${login}" agent="${agentLogin}"`);

  const hash = await bcrypt.hash(password, 10);
  const agentHash = await bcrypt.hash(agentPassword, 10);

  const tenant = await prisma.tenant.upsert({
    where: { slug },
    update: { is_active: true },
    create: {
      slug,
      name: slug === "test1" ? "Test Tenant 1" : `Tenant ${slug}`,
      plan: "basic",
      is_active: true
    }
  });

  await mergeDefaultReasonReferences(tenant.id);

  await prisma.user.upsert({
    where: { tenant_id_login: { tenant_id: tenant.id, login } },
    update: {
      password_hash: hash,
      is_active: true,
      can_authorize: true,
      app_access: true,
      role: "admin",
      name: "Admin"
    },
    create: {
      tenant_id: tenant.id,
      name: "Admin",
      login,
      password_hash: hash,
      role: "admin",
      is_active: true,
      can_authorize: true,
      app_access: true
    }
  });

  const wh = await prisma.warehouse.findFirst({ where: { tenant_id: tenant.id } });
  if (!wh) {
    await prisma.warehouse.create({
      data: { tenant_id: tenant.id, name: "Asosiy ombor", type: "main" }
    });
  }

  const warehouse = await prisma.warehouse.findFirst({ where: { tenant_id: tenant.id } });
  const agent = await prisma.user.upsert({
    where: { tenant_id_login: { tenant_id: tenant.id, login: agentLogin } },
    update: {
      password_hash: agentHash,
      is_active: true,
      can_authorize: true,
      app_access: true,
      role: "agent",
      name: "Agent"
    },
    create: {
      tenant_id: tenant.id,
      name: "Agent",
      login: agentLogin,
      password_hash: agentHash,
      role: "agent",
      is_active: true,
      can_authorize: true,
      app_access: true,
      agent_entitlements: {
        price_types: ["default"],
        product_rules: [],
        mobile_config: {
          ...defaultMobileConfigForRole("agent"),
          sync: { block_sync: false }
        }
      }
    }
  });

  if (warehouse) {
    const link = await prisma.warehouseUserLink.findFirst({
      where: { warehouse_id: warehouse.id, user_id: agent.id }
    });
    if (!link) {
      await prisma.warehouseUserLink.create({
        data: { warehouse_id: warehouse.id, user_id: agent.id, link_role: "agent" }
      });
    }
  }

  console.log("[railway-prod-init] RBAC…");
  const r = spawnSync("npx", ["tsx", "scripts/ensure-rbac-tenant.ts", slug], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32"
  });
  if (r.status !== 0) {
    throw new Error("ensure-rbac-tenant failed");
  }

  console.log("\n[railway-prod-init] Tayyor.");
  console.log(`  Veb: slug="${slug}", login="${login}"`);
  console.log(`  Mobil agent: slug="${slug}", login="${agentLogin}"`);
  console.log(`  Mobil API: tenant slug URL da /api/${slug}/…`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
