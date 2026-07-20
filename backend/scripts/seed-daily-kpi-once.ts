/**
 * Kunlik KPI sahifasi uchun demo ma’lumot:
 * - KPI guruh + oylik plan (approved)
 * - bir nechta agent target
 * - oy ichida bir nechta zakaz (fakt)
 *
 * Ishga tushirish:
 *   cd backend && npm run seed:daily-kpi-once
 *   SEED_TENANT_SLUG=test1 npm run seed:daily-kpi-once
 */
import "dotenv/config";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/config/database";

function workRegionOffsetMs(): number {
  return 5 * 3600 * 1000;
}

function ymdInWorkRegion(d = new Date()): string {
  return new Date(d.getTime() + workRegionOffsetMs()).toISOString().slice(0, 10);
}

function dayUtcRange(ymd: string): { start: Date; end: Date } {
  const [y, m, d] = ymd.split("-").map((x) => Number.parseInt(x, 10));
  const start = new Date(Date.UTC(y, m - 1, d, -5, 0, 0, 0));
  const end = new Date(Date.UTC(y, m - 1, d, 18, 59, 59, 999));
  return { start, end };
}

async function main() {
  const slug = (process.env.SEED_TENANT_SLUG || "test1").trim();
  const tag = `daily_kpi_${Date.now()}`;
  const todayKey = ymdInWorkRegion();
  const [yy, mm] = todayKey.split("-").map((x) => Number.parseInt(x, 10));
  const month = mm;
  const year = yy;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, slug: true }
  });
  if (!tenant) throw new Error(`Tenant not found: ${slug}`);

  const direction =
    (await prisma.tradeDirection.findFirst({
      where: { tenant_id: tenant.id, is_active: true },
      orderBy: [{ sort_order: "asc" }, { id: "asc" }],
      select: { id: true, name: true, code: true }
    })) ??
    (await prisma.tradeDirection.create({
      data: {
        tenant_id: tenant.id,
        name: "Daily KPI Demo",
        code: "DKPI",
        is_active: true,
        sort_order: 999
      },
      select: { id: true, name: true, code: true }
    }));

  let kpiGroup = await prisma.kpiGroup.findFirst({
    where: { tenant_id: tenant.id, is_active: true },
    orderBy: [{ sort_order: "asc" }, { id: "asc" }],
    select: { id: true, name: true }
  });
  if (!kpiGroup) {
    kpiGroup = await prisma.kpiGroup.create({
      data: {
        tenant_id: tenant.id,
        name: "Daily KPI Demo Group",
        code: "DKPI",
        is_active: true,
        sort_order: 0,
        comment: tag
      },
      select: { id: true, name: true }
    });
  }

  let supervisor = await prisma.user.findFirst({
    where: { tenant_id: tenant.id, role: "supervisor", is_active: true },
    orderBy: { id: "asc" },
    select: { id: true, name: true }
  });

  let agents = await prisma.user.findMany({
    where: {
      tenant_id: tenant.id,
      role: "agent",
      is_active: true,
      ...(supervisor ? { supervisor_user_id: supervisor.id } : {})
    },
    orderBy: { id: "asc" },
    take: 5,
    select: { id: true, name: true, code: true, trade_direction_id: true, branch: true }
  });

  if (agents.length < 3) {
    agents = await prisma.user.findMany({
      where: { tenant_id: tenant.id, role: "agent", is_active: true },
      orderBy: { id: "asc" },
      take: 5,
      select: { id: true, name: true, code: true, trade_direction_id: true, branch: true }
    });
  }
  if (agents.length === 0) throw new Error("No active agents — avval seed:komanda yoki db:seed");

  if (supervisor) {
    await prisma.user.updateMany({
      where: { id: { in: agents.map((a) => a.id) }, tenant_id: tenant.id },
      data: {
        supervisor_user_id: supervisor.id,
        trade_direction_id: direction.id,
        trade_direction: direction.name
      }
    });
  } else {
    await prisma.user.updateMany({
      where: { id: { in: agents.map((a) => a.id) }, tenant_id: tenant.id },
      data: { trade_direction_id: direction.id, trade_direction: direction.name }
    });
  }

  const plan = await prisma.salesKpiPlan.upsert({
    where: {
      tenant_id_month_year_trade_direction_id_kpi_group_id: {
        tenant_id: tenant.id,
        month,
        year,
        trade_direction_id: direction.id,
        kpi_group_id: kpiGroup.id
      }
    },
    create: {
      tenant_id: tenant.id,
      month,
      year,
      trade_direction_id: direction.id,
      kpi_group_id: kpiGroup.id,
      status: "approved"
    },
    update: { status: "approved" },
    select: { id: true }
  });

  const planCosts = [45_000_000, 38_000_000, 52_000_000, 28_000_000, 41_000_000];
  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i]!;
    const cost = planCosts[i % planCosts.length]!;
    await prisma.salesKpiPlanTarget.upsert({
      where: {
        plan_id_user_id: { plan_id: plan.id, user_id: agent.id }
      },
      create: {
        tenant_id: tenant.id,
        plan_id: plan.id,
        user_id: agent.id,
        cost: new Prisma.Decimal(cost),
        count: 0,
        volume: 0,
        acb: 0,
        order_count: 0,
        status: "approved",
        comment: tag
      },
      update: {
        cost: new Prisma.Decimal(cost),
        status: "approved",
        comment: tag
      }
    });
  }

  const client =
    (await prisma.client.findFirst({
      where: { tenant_id: tenant.id, merged_into_client_id: null, is_active: true },
      orderBy: { id: "asc" },
      select: { id: true, name: true, zone: true, region: true, city: true }
    })) ??
    (await prisma.client.create({
      data: {
        tenant_id: tenant.id,
        name: `Daily KPI Client ${tag}`,
        is_active: true,
        agent_id: agents[0]!.id,
        zone: "Зона Центр",
        region: "Ташкент",
        city: "Чиланзар"
      },
      select: { id: true, name: true, zone: true, region: true, city: true }
    }));

  // Bir nechta kunlar uchun fakt (o‘tgan ish kunlari + bugun)
  const dayOffsets = [0, -1, -2, -3, -5];
  let ordersCreated = 0;
  for (let ai = 0; ai < agents.length; ai++) {
    const agent = agents[ai]!;
    for (const off of dayOffsets) {
      const dt = new Date();
      dt.setUTCDate(dt.getUTCDate() + off);
      const ymd = ymdInWorkRegion(dt);
      if (!ymd.startsWith(`${year}-${String(month).padStart(2, "0")}`)) continue;
      const { start } = dayUtcRange(ymd);
      const sum = 1_200_000 + ai * 350_000 + Math.abs(off) * 180_000;
      const number = `DKPI-${tag}-${agent.id}-${ymd}`.slice(0, 48);
      const existing = await prisma.order.findFirst({
        where: { tenant_id: tenant.id, number },
        select: { id: true }
      });
      if (existing) continue;
      await prisma.order.create({
        data: {
          tenant_id: tenant.id,
          number,
          client_id: client.id,
          agent_id: agent.id,
          order_type: "order",
          status: "delivered",
          total_sum: new Prisma.Decimal(sum),
          created_at: start,
          updated_at: start,
          comment: tag
        }
      });
      ordersCreated += 1;
    }
  }

  // Klientlarni agentlarga bog‘lash (hudud filteri uchun)
  for (const agent of agents.slice(0, 3)) {
    await prisma.client.updateMany({
      where: { id: client.id, tenant_id: tenant.id },
      data: {
        agent_id: agent.id,
        zone: client.zone ?? "Зона Центр",
        region: client.region ?? "Ташкент",
        city: client.city ?? "Чиланзар"
      }
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        tenant: tenant.slug,
        month,
        year,
        direction: direction.name,
        kpi_group: kpiGroup.name,
        plan_id: plan.id,
        agents: agents.map((a) => ({ id: a.id, name: a.name })),
        orders_created: ordersCreated,
        open: `/plans/daily?month=${month}&year=${year}&direction_id=${direction.id}`
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
