/**
 * Bitta SalesDoc diler papkasini lokal tenant aksit ga yozadi.
 * Mavjud buyurtma (ombor + raqam) qayta yozilmaydi.
 * Yangi diler raqami f6-d0_... ko‘rinishida, boshqa filialniki bilan aralashmaydi.
 * Xodim faqat --staff bilan (Andijon, Namangan, Qoqon).
 * npx tsx scripts/import-salesdoc-marked.ts <papka> <filial> <dilerId> [--staff]
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../src/config/database";
import { applyClientDebtFile } from "./lib/salesdoc-client-debt";
import { loadSalesDoc, sdOrderNumber, sdPriceTypeName } from "./lib/salesdoc-andijon-load";
import { applyCardBalances, openActiveStaff } from "./lib/salesdoc-marked-extra";
import { salesDocInstant, salesDocMonthEnd } from "./lib/salesdoc-andijon-time";

const TENANT = 1;
const STAFF_DEALERS = new Set(["1", "2", "5"]);

function documentDay(o: { dateDeliver: string; dateLoad: string; date: string }): string {
  for (const raw of [o.dateDeliver, o.dateLoad, o.date]) {
    if (!/^[1-9]\d{3}-\d{2}-\d{2}/.test(raw)) continue;
    const dt = salesDocInstant(raw.slice(0, 10));
    if (!Number.isNaN(dt.getTime())) return raw.slice(0, 10);
  }
  return "2025-01-01";
}

function warehouseCode(dealerId: string): string {
  if (dealerId === "1") return "001";
  return `f${dealerId}-WH`;
}

async function main() {
  const root = process.argv[2];
  const branch = process.argv[3];
  const dealerId = process.argv[4];
  const withStaff = process.argv.includes("--staff");
  if (!root || !branch || !dealerId) throw new Error("papka, filial, dilerId kerak");
  if (withStaff && !STAFF_DEALERS.has(dealerId)) throw new Error("xodim faqat Andijon, Namangan, Qoqon");
  if (!STAFF_DEALERS.has(dealerId)) process.env.SALESDOC_ORDER_PREFIX = `f${dealerId}-`;
  else delete process.env.SALESDOC_ORDER_PREFIX;

  const tenant = await prisma.tenant.findUnique({ where: { id: TENANT }, select: { slug: true } });
  if (tenant?.slug !== "aksit" && tenant?.slug !== "test1") throw new Error("tenant 1 aksit emas");

  const data = loadSalesDoc(root, branch);
  let wh = await prisma.warehouse.findFirst({ where: { tenant_id: TENANT, code: warehouseCode(dealerId) } });
  if (!wh) {
    wh = await prisma.warehouse.create({
      data: { tenant_id: TENANT, code: warehouseCode(dealerId), name: branch, type: "store" }
    });
  }
  let desk = await prisma.cashDesk.findFirst({
    where: { tenant_id: TENANT, name: `${branch} Kassa` }
  });
  if (!desk) {
    desk = await prisma.cashDesk.create({
      data: { tenant_id: TENANT, code: `f${dealerId}-K`.slice(0, 20), name: `${branch} Kassa` }
    });
  }

  const codes = [...new Set(data.clients.map((c) => c.id.slice(0, 32)).filter(Boolean))];
  const haveClients = await prisma.client.findMany({
    where: { tenant_id: TENANT, warehouse_id: wh.id, client_code: { in: codes } },
    select: { id: true, client_code: true }
  });
  const clientId = new Map<string, number>();
  for (const c of haveClients) if (c.client_code && !clientId.has(c.client_code)) clientId.set(c.client_code, c.id);
  const fresh: Prisma.ClientCreateManyInput[] = [];
  for (const c of data.clients) {
    const code = c.id.slice(0, 32);
    if (!code || clientId.has(code)) continue;
    clientId.set(code, 0);
    fresh.push({
      tenant_id: TENANT,
      client_code: code,
      name: c.name.slice(0, 300),
      legal_name: c.firm || null,
      phone: c.phone || null,
      region: c.region || branch,
      district: c.territory || null,
      address: c.address || null,
      is_active: c.active,
      inn: c.inn || null,
      warehouse_id: wh.id,
      cash_desk_id: desk.id
    });
  }
  for (let i = 0; i < fresh.length; i += 400) {
    await prisma.client.createMany({ data: fresh.slice(i, i + 400) });
  }
  const clientRows = await prisma.client.findMany({
    where: { tenant_id: TENANT, warehouse_id: wh.id, client_code: { in: codes } },
    select: { id: true, client_code: true }
  });
  clientId.clear();
  for (const c of clientRows) if (c.client_code && !clientId.has(c.client_code)) clientId.set(c.client_code, c.id);

  const products = await prisma.product.findMany({
    where: { tenant_id: TENANT, sell_code: { not: null } },
    select: { id: true, sell_code: true }
  });
  const productBySd = new Map(products.map((p) => [p.sell_code as string, p.id]));
  const missing = new Set<string>();
  for (const line of data.lines) if (line.productId && !productBySd.has(line.productId)) missing.add(line.productId);
  for (const r of data.returns) if (r.productId && !productBySd.has(r.productId)) missing.add(r.productId);
  if (missing.size) {
    await prisma.product.createMany({
      data: [...missing].map((code) => ({
        tenant_id: TENANT,
        sku: code.slice(0, 64),
        name: code.slice(0, 300),
        sell_code: code.slice(0, 64),
        is_active: true
      })),
      skipDuplicates: true
    });
    const added = await prisma.product.findMany({
      where: { tenant_id: TENANT, sell_code: { in: [...missing] } },
      select: { id: true, sell_code: true }
    });
    for (const p of added) if (p.sell_code) productBySd.set(p.sell_code, p.id);
  }

  const defectSum = new Map<string, number>();
  for (const r of data.returns) {
    if (r.dealerId !== dealerId || !r.orderId) continue;
    defectSum.set(r.orderId, (defectSum.get(r.orderId) ?? 0) + r.sum);
  }
  const fullReturn = (sdId: string, sum: number) => sum > 0 && (defectSum.get(sdId) ?? 0) + 0.5 >= sum;
  type Agg = {
    date: string;
    dateLoad: string;
    dateDeliver: string;
    clientId: string;
    sum: number;
    priceTypeId: string;
    priceAbs: number;
    comment: string;
    forceReturn: boolean;
    lines: { productId: string; qty: number; sum: number }[];
  };
  const orders = new Map<string, Agg>();
  for (const line of data.lines) {
    if (!line.orderId || !line.date) continue;
    let o = orders.get(line.orderId);
    if (!o) {
      o = {
        date: line.date,
        dateLoad: "",
        dateDeliver: "",
        clientId: line.clientId,
        sum: 0,
        priceTypeId: "",
        priceAbs: 0,
        comment: line.comment,
        forceReturn: false,
        lines: []
      };
      orders.set(line.orderId, o);
    }
    o.sum += line.sum;
    if (line.dateLoad) o.dateLoad = o.dateLoad || line.dateLoad;
    if (line.dateDeliver) o.dateDeliver = o.dateDeliver || line.dateDeliver;
    if (line.priceTypeId && Math.abs(line.sum) >= o.priceAbs) {
      o.priceTypeId = line.priceTypeId;
      o.priceAbs = Math.abs(line.sum);
    }
    o.lines.push({ productId: line.productId, qty: line.qty, sum: line.sum });
  }
  for (const r of data.returns) {
    if (r.dealerId !== dealerId || !r.orderId || orders.has(r.orderId)) continue;
    orders.set(r.orderId, {
      date: "",
      dateLoad: "",
      dateDeliver: "",
      clientId: "",
      sum: r.sum,
      priceTypeId: "",
      priceAbs: 0,
      comment: "Возврат с полки",
      forceReturn: true,
      lines: [{ productId: r.productId, qty: r.qty, sum: r.sum }]
    });
  }
  for (const o of orders.values()) {
    if (o.sum >= 0) continue;
    o.sum = -o.sum;
    o.forceReturn = true;
    o.comment = o.comment || "Возврат с полки";
    for (const line of o.lines) {
      line.sum = -line.sum;
      if (line.qty < 0) line.qty = -line.qty;
    }
  }

  const numbers = [...orders.keys()].map((id) => sdOrderNumber(id));
  const existing = new Set<string>();
  for (let i = 0; i < numbers.length; i += 2000) {
    const rows = await prisma.order.findMany({
      where: { tenant_id: TENANT, number: { in: numbers.slice(i, i + 2000) } },
      select: { number: true }
    });
    for (const row of rows) existing.add(row.number);
  }
  const orderRows: Prisma.OrderCreateManyInput[] = [];
  for (const [sdId, o] of orders) {
    const number = sdOrderNumber(sdId);
    if (existing.has(number)) continue;
    const cid = clientId.get(o.clientId.slice(0, 32));
    if (!cid || o.sum === 0) continue;
    const day = documentDay(o);
    const isReturn = o.forceReturn || fullReturn(sdId, o.sum);
    orderRows.push({
      tenant_id: TENANT,
      number,
      client_id: cid,
      warehouse_id: wh.id,
      order_type: isReturn ? "return" : "order",
      status: "delivered",
      total_sum: Math.round(o.sum * 100) / 100,
      comment: o.comment || (isReturn ? "Возврат с полки" : null),
      created_at: salesDocInstant(day),
      consignment_due_date: salesDocMonthEnd(day),
      payment_method_ref: "pm-naxt",
      price_type: o.priceTypeId ? sdPriceTypeName(o.priceTypeId) : null
    });
  }
  let ordersInserted = 0;
  for (let i = 0; i < orderRows.length; i += 300) {
    ordersInserted += (await prisma.order.createMany({ data: orderRows.slice(i, i + 300) })).count;
  }
  const saved = await prisma.order.findMany({
    where: { tenant_id: TENANT, warehouse_id: wh.id, number: { in: numbers } },
    select: { id: true, number: true }
  });
  const orderPk = new Map(saved.map((o) => [o.number, o.id]));
  const haveItems = new Set(
    (
      await prisma.orderItem.findMany({
        where: { order_id: { in: saved.map((o) => o.id) } },
        distinct: ["order_id"],
        select: { order_id: true }
      })
    ).map((r) => r.order_id)
  );
  const items: Prisma.OrderItemCreateManyInput[] = [];
  for (const [sdId, o] of orders) {
    const oid = orderPk.get(sdOrderNumber(sdId));
    if (!oid || haveItems.has(oid)) continue;
    for (const line of o.lines) {
      const pid = productBySd.get(line.productId);
      if (!pid || !line.qty) continue;
      items.push({
        order_id: oid,
        product_id: pid,
        qty: line.qty,
        price: Math.round((line.sum / line.qty) * 100) / 100,
        total: Math.round(line.sum * 100) / 100
      });
    }
  }
  let lines = 0;
  for (let i = 0; i < items.length; i += 800) {
    lines += (await prisma.orderItem.createMany({ data: items.slice(i, i + 800) })).count;
  }

  const payNumbers = data.cash.map((c) => sdOrderNumber(c.id));
  const usedPay = new Set<string>();
  for (let i = 0; i < payNumbers.length; i += 2000) {
    const rows = await prisma.payment.findMany({
      where: { tenant_id: TENANT, number: { in: payNumbers.slice(i, i + 2000) } },
      select: { number: true }
    });
    for (const row of rows) if (row.number) usedPay.add(row.number);
  }
  const pays: Prisma.PaymentCreateManyInput[] = [];
  for (const c of data.cash) {
    const number = sdOrderNumber(c.id);
    const cid = clientId.get(c.clientId.slice(0, 32));
    if (!cid || c.sum <= 0 || usedPay.has(number)) continue;
    usedPay.add(number);
    pays.push({
      tenant_id: TENANT,
      number,
      client_id: cid,
      amount: Math.round(c.sum * 100) / 100,
      payment_type: c.kind === "Приход" ? "Наличные" : c.kind.slice(0, 64),
      cash_desk_id: desk.id,
      order_id: c.orderId && c.orderId !== "0" ? orderPk.get(sdOrderNumber(c.orderId)) ?? null : null,
      paid_at: salesDocInstant(c.date),
      workflow_status: "confirmed",
      entry_kind: "payment"
    });
  }
  let payments = 0;
  for (let i = 0; i < pays.length; i += 400) {
    payments += (await prisma.payment.createMany({ data: pays.slice(i, i + 400) })).count;
  }

  let returnsTyped = 0;
  const returnNumbers = [...orders.entries()]
    .filter(([id, o]) => o.forceReturn || fullReturn(id, o.sum))
    .map(([id]) => sdOrderNumber(id));
  for (let i = 0; i < returnNumbers.length; i += 2000) {
    const res = await prisma.order.updateMany({
      where: {
        tenant_id: TENANT,
        warehouse_id: wh.id,
        number: { in: returnNumbers.slice(i, i + 2000) },
        order_type: "order"
      },
      data: { order_type: "return", comment: "Возврат с полки" }
    });
    returnsTyped += res.count;
  }

  const debts = await applyClientDebtFile(prisma, root, wh.id);
  const cardBalances = await applyCardBalances(prisma, root, clientId);
  const staff = withStaff ? await openActiveStaff(prisma, branch, wh.id, desk.id, data) : { users: 0, slots: 0 };

  console.log(
    JSON.stringify(
      {
        branch,
        dealerId,
        warehouse: wh.name,
        clients: fresh.length,
        orders: ordersInserted,
        lines,
        payments,
        returnsTyped,
        debts,
        cardBalances,
        staff
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
