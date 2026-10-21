/**
 * Namangan / Qoqon SalesDoc papkasini tenant 1 ga yozadi.
 * SALESDOC_NO_PREFIX=1: id o‘zi qoladi (x0_3521 dan x olib tashlanmaydi).
 * Manfiy kassa — buyurtma qarzi, to‘lov emas. Nol summali buyurtma yozilmaydi.
 * Kartadagi sana: yetkazilgan kun. Bir xil to‘lov raqami ikkinchi marta tushmaydi.
 * npx tsx scripts/import-salesdoc-branch.ts <papka> <filial> <prefiks>
 */
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../src/config/database";
import { LIVE_CUTOFF, loadSalesDoc, sdLedgerDate, sdOrderNumber, sdPriceTypeName } from "./lib/salesdoc-andijon-load";
import { applyClientDebtFile } from "./lib/salesdoc-client-debt";
import { applySalesDocPriceCatalog } from "./lib/salesdoc-price-catalog";
import { salesDocInstant } from "./lib/salesdoc-andijon-docs";

const TENANT = 1;

function px(prefix: string, id: string): string {
  if (!id || id === "0") return id;
  if (process.env.SALESDOC_NO_PREFIX === "1") return id;
  return id.startsWith(prefix) ? id : `${prefix}${id}`;
}

