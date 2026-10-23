/**
 * Namangan / Qoqon: qaytarish, bonus, yetkazish jurnali (tenant aksit).
 * Mavjud buyurtma/to‘lov/mijoz qayta yozilmaydi. Order 868 ga tegmaydi.
 * npx tsx scripts/import-salesdoc-branch-gaps.ts <papka> <filial> <prefiks> <dilerId>
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../src/config/database";
import { LIVE_CUTOFF, loadSalesDoc, sdOrderNumber } from "./lib/salesdoc-andijon-load";
import { writeAndijonDeliveryLogs } from "./lib/salesdoc-andijon-delivery-logs";

const TENANT = 1;

/** Asosiy importdagi buyurtma raqami: d0_1797 → 1797. Prefiks qo‘shilmaydi. */
function orderNumber(id: string): string {
  if (!id || id === "0") return id;
  return sdOrderNumber(id);
}

function ymd(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value === "0000-00-00") return "";
  return value;
}

async function main() {
  const root = process.argv[2];
  const branch = process.argv[3];
  const prefix = process.argv[4];
  const dealerId = process.argv[5];
  if (!root || !branch || !prefix || !dealerId) {
    throw new Error("papka, filial, prefiks, dilerId kerak");
  }
  const tenant = await prisma.tenant.findUnique({ where: { id: TENANT }, select: { slug: true } });
  if (tenant?.slug !== "aksit" && tenant?.slug !== "test1") throw new Error("tenant 1 aksit yoki test1 emas");

  const data = loadSalesDoc(root, branch);
  const products = await prisma.product.findMany({
    where: { tenant_id: TENANT, sell_code: { not: null } },
    select: { id: true, sell_code: true }
  });
  const productBySd = new Map(products.map((p) => [p.sell_code as string, p.id]));

  const orders = new Map<string, { date: string; dateLoad: string; dateDeliver: string }>();
  let linesSkippedCutoff = 0;
  for (const line of data.lines) {
    if (!line.orderId) continue;
    const date = ymd(line.date);
    if (!date || date >= LIVE_CUTOFF) {
      linesSkippedCutoff += 1;
      continue;
    }
    const number = orderNumber(line.orderId);
    let o = orders.get(number);
    if (!o) {
      o = { date, dateLoad: "", dateDeliver: "" };
      orders.set(number, o);
    }
    const load = ymd(line.dateLoad);
    const deliver = ymd(line.dateDeliver);
    if (!o.dateLoad && load && load < LIVE_CUTOFF) o.dateLoad = load;
    if (!o.dateDeliver && deliver && deliver < LIVE_CUTOFF) o.dateDeliver = deliver;
  }

  const numbers = [...orders.keys()];
  const saved: { id: number; number: string }[] = [];
  for (let i = 0; i < numbers.length; i += 2000) {
    const chunk = numbers.slice(i, i + 2000);
    const rows = await prisma.order.findMany({
      where: { tenant_id: TENANT, number: { in: chunk }, id: { not: 868 } },
      select: { id: true, number: true }
    });
    saved.push(...rows);
  }
  const orderPk = new Map(saved.map((o) => [o.number, o.id]));
  const deliveryLogs = await writeAndijonDeliveryLogs(prisma, orders, orderPk);

  let returnsSkippedOtherDealer = 0;
  let returnsSkippedNoOrder = 0;
  let returnsSkippedExists = 0;
  let returnsSkippedNoProduct = 0;
  let returns = 0;
  const retMap = new Map<string, { lines: { productId: string; qty: number }[] }>();
  for (const r of data.returns) {
    if (r.dealerId !== dealerId) {
      returnsSkippedOtherDealer += 1;
      continue;
    }
    const number = orderNumber(r.orderId);
    if (!orderPk.has(number)) {
      returnsSkippedNoOrder += 1;
      continue;
    }
    let g = retMap.get(number);
    if (!g) {
      g = { lines: [] };
      retMap.set(number, g);
    }
    g.lines.push({ productId: r.productId, qty: r.qty });
  }
  for (const [sdId, g] of retMap) {
    const number = `SDR-${sdId}`.slice(0, 48);
    const exists = await prisma.salesReturn.findFirst({ where: { tenant_id: TENANT, number } });
    if (exists) {
      returnsSkippedExists += 1;
      continue;
    }
    const order = await prisma.order.findFirst({
      where: { tenant_id: TENANT, number: sdId, id: { not: 868 } },
      select: { id: true, client_id: true, warehouse_id: true }
    });
    if (!order?.warehouse_id) {
      returnsSkippedNoOrder += 1;
      continue;
    }
    const lines = g.lines
      .map((l) => ({ product_id: productBySd.get(l.productId), qty: l.qty }))
      .filter((l): l is { product_id: number; qty: number } => Boolean(l.product_id));
    if (!lines.length) {
      returnsSkippedNoProduct += 1;
      continue;
    }
    await prisma.salesReturn.create({
      data: {
        tenant_id: TENANT,
        number,
        client_id: order.client_id,
        order_id: order.id,
        warehouse_id: order.warehouse_id,
        status: "posted",
        return_type: "partial",
        note: `SalesDoc ${branch}`,
        lines: { create: lines.map((l) => ({ product_id: l.product_id, qty: l.qty })) }
      }
    });
    returns += 1;
  }

  let bonuses = 0;
  let bonusesScoped = 0;
  let bonusesSkipped = 0;
  for (const b of data.bonuses) {
    if (!b.name || !b.dealerIds.includes(dealerId)) {
      bonusesSkipped += 1;
      continue;
    }
    const product_ids = b.products.map((id) => productBySd.get(id)).filter((x): x is number => Boolean(x));
    const bonus_product_ids = b.bonusProducts
      .map((id) => productBySd.get(id))
      .filter((x): x is number => Boolean(x));
    const exists = await prisma.bonusRule.findFirst({
      where: { tenant_id: TENANT, name: b.name },
      select: { id: true, scope_branch_codes: true }
    });
    if (exists) {
      const scope = exists.scope_branch_codes ?? [];
      if (scope.length === 0 || scope.includes(branch)) {
        bonusesSkipped += 1;
        continue;
      }
      await prisma.bonusRule.update({
        where: { id: exists.id },
        data: { scope_branch_codes: [...scope, branch] }
      });
      bonusesScoped += 1;
      continue;
    }
    const row: Prisma.BonusRuleCreateInput = {
      tenant: { connect: { id: TENANT } },
      name: b.name,
      type: "qty",
      buy_qty: b.buy || null,
      free_qty: b.free || null,
      is_active: b.active,
      valid_from: b.from ? new Date(b.from) : null,
      valid_to: b.to ? new Date(b.to) : null,
      product_ids,
      bonus_product_ids,
      in_blocks: b.inBlocks,
      scope_branch_codes: [branch],
      scope_restrict_assortment: product_ids.length > 0
    };
    await prisma.bonusRule.create({ data: row });
    bonuses += 1;
  }

  console.log(
    JSON.stringify(
      {
        branch,
        prefix,
        dealerId,
        returns,
        returnsSkippedExists,
        returnsSkippedNoOrder,
        returnsSkippedNoProduct,
        returnsSkippedOtherDealer,
        bonuses,
        bonusesScoped,
        bonusesSkipped,
        deliveryLogs,
        ordersInFile: orders.size,
        ordersMatched: orderPk.size,
        linesSkippedCutoff,
        cutoff: LIVE_CUTOFF
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
  .finally(() => prisma.$disconnect());
