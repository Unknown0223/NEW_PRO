/**
 * Orders list (bugun) + prices-as-of + create validation smoke.
 *
 * Old shart: seed ishlagan bo‘lsin:
 *   npm run seed:orders-prices-asof-test
 *
 * Ishga tushirish:
 *   cd backend && npm run smoke:orders-prices-asof
 */
import "dotenv/config";
import request from "supertest";
import { buildApp } from "../src/app";
import { prisma } from "../src/config/database";

const SLUG = (process.env.SEED_TENANT_SLUG || "test1").trim();
const TAG = "[ORDERS-ASOF-TEST]";
const OLD_AS_OF_YMD = "2025-06-15";
const PRICE_TYPE = "retail";
const LOGIN = process.env.SMOKE_LOGIN || "admin";
const PASSWORD = process.env.SMOKE_PASSWORD || "secret123";

let failures = 0;

function ok(msg: string) {
  console.log(`[PASS] ${msg}`);
}

function fail(msg: string) {
  failures++;
  console.error(`[FAIL] ${msg}`);
}

function assert(cond: boolean, msg: string) {
  if (cond) ok(msg);
  else fail(msg);
}

function workRegionOffsetMs(): number {
  return 5 * 3600 * 1000;
}

function ymdInWorkRegion(d = new Date()): string {
  return new Date(d.getTime() + workRegionOffsetMs()).toISOString().slice(0, 10);
}

async function loginToken(app: Awaited<ReturnType<typeof buildApp>>): Promise<string> {
  const res = await request(app.server).post("/api/auth/login").send({
    slug: SLUG,
    login: LOGIN,
    password: PASSWORD
  });
  if (res.status !== 200) {
    throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.accessToken as string;
}

async function main() {
  console.log("\n=== smoke:orders-prices-asof ===\n");

  const tenant = await prisma.tenant.findUnique({ where: { slug: SLUG } });
  if (!tenant) {
    fail(`tenant ${SLUG} topilmadi`);
    process.exit(1);
  }

  const products = await prisma.product.findMany({
    where: { tenant_id: tenant.id, sku: { in: ["ASOF-P1", "ASOF-P2"] }, is_active: true },
    select: { id: true, sku: true },
    orderBy: { sku: "asc" }
  });
  assert(products.length === 2, `fixture products ASOF-P1/P2 mavjud (${products.length}/2)`);
  if (products.length < 2) {
    fail("Avval: npm run seed:orders-prices-asof-test");
    process.exit(1);
  }

  const todayYmd = ymdInWorkRegion();
  const productIds = products.map((p) => p.id).join(",");

  const app = buildApp();
  await app.ready();

  try {
    const token = await loginToken(app);
    ok(`login ${LOGIN}@${SLUG}`);

    // 1) Bugungi zakazlar
    const list = await request(app.server)
      .get(`/api/${SLUG}/orders`)
      .query({ date_from: todayYmd, date_to: todayYmd, page: 1, limit: 50 })
      .set("Authorization", `Bearer ${token}`);
    assert(list.status === 200, `GET orders today → ${list.status}`);
    const rows = (list.body?.data ?? []) as Array<{ id: number; number: string; comment?: string | null }>;
    const seeded = rows.filter((o) => (o.comment ?? "").includes(TAG) && (o.comment ?? "").includes("TODAY"));
    assert(seeded.length >= 2, `bugungi seed zakazlar ≥2 (topildi ${seeded.length})`);
    if (seeded.length > 0) {
      console.log(`       numbers: ${seeded.map((o) => o.number).join(", ")}`);
    }

    // 2) Старые цены
    const asOf = await request(app.server)
      .get(`/api/${SLUG}/orders/prices-as-of`)
      .query({ as_of: OLD_AS_OF_YMD, price_type: PRICE_TYPE, product_ids: productIds })
      .set("Authorization", `Bearer ${token}`);
    assert(asOf.status === 200, `GET prices-as-of → ${asOf.status}`);
    const items = (asOf.body?.items ?? []) as Array<{
      product_id: number;
      price: string | null;
      source: string;
    }>;
    assert(items.length === products.length, `as-of items count=${items.length}`);
    for (const p of products) {
      const row = items.find((i) => i.product_id === p.id);
      const expected = p.sku === "ASOF-P1" ? "12000" : "30000";
      assert(!!row, `${p.sku} as-of row`);
      assert(row?.source === "schedule", `${p.sku} source=schedule (got ${row?.source})`);
      assert(
        row?.price != null && Number(row.price) === Number(expected),
        `${p.sku} price=${row?.price} (expected ${expected})`
      );
    }

    // Bad as_of
    const badAsOf = await request(app.server)
      .get(`/api/${SLUG}/orders/prices-as-of`)
      .query({ as_of: "not-a-date", price_type: PRICE_TYPE, product_ids: productIds })
      .set("Authorization", `Bearer ${token}`);
    assert(badAsOf.status === 400, `prices-as-of bad as_of → 400 (got ${badAsOf.status})`);

    // 3) Create validation
    const client = await prisma.client.findFirst({
      where: { tenant_id: tenant.id, name: "ASOF-TEST mijoz (orders)" },
      select: { id: true }
    });
    const warehouse = await prisma.warehouse.findFirst({
      where: { tenant_id: tenant.id, is_active: true },
      select: { id: true }
    });
    const agent = await prisma.user.findFirst({
      where: { tenant_id: tenant.id, role: "agent", is_active: true },
      select: { id: true }
    });
    assert(!!client && !!warehouse && !!agent, "client/warehouse/agent for create checks");

    const badQty = await request(app.server)
      .post(`/api/${SLUG}/orders`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        client_id: client!.id,
        warehouse_id: warehouse!.id,
        agent_id: agent!.id,
        items: [{ product_id: products[0]!.id, qty: -1 }]
      });
    assert(badQty.status === 400, `POST order qty=-1 → 400 (got ${badQty.status})`);

    const emptyItems = await request(app.server)
      .post(`/api/${SLUG}/orders`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        client_id: client!.id,
        warehouse_id: warehouse!.id,
        agent_id: agent!.id,
        items: []
      });
    assert(emptyItems.status === 400, `POST order empty items → 400 (got ${emptyItems.status})`);

    const badAsOfCreate = await request(app.server)
      .post(`/api/${SLUG}/orders`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        client_id: client!.id,
        warehouse_id: warehouse!.id,
        agent_id: agent!.id,
        price_as_of: "22-07-2026",
        items: [{ product_id: products[0]!.id, qty: 1 }]
      });
    assert(
      badAsOfCreate.status === 400,
      `POST order bad price_as_of → 400 (got ${badAsOfCreate.status})`
    );
  } finally {
    await app.close();
    await prisma.$disconnect();
  }

  console.log(failures === 0 ? "\n=== ALL PASS ===\n" : `\n=== FAILED: ${failures} ===\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
