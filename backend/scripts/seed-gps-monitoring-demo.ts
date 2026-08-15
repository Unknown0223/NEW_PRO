/**
 * GPS monitoring dashboard demo: bugungi kun uchun marshrut, visits, orders, refusals, GPS trek.
 *
 *   npm run seed:gps-monitoring --prefix backend
 *
 * Muhit:
 *   SEED_TENANT_SLUG=test1
 *   SEED_AGENT_LOGIN=agent   (asosiy agent; yo‘q bo‘lsa birinchi faol agent)
 */
import { Prisma, PrismaClient } from "@prisma/client";
import path from "path";
import { config } from "dotenv";

config({ path: path.join(__dirname, "..", ".env") });

const prisma = new PrismaClient();

const STOPS = [
  { name: "[gps-mon] Darina Market", lat: 41.312, lon: 69.248, phone: "+998901200001" },
  { name: "[gps-mon] Barakat Mini", lat: 41.318, lon: 69.255, phone: "+998901200002" },
  { name: "[gps-mon] Chorsu Savdo", lat: 41.326, lon: 69.228, phone: "+998901200003" },
  { name: "[gps-mon] Orzu Market", lat: 41.305, lon: 69.262, phone: "+998901200004" },
  { name: "[gps-mon] Nasiba Store", lat: 41.298, lon: 69.241, phone: "+998901200005" },
  { name: "[gps-mon] Mehr Market", lat: 41.321, lon: 69.271, phone: "+998901200006" },
  { name: "[gps-mon] Ziyo Nur", lat: 41.335, lon: 69.258, phone: "+998901200007" },
  { name: "[gps-mon] Baxt Store", lat: 41.289, lon: 69.235, phone: "+998901200008" }
] as const;

