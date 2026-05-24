/**
 * Po-zakaz + erkin polki: 7 stsenariy, barcha vozvratlar to‘liq.
 * Ishga tushirish: npm run seed:polki-return-scenarios
 */
import "dotenv/config";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/config/database";
import { createOrder, updateOrderStatus } from "../src/modules/orders/orders.service";
import { createPeriodReturn } from "../src/modules/returns/returns-enhanced.create-period";
import { previewPolkiAutoBonusReverse } from "../src/modules/returns/returns-bonus-reverse.preview";
import { computeOrderReturnBalance } from "../src/modules/returns/returns-order-balance";
import { adjustOrderItemsQtyAfterPriorReturns } from "../src/modules/returns/returns-enhanced.helpers";
import type { OrderItemSummary } from "../src/modules/returns/returns-enhanced.types";

const TAG = "[POLKI-FULL]";

type VrRow = { number: string; refund: string; note: string };

type ScenarioRow = {
  code: string;
  order_id: number | null;
  order_number: string;
  polki_turi: "po_zakaz" | "erkin";
  shart: string;
  returns: VrRow[];
  qoldiq: { paid: number; bonus: number; fully_returned: boolean };
};

type Ctx = {
  tenantId: number;
  clientId: number;
  warehouseId: number;
  actorId: number;
  agentId: number;
  p1: { id: number };
  p2: { id: number };
  p3: { id: number } | undefined;
};

async function deliver(tenantId: number, orderId: number, actorId: number) {
  for (const status of ["confirmed", "picking", "delivering", "delivered"] as const) {
    await updateOrderStatus(tenantId, orderId, status, actorId);
  }
}

async function loadOrderItems(
  tenantId: number,
  clientId: number,
  orderId: number
): Promise<OrderItemSummary[]> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, tenant_id: tenantId, client_id: clientId },
    include: {
      items: {
        select: {
          product_id: true,
          qty: true,
          price: true,
          total: true,
          is_bonus: true,
          product: { select: { sku: true, name: true, unit: true, category_id: true } }
        }
      }
    }
  });
  if (!order) throw new Error(`Order ${orderId} topilmadi`);
  return order.items.map((it) => ({
    product_id: it.product_id,
    sku: it.product.sku,
    name: it.product.name,
    unit: it.product.unit,
    qty: String(it.qty),
    price: String(it.price),
    total: String(it.total),
    is_bonus: it.is_bonus,
    order_id: orderId,
    order_number: order.number,
    category_id: it.product.category_id
  }));
}

async function balanceAfter(ctx: Ctx, orderId: number) {
  const originalItems = await loadOrderItems(ctx.tenantId, ctx.clientId, orderId);
  const prev = await prisma.salesReturn.findMany({
    where: {
      tenant_id: ctx.tenantId,
      client_id: ctx.clientId,
      order_id: orderId,
      status: "posted"
    },
    select: {
      order_id: true,
      lines: { select: { product_id: true, qty: true, paid_qty: true, bonus_qty: true } }
    }
  });
  const remaining = adjustOrderItemsQtyAfterPriorReturns(originalItems, prev);
  return computeOrderReturnBalance(orderId, originalItems, remaining, prev);
}

function remainingQtyByProduct(items: OrderItemSummary[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const it of items) {
    const q = Math.floor(Number(it.qty) + 1e-9);
    if (q > 0) m.set(it.product_id, (m.get(it.product_id) ?? 0) + q);
  }
  return m;
}

async function ret(
  ctx: Ctx,
  input: {
    order_id?: number;
    date_from?: string;
    date_to?: string;
    lines: Array<{ product_id: number; qty?: number; paid_qty?: number; bonus_qty?: number }>;
    note: string;
  }
): Promise<VrRow & { id?: number }> {
  const r = await createPeriodReturn(
    ctx.tenantId,
    {
      client_id: ctx.clientId,
      order_id: input.order_id,
      warehouse_id: ctx.warehouseId,
      price_type: "retail",
      date_from: input.date_from,
      date_to: input.date_to,
      note: `${TAG} ${input.note}`,
      lines: input.lines
    },
    ctx.actorId
  );
  return { number: r.number, refund: r.refund_amount, note: input.note };
}

