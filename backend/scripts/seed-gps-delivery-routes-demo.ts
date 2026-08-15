/**
 * Demo: expeditor visits + GPS pings for GPS delivery routes report.
 *   npx tsx backend/scripts/seed-gps-delivery-routes-demo.ts
 */
import { Prisma, PrismaClient } from "@prisma/client";
import path from "path";
import { config } from "dotenv";

config({ path: path.join(__dirname, "..", ".env") });
const prisma = new PrismaClient();

async function main() {
  const slug = (process.env.SEED_TENANT_SLUG || "test1").trim();
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) throw new Error(`Tenant ${slug} topilmadi`);

  const exp = await prisma.user.findFirst({
    where: { tenant_id: tenant.id, role: "expeditor", is_active: true },
    orderBy: { id: "asc" }
  });
  if (!exp) throw new Error("Expeditor yo‘q");

  await prisma.user.update({ where: { id: exp.id }, data: { app_access: true } });

  let client = await prisma.client.findFirst({
    where: { tenant_id: tenant.id, latitude: { not: null } },
    orderBy: { id: "asc" }
  });
  if (!client) {
    client = await prisma.client.create({
      data: {
        tenant_id: tenant.id,
        name: "[gps-report] TT",
        address: "Toshkent",
        is_active: true,
        latitude: new Prisma.Decimal("41.31100000"),
        longitude: new Prisma.Decimal("69.28000000")
      }
    });
  }

  const now = new Date();
  const day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0);
  const existing = await prisma.agentVisit.count({
    where: { tenant_id: tenant.id, agent_id: exp.id, notes: "gps-delivery-report-demo" }
  });
  if (existing === 0) {
    for (let i = 0; i < 5; i++) {
      // Mijoz nuqtasiga yaqin check-in — «Был в точке» to‘g‘ri chiqishi uchun
      const lat = Number(client.latitude) + i * 0.0003;
      const lng = Number(client.longitude) + i * 0.0003;
      await prisma.agentVisit.create({
        data: {
          tenant_id: tenant.id,
          agent_id: exp.id,
          client_id: client.id,
          checked_in_at: new Date(day0.getTime() + i * 45 * 60000),
          checked_out_at: new Date(day0.getTime() + i * 45 * 60000 + 12 * 60000),
          latitude: new Prisma.Decimal(lat.toFixed(8)),
          longitude: new Prisma.Decimal(lng.toFixed(8)),
          notes: "gps-delivery-report-demo"
        }
      });
    }
  }

  const pingCount = await prisma.agentLocationPing.count({
    where: { tenant_id: tenant.id, agent_id: exp.id, recorded_at: { gte: day0 } }
  });
  if (pingCount < 5) {
    const pings: Prisma.AgentLocationPingCreateManyInput[] = [];
    for (let i = 0; i < 12; i++) {
      pings.push({
        tenant_id: tenant.id,
        agent_id: exp.id,
        latitude: new Prisma.Decimal((41.311 + i * 0.004).toFixed(8)),
        longitude: new Prisma.Decimal((69.28 + i * 0.003).toFixed(8)),
        accuracy_meters: 10,
        recorded_at: new Date(day0.getTime() + i * 20 * 60000)
      });
    }
    await prisma.agentLocationPing.createMany({ data: pings });
  }

  console.log(`[seed] OK expeditor id=${exp.id} ${exp.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
