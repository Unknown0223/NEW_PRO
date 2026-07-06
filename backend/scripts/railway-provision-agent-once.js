/** Railway SSH: node scripts/railway-provision-agent-once.js */
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const slug = (process.env.IMPORT_TENANT_SLUG || "test1").trim();
const login = (process.env.AGENT_LOGIN || "agent").trim();
const password = (process.env.AGENT_PASSWORD || "111111").trim();

async function main() {
  const prisma = new PrismaClient();
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw new Error(`Tenant not found: ${slug}`);

    const hash = await bcrypt.hash(password, 10);
    const agent = await prisma.user.upsert({
      where: { tenant_id_login: { tenant_id: tenant.id, login } },
      update: {
        password_hash: hash,
        role: "agent",
        is_active: true,
        app_access: true,
        can_authorize: true,
        name: "Agent"
      },
      create: {
        tenant_id: tenant.id,
        login,
        name: "Agent",
        password_hash: hash,
        role: "agent",
        is_active: true,
        app_access: true,
        can_authorize: true
      }
    });

    const wh = await prisma.warehouse.findFirst({ where: { tenant_id: tenant.id } });
    if (wh) {
      const link = await prisma.warehouseUserLink.findFirst({
        where: { warehouse_id: wh.id, user_id: agent.id }
      });
      if (!link) {
        await prisma.warehouseUserLink.create({
          data: { warehouse_id: wh.id, user_id: agent.id, link_role: "agent" }
        });
      }
    }

    console.log(`OK agent slug=${slug} login=${login}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
