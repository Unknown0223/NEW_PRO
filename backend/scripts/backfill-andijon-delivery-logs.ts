/** Bir martalik: mavjud d0_ zakazlarga yetkazish jurnali. Import skripti ham shu funksiyani chaqiradi. */
import { prisma } from "../src/config/database";
import { LIVE_CUTOFF, loadSalesDoc } from "./lib/salesdoc-andijon-load";
import { writeAndijonDeliveryLogs } from "./lib/salesdoc-andijon-delivery-logs";

const root = process.argv[2] ?? "C:\\Users\\UNKNOWN_007\\Desktop\\salesdoc-andijon";

async function main() {
  const data = loadSalesDoc(root);
  const orders = new Map<string, { date: string; dateLoad: string; dateDeliver: string }>();
  for (const line of data.lines) {
    if (!line.date || line.date >= LIVE_CUTOFF) continue;
    let o = orders.get(line.orderId);
    if (!o) {
      o = { date: line.date, dateLoad: "", dateDeliver: "" };
      orders.set(line.orderId, o);
    }
    if (!o.dateLoad && line.dateLoad && line.dateLoad < LIVE_CUTOFF) o.dateLoad = line.dateLoad;
    if (!o.dateDeliver && line.dateDeliver && line.dateDeliver < LIVE_CUTOFF) {
      o.dateDeliver = line.dateDeliver;
    }
  }
  const numbers = [...orders.keys()];
  const db = await prisma.order.findMany({
    where: { tenant_id: 1, number: { in: numbers }, id: { not: 868 } },
    select: { id: true, number: true }
  });
  const pk = new Map(db.map((o) => [o.number, o.id]));
  const inserted = await writeAndijonDeliveryLogs(prisma, orders, pk);
  console.log(JSON.stringify({ orders: orders.size, matched: pk.size, inserted }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
