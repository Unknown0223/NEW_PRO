/**
 * Andijon mahsulot, mijoz, buyurtma, to‘lov, qaytarish, bonus.
 * 2026-08-30 dan keyingi hujjatlar tashlanadi: aksitda jonli zakaz/to‘lov bor.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { LIVE_CUTOFF, type loadSalesDoc } from "./salesdoc-andijon-load";
import { writeAndijonDeliveryLogs } from "./salesdoc-andijon-delivery-logs";
import { writeAndijonPaymentsReturns } from "./salesdoc-andijon-docs-pay";
import type { applyAndijonStaff } from "./salesdoc-andijon-staff";

export { salesDocInstant } from "./salesdoc-andijon-time";
import { salesDocInstant } from "./salesdoc-andijon-time";

type Bundle = ReturnType<typeof loadSalesDoc>;
type Staff = Awaited<ReturnType<typeof applyAndijonStaff>>;
const TENANT = 1;

function gps(text: string): { lat: number; lng: number } | null {
  const m = text.split(",").map((s) => Number(s.trim()));
  if (m.length < 2 || !Number.isFinite(m[0]) || !Number.isFinite(m[1])) return null;
  if (Math.abs(m[0]) > 90 || Math.abs(m[1]) > 180) return null;
  return { lat: m[0], lng: m[1] };
}

function phoneNorm(phone: string): string | null {
  const d = phone.replace(/\D/g, "");
  return d ? d.slice(0, 20) : null;
}

export async function applyAndijonDocs(prisma: PrismaClient, data: Bundle, staff: Staff) {
  const skipped = {
    stock: "Kategoriya qoldig‘i, mahsulot qoldig‘i emas — stock yozilmadi",
    purchase: "purchase.json oylari bo‘sh",
    debt: "debt.json bitta yig‘indi, mijoz kesimida emas — balansga yozilmadi",
    sellTotals: "sell-*.json kunlik yig‘indi; zakazlar sale-lines dan",
    photos: "Foto hisobot yuklanmagan",
    liveDocs: `Hujjat sanasi ${LIVE_CUTOFF} va undan keyin — aksitda shu davr zakaz/to‘lovlari bor, SD- raqamsiz`,
    cashComment: "cash-*.json da comment ustuni yo‘q (computation — summa)",
    cashTime: "Soat cash-clock (diler finans/getData) dan. Izoh ustuni manbada yo‘q",
    debtSplit: "debtApi yig‘indisi kompaniya debitoriga teng emas — mijoz kesimi yozilmadi"
  };
  const counts = {
    products: 0,
    clientsCreated: 0,
    clientsUpdated: 0,
    clientsSkippedForeign: 0,
    orders: 0,
    orderLines: 0,
    payments: 0,
    returns: 0,
    bonuses: 0,
    ordersSkippedLive: 0,
    paymentsSkippedLive: 0,
    paymentsSkippedNoClient: 0,
    deliveryLogs: 0
  };

  const catId = new Map<string, number>();
  for (const c of data.categories) {
    const code = `SD-${c.value}`.slice(0, 64);
    let row = await prisma.productCategory.findFirst({ where: { tenant_id: TENANT, code } });
    if (!row) {
      row = await prisma.productCategory.create({
        data: { tenant_id: TENANT, name: c.text.slice(0, 200), code }
      });
    }
    catId.set(c.value, row.id);
  }

  for (const p of data.products) {
    if (!p.sku) continue;
    const category_id = catId.get(p.categoryId) ?? null;
    const existing = await prisma.product.findFirst({ where: { tenant_id: TENANT, sku: p.sku } });
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: { name: p.name, is_active: p.active, sell_code: p.id, category_id: category_id ?? existing.category_id }
      });
    } else {
      await prisma.product.create({
        data: {
          tenant_id: TENANT,
          sku: p.sku,
          name: p.name,
          is_active: p.active,
          sell_code: p.id,
          category_id
        }
      });
    }
    counts.products += 1;
  }
  const productBySd = new Map<string, number>();
  const prodRows = await prisma.product.findMany({
    where: { tenant_id: TENANT, sell_code: { not: null } },
    select: { id: true, sell_code: true }
  });
  for (const r of prodRows) if (r.sell_code) productBySd.set(r.sell_code, r.id);

  const codes = data.clients.map((c) => c.id);
  const existingClients = await prisma.client.findMany({
    where: { tenant_id: TENANT, client_code: { in: codes } },
    select: { id: true, client_code: true, region: true }
  });
  const clientByCode = new Map<string, { id: number; region: string | null }>();
  for (const c of existingClients) {
    if (c.client_code) clientByCode.set(c.client_code, { id: c.id, region: c.region });
  }

  const toCreate: Prisma.ClientCreateManyInput[] = [];
  for (const c of data.clients) {
    const agent = c.agentCode ? staff.userByKey.get(c.agentCode) ?? null : null;
    const g = gps(c.gps);
    const found = clientByCode.get(c.id);
    const regionOk =
      !found?.region || /andij|андиж/i.test(found.region) || found.region.trim() === "";
    if (found && !regionOk) {
      counts.clientsSkippedForeign += 1;
      continue;
    }
    const dataRow = {
      name: c.name,
      legal_name: c.firm || null,
      phone: c.phone || null,
      phone_normalized: phoneNorm(c.phone),
      agent_id: agent,
      region: c.region || "Andijon",
      district: c.territory || null,
      address: c.address || null,
      landmark: c.landmark || null,
      category: c.category || null,
      is_active: c.active,
      inn: c.inn || null,
      latitude: g?.lat ?? null,
      longitude: g?.lng ?? null,
      warehouse_id: staff.whMainId,
      cash_desk_id: staff.cashMainId
    };
    if (found) {
      await prisma.client.update({ where: { id: found.id }, data: dataRow });
      counts.clientsUpdated += 1;
    } else {
      toCreate.push({ tenant_id: TENANT, client_code: c.id, ...dataRow });
    }
  }
  for (let i = 0; i < toCreate.length; i += 400) {
    const part = toCreate.slice(i, i + 400);
    const res = await prisma.client.createMany({ data: part, skipDuplicates: true });
    counts.clientsCreated += res.count;
  }
  const clientRows = await prisma.client.findMany({
    where: { tenant_id: TENANT, client_code: { in: codes } },
    select: { id: true, client_code: true }
  });
  const clientId = new Map<string, number>();
  for (const c of clientRows) if (c.client_code) clientId.set(c.client_code, c.id);

  type Agg = {
    date: string;
    dateLoad: string;
    dateDeliver: string;
    clientId: string;
    agentId: string;
    storeId: string;
    expId: string;
    comment: string;
    sum: number;
    lines: { productId: string; qty: number; sum: number }[];
  };
  const orders = new Map<string, Agg>();
  for (const line of data.lines) {
    if (!line.date || line.date >= LIVE_CUTOFF) {
      counts.ordersSkippedLive += 1;
      continue;
    }
    let o = orders.get(line.orderId);
    if (!o) {
      o = {
        date: line.date,
        dateLoad: "",
        dateDeliver: "",
        clientId: line.clientId,
        agentId: line.agentId,
        storeId: line.storeId,
        expId: line.expId,
        comment: line.comment,
        sum: 0,
        lines: []
      };
      orders.set(line.orderId, o);
    }
    o.sum += line.sum;
    if (!o.dateLoad && line.dateLoad && line.dateLoad < LIVE_CUTOFF) o.dateLoad = line.dateLoad;
    if (!o.dateDeliver && line.dateDeliver && line.dateDeliver < LIVE_CUTOFF) o.dateDeliver = line.dateDeliver;
    o.lines.push({ productId: line.productId, qty: line.qty, sum: line.sum });
  }

  const orderRows: Prisma.OrderCreateManyInput[] = [];
  for (const [sdId, o] of orders) {
    const cid = clientId.get(o.clientId);
    if (!cid) continue;
    orderRows.push({
      tenant_id: TENANT,
      number: sdId.slice(0, 64),
      client_id: cid,
      agent_id: o.agentId ? staff.userByKey.get(`AG-${o.agentId}`) ?? null : null,
      expeditor_user_id: o.expId ? staff.userByKey.get(`EX-${o.expId}`) ?? null : null,
      warehouse_id: staff.storeWh.get(o.storeId) ?? staff.whMainId,
      order_type: "order",
      status: "delivered",
      total_sum: Math.round(o.sum * 100) / 100,
      comment: o.comment || null,
      created_at: salesDocInstant(o.date),
      payment_method_ref: "001"
    });
  }
  for (let i = 0; i < orderRows.length; i += 300) {
    const res = await prisma.order.createMany({ data: orderRows.slice(i, i + 300), skipDuplicates: true });
    counts.orders += res.count;
  }
  const numbers = orderRows.map((o) => o.number);
  const orderDb = await prisma.order.findMany({
    where: { tenant_id: TENANT, number: { in: numbers }, id: { not: 868 } },
    select: { id: true, number: true }
  });
  const orderPk = new Map(orderDb.map((o) => [o.number, o.id]));
  counts.deliveryLogs = await writeAndijonDeliveryLogs(prisma, orders, orderPk);
  const withItems = new Set(
    (
      await prisma.orderItem.findMany({
        where: { order_id: { in: orderDb.map((o) => o.id) } },
        distinct: ["order_id"],
        select: { order_id: true }
      })
    ).map((r) => r.order_id)
  );
  const itemRows: Prisma.OrderItemCreateManyInput[] = [];
  for (const [sdId, o] of orders) {
    const oid = orderPk.get(sdId);
    if (!oid || withItems.has(oid)) continue;
    for (const line of o.lines) {
      const pid = productBySd.get(line.productId);
      if (!pid || line.qty === 0) continue;
      const price = line.qty !== 0 ? Math.round((line.sum / line.qty) * 100) / 100 : 0;
      itemRows.push({
        order_id: oid,
        product_id: pid,
        qty: line.qty,
        price,
        total: Math.round(line.sum * 100) / 100
      });
    }
  }
  for (let i = 0; i < itemRows.length; i += 800) {
    const res = await prisma.orderItem.createMany({ data: itemRows.slice(i, i + 800) });
    counts.orderLines += res.count;
  }
  await writeAndijonPaymentsReturns(prisma, data, staff, clientId, orderPk, productBySd, orders, counts);

  return { counts, skipped };
}

