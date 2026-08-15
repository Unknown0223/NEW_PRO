/**
 * Orders list + «Старые цены» (prices-as-of) test fixture.
 *
 * Qo‘shadi (tenant test1 yoki SEED_TENANT_SLUG):
 * - 2 ta mahsulot (ASOF-P1 / ASOF-P2) + joriy retail narxlar
 * - applied `product_price_schedules` eski sanada (source=schedule)
 * - 2 ta bugungi zakaz (+ 1 ta kechagi, filter tekshiruvi)
 *
 * Ishga tushirish:
 *   cd backend && npm run seed:orders-prices-asof-test
 *   SEED_TENANT_SLUG=test1 npm run seed:orders-prices-asof-test
 *
 * Keyin smoke:
 *   npm run smoke:orders-prices-asof
 */
import "dotenv/config";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/config/database";
import { createOrder } from "../src/modules/orders/orders.service";
import { PRICE_SCHEDULE_STATUS } from "../src/modules/products/product-price-schedules.service";

const TAG = "[ORDERS-ASOF-TEST]";
const CLIENT_NAME = "ASOF-TEST mijoz (orders)";
const PRICE_TYPE = "retail";

/** UI / smoke uchun: shu sanada as-of → eski narx + source=schedule */
const OLD_AS_OF_YMD = "2025-06-15";
const OLD_PRICES: Record<string, number> = { "ASOF-P1": 12_000, "ASOF-P2": 30_000 };
const CURRENT_PRICES: Record<string, number> = { "ASOF-P1": 25_000, "ASOF-P2": 60_000 };

const PRODUCTS: Array<{ sku: string; name: string; unit: string }> = [
  { sku: "ASOF-P1", name: "ASOF Test Mahsulot 1", unit: "quti" },
  { sku: "ASOF-P2", name: "ASOF Test Mahsulot 2", unit: "dona" }
];

function workRegionOffsetMs(): number {
  return 5 * 3600 * 1000;
}

function ymdInWorkRegion(d = new Date()): string {
  return new Date(d.getTime() + workRegionOffsetMs()).toISOString().slice(0, 10);
}

/** Asia/Tashkent kun o‘rtasi (UTC). */
function middayUtcFromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((x) => Number.parseInt(x, 10));
  return new Date(Date.UTC(y, m - 1, d, 7, 0, 0, 0)); // 12:00 Tashkent
}

function daysAgoLocal(n: number, hour = 12): Date {
  const now = new Date();
  const local = new Date(now.getTime() + workRegionOffsetMs());
  local.setUTCHours(hour, 0, 0, 0);
  local.setUTCDate(local.getUTCDate() - n);
  return new Date(local.getTime() - workRegionOffsetMs());
}

async function cleanupPriorOrders(tenantId: number, clientId: number) {
  const orders = await prisma.order.findMany({
    where: { tenant_id: tenantId, client_id: clientId, comment: { contains: TAG } },
    select: { id: true }
  });
  const ids = orders.map((o) => o.id);
  if (ids.length === 0) return;
  await prisma.paymentAllocation.deleteMany({ where: { tenant_id: tenantId, order_id: { in: ids } } });
  await prisma.orderItem.deleteMany({ where: { order_id: { in: ids } } });
  await prisma.orderStatusLog.deleteMany({ where: { order_id: { in: ids } } });
  await prisma.order.deleteMany({ where: { id: { in: ids } } });
  console.log(`${TAG} eski zakazlar o‘chirildi: ${ids.length}`);
}

async function ensureProducts(tenantId: number) {
  const out: Array<{ id: number; sku: string }> = [];
  for (const p of PRODUCTS) {
    const row = await prisma.product.upsert({
      where: { tenant_id_sku: { tenant_id: tenantId, sku: p.sku } },
      create: {
        tenant_id: tenantId,
        sku: p.sku,
        name: p.name,
        unit: p.unit,
        is_active: true,
        comment: TAG
      },
      update: { name: p.name, is_active: true, comment: TAG },
      select: { id: true, sku: true }
    });
    out.push(row);
  }
  return out;
}

