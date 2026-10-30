/**
 * Imported Andijon orders have status delivered but no status log.
 * Orders list «Дата доставки» / «Дата отгрузки» filters those logs.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { LIVE_CUTOFF } from "./salesdoc-andijon-load";

type OrderDates = { date: string; dateLoad: string; dateDeliver: string };

function dayStamp(ymd: string): Date {
  return new Date(`${ymd}T06:00:00+05:00`);
}

function shipDay(o: OrderDates): string {
  if (o.dateLoad && o.dateLoad < LIVE_CUTOFF) return o.dateLoad;
  if (o.date && o.date < LIVE_CUTOFF) return o.date;
  return "";
}

function deliverDay(o: OrderDates): string {
  if (o.dateDeliver && o.dateDeliver < LIVE_CUTOFF) return o.dateDeliver;
  return shipDay(o);
}

export async function writeAndijonDeliveryLogs(
  prisma: PrismaClient,
  orders: Map<string, OrderDates>,
  orderPk: Map<string, number>
): Promise<number> {
  const wanted: Prisma.OrderStatusLogCreateManyInput[] = [];
  for (const [sdId, o] of orders) {
    if (!sdId.includes("_") || o.date >= LIVE_CUTOFF) continue;
    const orderId = orderPk.get(sdId);
    if (!orderId || orderId === 868) continue;
    const ship = shipDay(o);
    const deliver = deliverDay(o);
    if (ship) {
      wanted.push({
        order_id: orderId,
        from_status: "new",
        to_status: "delivering",
        created_at: dayStamp(ship)
      });
    }
    if (deliver) {
      wanted.push({
        order_id: orderId,
        from_status: "delivering",
        to_status: "delivered",
        created_at: dayStamp(deliver)
      });
    }
  }
  if (wanted.length === 0) return 0;

  const ids = [...new Set(wanted.map((r) => r.order_id))];
  const have = new Set<string>();
  for (let i = 0; i < ids.length; i += 2000) {
    const chunk = ids.slice(i, i + 2000);
    const rows = await prisma.orderStatusLog.findMany({
      where: {
        order_id: { in: chunk },
        superseded_at: null,
        to_status: { in: ["delivering", "delivered"] }
      },
      select: { order_id: true, to_status: true }
    });
    for (const r of rows) have.add(`${r.order_id}:${r.to_status}`);
  }

  const fresh = wanted.filter((r) => !have.has(`${r.order_id}:${r.to_status}`));
  let inserted = 0;
  for (let i = 0; i < fresh.length; i += 800) {
    const res = await prisma.orderStatusLog.createMany({ data: fresh.slice(i, i + 800) });
    inserted += res.count;
  }
  return inserted;
}