async function retAuto(
  ctx: Ctx,
  orderId: number,
  productQty: Array<{ product_id: number; qty: number }>,
  note: string
): Promise<VrRow> {
  const preview = await previewPolkiAutoBonusReverse(ctx.tenantId, {
    client_id: ctx.clientId,
    order_id: orderId,
    price_type: "retail",
    lines: productQty.filter((l) => l.qty > 0).map((l) => ({ product_id: l.product_id, return_qty: l.qty }))
  });
  const lines = preview.lines.map((l) => ({
    product_id: l.product_id,
    paid_qty: l.paid_qty,
    bonus_qty: l.bonus_qty,
    bonus_cash: 0
  }));
  if (lines.length === 0) throw new Error(`Preview bo‘sh: ${note}`);
  return ret(ctx, { order_id: orderId, lines, note });
}

async function retAutoAllRemaining(ctx: Ctx, orderId: number, note: string): Promise<VrRow | null> {
  const originalItems = await loadOrderItems(ctx.tenantId, ctx.clientId, orderId);
  const prev = await prisma.salesReturn.findMany({
    where: {
      tenant_id: ctx.tenantId,
      client_id: ctx.clientId,
      order_id: orderId,
      status: "posted"
    },
    select: {
      order_id: true,
      lines: { select: { product_id: true, qty: true, paid_qty: true, bonus_qty: true } }
    }
  });
  const remaining = adjustOrderItemsQtyAfterPriorReturns(originalItems, prev);
  const byProd = remainingQtyByProduct(remaining);
  const lines = [...byProd.entries()].map(([product_id, qty]) => ({ product_id, qty }));
  if (lines.length === 0) return null;
  return retAuto(ctx, orderId, lines, note);
}

async function setupCtx(): Promise<{ ctx: Ctx; rule10Id: number; clientName: string }> {
  const slug = (process.env.SEED_TENANT_SLUG || "test1").trim();
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) throw new Error(`Tenant: ${slug}`);

  const actor = await prisma.user.findFirst({
    where: { tenant_id: tenant.id, role: "admin", is_active: true },
    select: { id: true }
  });
  if (!actor) throw new Error("admin topilmadi");

  let client = await prisma.client.findFirst({
    where: {
      tenant_id: tenant.id,
      is_active: true,
      merged_into_client_id: null,
      name: { contains: "POLKI-FULL", mode: "insensitive" }
    },
    select: { id: true, name: true }
  });
  if (!client) {
    client = await prisma.client.create({
      data: {
        tenant_id: tenant.id,
        name: "POLKI-FULL test mijoz",
        is_active: true,
        credit_limit: new Prisma.Decimal(0)
      },
      select: { id: true, name: true }
    });
  }

  const warehouse = await prisma.warehouse.findFirst({
    where: { tenant_id: tenant.id, type: "main", is_active: true },
    select: { id: true }
  });
  if (!warehouse) throw new Error("main ombor topilmadi");

  const agent = await prisma.user.findFirst({
    where: { tenant_id: tenant.id, role: "agent", is_active: true },
    select: { id: true }
  });
  if (!agent) throw new Error("agent topilmadi");

  const products = await prisma.product.findMany({
    where: { tenant_id: tenant.id, is_active: true, sku: { in: ["SKU-001", "SKU-002", "SKU-003"] } },
    orderBy: { id: "asc" },
    select: { id: true, sku: true }
  });
  const p1 = products.find((p) => p.sku === "SKU-001") ?? products[0];
  const p2 = products.find((p) => p.sku === "SKU-002") ?? products[1];
  const p3 = products.find((p) => p.sku === "SKU-003");
  if (!p1 || !p2) throw new Error("SKU-001/002 kerak");

  for (const p of [p1, p2, p3].filter(Boolean)) {
    await prisma.stock.upsert({
      where: {
        tenant_id_warehouse_id_product_id: {
          tenant_id: tenant.id,
          warehouse_id: warehouse.id,
          product_id: p!.id
        }
      },
      create: {
        tenant_id: tenant.id,
        warehouse_id: warehouse.id,
        product_id: p!.id,
        qty: new Prisma.Decimal(1_000_000),
        reserved_qty: new Prisma.Decimal(0)
      },
      update: { qty: new Prisma.Decimal(1_000_000), reserved_qty: new Prisma.Decimal(0) }
    });
  }

  let rule10 = await prisma.bonusRule.findFirst({
    where: { tenant_id: tenant.id, is_active: true, type: "qty", buy_qty: 10, free_qty: 1 },
    select: { id: true }
  });
  if (!rule10) {
    rule10 = await prisma.bonusRule.create({
      data: {
        tenant_id: tenant.id,
        name: `${TAG} 10+1`,
        type: "qty",
        buy_qty: 10,
        free_qty: 1,
        priority: 9980,
        is_active: true,
        target_all_clients: true,
        is_manual: false,
        in_blocks: true,
        product_ids: [p1.id],
        bonus_product_ids: [p2.id],
        product_category_ids: []
      },
      select: { id: true }
    });
  }

  const ctx: Ctx = {
    tenantId: tenant.id,
    clientId: client.id,
    warehouseId: warehouse.id,
    actorId: actor.id,
    agentId: agent.id,
    p1,
    p2,
    p3
  };
  return { ctx, rule10Id: rule10.id, clientName: client.name };
}

