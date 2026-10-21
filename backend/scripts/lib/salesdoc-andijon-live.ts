/**
 * 2026-08-30 dan keyingi SalesDoc hujjat.
 * Faqat shu klient+kun+summa bo‘yicha jonli aksit qatori yo‘q bo‘lsa yoziladi.
 * Order id 868 ga tegmaydi.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { LIVE_CUTOFF, sdLedgerDate, sdOrderNumber, sdPriceTypeName, type loadSalesDoc } from "./salesdoc-andijon-load";
import { salesDocInstant } from "./salesdoc-andijon-docs";
import type { applyAndijonStaff } from "./salesdoc-andijon-staff";

type Bundle = ReturnType<typeof loadSalesDoc>;
type Staff = Awaited<ReturnType<typeof applyAndijonStaff>>;
const TENANT = 1;

function keyOf(clientId: number, day: string, sum: number): string {
  return `${clientId}|${day}|${Math.round(sum * 100)}`;
}

export async function applyAndijonLive(prisma: PrismaClient, data: Bundle, staff: Staff) {
  const counts = { orders: 0, lines: 0, payments: 0, skippedOrders: 0, skippedPayments: 0 };
  const codes = [...new Set(data.lines.filter((l) => l.date >= LIVE_CUTOFF).map((l) => l.clientId))];
  const payCodes = data.cash.filter((c) => c.date.slice(0, 10) >= LIVE_CUTOFF).map((c) => c.clientId);
  const clients = await prisma.client.findMany({
    where: { tenant_id: TENANT, client_code: { in: [...new Set([...codes, ...payCodes])] } },
    select: { id: true, client_code: true, region: true }
  });
  const clientId = new Map<string, number>();
  for (const c of clients) {
    if (!c.client_code) continue;
    const region = (c.region ?? "").trim();
    if (region && !/andij|андиж/i.test(region)) continue;
    clientId.set(c.client_code, c.id);
  }
  const ids = [...clientId.values()];
  if (!ids.length) return counts;

  const nativeOrders = await prisma.$queryRaw<
    { client_id: number; day: string; total: string; n: number }[]
  >`
    SELECT client_id, to_char(created_at AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD') AS day,
           total_sum::text AS total, count(*)::int AS n
    FROM orders
    WHERE tenant_id = ${TENANT} AND id <> 868 AND client_id IN (${Prisma.join(ids)})
      AND number NOT LIKE 'd0_%' AND created_at >= ${new Date("2026-08-29T00:00:00+05:00")}
    GROUP BY client_id, day, total_sum
  `;
  const nativeOrderN = new Map<string, number>();
  for (const r of nativeOrders) nativeOrderN.set(keyOf(r.client_id, r.day, Number(r.total)), r.n);

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
    priceTypeId: string;
    priceAbs: number;
    lines: { productId: string; qty: number; sum: number }[];
  };
  const orders = new Map<string, Agg>();
  for (const line of data.lines) {
    if (!line.date || line.date < LIVE_CUTOFF || !line.orderId) continue;
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
  const products = await prisma.product.findMany({
    where: { tenant_id: TENANT, sell_code: { not: null } },
    select: { id: true, sell_code: true }
  });
  const productBySd = new Map(products.map((p) => [p.sell_code as string, p.id]));
  const orderRows: Prisma.OrderCreateManyInput[] = [];
  const accepted = new Map<string, Agg>();
  for (const [sdId, o] of orders) {
    const cid = clientId.get(o.clientId);
    if (!cid || o.sum === 0) {
      counts.skippedOrders += 1;
      continue;
    }
    const k = keyOf(cid, o.date, o.sum);
    if ((nativeOrderN.get(k) ?? 0) > 0) {
      counts.skippedOrders += 1;
      continue;
    }
    accepted.set(sdId, o);
    orderRows.push({
      tenant_id: TENANT,
      number: sdOrderNumber(sdId),
      client_id: cid,
      agent_id: o.agentId ? staff.userByKey.get(`AG-${o.agentId}`) ?? null : null,
      expeditor_user_id: o.expId ? staff.userByKey.get(`EX-${o.expId}`) ?? null : null,
      warehouse_id: staff.storeWh.get(o.storeId) ?? staff.whMainId,
      order_type: "order",
      status: "delivered",
      total_sum: Math.round(o.sum * 100) / 100,
      comment: o.comment || null,
      created_at: salesDocInstant(sdLedgerDate(o.date, o.dateLoad, o.dateDeliver)),
      payment_method_ref: "pm-naxt",
      price_type: o.priceTypeId ? sdPriceTypeName(o.priceTypeId) : null
    });
  }
  if (orderRows.length) {
    const res = await prisma.order.createMany({ data: orderRows, skipDuplicates: true });
    counts.orders = res.count;
  }
  const saved = await prisma.order.findMany({
    where: { tenant_id: TENANT, number: { in: [...accepted.keys()] }, id: { not: 868 } },
    select: { id: true, number: true }
  });
  const orderPk = new Map(saved.map((o) => [o.number, o.id]));
  const itemRows: Prisma.OrderItemCreateManyInput[] = [];
  for (const [sdId, o] of accepted) {
    const oid = orderPk.get(sdId);
    if (!oid) continue;
    for (const line of o.lines) {
      const pid = productBySd.get(line.productId);
      if (!pid || line.qty === 0) continue;
      itemRows.push({
        order_id: oid,
        product_id: pid,
        qty: line.qty,
        price: line.qty ? Math.round((line.sum / line.qty) * 100) / 100 : 0,
        total: Math.round(line.sum * 100) / 100
      });
    }
  }
  if (itemRows.length) {
    const have = new Set(
      (
        await prisma.orderItem.findMany({
          where: { order_id: { in: saved.map((o) => o.id) } },
          distinct: ["order_id"],
          select: { order_id: true }
        })
      ).map((r) => r.order_id)
    );
    const fresh = itemRows.filter((r) => !have.has(r.order_id));
    if (fresh.length) counts.lines = (await prisma.orderItem.createMany({ data: fresh })).count;
  }

  const nativePays = await prisma.$queryRaw<{ client_id: number; day: string; total: string; n: number }[]>`
    SELECT client_id, to_char(COALESCE(paid_at, created_at) AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD') AS day,
           amount::text AS total, count(*)::int AS n
    FROM client_payments
    WHERE tenant_id = ${TENANT} AND deleted_at IS NULL AND client_id IN (${Prisma.join(ids)})
      AND (number IS NULL OR number NOT LIKE '%\_%' ESCAPE '\')
      AND COALESCE(paid_at, created_at) >= ${new Date("2026-08-29T00:00:00+05:00")}
    GROUP BY client_id, day, amount
  `;
  const nativePayN = new Map<string, number>();
  for (const r of nativePays) nativePayN.set(keyOf(r.client_id, r.day, Number(r.total)), r.n);
  const liveCash = data.cash.filter((c) => c.sum > 0 && c.date.slice(0, 10) >= LIVE_CUTOFF && clientId.has(c.clientId));
  const payRows: Prisma.PaymentCreateManyInput[] = [];
  for (const c of liveCash) {
    const cid = clientId.get(c.clientId)!;
    const k = keyOf(cid, c.date.slice(0, 10), c.sum);
    if ((nativePayN.get(k) ?? 0) > 0) {
      counts.skippedPayments += 1;
      continue;
    }
    payRows.push({
      tenant_id: TENANT,
      number: c.id.slice(0, 64),
      client_id: cid,
      amount: Math.round(Math.abs(c.sum) * 100) / 100,
      payment_type: c.kind === "Приход" ? "Наличные" : c.kind.slice(0, 64),
      cash_desk_id: staff.cashByBox.get(c.cashbox) ?? staff.cashMainId,
      created_by_user_id: c.userId ? staff.userByKey.get(`US-${c.userId}`) ?? null : null,
      ledger_agent_id: c.agentId ? staff.userByKey.get(`AG-${c.agentId}`) ?? null : null,
      order_id: c.orderId && c.orderId !== "0" ? orderPk.get(c.orderId) ?? null : null,
      paid_at: salesDocInstant(c.date),
      note: c.comment || null,
      workflow_status: "confirmed",
      entry_kind: "payment"
    });
  }
  if (payRows.length) counts.payments = (await prisma.payment.createMany({ data: payRows, skipDuplicates: true })).count;
  return counts;
}
