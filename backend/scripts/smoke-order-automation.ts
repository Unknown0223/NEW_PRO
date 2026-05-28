/**
 * Order automation (restriction + auto-confirm) smoke test.
 *
 * 1) Engine — DBsiz, har doim.
 * 2) API + buyurtma yaratish — integration DB kerak (.db-integration-ready).
 *
 * Ishga tushirish:
 *   cd backend && npx tsx scripts/smoke-order-automation.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { Prisma } from "@prisma/client";
import { buildApp } from "../src/app";
import { prisma } from "../src/config/database";
import {
  autoConfirmRuleMatchesContext,
  ruleMatchesOrderContext
} from "../src/modules/order-automation/order-automation.engine";
import type { OrderRuleContext } from "../src/modules/order-automation/order-automation.types";

const SLUG = "test1";
const RULE_PREFIX = "[smoke-oa]";
const marker = join(__dirname, "../tests/.db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

let failures = 0;

function ok(msg: string) {
  console.log(`[OK] ${msg}`);
}

function fail(msg: string) {
  failures++;
  console.error(`[FAIL] ${msg}`);
}

function assert(cond: boolean, msg: string) {
  if (cond) ok(msg);
  else fail(msg);
}

function baseCtx(over: Partial<OrderRuleContext> = {}): OrderRuleContext {
  return {
    tenant_id: 1,
    total_sum: 5_000_000,
    currency_code: "UZS",
    warehouse_id: 10,
    agent_id: 5,
    agent_trade_direction: "Продажа",
    payment_method_ref: "cash",
    request_type_ref: "order",
    is_consignment: false,
    order_type: "order",
    creation_channel: "web",
    client_region: "Ташкент",
    client_city: "Ташкент",
    client_zone: null,
    client_territory_refs: ["Ташкент"],
    ...over
  };
}

function baseRule() {
  return {
    is_active: true,
    currency_code: "UZS",
    amount_from: null,
    amount_to: null,
    scope_agent_user_ids: [] as number[],
    scope_warehouse_ids: [] as number[],
    scope_territory_refs: [] as string[],
    scope_zones: [] as string[],
    scope_regions: [] as string[],
    scope_cities: [] as string[],
    payment_method_ref: null,
    trade_direction_ref: null,
    consignment_mode: "all"
  };
}

function runEngineSmoke() {
  console.log("\n=== Engine (no DB) ===\n");
  assert(ruleMatchesOrderContext(baseRule(), baseCtx()), "empty scopes match");
  assert(
    !ruleMatchesOrderContext(
      { ...baseRule(), scope_warehouse_ids: [99] },
      baseCtx({ warehouse_id: 10 })
    ),
    "warehouse scope mismatch"
  );
  assert(
    ruleMatchesOrderContext(
      { ...baseRule(), scope_warehouse_ids: [10] },
      baseCtx({ warehouse_id: 10 })
    ),
    "warehouse scope match"
  );
  assert(
    autoConfirmRuleMatchesContext(
      {
        ...baseRule(),
        request_type_refs: ["order"],
        source_channels: ["web"],
        execution_type: "instant"
      },
      baseCtx()
    ),
    "auto-confirm instant + request type"
  );
}

async function loginToken(app: Awaited<ReturnType<typeof buildApp>>): Promise<string> {
  const res = await request(app.server).post("/api/auth/login").send({
    slug: SLUG,
    login: "admin",
    password: "secret123"
  });
  if (res.status !== 200) {
    throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.accessToken as string;
}

async function mainWarehouseId(
  app: Awaited<ReturnType<typeof buildApp>>,
  token: string
): Promise<number> {
  const list = await request(app.server)
    .get(`/api/${SLUG}/warehouses`)
    .set("Authorization", `Bearer ${token}`);
  if (list.status !== 200) throw new Error(`warehouses list: ${list.status}`);
  const rows = list.body.data as { id: number; name: string; type: string | null }[];
  const main = rows.find((w) => w.type === "main") ?? rows[0];
  if (!main) throw new Error("no warehouse");
  return main.id;
}

async function ensureStock(tenantId: number, warehouseId: number) {
  const products = await prisma.product.findMany({
    where: { tenant_id: tenantId, sku: "SKU-001" },
    take: 1
  });
  const p = products[0];
  if (!p) throw new Error("SKU-001 product missing in seed");
  const plenty = new Prisma.Decimal("1000000");
  const zero = new Prisma.Decimal("0");
  await prisma.stock.upsert({
    where: {
      tenant_id_warehouse_id_product_id: {
        tenant_id: tenantId,
        warehouse_id: warehouseId,
        product_id: p.id
      }
    },
    create: {
      tenant_id: tenantId,
      warehouse_id: warehouseId,
      product_id: p.id,
      qty: plenty,
      reserved_qty: zero
    },
    update: { qty: plenty, reserved_qty: zero }
  });
  return p.id;
}

async function cleanupSmokeRules(tenantId: number) {
  await prisma.orderRestrictionRule.deleteMany({
    where: { tenant_id: tenantId, name: { startsWith: RULE_PREFIX } }
  });
  await prisma.orderAutoConfirmRule.deleteMany({
    where: { tenant_id: tenantId, name: { startsWith: RULE_PREFIX } }
  });
}

async function runApiSmoke() {
  console.log("\n=== API + order create (database) ===\n");

  const table = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'order_restriction_rules'
    ) AS exists
  `;
  if (!table[0]?.exists) {
    fail("order_restriction_rules table missing — run: npx prisma migrate deploy");
    return;
  }

  const tenant = await prisma.tenant.findUnique({ where: { slug: SLUG } });
  if (!tenant) {
    fail(`tenant slug=${SLUG} not found`);
    return;
  }

  const app = buildApp();
  await app.ready();

  const createdRuleIds: number[] = [];
  const createdAutoIds: number[] = [];

  try {
    await cleanupSmokeRules(tenant.id);
    const token = await loginToken(app);
    const warehouseId = await mainWarehouseId(app, token);
    const productId = await ensureStock(tenant.id, warehouseId);

    const agentsRes = await request(app.server)
      .get(`/api/${SLUG}/agents`)
      .set("Authorization", `Bearer ${token}`);
    assert(agentsRes.status === 200, "GET /agents");
    const agentId = (agentsRes.body.data as { id: number }[])[0]?.id;
    if (!agentId) {
      fail("no agent in seed");
      return;
    }

    const clientsRes = await request(app.server)
      .get(`/api/${SLUG}/clients?page=1&limit=5&search=Asosiy`)
      .set("Authorization", `Bearer ${token}`);
    assert(clientsRes.status === 200, "GET /clients");
    const clientId = (clientsRes.body.data as { id: number }[])[0]?.id;
    if (!clientId) {
      fail("no client in seed");
      return;
    }

    const ruleName = `${RULE_PREFIX} block wh ${warehouseId}`;
    const createRule = await request(app.server)
      .post(`/api/${SLUG}/order-restriction-rules`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: ruleName,
        is_active: true,
        scope_warehouse_ids: [warehouseId],
        consignment_mode: "all",
        currency_code: "UZS"
      });
    assert(createRule.status === 201, "POST order-restriction-rules");
    const ruleId = createRule.body.data?.id as number | undefined;
    if (!ruleId) {
      fail("restriction rule id missing");
      return;
    }
    createdRuleIds.push(ruleId);

    const listFiltered = await request(app.server)
      .get(
        `/api/${SLUG}/order-restriction-rules?page=1&limit=20&warehouse_id=${warehouseId}&is_active=true`
      )
      .set("Authorization", `Bearer ${token}`);
    assert(listFiltered.status === 200, "GET restriction rules with warehouse filter");
    const found =
      Array.isArray(listFiltered.body.data) &&
      (listFiltered.body.data as { id: number }[]).some((r) => r.id === ruleId);
    assert(found, "list filter returns created rule");

    const blocked = await request(app.server)
      .post(`/api/${SLUG}/orders`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        agent_id: agentId,
        client_id: clientId,
        warehouse_id: warehouseId,
        items: [{ product_id: productId, qty: 1 }]
      });
    assert(blocked.status === 403, "POST order blocked (403)");
    assert(blocked.body.error === "OrderRestricted", "error code OrderRestricted");

    await request(app.server)
      .patch(`/api/${SLUG}/order-restriction-rules/${ruleId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ is_active: false });
    ok("deactivated restriction rule");

    const allowed = await request(app.server)
      .post(`/api/${SLUG}/orders`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        agent_id: agentId,
        client_id: clientId,
        warehouse_id: warehouseId,
        items: [{ product_id: productId, qty: 1 }]
      });
    assert(allowed.status === 201, "POST order allowed after rule off");
    const orderId = allowed.body.id as number | undefined;
    if (orderId) {
      await prisma.order.delete({ where: { id: orderId } }).catch(() => undefined);
      ok("cleaned up test order");
    }

    const autoName = `${RULE_PREFIX} instant`;
    const createAuto = await request(app.server)
      .post(`/api/${SLUG}/order-auto-confirm-rules`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: autoName,
        is_active: true,
        scope_warehouse_ids: [warehouseId],
        execution_type: "instant",
        request_type_refs: [],
        source_channels: ["web"],
        consignment_mode: "all",
        currency_code: "UZS"
      });
    assert(createAuto.status === 201, "POST order-auto-confirm-rules");
    const autoId = createAuto.body.data?.id as number | undefined;
    if (autoId) createdAutoIds.push(autoId);

    const listAuto = await request(app.server)
      .get(
        `/api/${SLUG}/order-auto-confirm-rules?page=1&limit=20&execution_type=instant&warehouse_id=${warehouseId}`
      )
      .set("Authorization", `Bearer ${token}`);
    assert(listAuto.status === 200, "GET auto-confirm rules with filters");

    const dup = await request(app.server)
      .post(`/api/${SLUG}/order-auto-confirm-rules/${autoId}/duplicate`)
      .set("Authorization", `Bearer ${token}`);
    assert(dup.status === 201, "POST duplicate auto-confirm rule");
    const dupId = dup.body.data?.id as number | undefined;
    if (dupId) createdAutoIds.push(dupId);

    const formOptsRes = await request(app.server)
      .get(`/api/${SLUG}/order-automation/form-options`)
      .set("Authorization", `Bearer ${token}`);
    assert(formOptsRes.status === 200, "GET order-automation/form-options");
    assert(
      Array.isArray(formOptsRes.body.data?.warehouses) && formOptsRes.body.data.warehouses.length > 0,
      "form-options returns warehouses"
    );
    assert(
      Array.isArray(formOptsRes.body.data?.agents),
      "form-options returns agents list"
    );
    const currencies = formOptsRes.body.data?.currencies as { value: string; label: string }[] | undefined;
    assert(Array.isArray(currencies) && currencies.length >= 1, "form-options returns tenant currencies");
    assert(
      !currencies?.some((c) => c.value === "USD" || c.value === "EUR"),
      "currencies from settings only (no hardcoded USD/EUR unless in tenant)"
    );
  } finally {
    await cleanupSmokeRules(tenant.id);
    await app.close();
  }
}

async function main() {
  console.log("Order automation smoke test\n");

  runEngineSmoke();

  if (!dbReady) {
    console.log(
      "\n[WARN] Database integration skipped — create tests/.db-integration-ready with content `1`"
    );
    console.log("       (after migrate + seed on test DB)\n");
  } else {
    try {
      await runApiSmoke();
    } catch (e) {
      fail(`API smoke threw: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      await prisma.$disconnect();
    }
  }

  console.log(`\n=== Done: ${failures === 0 ? "ALL PASSED" : `${failures} failure(s)`} ===\n`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
