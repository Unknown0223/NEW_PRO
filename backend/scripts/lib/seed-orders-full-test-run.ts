import fs from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "../../src/config/database";
import { createOrder, listOrdersPaged, updateOrderStatus } from "../../src/modules/orders/orders.service";
import { intEnv, nowTag, type SeededOrder } from "./seed-orders-full-test-types";
import { finalizeSeedOrdersFullTestReport } from "./seed-orders-full-test-report";

export async function runSeedOrdersFullTest(): Promise<void> {
  const slug = (process.env.SEED_TENANT_SLUG || "test1").trim();
  const perStatus = intEnv("SEED_ORDERS_PER_STATUS", 5);
  const perType = intEnv("SEED_ORDERS_PER_TYPE", 3);
  const runTag = `orders_full_test_${nowTag()}`;
  const commentPrefix = `[${runTag}]`;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true }
  });
  if (!tenant) throw new Error(`Tenant topilmadi: ${slug}`);

  const actor = await prisma.user.findFirst({
    where: { tenant_id: tenant.id, is_active: true, role: { in: ["admin", "operator", "supervisor"] } },
    orderBy: [{ role: "asc" }, { id: "asc" }],
    select: { id: true, name: true, role: true, login: true }
  });
  if (!actor) throw new Error("Admin/operator/supervisor foydalanuvchi topilmadi.");

  const warehouse = await prisma.warehouse.findFirst({
    where: { tenant_id: tenant.id, is_active: true },
    orderBy: { id: "asc" },
    select: { id: true, name: true }
  });
  if (!warehouse) throw new Error("Faol ombor topilmadi.");

  const sampledClients = await prisma.client.findMany({
    where: { tenant_id: tenant.id, is_active: true, merged_into_client_id: null },
    orderBy: { id: "asc" },
    take: 20,
    select: { id: true, name: true, credit_limit: true, category: true, city: true, region: true }
  });
  if (sampledClients.length === 0) throw new Error("Faol klient topilmadi.");

  const primaryClient =
    sampledClients.find((c) => Number(c.credit_limit) <= 0) ??
    sampledClients[0]!;

  const agents = await prisma.user.findMany({
    where: { tenant_id: tenant.id, role: "agent", is_active: true },
    orderBy: { id: "asc" },
    select: { id: true, name: true, login: true, trade_direction_id: true }
  });
  if (agents.length === 0) throw new Error("Faol agent topilmadi.");

  const retailPrices = await prisma.productPrice.findMany({
    where: { tenant_id: tenant.id, price_type: "retail", product: { is_active: true } },
    orderBy: { product_id: "asc" },
    take: 50,
    select: { product_id: true, price: true, product: { select: { id: true, name: true, category_id: true } } }
  });
  const uniqProducts = new Map<number, { id: number; name: string; category_id: number | null; price: Prisma.Decimal }>();
  for (const row of retailPrices) {
    if (!uniqProducts.has(row.product_id)) {
      uniqProducts.set(row.product_id, {
        id: row.product.id,
        name: row.product.name,
        category_id: row.product.category_id,
        price: row.price
      });
    }
  }
  const products = [...uniqProducts.values()];
  if (products.length < 2) {
    throw new Error("Retail narxli faol mahsulotlar kamida 2 ta bo'lishi kerak.");
  }
  const paidProduct = products[0]!;
  const bonusProduct = products[1]!;

  // Stock zaxira qo'shamiz (reserve/confirm flow yetishmovchilik bermasin).
  for (const p of [paidProduct, bonusProduct]) {
    await prisma.stock.upsert({
      where: {
        tenant_id_warehouse_id_product_id: {
          tenant_id: tenant.id,
          warehouse_id: warehouse.id,
          product_id: p.id
        }
      },
      create: {
        tenant_id: tenant.id,
        warehouse_id: warehouse.id,
        product_id: p.id,
        qty: new Prisma.Decimal(100000),
        reserved_qty: new Prisma.Decimal(0)
      },
      update: {
        qty: { increment: new Prisma.Decimal(100000) }
      }
    });
  }

  // Bonus/skidka coverage uchun vaqtinchalik auto-rules (yakunda o'chiriladi).
  const tempRuleIds: number[] = [];
  const qtyRule = await prisma.bonusRule.create({
    data: {
      tenant_id: tenant.id,
      name: `${commentPrefix} qty 2=>1`,
      type: "qty",
      buy_qty: 2,
      free_qty: 1,
      priority: 9990,
      is_active: true,
      target_all_clients: false,
      selected_client_ids: [primaryClient.id],
      is_manual: false,
      in_blocks: true,
      product_ids: [paidProduct.id],
      bonus_product_ids: [bonusProduct.id],
      product_category_ids: []
    },
    select: { id: true }
  });
  tempRuleIds.push(qtyRule.id);
  await prisma.bonusRuleCondition.create({
    data: {
      bonus_rule_id: qtyRule.id,
      step_qty: new Prisma.Decimal(2),
      bonus_qty: new Prisma.Decimal(1),
      sort_order: 0
    }
  });

  const discountRule = await prisma.bonusRule.create({
    data: {
      tenant_id: tenant.id,
      name: `${commentPrefix} discount 10%`,
      type: "discount",
      discount_pct: new Prisma.Decimal(10),
      priority: 9980,
      is_active: true,
      target_all_clients: false,
      selected_client_ids: [primaryClient.id],
      is_manual: false,
      product_ids: [paidProduct.id],
      bonus_product_ids: [],
      product_category_ids: []
    },
    select: { id: true }
  });
  tempRuleIds.push(discountRule.id);

  const sumRule = await prisma.bonusRule.create({
    data: {
      tenant_id: tenant.id,
      name: `${commentPrefix} sum gift`,
      type: "sum",
      min_sum: new Prisma.Decimal(1),
      free_qty: 1,
      priority: 9970,
      is_active: true,
      target_all_clients: false,
      selected_client_ids: [primaryClient.id],
      is_manual: false,
      product_ids: [paidProduct.id],
      bonus_product_ids: [bonusProduct.id],
      product_category_ids: []
    },
    select: { id: true }
  });
  tempRuleIds.push(sumRule.id);

  const seeded: SeededOrder[] = [];

  const statusTargets: Array<{
    status: "new" | "confirmed" | "picking" | "delivering" | "delivered" | "cancelled" | "returned";
    path: string[];
  }> = [
    { status: "new", path: [] },
    { status: "confirmed", path: ["confirmed"] },
    { status: "picking", path: ["confirmed", "picking"] },
    { status: "delivering", path: ["confirmed", "picking", "delivering"] },
    { status: "delivered", path: ["confirmed", "picking", "delivering", "delivered"] },
    { status: "cancelled", path: ["cancelled"] },
    { status: "returned", path: ["confirmed", "picking", "delivering", "delivered", "returned"] }
  ];

  for (const target of statusTargets) {
    for (let i = 0; i < perStatus; i++) {
      const agent = agents[i % agents.length]!;
      const applyBonus = i % 2 === 0;
      const qty = applyBonus ? 3 : 1;
      const created = await createOrder(
        tenant.id,
        {
          client_id: primaryClient.id,
          warehouse_id: warehouse.id,
          agent_id: agent.id,
          payment_method_ref: "cash",
          order_type: "order",
          apply_bonus: applyBonus,
          comment: `${commentPrefix} status=${target.status} idx=${i + 1}`,
          request_type_ref: "seed-test",
          items: [{ product_id: paidProduct.id, qty }]
        },
        "admin"
      );
      for (const next of target.path) {
        await updateOrderStatus(tenant.id, created.id, next, actor.id, "admin");
      }
      const final = await prisma.order.findUniqueOrThrow({
        where: { id: created.id },
        select: {
          id: true,
          number: true,
          client_id: true,
          order_type: true,
          status: true,
          total_sum: true,
          bonus_sum: true,
          discount_sum: true
        }
      });
      seeded.push({
        id: final.id,
        number: final.number,
        client_id: final.client_id,
        order_type: final.order_type,
        status: final.status,
        total_sum: final.total_sum.toString(),
        bonus_sum: final.bonus_sum.toString(),
        discount_sum: final.discount_sum.toString()
      });
    }
  }

  // Qo'shimcha order_type coverage.
  // `exchange` — bog‘langan obmen (source_order_ids + minus/plus); alohida integratsiya seedi yoki UI orqali.
  const extraTypes: Array<"partial_return" | "return" | "return_by_order"> = [
    "partial_return",
    "return",
    "return_by_order"
  ];
  for (const ot of extraTypes) {
    for (let i = 0; i < perType; i++) {
      const agent = agents[(i + 1) % agents.length]!;
      const created = await createOrder(
        tenant.id,
        {
          client_id: primaryClient.id,
          warehouse_id: warehouse.id,
          agent_id: agent.id,
          payment_method_ref: "cash",
          order_type: ot,
          apply_bonus: true,
          comment: `${commentPrefix} type=${ot} idx=${i + 1}`,
          request_type_ref: "seed-test",
          items: [{ product_id: paidProduct.id, qty: 2 }]
        },
        "admin"
      );
      const final = await prisma.order.findUniqueOrThrow({
        where: { id: created.id },
        select: {
          id: true,
          number: true,
          client_id: true,
          order_type: true,
          status: true,
          total_sum: true,
          bonus_sum: true,
          discount_sum: true
        }
      });
      seeded.push({
        id: final.id,
        number: final.number,
        client_id: final.client_id,
        order_type: final.order_type,
        status: final.status,
        total_sum: final.total_sum.toString(),
        bonus_sum: final.bonus_sum.toString(),
        discount_sum: final.discount_sum.toString()
      });
    }
  }

  // delivered zakazlarga payment_type coverage.
  const deliveredIds = seeded
    .filter((o) => o.order_type === "order" && o.status === "delivered")
    .map((o) => o.id)
    .slice(0, 10);
  for (let i = 0; i < deliveredIds.length; i++) {
    const oid = deliveredIds[i]!;
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: oid },
      select: { client_id: true, total_sum: true }
    });
    const amount = new Prisma.Decimal(order.total_sum).mul(new Prisma.Decimal(0.2)).toDecimalPlaces(2);
    await prisma.payment.create({
      data: {
        tenant_id: tenant.id,
        client_id: order.client_id,
        order_id: oid,
        amount,
        payment_type: i % 2 === 0 ? "cash" : "transfer",
        note: `${commentPrefix} payment for order ${oid}`,
        created_by_user_id: actor.id
      }
    });
  }

  await finalizeSeedOrdersFullTestReport({
    runTag,
    tenant,
    actor,
    warehouse,
    primaryClient,
    sampledClients,
    paidProduct,
    bonusProduct,
    seeded,
    tempRuleIds,
    deliveredIds,
    commentPrefix
  });
}
