/**
 * Mobil xarita / marshrut testi: Toshkent atrofida GPS koordinatali mijozlar + bugungi marshrut.
 *
 * Ishga tushirish:
 *   npm run seed:agent-route-map-once --prefix backend
 *
 * yoki repo ildizidan:
 *   .\seed-mobile-route.cmd
 *
 * Muhit:
 *   SEED_TENANT_SLUG=test1   (default)
 *   SEED_AGENT_LOGIN=agent   (default)
 */
import { Prisma, PrismaClient } from "@prisma/client";
import path from "path";
import { config } from "dotenv";
import { upsertAgentRouteDay } from "../src/modules/field/field.service";

config({ path: path.join(__dirname, "..", ".env") });

const prisma = new PrismaClient();

const MAP_STOPS = [
  { name: "[xarita] Chorsu bozori", lat: 41.3265, lon: 69.2285, phone: "+998901100001" },
  { name: "[xarita] Amir Temur", lat: 41.3111, lon: 69.2797, phone: "+998901100002" },
  { name: "[xarita] Yunusobod", lat: 41.3543, lon: 69.2892, phone: "+998901100003" },
  { name: "[xarita] Chilonzor", lat: 41.2869, lon: 69.2034, phone: "+998901100004" },
  { name: "[xarita] Sergeli", lat: 41.2208, lon: 69.2403, phone: "+998901100005" },
  { name: "[xarita] Mirzo Ulug'bek", lat: 41.3388, lon: 69.3344, phone: "+998901100006" },
  { name: "[xarita] Yakkasaroy", lat: 41.2982, lon: 69.2521, phone: "+998901100007" },
  { name: "[xarita] Olmazor", lat: 41.3689, lon: 69.2039, phone: "+998901100008" }
] as const;

function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function upsertMapClient(
  tenantId: number,
  agentId: number,
  stop: (typeof MAP_STOPS)[number]
) {
  const norm = stop.phone.replace(/\D/g, "");
  let client = await prisma.client.findFirst({
    where: { tenant_id: tenantId, name: stop.name }
  });
  if (!client) {
    client = await prisma.client.create({
      data: {
        tenant_id: tenantId,
        name: stop.name,
        phone: stop.phone,
        address: "Toshkent (test)",
        category: "retail",
        agent_id: agentId,
        is_active: true,
        latitude: new Prisma.Decimal(stop.lat.toFixed(8)),
        longitude: new Prisma.Decimal(stop.lon.toFixed(8))
      }
    });
    if (norm) {
      await prisma.$executeRaw(Prisma.sql`
        UPDATE "clients" SET "phone_normalized" = ${norm} WHERE "id" = ${client.id}
      `);
    }
  } else {
    client = await prisma.client.update({
      where: { id: client.id },
      data: {
        agent_id: agentId,
        is_active: true,
        latitude: new Prisma.Decimal(stop.lat.toFixed(8)),
        longitude: new Prisma.Decimal(stop.lon.toFixed(8)),
        address: client.address ?? "Toshkent (test)"
      }
    });
    if (norm) {
      await prisma.$executeRaw(Prisma.sql`
        UPDATE "clients" SET "phone_normalized" = ${norm} WHERE "id" = ${client.id}
      `);
    }
  }

  const allWeekdays = [1, 2, 3, 4, 5, 6, 7];
  await prisma.clientAgentAssignment.upsert({
    where: { client_id_slot: { client_id: client.id, slot: 1 } },
    create: {
      tenant_id: tenantId,
      client_id: client.id,
      slot: 1,
      agent_id: agentId,
      visit_weekdays: allWeekdays
    },
    update: {
      agent_id: agentId,
      visit_weekdays: allWeekdays
    }
  });

  return client;
}

async function main() {
  const slug = (process.env.SEED_TENANT_SLUG || "test1").trim();
  const agentLogin = (process.env.SEED_AGENT_LOGIN || "agent").trim();
  const routeDate = todayIsoLocal();

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) throw new Error(`Tenant "${slug}" topilmadi.`);

  const agent = await prisma.user.findFirst({
    where: { tenant_id: tenant.id, login: agentLogin, role: "agent", is_active: true },
    select: { id: true, name: true, login: true }
  });
  if (!agent) {
    throw new Error(`Agent login="${agentLogin}" topilmadi. Avval: npm run db:seed --prefix backend`);
  }

  const clients = [];
  for (const stop of MAP_STOPS) {
    const c = await upsertMapClient(tenant.id, agent.id, stop);
    clients.push(c);
    console.log(`[seed] Mijoz: ${c.name} (${c.latitude}, ${c.longitude})`);
  }

  const stops = clients.map((c, i) => ({
    sort_order: i + 1,
    client_id: c.id,
    client_name: c.name,
    latitude: Number(c.latitude),
    longitude: Number(c.longitude),
    visited: false
  }));

  const route = await upsertAgentRouteDay(tenant.id, {
    agent_id: agent.id,
    route_date: routeDate,
    stops,
    notes: "Mobil xarita test (seed-agent-route-map-once)"
  });

  console.log("");
  console.log(`[seed] Tayyor: ${clients.length} ta nuqta, marshrut sanasi ${routeDate}`);
  console.log(`[seed] Agent: ${agent.name} (login=${agent.login}, id=${agent.id})`);
  console.log(`[seed] Marshrut id=${route.id}, stops=${Array.isArray(route.stops) ? route.stops.length : 0}`);
  console.log("");
  console.log("Mobil ilovada:");
  console.log("  1) Savdo nuqtalari yoki Xarita sahifasini oching");
  console.log("  2) Yuqoridagi ↻ (sinxron) tugmasini bosing yoki ilovadan chiqib qayta kiring");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