async function ensurePricesAndSchedules(
  tenantId: number,
  products: Array<{ id: number; sku: string }>,
  actorId: number | null
) {
  const oldAt = middayUtcFromYmd(OLD_AS_OF_YMD);
  const recentAt = daysAgoLocal(1, 10);
  const productIds = products.map((p) => p.id);

  // Idempotent: faqat fixture mahsulotlarining applied tarixini qayta yozamiz.
  await prisma.productPriceSchedule.deleteMany({
    where: {
      tenant_id: tenantId,
      product_id: { in: productIds },
      price_type: PRICE_TYPE,
      status: PRICE_SCHEDULE_STATUS.applied
    }
  });

  for (const p of products) {
    const current = CURRENT_PRICES[p.sku]!;
    const old = OLD_PRICES[p.sku]!;
    await prisma.productPrice.upsert({
      where: {
        tenant_id_product_id_price_type: {
          tenant_id: tenantId,
          product_id: p.id,
          price_type: PRICE_TYPE
        }
      },
      create: {
        tenant_id: tenantId,
        product_id: p.id,
        price_type: PRICE_TYPE,
        price: new Prisma.Decimal(current),
        currency: "UZS"
      },
      update: { price: new Prisma.Decimal(current), currency: "UZS" }
    });

    await prisma.productPriceSchedule.createMany({
      data: [
        {
          tenant_id: tenantId,
          product_id: p.id,
          price_type: PRICE_TYPE,
          price: new Prisma.Decimal(old),
          currency: "UZS",
          effective_at: oldAt,
          status: PRICE_SCHEDULE_STATUS.applied,
          applied_at: oldAt,
          created_by: actorId ?? undefined
        },
        {
          tenant_id: tenantId,
          product_id: p.id,
          price_type: PRICE_TYPE,
          price: new Prisma.Decimal(current),
          currency: "UZS",
          effective_at: recentAt,
          status: PRICE_SCHEDULE_STATUS.applied,
          applied_at: recentAt,
          created_by: actorId ?? undefined
        }
      ]
    });
  }
}

async function ensureStock(
  tenantId: number,
  warehouseId: number,
  productIds: number[]
) {
  const qty = new Prisma.Decimal(1_000_000);
  const zero = new Prisma.Decimal(0);
  for (const productId of productIds) {
    await prisma.stock.upsert({
      where: {
        tenant_id_warehouse_id_product_id: {
          tenant_id: tenantId,
          warehouse_id: warehouseId,
          product_id: productId
        }
      },
      create: {
        tenant_id: tenantId,
        warehouse_id: warehouseId,
        product_id: productId,
        qty,
        reserved_qty: zero
      },
      update: { qty, reserved_qty: zero }
    });
  }
}

async function ensureClient(tenantId: number, agentId: number) {
  let client = await prisma.client.findFirst({
    where: { tenant_id: tenantId, name: CLIENT_NAME, merged_into_client_id: null },
    select: { id: true }
  });
  if (!client) {
    client = await prisma.client.create({
      data: {
        tenant_id: tenantId,
        name: CLIENT_NAME,
        phone: "+998901008888",
        is_active: true,
        agent_id: agentId,
        credit_limit: new Prisma.Decimal(50_000_000)
      },
      select: { id: true }
    });
  } else {
    await prisma.client.update({
      where: { id: client.id },
      data: { agent_id: agentId, is_active: true }
    });
  }
  return client.id;
}

