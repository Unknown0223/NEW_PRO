import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/config/database";
import {
  getSupervisorDashboardSnapshot,
  type SupervisorDashboardFilters
} from "../src/modules/dashboard/dashboard.service";

type SeedRow = {
  agent_id: number;
  agent_name: string;
  client_id: number;
  client_name: string;
  order_id: number | null;
  visit_id: number;
  photo_report_id: number;
  assignment_id: number;
};

function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const slug = (process.env.SEED_TENANT_SLUG || "test1").trim();
  const runTag = `supervisor_dashboard_${Date.now()}`;
  const today = ymdUtc(new Date());

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true }
  });
  if (!tenant) {
    throw new Error(`Tenant not found: ${slug}`);
  }

  let supervisor = await prisma.user.findFirst({
    where: { tenant_id: tenant.id, role: "supervisor", is_active: true },
    orderBy: { id: "asc" },
    select: { id: true, name: true }
  });
  if (!supervisor) {
    throw new Error("Active supervisor not found.");
  }

  const existingSupLink = await prisma.user.findFirst({
    where: {
      tenant_id: tenant.id,
      role: "agent",
      is_active: true,
      supervisor_user_id: { not: null }
    },
    orderBy: { id: "asc" },
    select: { supervisor_user_id: true }
  });
  if (existingSupLink?.supervisor_user_id) {
    const s = await prisma.user.findFirst({
      where: {
        id: existingSupLink.supervisor_user_id,
        tenant_id: tenant.id,
        role: "supervisor",
        is_active: true
      },
      select: { id: true, name: true }
    });
    if (s) supervisor = s;
  }

  let agents = await prisma.user.findMany({
    where: {
      tenant_id: tenant.id,
      role: "agent",
      is_active: true,
      supervisor_user_id: supervisor.id
    },
    orderBy: { id: "asc" },
    take: 3,
    select: { id: true, name: true }
  });
  if (agents.length === 0) {
    const fallbackAgents = await prisma.user.findMany({
      where: { tenant_id: tenant.id, role: "agent", is_active: true },
      orderBy: { id: "asc" },
      take: 3,
      select: { id: true, name: true }
    });
    if (fallbackAgents.length === 0) {
      throw new Error("No active agents found.");
    }
    await prisma.user.updateMany({
      where: { id: { in: fallbackAgents.map((a) => a.id) } },
      data: { supervisor_user_id: supervisor.id }
    });
    agents = fallbackAgents;
  }

  const rows: SeedRow[] = [];
  const baseLat = 41.2995;
  const baseLon = 69.2401;

  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i]!;
    const client =
      (await prisma.client.findFirst({
        where: {
          tenant_id: tenant.id,
          is_active: true,
          merged_into_client_id: null,
          agent_id: agent.id
        },
        orderBy: { id: "asc" },
        select: { id: true, name: true }
      })) ??
      (await prisma.client.findFirst({
        where: {
          tenant_id: tenant.id,
          is_active: true,
          merged_into_client_id: null
        },
        orderBy: { id: "asc" },
        select: { id: true, name: true }
      }));
    if (!client) {
      throw new Error("No active client found.");
    }

    const latestOrder = await prisma.order.findFirst({
      where: {
        tenant_id: tenant.id,
        order_type: "order",
        status: { in: ["delivering", "delivered"] },
        agent_id: agent.id
      },
      orderBy: { id: "desc" },
      select: { id: true }
    });

    const assignment = await prisma.clientAgentAssignment.upsert({
      where: { client_id_slot: { client_id: client.id, slot: 1 } },
      create: {
        tenant_id: tenant.id,
        client_id: client.id,
        slot: 1,
        agent_id: agent.id,
        visit_date: new Date(`${today}T00:00:00.000Z`),
        visit_weekdays: [1, 2, 3, 4, 5, 6, 7]
      },
      update: {
        tenant_id: tenant.id,
        agent_id: agent.id,
        visit_date: new Date(`${today}T00:00:00.000Z`),
        visit_weekdays: [1, 2, 3, 4, 5, 6, 7]
      },
      select: { id: true }
    });

    const checkIn = new Date(Date.now() - (i + 1) * 20 * 60 * 1000);
    const checkOut = new Date(checkIn.getTime() + 8 * 60 * 1000);
    const visit = await prisma.agentVisit.create({
      data: {
        tenant_id: tenant.id,
        agent_id: agent.id,
        client_id: client.id,
        checked_in_at: checkIn,
        checked_out_at: checkOut,
        latitude: (baseLat + i * 0.004).toFixed(8),
        longitude: (baseLon + i * 0.004).toFixed(8),
        notes: `[${runTag}] seeded for supervisor dashboard`
      },
      select: { id: true }
    });

    const photo = await prisma.clientPhotoReport.create({
      data: {
        tenant_id: tenant.id,
        client_id: client.id,
        order_id: latestOrder?.id ?? null,
        created_by_user_id: agent.id,
        image_url: `https://picsum.photos/seed/${runTag}-${agent.id}/1200/800`,
        caption: `[${runTag}] dashboard test photo`
      },
      select: { id: true }
    });

    rows.push({
      agent_id: agent.id,
      agent_name: agent.name,
      client_id: client.id,
      client_name: client.name,
      order_id: latestOrder?.id ?? null,
      visit_id: visit.id,
      photo_report_id: photo.id,
      assignment_id: assignment.id
    });
  }

  const filters: SupervisorDashboardFilters = {
    date: today,
    payment_types: [],
    agent_ids: [],
    supervisor_ids: [supervisor.id],
    trade_directions: [],
    client_categories: [],
    territory_1_list: [],
    territory_2_list: [],
    territory_3_list: []
  };
  const snapshot = await getSupervisorDashboardSnapshot(tenant.id, filters);

  const report = {
    run_tag: runTag,
    tenant: tenant.slug,
    supervisor: { id: supervisor.id, name: supervisor.name },
    date: today,
    seeded_rows: rows,
    kpi: snapshot.kpi,
    visit_rows_count: snapshot.visit_report.rows.length,
    product_matrix_agents_count: snapshot.product_matrix.by_category.by_agents.length,
    efficiency_agents_count: snapshot.efficiency_report.by_agents.length
  };

  const outDir = path.join(process.cwd(), "scripts", "output");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${runTag}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log("\n=== SUPERVISOR DASHBOARD SEED DONE ===");
  console.log(`Tenant: ${tenant.slug}`);
  console.log(`Supervisor: #${supervisor.id} ${supervisor.name}`);
  console.log(`Date: ${today}`);
  console.log(`Seeded rows: ${rows.length}`);
  console.log(`KPI total_sales_sum: ${snapshot.kpi.total_sales_sum}`);
  console.log(`KPI planned_visits: ${snapshot.kpi.planned_visits}`);
  console.log(`KPI visited_total: ${snapshot.kpi.visited_total}`);
  console.log(`KPI photo_reports: ${snapshot.kpi.photo_reports}`);
  console.log(`Report: ${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