async function main() {
  const root = process.argv[2];
  const branch = process.argv[3];
  const prefix = process.argv[4];
  if (!root || !branch || !prefix) throw new Error("papka, filial, prefiks kerak");
  const tenant = await prisma.tenant.findUnique({ where: { id: TENANT }, select: { slug: true } });
  if (tenant?.slug !== "aksit" && tenant?.slug !== "test1") throw new Error("tenant 1 aksit yoki test1 emas");
  const data = loadSalesDoc(root, branch);
  for (const c of data.clients) c.id = px(prefix, c.id);
  for (const line of data.lines) {
    line.orderId = px(prefix, line.orderId);
    line.clientId = px(prefix, line.clientId);
    line.agentId = px(prefix, line.agentId);
  }
  for (const c of data.cash) {
    c.id = px(prefix, c.id);
    c.clientId = px(prefix, c.clientId);
    c.orderId = px(prefix, c.orderId);
    c.agentId = px(prefix, c.agentId);
  }
  for (const r of data.returns) r.orderId = px(prefix, r.orderId);

  const whCode = (process.env.SALESDOC_NO_PREFIX === "1" ? branch : `${prefix}WH`).slice(0, 40);
  let wh = await prisma.warehouse.findFirst({ where: { tenant_id: TENANT, code: whCode } });
  if (!wh) {
    wh = await prisma.warehouse.create({
      data: { tenant_id: TENANT, code: whCode, name: branch, type: "store" }
    });
  }
  const deskCode = (process.env.SALESDOC_NO_PREFIX === "1" ? branch : `${prefix}K`).slice(0, 20);
  let desk = await prisma.cashDesk.findFirst({ where: { tenant_id: TENANT, code: deskCode } });
  if (!desk) {
    desk = await prisma.cashDesk.create({
      data: { tenant_id: TENANT, code: deskCode, name: `${branch} Kassa` }
    });
  }
  const role = await prisma.role.upsert({
    where: { tenant_id_key: { tenant_id: TENANT, key: "agent" } },
    create: { tenant_id: TENANT, key: "agent", name: "agent", is_system: true },
    update: {}
  });
  const userBy = new Map<string, number>();
  let users = 0;
  for (const agent of data.staff.agents) {
    const code = px(prefix, agent.id).slice(0, 64);
    const existing = await prisma.user.findFirst({ where: { tenant_id: TENANT, code } });
    if (existing) {
      userBy.set(code, existing.id);
      continue;
    }
    const login = `sd-${code}`.toLowerCase().slice(0, 64);
    const created = await prisma.user.create({
      data: {
        tenant_id: TENANT,
        name: agent.name.slice(0, 200),
        login,
        password_hash: bcrypt.hashSync(crypto.randomBytes(18).toString("base64url"), 8),
        role: "agent",
        code,
        branch,
        can_authorize: true,
        app_access: true,
        warehouse_id: wh.id
      }
    });
    await prisma.userRole.upsert({
      where: { user_id_role_id: { user_id: created.id, role_id: role.id } },
      create: { user_id: created.id, role_id: role.id },
      update: {}
    });
    userBy.set(code, created.id);
    users += 1;
  }

  const knownClients = new Set(data.clients.map((c) => c.id));
  const onSales = new Set(data.lines.map((l) => l.clientId).filter(Boolean));
  for (const id of new Set(data.cash.map((c) => c.clientId))) {
    if (!id || knownClients.has(id) || !onSales.has(id)) continue;
    data.clients.push({
      id,
      name: id,
      firm: "",
      phone: "",
      agentCode: "",
      agentName: "",
      region: branch,
      territory: "",
      address: "",
      landmark: "",
      category: "",
      active: true,
      inn: "",
      gps: "",
      createdAt: ""
    });
    knownClients.add(id);
  }

  const sameWarehouse = process.env.SALESDOC_NO_PREFIX === "1";
  const existingCodes = new Set(
    (
      await prisma.client.findMany({
        where: {
          tenant_id: TENANT,
          ...(sameWarehouse ? { warehouse_id: wh.id } : {}),
          client_code: { in: data.clients.map((c) => c.id.slice(0, 32)) }
        },
        select: { client_code: true }
      })
    ).map((c) => c.client_code)
  );
  const clientInserts: Prisma.ClientCreateManyInput[] = data.clients.filter((c) => !existingCodes.has(c.id.slice(0, 32))).map((c) => ({
    tenant_id: TENANT,
    client_code: c.id.slice(0, 32),
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
  }));
  let clientsCreated = 0;
  for (let i = 0; i < clientInserts.length; i += 400) {
    clientsCreated += (
      await prisma.client.createMany({ data: clientInserts.slice(i, i + 400), skipDuplicates: true })
    ).count;
  }
  const clientRows = await prisma.client.findMany({
    where: {
      tenant_id: TENANT,
      ...(sameWarehouse ? { warehouse_id: wh.id } : {}),
      client_code: { in: data.clients.map((c) => c.id.slice(0, 32)) }
    },
    select: { id: true, client_code: true }
  });
  const clientId = new Map(clientRows.map((c) => [c.client_code as string, c.id]));
  const products = await prisma.product.findMany({
    where: { tenant_id: TENANT, sell_code: { not: null } },
    select: { id: true, sell_code: true }
  });
  const productBySd = new Map(products.map((p) => [p.sell_code as string, p.id]));

  type Agg = {
    date: string;
    dateLoad: string;
    dateDeliver: string;
    clientId: string;
    agentId: string;
    comment: string;
    sum: number;
    priceTypeId: string;
    priceAbs: number;
    lines: { productId: string; qty: number; sum: number }[];
  };
  const orders = new Map<string, Agg>();
  for (const line of data.lines) {
    if (!line.date || line.date >= LIVE_CUTOFF || !line.orderId) continue;
    let o = orders.get(line.orderId);
    if (!o) {
      o = {
        date: line.date,
        dateLoad: "",
        dateDeliver: "",
        clientId: line.clientId,
        agentId: line.agentId,
        comment: line.comment,
        sum: 0,
        priceTypeId: "",
        priceAbs: 0,
        lines: []
      };
      orders.set(line.orderId, o);
    }
    o.sum += line.sum;
    if (!o.dateLoad && line.dateLoad) o.dateLoad = line.dateLoad;
    if (!o.dateDeliver && line.dateDeliver) o.dateDeliver = line.dateDeliver;
    if (line.priceTypeId && Math.abs(line.sum) >= o.priceAbs) {
      o.priceTypeId = line.priceTypeId;
      o.priceAbs = Math.abs(line.sum);
    }
    o.lines.push({ productId: line.productId, qty: line.qty, sum: line.sum });
  }
  const orderRows: Prisma.OrderCreateManyInput[] = [];
  for (const [sdId, o] of orders) {
    const cid = clientId.get(o.clientId.slice(0, 32));
    if (!cid || o.sum === 0) continue;
    orderRows.push({
      tenant_id: TENANT,
      number: sdOrderNumber(sdId),
      client_id: cid,
      agent_id: userBy.get(o.agentId) ?? null,
      warehouse_id: wh.id,
      order_type: "order",
      status: "delivered",
      total_sum: Math.round(o.sum * 100) / 100,
      comment: o.comment || null,
      created_at: salesDocInstant(sdLedgerDate(o.date, o.dateLoad, o.dateDeliver)),
      payment_method_ref: "pm-naxt",
      price_type: o.priceTypeId ? sdPriceTypeName(o.priceTypeId) : null
    });
  }
  let ordersInserted = 0;
  for (let i = 0; i < orderRows.length; i += 300) {
    ordersInserted += (await prisma.order.createMany({ data: orderRows.slice(i, i + 300), skipDuplicates: true })).count;
  }
  const saved = await prisma.order.findMany({
    where: {
      tenant_id: TENANT,
      warehouse_id: wh.id,
      number: { in: [...orders.keys()].map((id) => sdOrderNumber(id)) }
    },
    select: { id: true, number: true }
  });
  const orderPk = new Map(saved.map((o) => [o.number, o.id]));
  for (const sdId of orders.keys()) {
    const id = orderPk.get(sdOrderNumber(sdId));
    if (id) orderPk.set(sdId, id);
  }
  const haveItems = new Set(
    (await prisma.orderItem.findMany({
      where: { order_id: { in: saved.map((o) => o.id) } },
      distinct: ["order_id"],
      select: { order_id: true }
    })).map((r) => r.order_id)
  );
  const missingProducts = new Set<string>();
  for (const o of orders.values()) {
    for (const line of o.lines) {
      if (line.productId && !productBySd.has(line.productId)) missingProducts.add(line.productId);
    }
  }
  if (missingProducts.size) {
    await prisma.product.createMany({
      data: [...missingProducts].map((code) => ({
        tenant_id: TENANT,
        sku: code.slice(0, 64),
        name: code.slice(0, 300),
        sell_code: code.slice(0, 64),
        is_active: true
      })),
      skipDuplicates: true
    });
    const added = await prisma.product.findMany({
      where: { tenant_id: TENANT, sell_code: { in: [...missingProducts] } },
      select: { id: true, sell_code: true }
    });
    for (const p of added) if (p.sell_code) productBySd.set(p.sell_code, p.id);
  }
  const items: Prisma.OrderItemCreateManyInput[] = [];
  for (const [sdId, o] of orders) {
    const oid = orderPk.get(sdId);
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
  const usedNumbers = new Set(
    (await prisma.payment.findMany({
      where: { tenant_id: TENANT, number: { not: null } },
      select: { number: true }
    })).map((p) => p.number as string)
  );
  const pays: Prisma.PaymentCreateManyInput[] = [];
  let paymentsSkippedLive = 0;
  let paymentsSkippedNoClient = 0;
  for (const c of data.cash) {
    const day = c.date.slice(0, 10);
    if (!day || day >= LIVE_CUTOFF) {
      paymentsSkippedLive += 1;
      continue;
    }
    const cid = clientId.get(c.clientId.slice(0, 32));
    if (!cid || c.sum <= 0) {
      if (c.sum > 0 && !cid) paymentsSkippedNoClient += 1;
      continue;
    }
    const rawPay =
      process.env.SALESDOC_NO_PREFIX === "1" || !c.id.startsWith(prefix) ? c.id : c.id.slice(prefix.length);
    const payNumber = rawPay.slice(0, 64);
    if (usedNumbers.has(payNumber)) continue;
    usedNumbers.add(payNumber);
    pays.push({
      tenant_id: TENANT,
      number: payNumber,
      client_id: cid,
      amount: Math.round(c.sum * 100) / 100,
      payment_type: c.kind === "Приход" ? "Наличные" : c.kind.slice(0, 64),
      cash_desk_id: desk.id,
      ledger_agent_id: userBy.get(c.agentId) ?? null,
      order_id: c.orderId && c.orderId !== "0" ? orderPk.get(c.orderId) ?? null : null,
      paid_at: salesDocInstant(c.date),
      workflow_status: "confirmed",
      entry_kind: "payment"
    });
  }
  let payments = 0;
  for (let i = 0; i < pays.length; i += 400) {
    payments += (await prisma.payment.createMany({ data: pays.slice(i, i + 400), skipDuplicates: true })).count;
  }
  const debts = await applyClientDebtFile(prisma, root, wh.id);
  const priceTypes = await applySalesDocPriceCatalog(prisma, data.priceTypes);
  console.log(JSON.stringify({
    branch,
    prefix,
    users,
    clientsCreated,
    orders: ordersInserted,
    lines,
    payments,
    paymentsSkippedLive,
    paymentsSkippedNoClient,
    debts,
    priceTypes,
    emptyMonths: data.skippedEmptyMonths,
    cutoff: LIVE_CUTOFF,
    note: "2026-08-30 dan keyin yozilmadi. Soat/izoh bu dilerda yo‘q. Foto yo‘q."
  }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