async function main() {
  const slug = (process.env.SEED_TENANT_SLUG || "test1").trim();
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, slug: true }
  });
  if (!tenant) throw new Error(`Tenant topilmadi: ${slug}`);

  const actor = await prisma.user.findFirst({
    where: { tenant_id: tenant.id, role: "admin", is_active: true },
    select: { id: true, login: true }
  });
  if (!actor) throw new Error("admin topilmadi");

  const agent = await prisma.user.findFirst({
    where: { tenant_id: tenant.id, role: "agent", is_active: true },
    orderBy: { id: "asc" },
    select: { id: true, login: true, name: true }
  });
  if (!agent) throw new Error("faol agent topilmadi");

  const warehouse = await prisma.warehouse.findFirst({
    where: { tenant_id: tenant.id, is_active: true },
    orderBy: [{ type: "asc" }, { id: "asc" }],
    select: { id: true, name: true, type: true }
  });
  if (!warehouse) throw new Error("ombor topilmadi");

  const products = await ensureProducts(tenant.id);
  await ensurePricesAndSchedules(tenant.id, products, actor.id);
  await ensureStock(
    tenant.id,
    warehouse.id,
    products.map((p) => p.id)
  );
  const clientId = await ensureClient(tenant.id, agent.id);
  await cleanupPriorOrders(tenant.id, clientId);

  const todayYmd = ymdInWorkRegion();
  const p1 = products[0]!;
  const p2 = products[1]!;

  const todaySpecs = [
    { comment: `${TAG} TODAY-1`, items: [{ product_id: p1.id, qty: 2 }] },
    { comment: `${TAG} TODAY-2`, items: [{ product_id: p2.id, qty: 1 }] }
  ];
  const createdToday: Array<{ id: number; number: string; comment: string }> = [];
  for (const spec of todaySpecs) {
    const o = await createOrder(tenant.id, {
      agent_id: agent.id,
      client_id: clientId,
      warehouse_id: warehouse.id,
      price_type: PRICE_TYPE,
      items: spec.items,
      apply_bonus: false,
      comment: spec.comment
    });
    createdToday.push({ id: o.id, number: o.number, comment: spec.comment });
  }

  const yesterdayAt = daysAgoLocal(1, 14);
  const yesterday = await createOrder(tenant.id, {
    agent_id: agent.id,
    client_id: clientId,
    warehouse_id: warehouse.id,
    price_type: PRICE_TYPE,
    items: [{ product_id: p1.id, qty: 1 }],
    apply_bonus: false,
    comment: `${TAG} YESTERDAY`
  });
  await prisma.order.update({
    where: { id: yesterday.id },
    data: { created_at: yesterdayAt, updated_at: yesterdayAt }
  });

  console.log("\n── seed:orders-prices-asof-test ──");
  console.log(`tenant: ${tenant.slug} (id=${tenant.id})`);
  console.log(`client: ${CLIENT_NAME} (id=${clientId})`);
  console.log(`agent: ${agent.login ?? agent.name} (id=${agent.id})`);
  console.log(`warehouse: ${warehouse.name} (id=${warehouse.id})`);
  console.log(`price_type: ${PRICE_TYPE}`);
  console.log(`as_of (старые цены): ${OLD_AS_OF_YMD}`);
  for (const p of products) {
    console.log(
      `  ${p.sku} id=${p.id}  old=${OLD_PRICES[p.sku]}  current=${CURRENT_PRICES[p.sku]}`
    );
  }
  console.log(`today (${todayYmd}) orders:`);
  for (const o of createdToday) {
    console.log(`  #${o.number} id=${o.id}  ${o.comment}`);
  }
  console.log(
    `yesterday order: #${yesterday.number} id=${yesterday.id} at=${yesterdayAt.toISOString()}`
  );
  console.log("\nTekshiruv:");
  console.log(`  UI /orders — bugungi ro‘yxatda #${createdToday.map((o) => o.number).join(", ")}`);
  console.log(
    `  GET /api/${slug}/orders/prices-as-of?as_of=${OLD_AS_OF_YMD}&price_type=${PRICE_TYPE}&product_ids=${p1.id},${p2.id}`
  );
  console.log(`  smoke: npm run smoke:orders-prices-asof`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    // Redis / event-bus ochiq socketlar processni ushlab qolmasin
    process.exit(0);
  });
