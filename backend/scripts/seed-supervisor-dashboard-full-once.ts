/**
 * Supervisor dashboard + KPI to‘liq sinash uchun bir martalik seed.
 *
 * - Barcha faol agentlar, supervayzerlar, ekskeditorlar va (cheklov bilan) barcha mijozlardan foydalanadi.
 * - Kun uchun `delivered` buyurtmalar: `payment_method_ref` tenant katalogidagi kalitlar bo‘yicha taqsimlanadi
 *   (NAQD, PERECHIS, …) + SEED_EMPTY_PAYMENT_RATIO ulushi bo‘sh (KPI «Не указано»).
 * - Vizitlar, reja (client_agent_assignments), foto hisobotlar — agentlar bo‘yicha qisman.
 *
 * Ishga tushirish (backend papkasidan):
 *   npx tsx scripts/seed-supervisor-dashboard-full-once.ts
 *
 * ENV:
 *   SEED_TENANT_SLUG=test1
 *   SEED_DATE=2026-05-07          # UTC sana (YYYY-MM-DD), default — bugun UTC
 *   SEED_MAX_CLIENTS=0            # 0 = SEED_CLIENT_FETCH_CAP gacha yuklash (butun bazani emas)
 *   SEED_CLIENT_FETCH_CAP=5000    # MAX_CLIENTS=0 bo‘lganda klientlardan maks. shuncha
 *   SEED_MAX_ORDERS=500           # yaratiladigan buyurtmalar yuqori chegari
 *   SEED_EMPTY_PAYMENT_RATIO=0.08 # 0..1 — payment_method_ref bo‘sh buyurtmalar ulushi
 *   SEED_VISIT_PER_AGENT=1        # har agent uchun qo‘shimcha agent_visit (0 o‘chiradi)
 *   SEED_DRY_RUN=1                # faqat hisobot, yozuv yo‘q
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/config/database";
import {
  getSupervisorDashboardSnapshot,
  type SupervisorDashboardFilters
} from "../src/modules/dashboard/dashboard.service";
import {
  paymentMethodStorageKey,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries
} from "../src/modules/tenant-settings/finance-refs";

function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function intEnv(name: string, fallback: number): number {
  const raw = (process.env[name] ?? "").trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function floatEnv(name: string, fallback: number): number {
  const raw = (process.env[name] ?? "").trim();
  if (!raw) return fallback;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
}

function boolEnv(name: string): boolean {
  const v = (process.env[name] ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

async function main() {
  const slug = (process.env.SEED_TENANT_SLUG || "test1").trim();
  const runTag = `sd_full_${Date.now()}`;
  const dryRun = boolEnv("SEED_DRY_RUN");
  const maxClients = intEnv("SEED_MAX_CLIENTS", 400);
  const clientFetchCap = intEnv("SEED_CLIENT_FETCH_CAP", 5000);
  const maxOrders = intEnv("SEED_MAX_ORDERS", 500);
  const emptyPayRatio = floatEnv("SEED_EMPTY_PAYMENT_RATIO", 0.08);
  const visitsPerAgent = intEnv("SEED_VISIT_PER_AGENT", 1);

  const today = (process.env.SEED_DATE ?? "").trim() || ymdUtc(new Date());

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, settings: true }
  });
  if (!tenant) throw new Error(`Tenant topilmadi: ${slug}`);

  const refs =
    tenant.settings && typeof tenant.settings === "object"
      ? ((tenant.settings as Record<string, unknown>).references as Record<string, unknown> | undefined) ?? {}
      : {};
  const currencyEntries = resolveCurrencyEntries(refs);
  const paymentEntries = resolvePaymentMethodEntries(refs, currencyEntries);
  const paymentKeys = paymentEntries
    .filter((e) => e.active !== false)
    .map((e) => paymentMethodStorageKey(e))
    .filter((k) => k.length > 0);
  const fallbackKeys = ["NAQD", "PERECHIS", "TERMINAL", "cash", "transfer"];
  const keysToUse = paymentKeys.length > 0 ? paymentKeys : fallbackKeys;

  const warehouse = await prisma.warehouse.findFirst({
    where: { tenant_id: tenant.id, is_active: true },
    orderBy: { id: "asc" },
    select: { id: true }
  });

  const agents = await prisma.user.findMany({
    where: { tenant_id: tenant.id, role: "agent", is_active: true },
    orderBy: { id: "asc" },
    select: { id: true, name: true, supervisor_user_id: true }
  });
  if (agents.length === 0) throw new Error("Faol agent topilmadi.");

  const supervisors = await prisma.user.findMany({
    where: { tenant_id: tenant.id, role: "supervisor", is_active: true },
    orderBy: { id: "asc" },
    select: { id: true, name: true }
  });

  const expeditors = await prisma.user.findMany({
    where: { tenant_id: tenant.id, role: "expeditor", is_active: true },
    orderBy: { id: "asc" },
    select: { id: true, name: true }
  });

  const clientWhere = {
    tenant_id: tenant.id,
    is_active: true,
    merged_into_client_id: null as null
  };
  const clientTake = maxClients > 0 ? maxClients : Math.min(clientFetchCap, 50_000);
  const clients = await prisma.client.findMany({
    where: clientWhere,
    orderBy: { id: "asc" },
    take: clientTake
  });
  if (clients.length === 0) throw new Error("Faol klient topilmadi.");

  const productRow = await prisma.product.findFirst({
    where: { tenant_id: tenant.id, is_active: true },
    orderBy: { id: "asc" },
    select: { id: true }
  });
  if (!productRow) throw new Error("Faol mahsulot topilmadi.");

  const priceRow = await prisma.productPrice.findFirst({
    where: { tenant_id: tenant.id, product_id: productRow.id },
    orderBy: { id: "asc" },
    select: { price: true }
  });
  const unitPrice = priceRow?.price ?? new Prisma.Decimal(125_000);
  const qty = new Prisma.Decimal(1);
  const lineTotal = new Prisma.Decimal(unitPrice).mul(qty);

  const targetOrderCount = Math.min(maxOrders, clients.length);
  const summary = {
    run_tag: runTag,
    tenant: tenant.slug,
    date_utc: today,
    dry_run: dryRun,
    payment_keys_from_tenant: paymentKeys,
    keys_used: keysToUse,
    agents: agents.length,
    supervisors: supervisors.length,
    expeditors: expeditors.length,
    clients_fetched: clients.length,
    client_fetch_cap: clientTake,
    orders_planned: targetOrderCount,
    visits_per_agent: visitsPerAgent,
    empty_payment_ratio: emptyPayRatio,
    created_orders: 0,
    created_visits: 0,
    created_photos: 0,
    created_assignments: 0
  };

  if (dryRun) {
    console.log(JSON.stringify(summary, null, 2));
    console.log("SEED_DRY_RUN=1 — yozuvlar yaratilmadi.");
    return;
  }

  if (warehouse) {
    await prisma.stock.upsert({
      where: {
        tenant_id_warehouse_id_product_id: {
          tenant_id: tenant.id,
          warehouse_id: warehouse.id,
          product_id: productRow.id
        }
      },
      create: {
        tenant_id: tenant.id,
        warehouse_id: warehouse.id,
        product_id: productRow.id,
        qty: new Prisma.Decimal(1_000_000),
        reserved_qty: new Prisma.Decimal(0)
      },
      update: { qty: { increment: new Prisma.Decimal(500_000) } }
    });
  }

  /** Agentlarni supervayzerga ulash (bo‘sh bo‘lsa). */
  const supId = supervisors[0]?.id ?? null;
  if (supId) {
    await prisma.user.updateMany({
      where: {
        tenant_id: tenant.id,
        role: "agent",
        is_active: true,
        supervisor_user_id: null
      },
      data: { supervisor_user_id: supId }
    });
  }

  const baseLat = 41.2995;
  const baseLon = 69.2401;

  for (let i = 0; i < targetOrderCount; i++) {
    const client = clients[i]!;
    const agent = agents[i % agents.length]!;
    const exp =
      expeditors.length > 0 ? expeditors[i % expeditors.length]! : null;

    const useEmptyPay = Math.random() < emptyPayRatio;
    const payKey = useEmptyPay ? null : keysToUse[i % keysToUse.length]!;

    const hour = 8 + (i % 12);
    const minute = (i * 13) % 60;
    const createdAt = new Date(`${today}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`);

    const number = `${runTag.slice(-8)}-${client.id}-${i}`.slice(0, 47);

    await prisma.order.create({
      data: {
        tenant_id: tenant.id,
        number,
        client_id: client.id,
        agent_id: agent.id,
        warehouse_id: warehouse?.id ?? null,
        order_type: "order",
        status: "delivered",
        total_sum: lineTotal,
        bonus_sum: new Prisma.Decimal(0),
        discount_sum: new Prisma.Decimal(0),
        payment_method_ref: payKey,
        expeditor_user_id: exp?.id ?? null,
        created_at: createdAt,
        items: {
          create: [
            {
              product_id: productRow.id,
              qty,
              price: unitPrice,
              total: lineTotal,
              is_bonus: false
            }
          ]
        }
      }
    });
    summary.created_orders++;
  }

  if (visitsPerAgent > 0) {
    for (let a = 0; a < agents.length; a++) {
      const agent = agents[a]!;
      const client =
        clients[a % clients.length] ??
        clients[0]!;
      for (let v = 0; v < visitsPerAgent; v++) {
        const checkIn = new Date(`${today}T${String(10 + v).padStart(2, "0")}:${String((a * 7 + v * 11) % 60).padStart(2, "0")}:00.000Z`);
        const checkOut = new Date(checkIn.getTime() + 15 * 60 * 1000);
        await prisma.agentVisit.create({
          data: {
            tenant_id: tenant.id,
            agent_id: agent.id,
            client_id: client.id,
            checked_in_at: checkIn,
            checked_out_at: checkOut,
            latitude: (baseLat + a * 0.002 + v * 0.0005).toFixed(8),
            longitude: (baseLon + a * 0.002 + v * 0.0005).toFixed(8),
            notes: `[${runTag}] full dashboard seed`
          }
        });
        summary.created_visits++;

        await prisma.clientPhotoReport.create({
          data: {
            tenant_id: tenant.id,
            client_id: client.id,
            order_id: null,
            created_by_user_id: agent.id,
            image_url: `https://picsum.photos/seed/${runTag}-a${agent.id}-v${v}/800/600`,
            caption: `[${runTag}] photo`
          }
        });
        summary.created_photos++;
      }

      await prisma.clientAgentAssignment.upsert({
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
          agent_id: agent.id,
          visit_date: new Date(`${today}T00:00:00.000Z`),
          visit_weekdays: [1, 2, 3, 4, 5, 6, 7]
        }
      });
      summary.created_assignments++;
    }
  }

  const primarySupervisor = supervisors[0];
  const baseFilters: SupervisorDashboardFilters = {
    date: today,
    payment_types: [],
    agent_ids: [],
    supervisor_ids: [],
    trade_directions: [],
    client_categories: [],
    territory_1_list: [],
    territory_2_list: [],
    territory_3_list: []
  };

  const snapshotAll = await getSupervisorDashboardSnapshot(tenant.id, baseFilters);
  const snapshotSupervisor = primarySupervisor
    ? await getSupervisorDashboardSnapshot(tenant.id, {
        ...baseFilters,
        supervisor_ids: [primarySupervisor.id]
      })
    : null;

  const report = {
    ...summary,
    primary_supervisor: primarySupervisor ? { id: primarySupervisor.id, name: primarySupervisor.name } : null,
    kpi_no_supervisor_filter: snapshotAll.kpi,
    kpi_as_primary_supervisor: snapshotSupervisor?.kpi ?? null,
    sales_by_payment_method: snapshotAll.kpi.sales_by_payment_method,
    visit_rows: snapshotAll.visit_report.rows.length
  };

  const outDir = path.join(process.cwd(), "scripts", "output");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${runTag}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log("\n=== SUPERVISOR DASHBOARD FULL SEED OK ===");
  console.log(`Tenant: ${tenant.slug}  Date (UTC): ${today}`);
  console.log(`Orders created: ${summary.created_orders}  Visits: ${summary.created_visits}  Photos: ${summary.created_photos}`);
  console.log(`Payment keys used: ${keysToUse.join(", ")}`);
  console.log(`KPI total_sales_sum (barcha): ${snapshotAll.kpi.total_sales_sum}`);
  console.log(`sales_by_payment_method rows: ${snapshotAll.kpi.sales_by_payment_method.length}`);
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
