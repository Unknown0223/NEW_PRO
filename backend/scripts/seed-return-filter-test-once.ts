/**
 * Qaytarish filtri test mijozi: davr / balans 0 / ikkalasi uchun zakazlar.
 * Ishga tushirish: npm run seed:return-filter-test
 */
import "dotenv/config";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/config/database";
import { createOrder, updateOrderStatus } from "../src/modules/orders/orders.service";
import { createPayment } from "../src/modules/payments/payment.create";
import { buildReturnFilterMetaForClient } from "../src/modules/returns/returns-filter.stats";
import { listClientOrderPickBalancesWithMeta } from "../src/modules/returns/returns-enhanced.client-data";
import {
  buildOrderCreatedAtFilter,
  resolveReturnEligibleWindowSync,
  subtractReturnPeriod
} from "../src/modules/returns/returns-filter.service";
import { computeLedgerRunningBalance, findLatestBalanceZeroAt } from "../src/modules/returns/returns-filter.balance-zero";
import type { ReturnFilterSettings } from "../src/modules/returns/returns-filter.types";
import { POLKI_SOURCE_ORDER_STATUS } from "../src/modules/returns/returns-enhanced.client-data.shared";

const TAG = "[FILTR-TEST]";
const CLIENT_NAME = "FILTR-TEST mijoz (polki)";

type Ctx = {
  tenantId: number;
  clientId: number;
  warehouseId: number;
  actorId: number;
  agentId: number;
  productId: number;
  paymentType: string;
};

function daysAgo(n: number, hour = 12): Date {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

async function deliver(tenantId: number, orderId: number, actorId: number) {
  for (const status of ["confirmed", "picking", "delivering", "delivered"] as const) {
    await updateOrderStatus(tenantId, orderId, status, actorId);
  }
}

async function deliverAt(ctx: Ctx, comment: string, qty: number, at: Date) {
  const o = await createOrder(ctx.tenantId, {
    agent_id: ctx.agentId,
    client_id: ctx.clientId,
    warehouse_id: ctx.warehouseId,
    items: [{ product_id: ctx.productId, qty }],
    apply_bonus: false,
    comment: `${TAG} ${comment}`
  });
  await deliver(ctx.tenantId, o.id, ctx.actorId);
  await prisma.order.update({
    where: { id: o.id },
    data: { created_at: at, updated_at: at }
  });
  const full = await prisma.order.findUnique({
    where: { id: o.id },
    select: { id: true, number: true, total_sum: true }
  });
  if (!full) throw new Error(`Order ${o.id} topilmadi`);
  return full;
}

async function setupCtx(): Promise<Ctx> {
  const slug = (process.env.SEED_TENANT_SLUG || "test1").trim();
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) throw new Error(`Tenant: ${slug}`);

  const actor = await prisma.user.findFirst({
    where: { tenant_id: tenant.id, role: "admin", is_active: true },
    select: { id: true }
  });
  if (!actor) throw new Error("admin topilmadi");

  const agent = await prisma.user.findFirst({
    where: { tenant_id: tenant.id, login: "agent", is_active: true },
    select: { id: true }
  });
  if (!agent) throw new Error("agent (seed) topilmadi");

  let client = await prisma.client.findFirst({
    where: {
      tenant_id: tenant.id,
      merged_into_client_id: null,
      name: CLIENT_NAME
    },
    select: { id: true }
  });
  if (!client) {
    client = await prisma.client.create({
      data: {
        tenant_id: tenant.id,
        name: CLIENT_NAME,
        phone: "+998901009999",
        is_active: true,
        agent_id: agent.id,
        credit_limit: new Prisma.Decimal(50_000_000)
      },
      select: { id: true }
    });
  } else {
    await prisma.client.update({
      where: { id: client.id },
      data: { agent_id: agent.id, is_active: true }
    });
  }

  const warehouse = await prisma.warehouse.findFirst({
    where: { tenant_id: tenant.id, type: "main", is_active: true },
    select: { id: true }
  });
  if (!warehouse) throw new Error("main ombor topilmadi");

  const product = await prisma.product.findFirst({
    where: { tenant_id: tenant.id, sku: "SKU-001", is_active: true },
    select: { id: true }
  });
  if (!product) throw new Error("SKU-001 topilmadi");

  await prisma.stock.upsert({
    where: {
      tenant_id_warehouse_id_product_id: {
        tenant_id: tenant.id,
        warehouse_id: warehouse.id,
        product_id: product.id
      }
    },
    create: {
      tenant_id: tenant.id,
      warehouse_id: warehouse.id,
      product_id: product.id,
      qty: new Prisma.Decimal(1_000_000),
      reserved_qty: new Prisma.Decimal(0)
    },
    update: { qty: new Prisma.Decimal(1_000_000), reserved_qty: new Prisma.Decimal(0) }
  });

  const tenantRow = await prisma.tenant.findUnique({
    where: { id: tenant.id },
    select: { settings: true }
  });
  const refs = (
    tenantRow?.settings as { references?: { payment_method_entries?: Array<{ id: string }> } } | null
  )?.references?.payment_method_entries;
  const paymentType = refs?.[0]?.id ?? "cash";

  return {
    tenantId: tenant.id,
    clientId: client.id,
    warehouseId: warehouse.id,
    actorId: actor.id,
    agentId: agent.id,
    productId: product.id,
    paymentType
  };
}

