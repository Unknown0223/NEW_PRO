/**
 * Namangan / Qoqon SalesDoc papkasini tenant aksit (id 1) ga yozadi.
 * Raqamlar prefiksli (f2-, f5-), Andijon qatorlari va order 868 ga tegmaydi.
 * npx tsx scripts/import-salesdoc-branch.ts <papka> <filial> <prefiks>
 */
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../src/config/database";
import { LIVE_CUTOFF, loadSalesDoc } from "./lib/salesdoc-andijon-load";
import { salesDocInstant } from "./lib/salesdoc-andijon-docs";

const TENANT = 1;

function px(prefix: string, id: string): string {
  if (!id || id === "0") return id;
  return id.startsWith(prefix) ? id : `${prefix}${id}`;
}

async function main() {
  const root = process.argv[2];
  const branch = process.argv[3];
  const prefix = process.argv[4];
  if (!root || !branch || !prefix) throw new Error("papka, filial, prefiks kerak");
  const tenant = await prisma.tenant.findUnique({ where: { id: TENANT }, select: { slug: true } });
  if (tenant?.slug !== "aksit") throw new Error("tenant 1 aksit emas");
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

  const whCode = `${prefix}WH`.slice(0, 40);
  let wh = await prisma.warehouse.findFirst({ where: { tenant_id: TENANT, code: whCode } });
  if (!wh) {
    wh = await prisma.warehouse.create({
      data: { tenant_id: TENANT, code: whCode, name: branch, type: "store" }
    });
  }
  const deskCode = `${prefix}K`.slice(0, 20);
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

  const existingCodes = new Set(
    (
      await prisma.client.findMany({
        where: { tenant_id: TENANT, client_code: { in: data.clients.map((c) => c.id.slice(0, 32)) } },
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
    where: { tenant_id: TENANT, client_code: { in: data.clients.map((c) => c.id.slice(0, 32)) } },
    select: { id: true, client_code: true }
  });
  const clientId = new Map(clientRows.map((c) => [c.client_code as string, c.id]));
  const products = await prisma.product.findMany({
    where: { tenant_id: TENANT, sell_code: { not: null } },
    select: { id: true, sell_code: true }
  });
  const productBySd = new Map(products.map((p) => [p.sell_code as string, p.id]));

  type Agg = { date: string; clientId: string; agentId: string; comment: string; sum: number; lines: { productId: string; qty: number; sum: number }[] };
  const orders = new Map<string, Agg>();
  for (const line of data.lines) {
    if (!line.date || line.date >= LIVE_CUTOFF || !line.orderId) continue;
    let o = orders.get(line.orderId);
    if (!o) {
      o = { date: line.date, clientId: line.clientId, agentId: line.agentId, comment: line.comment, sum: 0, lines: [] };
      orders.set(line.orderId, o);
    }
    o.sum += line.sum;
    o.lines.push({ productId: line.productId, qty: line.qty, sum: line.sum });
  }
  const orderRows: Prisma.OrderCreateManyInput[] = [];
  for (const [sdId, o] of orders) {
    const cid = clientId.get(o.clientId.slice(0, 32));
    if (!cid) continue;
    orderRows.push({
      tenant_id: TENANT,
      number: sdId.slice(0, 64),
      client_id: cid,
      agent_id: userBy.get(o.agentId) ?? null,
      warehouse_id: wh.id,
      order_type: "order",
      status: "delivered",
      total_sum: Math.round(o.sum * 100) / 100,
      comment: o.comment || null,
      created_at: salesDocInstant(o.date),
      payment_method_ref: "001"
    });
  }
  let ordersInserted = 0;
  for (let i = 0; i < orderRows.length; i += 300) {
    ordersInserted += (await prisma.order.createMany({ data: orderRows.slice(i, i + 300), skipDuplicates: true })).count;
  }
  const saved = await prisma.order.findMany({
    where: { tenant_id: TENANT, number: { in: [...orders.keys()] }, id: { not: 868 } },
    select: { id: true, number: true }
  });
  const orderPk = new Map(saved.map((o) => [o.number, o.id]));
  const haveItems = new Set(
    (await prisma.orderItem.findMany({
      where: { order_id: { in: saved.map((o) => o.id) } },
      distinct: ["order_id"],
      select: { order_id: true }
    })).map((r) => r.order_id)
  );
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
    if (!cid || !c.sum) {
      if (c.sum && !cid) paymentsSkippedNoClient += 1;
      continue;
    }
    const rawPay = c.id.startsWith(prefix) ? c.id.slice(prefix.length) : c.id;
    let payNumber = rawPay.slice(0, 64);
    if (usedNumbers.has(payNumber)) payNumber = c.id.slice(0, 64);
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
