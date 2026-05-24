import fs from "node:fs";
import path from "node:path";
import { prisma } from "../../src/config/database";
import { listOrdersPaged } from "../../src/modules/orders/orders.service";
import type { SeededOrder } from "./seed-orders-full-test-types";

export async function finalizeSeedOrdersFullTestReport(opts: {
  runTag: string;
  tenant: { id: number; slug: string };
  actor: { id: number; name: string; role: string; login: string };
  warehouse: { id: number; name: string };
  primaryClient: { id: number; name: string; credit_limit: { toString(): string }; category: string | null };
  sampledClients: Array<{
    id: number;
    name: string;
    credit_limit: { toString(): string };
    category: string | null;
    city: string | null;
    region: string | null;
  }>;
  paidProduct: { id: number; name: string; price: { toString(): string } };
  bonusProduct: { id: number; name: string };
  seeded: SeededOrder[];
  tempRuleIds: number[];
  deliveredIds: number[];
  commentPrefix: string;
}): Promise<void> {
  const {
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
    deliveredIds
  } = opts;

  await prisma.bonusRule.updateMany({
    where: { id: { in: tempRuleIds } },
    data: { is_active: false }
  });

  const seededIds = seeded.map((s) => s.id);
  const statusCounts = new Map<string, number>();
  for (const s of ["new", "confirmed", "picking", "delivering", "delivered", "cancelled", "returned"]) {
    const c = await prisma.order.count({
      where: { id: { in: seededIds }, order_type: "order", status: s }
    });
    statusCounts.set(s, c);
  }

  const typeCounts = new Map<string, number>();
  for (const t of ["order", "partial_return", "return", "return_by_order"]) {
    const c = await prisma.order.count({
      where: { id: { in: seededIds }, order_type: t }
    });
    typeCounts.set(t, c);
  }

  const bonusOrderCount = await prisma.order.count({
    where: { id: { in: seededIds }, OR: [{ bonus_sum: { gt: 0 } }, { items: { some: { is_bonus: true } } }] }
  });
  const discountOrderCount = await prisma.order.count({
    where: { id: { in: seededIds }, discount_sum: { gt: 0 } }
  });

  const filterChecks = {
    byStatusDelivered: (
      await listOrdersPaged(
        tenant.id,
        { page: 1, limit: 50, status: "delivered", date_mode: "ship" },
        "admin"
      )
    ).data.some((r) => seededIds.includes(r.id)),
    byPaymentTypeCash: (
      await listOrdersPaged(
        tenant.id,
        { page: 1, limit: 50, payment_type: "cash", date_mode: "ship" },
        "admin"
      )
    ).data.some((r) => seededIds.includes(r.id)),
    byPaymentMethodRef: (
      await listOrdersPaged(
        tenant.id,
        { page: 1, limit: 50, payment_method_ref: "cash", date_mode: "ship" },
        "admin"
      )
    ).data.some((r) => seededIds.includes(r.id))
  };

  const knownGaps = [
    "Orders filterlarida `Тип накладной`, `Тип цены`, `День`, `Направление торговли`, `Территория 1/2/3` hali API ga ulanmagan (stub).",
    "UIda filter ichidagi qidiruv inputlari olib tashlandi: `Клиенты (ID)`, `Категория клиента`, umumiy jadval `Поиск`."
  ];

  const report = {
    run_tag: runTag,
    tenant: tenant.slug,
    actor: actor,
    warehouse: warehouse,
    primary_client: {
      id: primaryClient.id,
      name: primaryClient.name,
      credit_limit: primaryClient.credit_limit.toString(),
      category: primaryClient.category
    },
    sampled_clients: sampledClients.map((c) => ({
      id: c.id,
      name: c.name,
      credit_limit: c.credit_limit.toString(),
      category: c.category,
      city: c.city,
      region: c.region
    })),
    products: {
      paid: { id: paidProduct.id, name: paidProduct.name, price: paidProduct.price.toString() },
      bonus: { id: bonusProduct.id, name: bonusProduct.name }
    },
    created_orders_total: seeded.length,
    created_order_ids: seededIds,
    status_counts: Object.fromEntries(statusCounts),
    type_counts: Object.fromEntries(typeCounts),
    bonus_order_count: bonusOrderCount,
    discount_order_count: discountOrderCount,
    delivered_orders_with_seed_payments: deliveredIds.length,
    filter_checks: filterChecks,
    known_gaps: knownGaps
  };

  const outDir = path.join(process.cwd(), "scripts", "output");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${runTag}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log("\n=== ORDERS FULL TEST SEED DONE ===");
  console.log(`Tenant: ${tenant.slug}`);
  console.log(`Run tag: ${runTag}`);
  console.log(`Primary client: #${primaryClient.id} ${primaryClient.name}`);
  console.log(`Orders created: ${seeded.length}`);
  console.log(`Bonus orders: ${bonusOrderCount}; Discount orders: ${discountOrderCount}`);
  console.log(`Report: ${outPath}`);
  console.log("\nSampled clients:");
  for (const c of sampledClients) {
    console.log(`- #${c.id} ${c.name}`);
  }
}