async function main() {
  const { ctx, rule10Id, clientName } = await setupCtx();
  const manifest: ScenarioRow[] = [];

  // S7: erkin polki — birinchi (boshqa po-zakaz vozvratlari davrni iflos qilmasin)
  {
    const o = await createOrder(ctx.tenantId, {
      agent_id: ctx.agentId,
      client_id: ctx.clientId,
      warehouse_id: ctx.warehouseId,
      items: [{ product_id: ctx.p1.id, qty: 6 }],
      apply_bonus: false,
      comment: `${TAG} S7-erkin-polki`
    });
    await deliver(ctx.tenantId, o.id, ctx.actorId);
    const created = await prisma.order.findUnique({
      where: { id: o.id },
      select: { created_at: true }
    });
    const d = created!.created_at;
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const r1 = await ret(ctx, {
      date_from: iso,
      date_to: iso,
      lines: [{ product_id: ctx.p1.id, qty: 4 }],
      note: "S7 erkin polki qisman 4"
    });
    const r2 = await ret(ctx, {
      date_from: iso,
      date_to: iso,
      lines: [{ product_id: ctx.p1.id, qty: 2 }],
      note: "S7 erkin polki qolgan 2"
    });
    manifest.push({
      code: "S7-FREE-POLKI-PERIOD",
      order_id: o.id,
      order_number: o.number,
      polki_turi: "erkin",
      shart: "Vozvrat s polki (erkin) — order_id yo‘q, sana oralig‘i",
      returns: [r1, r2],
      qoldiq: { paid: 0, bonus: 0, fully_returned: true }
    });
  }

  // S1: faqat pullik — qisman 5, keyin qolgan 7 (yopish)
  {
    const o = await createOrder(ctx.tenantId, {
      agent_id: ctx.agentId,
      client_id: ctx.clientId,
      warehouse_id: ctx.warehouseId,
      items: [{ product_id: ctx.p1.id, qty: 12 }],
      apply_bonus: false,
      comment: `${TAG} S1-paid-only`
    });
    await deliver(ctx.tenantId, o.id, ctx.actorId);
    const r1 = await ret(ctx, {
      order_id: o.id,
      lines: [{ product_id: ctx.p1.id, qty: 5 }],
      note: "S1 qisman 5"
    });
    const r2 = await ret(ctx, {
      order_id: o.id,
      lines: [{ product_id: ctx.p1.id, qty: 7 }],
      note: "S1 qolgan 7 — yopish"
    });
    const bal = await balanceAfter(ctx, o.id);
    manifest.push({
      code: "S1-PAID-PARTIAL-THEN-CLOSE",
      order_id: o.id,
      order_number: o.number,
      polki_turi: "po_zakaz",
      shart: "Faqat pullik; 5+7=12; to‘liq yopiladi",
      returns: [r1, r2],
      qoldiq: { paid: bal.remaining_paid_qty, bonus: bal.remaining_bonus_qty, fully_returned: bal.fully_returned }
    });
  }

  // S2: 10+1 — 4+2+1, keyin qolganini avto yopish
  {
    const o = await createOrder(ctx.tenantId, {
      agent_id: ctx.agentId,
      client_id: ctx.clientId,
      warehouse_id: ctx.warehouseId,
      items: [{ product_id: ctx.p1.id, qty: 20 }],
      apply_bonus: true,
      comment: `${TAG} S2-10+1`
    });
    await deliver(ctx.tenantId, o.id, ctx.actorId);
    const r1 = await retAuto(ctx, o.id, [{ product_id: ctx.p1.id, qty: 4 }], "S2: 4 ta");
    const r2 = await retAuto(ctx, o.id, [{ product_id: ctx.p1.id, qty: 2 }], "S2: 2 ta");
    const r3 = await retAuto(ctx, o.id, [{ product_id: ctx.p1.id, qty: 1 }], "S2: 1 ta");
    const r4 = await retAutoAllRemaining(ctx, o.id, "S2: qolganini yopish");
    const bal = await balanceAfter(ctx, o.id);
    manifest.push({
      code: "S2-10+1-4-2-1-FLUSH",
      order_id: o.id,
      order_number: o.number,
      polki_turi: "po_zakaz",
      shart: "20 pullik + 10+1 bonus; 4→2→1→qolgan; 0/0",
      returns: [r1, r2, r3, ...(r4 ? [r4] : [])],
      qoldiq: { paid: bal.remaining_paid_qty, bonus: bal.remaining_bonus_qty, fully_returned: bal.fully_returned }
    });
  }

  // S3: bir martada to‘liq + ikkinchi blok
  {
    const o = await createOrder(ctx.tenantId, {
      agent_id: ctx.agentId,
      client_id: ctx.clientId,
      warehouse_id: ctx.warehouseId,
      items: [
        { product_id: ctx.p1.id, qty: 8 },
        { product_id: ctx.p2.id, qty: 8 }
      ],
      apply_bonus: false,
      comment: `${TAG} S3-full-lock`
    });
    await deliver(ctx.tenantId, o.id, ctx.actorId);
    const r1 = await ret(ctx, {
      order_id: o.id,
      lines: [
        { product_id: ctx.p1.id, qty: 8 },
        { product_id: ctx.p2.id, qty: 8 }
      ],
      note: "S3 bir VR — to‘liq"
    });
    let blocked = "ok";
    try {
      await ret(ctx, {
        order_id: o.id,
        lines: [{ product_id: ctx.p1.id, qty: 1 }],
        note: "S3 ikkinchi — blok"
      });
      blocked = "XATO: bloklanmagan";
    } catch (e) {
      blocked = e instanceof Error ? e.message : String(e);
    }
    const bal = await balanceAfter(ctx, o.id);
    manifest.push({
      code: "S3-FULL-LOCK",
      order_id: o.id,
      order_number: o.number,
      polki_turi: "po_zakaz",
      shart: "Bir VR to‘liq; ikkinchi ORDER_FULLY_RETURNED",
      returns: [r1, { number: "—", refund: "0", note: `blok: ${blocked}` }],
      qoldiq: { paid: bal.remaining_paid_qty, bonus: bal.remaining_bonus_qty, fully_returned: bal.fully_returned }
    });
  }

  // S4: bonus-only input → reconcile, keyin yopish
  {
    const o = await createOrder(ctx.tenantId, {
      agent_id: ctx.agentId,
      client_id: ctx.clientId,
      warehouse_id: ctx.warehouseId,
      items: [
        { product_id: ctx.p1.id, qty: 10 },
        { product_id: ctx.p2.id, qty: 10 }
      ],
      apply_bonus: false,
      comment: `${TAG} S4-reconcile`
    });
    await deliver(ctx.tenantId, o.id, ctx.actorId);
    const r1 = await ret(ctx, {
      order_id: o.id,
      lines: [
        { product_id: ctx.p1.id, paid_qty: 0, bonus_qty: 6 },
        { product_id: ctx.p2.id, paid_qty: 0, bonus_qty: 6 }
      ],
      note: "S4 bonus-only → server pullik"
    });
    const r2 = await retAutoAllRemaining(ctx, o.id, "S4 qolganini yopish");
    const bal = await balanceAfter(ctx, o.id);
    manifest.push({
      code: "S4-RECONCILE-THEN-CLOSE",
      order_id: o.id,
      order_number: o.number,
      polki_turi: "po_zakaz",
      shart: "Noto‘g‘ri bonus-only; reconcile; keyin to‘liq yopish",
      returns: [r1, ...(r2 ? [r2] : [])],
      qoldiq: { paid: bal.remaining_paid_qty, bonus: bal.remaining_bonus_qty, fully_returned: bal.fully_returned }
    });
  }

  // S5: cross-bonus — qisman 10, keyin qolgan
  {
    const o = await createOrder(ctx.tenantId, {
      agent_id: ctx.agentId,
      client_id: ctx.clientId,
      warehouse_id: ctx.warehouseId,
      items: [{ product_id: ctx.p1.id, qty: 20 }],
      apply_bonus: true,
      comment: `${TAG} S5-cross-bonus`
    });
    await deliver(ctx.tenantId, o.id, ctx.actorId);
    const r1 = await retAuto(ctx, o.id, [{ product_id: ctx.p1.id, qty: 10 }], "S5 qisman 10");
    const r2 = await retAutoAllRemaining(ctx, o.id, "S5 qolganini yopish");
    const bal = await balanceAfter(ctx, o.id);
    manifest.push({
      code: "S5-CROSS-BONUS-FLUSH",
      order_id: o.id,
      order_number: o.number,
      polki_turi: "po_zakaz",
      shart: "Savdo mahs.1, bonus boshqa mahsulotda; yopishgacha",
      returns: [r1, ...(r2 ? [r2] : [])],
      qoldiq: { paid: bal.remaining_paid_qty, bonus: bal.remaining_bonus_qty, fully_returned: bal.fully_returned }
    });
  }

  // S6: bir VR da ko‘p mahsulot (multi-line)
  {
    const o = await createOrder(ctx.tenantId, {
      agent_id: ctx.agentId,
      client_id: ctx.clientId,
      warehouse_id: ctx.warehouseId,
      items: [
        { product_id: ctx.p1.id, qty: 6 },
        { product_id: ctx.p2.id, qty: 4 }
      ],
      apply_bonus: false,
      comment: `${TAG} S6-multi-line`
    });
    await deliver(ctx.tenantId, o.id, ctx.actorId);
    const r1 = await retAuto(ctx, o.id, [
      { product_id: ctx.p1.id, qty: 3 },
      { product_id: ctx.p2.id, qty: 2 }
    ], "S6 bir VR — 2 mahsulot qisman");
    const r2 = await retAutoAllRemaining(ctx, o.id, "S6 qolganini yopish");
    const bal = await balanceAfter(ctx, o.id);
    manifest.push({
      code: "S6-MULTI-PRODUCT-VR",
      order_id: o.id,
      order_number: o.number,
      polki_turi: "po_zakaz",
      shart: "Bitta vozvratda bir nechta mahsulot; keyin yopish",
      returns: [r1, ...(r2 ? [r2] : [])],
      qoldiq: { paid: bal.remaining_paid_qty, bonus: bal.remaining_bonus_qty, fully_returned: bal.fully_returned }
    });
  }

  console.log("\n=== POLKI FULL — BARCHA VOZVRATLAR ===\n");
  console.log(`Mijoz: ${clientName} (id=${ctx.clientId})`);
  console.log(`Bonus 10+1 qoida id=${rule10Id}\n`);

  for (const m of manifest) {
    console.log(`--- ${m.code} (${m.polki_turi}) ---`);
    console.log(`Zakaz: id=${m.order_id ?? "—"} №${m.order_number}`);
    console.log(`Shart: ${m.shart}`);
    for (const r of m.returns) console.log(`  VR: ${r.number} refund=${r.refund} | ${r.note}`);
    console.log(
      `  Qoldiq: pullik=${m.qoldiq.paid} bonus=${m.qoldiq.bonus} yopilgan=${m.qoldiq.fully_returned}\n`
    );
  }

  const out = {
    tag: TAG,
    client_id: ctx.clientId,
    created_at: new Date().toISOString(),
    scenarios: manifest
  };
  const outPath = "scripts/polki-test-scenarios-manifest.json";
  await import("node:fs").then((fs) =>
    fs.promises.writeFile(outPath, JSON.stringify(out, null, 2), "utf8")
  );
  console.log(`Manifest: backend/${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
