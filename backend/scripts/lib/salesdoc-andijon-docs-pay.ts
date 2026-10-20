/** Andijon to‘lov, qaytarish va bonus yozuvi. */
import type { Prisma, PrismaClient } from "@prisma/client";
import { LIVE_CUTOFF, type loadSalesDoc } from "./salesdoc-andijon-load";
import { salesDocInstant } from "./salesdoc-andijon-time";
import type { applyAndijonStaff } from "./salesdoc-andijon-staff";

type Bundle = ReturnType<typeof loadSalesDoc>;
type Staff = Awaited<ReturnType<typeof applyAndijonStaff>>;
const TENANT = 1;
const BRANCH_ANDIJON = "Andijon";

type PayCounts = {
  payments: number;
  paymentsSkippedLive: number;
  paymentsSkippedNoClient: number;
  returns: number;
  bonuses: number;
};

export async function writeAndijonPaymentsReturns(
  prisma: PrismaClient,
  data: Bundle,
  staff: Staff,
  clientId: Map<string, number>,
  orderPk: Map<string, number>,
  productBySd: Map<string, number>,
  orders: Map<string, { agentId: string; expId: string }>,
  counts: PayCounts
) {
  const cashCodes = [...new Set(data.cash.map((c) => c.clientId).filter(Boolean))];
  if (cashCodes.length) {
    const extraClients = await prisma.client.findMany({
      where: { tenant_id: TENANT, client_code: { in: cashCodes } },
      select: { id: true, client_code: true, region: true }
    });
    for (const c of extraClients) {
      if (!c.client_code || clientId.has(c.client_code)) continue;
      const region = (c.region ?? "").trim();
      if (region && !/andij|андиж/i.test(region)) continue;
      clientId.set(c.client_code, c.id);
    }
  }

  const payRows: Prisma.PaymentCreateManyInput[] = [];
  for (const c of data.cash) {
    const day = c.date.slice(0, 10);
    if (!day || day >= LIVE_CUTOFF) {
      counts.paymentsSkippedLive += 1;
      continue;
    }
    const cid = clientId.get(c.clientId);
    if (!cid || c.sum === 0) {
      if (c.sum !== 0 && !cid) counts.paymentsSkippedNoClient += 1;
      continue;
    }
    const box = staff.cashByBox.get(c.cashbox) ?? staff.cashMainId;
    payRows.push({
      tenant_id: TENANT,
      number: c.id.slice(0, 64),
      client_id: cid,
      amount: Math.round(c.sum * 100) / 100,
      payment_type: c.kind === "Приход" ? "Наличные" : c.kind.slice(0, 64),
      cash_desk_id: box,
      created_by_user_id: c.userId ? staff.userByKey.get(`US-${c.userId}`) ?? null : null,
      ledger_agent_id: c.agentId ? staff.userByKey.get(`AG-${c.agentId}`) ?? null : null,
      order_id: c.orderId && c.orderId !== "0" ? orderPk.get(c.orderId) ?? null : null,
      paid_at: salesDocInstant(c.date),
      note: c.comment || null,
      workflow_status: "confirmed",
      entry_kind: "payment"
    });
  }
  for (let i = 0; i < payRows.length; i += 400) {
    const res = await prisma.payment.createMany({ data: payRows.slice(i, i + 400), skipDuplicates: true });
    counts.payments += res.count;
  }

  const orderNums: string[] = [];
  const orderAgents: number[] = [];
  const orderExps: number[] = [];
  for (const [sdId, o] of orders) {
    orderNums.push(sdId.slice(0, 64));
    orderAgents.push(staff.userByKey.get(`AG-${o.agentId}`) ?? 0);
    orderExps.push(staff.userByKey.get(`EX-${o.expId}`) ?? 0);
  }
  if (orderNums.length) {
    await prisma.$executeRaw`
      UPDATE orders AS o
      SET agent_id = CASE WHEN m.uid <> 0 THEN m.uid ELSE o.agent_id END,
          expeditor_user_id = CASE WHEN m.eid <> 0 THEN m.eid ELSE o.expeditor_user_id END
      FROM unnest(${orderNums}::text[], ${orderAgents}::int[], ${orderExps}::int[]) AS m(num, uid, eid)
      WHERE o.tenant_id = ${TENANT} AND o.id <> 868 AND o.number = m.num
    `;
  }
  const payNums: string[] = [];
  const payBy: number[] = [];
  const payAg: number[] = [];
  const payNotes: string[] = [];
  const payAt: Date[] = [];
  const payHasClock: boolean[] = [];
  for (const c of data.cash) {
    const day = c.date.slice(0, 10);
    if (!day || day >= LIVE_CUTOFF || !c.id) continue;
    payNums.push(c.id.slice(0, 64));
    payBy.push(staff.userByKey.get(`US-${c.userId}`) ?? 0);
    payAg.push(staff.userByKey.get(`AG-${c.agentId}`) ?? 0);
    payNotes.push(c.comment);
    payAt.push(salesDocInstant(c.date));
    payHasClock.push(/\d{2}:\d{2}/.test(c.date));
  }
  for (let i = 0; i < payNums.length; i += 2000) {
    const nums = payNums.slice(i, i + 2000);
    const creators = payBy.slice(i, i + 2000);
    const agents = payAg.slice(i, i + 2000);
    const notes = payNotes.slice(i, i + 2000);
    const ats = payAt.slice(i, i + 2000);
    const clocks = payHasClock.slice(i, i + 2000);
    await prisma.$executeRaw`
      UPDATE client_payments AS p
      SET created_by_user_id = CASE WHEN m.creator <> 0 THEN m.creator ELSE p.created_by_user_id END,
          ledger_agent_id = CASE WHEN m.ag <> 0 THEN m.ag ELSE p.ledger_agent_id END,
          note = CASE WHEN m.note <> '' THEN m.note ELSE p.note END,
          paid_at = CASE WHEN m.has_clock THEN m.paid ELSE p.paid_at END
      FROM unnest(
        ${nums}::text[],
        ${creators}::int[],
        ${agents}::int[],
        ${notes}::text[],
        ${ats}::timestamptz[],
        ${clocks}::boolean[]
      ) AS m(num, creator, ag, note, paid, has_clock)
      WHERE p.tenant_id = ${TENANT} AND p.number = m.num AND (p.order_id IS NULL OR p.order_id <> 868)
    `;
  }

  const retMap = new Map<string, { sum: number; lines: { productId: string; qty: number }[] }>();
  for (const r of data.returns) {
    const oid = orderPk.get(r.orderId);
    if (!oid) continue;
    let g = retMap.get(r.orderId);
    if (!g) {
      g = { sum: 0, lines: [] };
      retMap.set(r.orderId, g);
    }
    g.sum += r.sum;
    g.lines.push({ productId: r.productId, qty: r.qty });
  }
  for (const [sdId, g] of retMap) {
    const number = `SDR-${sdId}`.slice(0, 48);
    const exists = await prisma.salesReturn.findFirst({ where: { tenant_id: TENANT, number } });
    if (exists) continue;
    const order = await prisma.order.findFirst({
      where: { tenant_id: TENANT, number: sdId, id: { not: 868 } },
      select: { id: true, client_id: true, warehouse_id: true }
    });
    if (!order?.warehouse_id) continue;
    const lines = g.lines
      .map((l) => ({ product_id: productBySd.get(l.productId), qty: l.qty }))
      .filter((l): l is { product_id: number; qty: number } => Boolean(l.product_id));
    if (!lines.length) continue;
    await prisma.salesReturn.create({
      data: {
        tenant_id: TENANT,
        number,
        client_id: order.client_id,
        order_id: order.id,
        warehouse_id: order.warehouse_id,
        status: "posted",
        return_type: "partial",
        note: "SalesDoc Andijon",
        lines: { create: lines.map((l) => ({ product_id: l.product_id, qty: l.qty })) }
      }
    });
    counts.returns += 1;
  }

  for (const b of data.bonuses) {
    if (!b.andijon || !b.name) continue;
    const exists = await prisma.bonusRule.findFirst({ where: { tenant_id: TENANT, name: b.name } });
    if (exists) continue;
    const product_ids = b.products.map((id) => productBySd.get(id)).filter((x): x is number => Boolean(x));
    const bonus_product_ids = b.bonusProducts
      .map((id) => productBySd.get(id))
      .filter((x): x is number => Boolean(x));
    await prisma.bonusRule.create({
      data: {
        tenant_id: TENANT,
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
        scope_branch_codes: [BRANCH_ANDIJON],
        scope_restrict_assortment: product_ids.length > 0
      }
    });
    counts.bonuses += 1;
  }
}