function todayParts() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  return { y, m, day, iso: `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
}

function atLocal(y: number, m: number, day: number, hour: number, minute: number) {
  return new Date(y, m, day, hour, minute, 0, 0);
}

async function upsertClient(
  tenantId: number,
  agentId: number,
  stop: (typeof STOPS)[number]
) {
  let client = await prisma.client.findFirst({
    where: { tenant_id: tenantId, name: stop.name }
  });
  const data = {
    tenant_id: tenantId,
    name: stop.name,
    phone: stop.phone,
    address: "Toshkent · GPS monitoring demo",
    category: "retail",
    agent_id: agentId,
    is_active: true,
    latitude: new Prisma.Decimal(stop.lat.toFixed(8)),
    longitude: new Prisma.Decimal(stop.lon.toFixed(8))
  };
  if (!client) {
    client = await prisma.client.create({ data });
  } else {
    client = await prisma.client.update({
      where: { id: client.id },
      data: {
        agent_id: agentId,
        is_active: true,
        latitude: data.latitude,
        longitude: data.longitude,
        address: data.address
      }
    });
  }
  return client;
}

async function main() {
  const slug = (process.env.SEED_TENANT_SLUG || "test1").trim();
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) throw new Error(`Tenant "${slug}" topilmadi.`);

  const login = (process.env.SEED_AGENT_LOGIN || "agent").trim();
  let agent = await prisma.user.findFirst({
    where: { tenant_id: tenant.id, login, role: "agent", is_active: true }
  });
  if (!agent) {
    agent = await prisma.user.findFirst({
      where: { tenant_id: tenant.id, role: "agent", is_active: true },
      orderBy: { id: "asc" }
    });
  }
  if (!agent) throw new Error("Faol agent topilmadi.");

  const supervisor = await prisma.user.findFirst({
    where: { tenant_id: tenant.id, role: "supervisor", is_active: true },
    orderBy: { id: "asc" }
  });
  if (supervisor && agent.supervisor_user_id !== supervisor.id) {
    await prisma.user.update({
      where: { id: agent.id },
      data: { supervisor_user_id: supervisor.id }
    });
  }

  const { y, m, day, iso } = todayParts();
  const dayUtc = new Date(Date.UTC(y, m, day));

  console.log(`[seed:gps-monitoring] tenant=${slug} agent=${agent.id} (${agent.name}) date=${iso}`);

  const clients = [];
  for (const stop of STOPS) {
    clients.push(await upsertClient(tenant.id, agent.id, stop));
  }

  const stopsJson = clients.map((c, i) => ({
    sort_order: i + 1,
    client_id: c.id,
    client_name: c.name,
    latitude: Number(c.latitude),
    longitude: Number(c.longitude),
    visited: i < 5
  }));

  await prisma.agentRouteDay.upsert({
    where: {
      tenant_id_agent_id_route_date: {
        tenant_id: tenant.id,
        agent_id: agent.id,
        route_date: dayUtc
      }
    },
    create: {
      tenant_id: tenant.id,
      agent_id: agent.id,
      route_date: dayUtc,
      stops: stopsJson,
      notes: "GPS monitoring demo"
    },
    update: { stops: stopsJson, notes: "GPS monitoring demo" }
  });

  // Clear prior demo visits/pings for today for this agent (idempotent-ish)
  await prisma.agentVisit.deleteMany({
    where: {
      tenant_id: tenant.id,
      agent_id: agent.id,
      checked_in_at: {
        gte: atLocal(y, m, day, 0, 0),
        lte: atLocal(y, m, day, 23, 59)
      },
      notes: "gps-monitoring-demo"
    }
  });
  await prisma.agentLocationPing.deleteMany({
    where: {
      tenant_id: tenant.id,
      agent_id: agent.id,
      recorded_at: {
        gte: atLocal(y, m, day, 0, 0),
        lte: atLocal(y, m, day, 23, 59)
      }
    }
  });

  // Visits for first 5 stops
  for (let i = 0; i < 5; i++) {
    const c = clients[i];
    const hour = 9 + i;
    await prisma.agentVisit.create({
      data: {
        tenant_id: tenant.id,
        agent_id: agent.id,
        client_id: c.id,
        checked_in_at: atLocal(y, m, day, hour, 10 + i * 3),
        checked_out_at: atLocal(y, m, day, hour, 25 + i * 3),
        latitude: c.latitude,
        longitude: c.longitude,
        notes: "gps-monitoring-demo"
      }
    });
  }

  // Order on first two clients
  for (let i = 0; i < 2; i++) {
    const c = clients[i];
    const number = `GPS-MON-${iso.replace(/-/g, "")}-${agent.id}-${i + 1}`;
    const existing = await prisma.order.findFirst({
      where: { tenant_id: tenant.id, number }
    });
    if (!existing) {
      await prisma.order.create({
        data: {
          tenant_id: tenant.id,
          number,
          client_id: c.id,
          agent_id: agent.id,
          order_type: "order",
          status: "confirmed",
          total_sum: new Prisma.Decimal((1.5 + i * 2.3) * 1_000_000),
          created_at: atLocal(y, m, day, 9 + i, 40)
        }
      });
    }
  }

  // Refusal on 6th client
  const refusalClient = clients[5];
  const refusalExists = await prisma.clientRefusal.findFirst({
    where: {
      tenant_id: tenant.id,
      agent_id: agent.id,
      client_id: refusalClient.id,
      created_at: {
        gte: atLocal(y, m, day, 0, 0),
        lte: atLocal(y, m, day, 23, 59)
      }
    }
  });
  if (!refusalExists) {
    await prisma.clientRefusal.create({
      data: {
        tenant_id: tenant.id,
        agent_id: agent.id,
        client_id: refusalClient.id,
        refusal_reason_ref: "no_need",
        comment: "gps-monitoring-demo",
        created_at: atLocal(y, m, day, 14, 20)
      }
    });
  }

  // GPS breadcrumb along visited stops
  const pingRows: Prisma.AgentLocationPingCreateManyInput[] = [];
  for (let i = 0; i < 5; i++) {
    const a = clients[i];
    const b = clients[Math.min(i + 1, 4)];
    for (let s = 0; s < 4; s++) {
      const t = s / 4;
      const lat = Number(a.latitude) + (Number(b.latitude) - Number(a.latitude)) * t;
      const lon = Number(a.longitude) + (Number(b.longitude) - Number(a.longitude)) * t;
      pingRows.push({
        tenant_id: tenant.id,
        agent_id: agent.id,
        latitude: new Prisma.Decimal(lat.toFixed(8)),
        longitude: new Prisma.Decimal(lon.toFixed(8)),
        accuracy_meters: 8 + (s % 3) * 2,
        recorded_at: atLocal(y, m, day, 9 + i, 5 + s * 8)
      });
    }
  }
  // fresh "online" ping
  pingRows.push({
    tenant_id: tenant.id,
    agent_id: agent.id,
    latitude: clients[4].latitude!,
    longitude: clients[4].longitude!,
    accuracy_meters: 6,
    recorded_at: new Date()
  });
  await prisma.agentLocationPing.createMany({ data: pingRows });

  console.log(
    `[seed:gps-monitoring] OK: ${clients.length} clients, route stops, 5 visits, 2 orders, 1 refusal, ${pingRows.length} pings`
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