async function verifyFilter(
  tenantId: number,
  clientId: number,
  label: string,
  settings: ReturnFilterSettings
) {
  const now = new Date();
  const periodFrom = settings.period_enabled
    ? subtractReturnPeriod(now, settings.period_value, settings.period_unit)
    : null;
  let balanceZeroAt: Date | null = null;
  if (settings.balance_zero_enabled) {
    balanceZeroAt = await findLatestBalanceZeroAt(
      tenantId,
      clientId,
      settings.period_enabled ? periodFrom : null,
      now
    );
  }
  const window = resolveReturnEligibleWindowSync(settings, balanceZeroAt, now);
  const createdAt = buildOrderCreatedAtFilter(window);
  const count = window.empty
    ? 0
    : await prisma.order.count({
        where: {
          tenant_id: tenantId,
          client_id: clientId,
          status: POLKI_SOURCE_ORDER_STATUS,
          ...(createdAt ? { created_at: createdAt } : {})
        }
      });
  console.log(
    `  ${label}: filtr=${count} ta${window.empty ? " (bo‘sh)" : ""}${balanceZeroAt ? `, balans0=${balanceZeroAt.toISOString().slice(0, 10)}` : ""}`
  );
}

async function cleanupPriorSeed(tenantId: number, clientId: number) {
  const orders = await prisma.order.findMany({
    where: { tenant_id: tenantId, client_id: clientId, comment: { contains: TAG } },
    select: { id: true }
  });
  const ids = orders.map((o) => o.id);
  if (ids.length > 0) {
    await prisma.salesReturn.deleteMany({ where: { tenant_id: tenantId, order_id: { in: ids } } });
    await prisma.paymentAllocation.deleteMany({ where: { tenant_id: tenantId, order_id: { in: ids } } });
    await prisma.orderItem.deleteMany({ where: { order_id: { in: ids } } });
    await prisma.orderStatusLog.deleteMany({ where: { order_id: { in: ids } } });
    await prisma.order.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.payment.deleteMany({
    where: { tenant_id: tenantId, client_id: clientId, note: { contains: TAG } }
  });
}

async function main() {
  const ctx = await setupCtx();
  await cleanupPriorSeed(ctx.tenantId, ctx.clientId);
  const created: Array<{ tag: string; id: number; number: string; at: string }> = [];

  // Eski (davr tashqarisi) — 3 ta
  for (let i = 1; i <= 3; i++) {
    const at = daysAgo(15, 10 + i);
    const o = await deliverAt(ctx, `OLD-${i}`, 5, at);
    created.push({ tag: `OLD-${i}`, id: o.id, number: o.number, at: at.toISOString().slice(0, 10) });
  }

  // Balans 0 nuqtasi: joriy ledger qarzini to‘liq yopish (5 kun oldin)
  const zeroDay = daysAgo(5, 11);
  const ledgerBeforeZero = await computeLedgerRunningBalance(ctx.tenantId, ctx.clientId, zeroDay);
  if (ledgerBeforeZero.lt(0)) {
    await createPayment(
      ctx.tenantId,
      {
        client_id: ctx.clientId,
        amount: Number(ledgerBeforeZero.abs().toString()),
        payment_type: ctx.paymentType,
        paid_at: zeroDay.toISOString(),
        note: `${TAG} ZERO-CLEAR — balans 0`
      },
      ctx.actorId
    );
    created.push({
      tag: "ZERO-CLEAR",
      id: 0,
      number: "—",
      at: zeroDay.toISOString().slice(0, 10)
    });
  }

  // Balans 0 dan keyin — 3 ta (2 kun oldin)
  for (let i = 1; i <= 3; i++) {
    const at = daysAgo(2, 10 + i);
    const o = await deliverAt(ctx, `AFTER-ZERO-${i}`, 6, at);
    created.push({ tag: `AFTER-ZERO-${i}`, id: o.id, number: o.number, at: at.toISOString().slice(0, 10) });
  }

  // Bugun — 3 ta (qarzli, to‘lovsiz)
  for (let i = 1; i <= 3; i++) {
    const at = daysAgo(0, 8 + i);
    const o = await deliverAt(ctx, `TODAY-${i}`, 6, at);
    created.push({ tag: `TODAY-${i}`, id: o.id, number: o.number, at: at.toISOString().slice(0, 10) });
  }

  console.log("\n=== FILTR-TEST mijoz yaratildi ===\n");
  console.log(`Mijoz: ${CLIENT_NAME} (id=${ctx.clientId})`);
  console.log(`Agent: Agent (seed) (id=${ctx.agentId})`);
  console.log(`Web: /orders/new?type=return_by_order — mijozni tanlang\n`);
  console.log("Zakazlar:");
  for (const row of created) {
    console.log(`  ${row.tag.padEnd(14)} №${row.number} id=${row.id} sana=${row.at}`);
  }

  console.log("\nFiltr tekshiruvi (7 kun + balans 0 / faqat davr / faqat balans 0 / filtr yo‘q):\n");

  const settingsBase: ReturnFilterSettings = {
    period_enabled: true,
    period_unit: "day",
    period_value: 7,
    balance_zero_enabled: false
  };

  await verifyFilter(ctx.tenantId, ctx.clientId, "HOLAT 1 — faqat davr 7 kun", {
    ...settingsBase,
    balance_zero_enabled: false
  });

  await verifyFilter(ctx.tenantId, ctx.clientId, "HOLAT 2 — faqat balans 0", {
    ...settingsBase,
    period_enabled: false,
    balance_zero_enabled: true
  });

  await verifyFilter(ctx.tenantId, ctx.clientId, "HOLAT 3 — davr 7 kun + balans 0", {
    ...settingsBase,
    period_enabled: true,
    balance_zero_enabled: true
  });

  await verifyFilter(ctx.tenantId, ctx.clientId, "HOLAT 4 — filtr yo‘q", {
    period_enabled: false,
    period_unit: "day",
    period_value: 7,
    balance_zero_enabled: false
  });

  const live = await buildReturnFilterMetaForClient(ctx.tenantId, ctx.clientId);
  const pick = await listClientOrderPickBalancesWithMeta(ctx.tenantId, ctx.clientId);
  console.log(
    `\nJoriy tenant sozlamasi: filtr=${live.meta.delivered_after_filter} ta, po-zakaz ro‘yxat=${pick.balances.length} ta`
  );

  console.log("\nKutilgan:");
  console.log("  HOLAT 1: ~6 ta (AFTER-ZERO×3 + TODAY×3, ZERO-CLEAR zakaz emas)");
  console.log("  HOLAT 2: ~6 ta (balans 0 dan keyingilar)");
  console.log("  HOLAT 3: ~6 ta (ZERO-CLEAR 5 kun oldin — davr ichida)");
  console.log("  HOLAT 4: ~10 ta (OLD×3 ham kiradi)\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
