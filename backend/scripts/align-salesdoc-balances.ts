/**
 * Kassa kartasidagi qarz ekranda ko‘rinishi uchun
 * yetkazilgan zakazlarni mavjud to‘lovlarga FIFO taqsimlaydi.
 * Yangi to‘lov yozilmaydi. Qayta ishga tushsa qolgan qarzni qayta hisoblaydi.
 * npx tsx scripts/align-salesdoc-balances.ts
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../src/config/database";

const TENANT = 1;
const CODES = ["001", "f2-WH", "f5-WH", "f6-WH", "f7-WH", "f8-WH", "f9-WH", "f10-WH", "f11-WH"];

type MoneyRow = { client_id: number; id: number; amount: Prisma.Decimal; used: Prisma.Decimal };

function n(v: Prisma.Decimal | number | string | null): number {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

async function alignWarehouse(warehouseId: number, name: string) {
  const orders = await prisma.$queryRaw<MoneyRow[]>`
    SELECT o.client_id, o.id, o.total_sum AS amount, COALESCE(a.used, 0) AS used
    FROM orders o
    LEFT JOIN (
      SELECT order_id, SUM(amount) AS used
      FROM payment_allocations
      WHERE tenant_id = ${TENANT}
      GROUP BY order_id
    ) a ON a.order_id = o.id
    WHERE o.tenant_id = ${TENANT}
      AND o.order_type = 'order'
      AND o.status = 'delivered'
      AND o.total_sum > 0
      AND o.client_id IN (
        SELECT id FROM clients WHERE tenant_id = ${TENANT} AND warehouse_id = ${warehouseId}
      )
    ORDER BY o.client_id, o.created_at, o.id
  `;
  const pays = await prisma.$queryRaw<MoneyRow[]>`
    SELECT p.client_id, p.id, p.amount, COALESCE(a.used, 0) AS used
    FROM client_payments p
    LEFT JOIN (
      SELECT payment_id, SUM(amount) AS used
      FROM payment_allocations
      WHERE tenant_id = ${TENANT}
      GROUP BY payment_id
    ) a ON a.payment_id = p.id
    WHERE p.tenant_id = ${TENANT}
      AND p.deleted_at IS NULL
      AND p.entry_kind = 'payment'
      AND p.amount > 0
      AND p.client_id IN (
        SELECT id FROM clients WHERE tenant_id = ${TENANT} AND warehouse_id = ${warehouseId}
      )
    ORDER BY p.client_id, p.paid_at NULLS LAST, p.id
  `;
  const cards = await prisma.clientBalance.findMany({
    where: { tenant_id: TENANT, client: { warehouse_id: warehouseId } },
    select: { client_id: true, balance: true }
  });
  const target = new Map(cards.map((c) => [c.client_id, Math.max(0, -n(c.balance))]));
  const byClientOrders = new Map<number, MoneyRow[]>();
  for (const row of orders) {
    const clientId = Number(row.client_id);
    const list = byClientOrders.get(clientId) ?? [];
    list.push(row);
    byClientOrders.set(clientId, list);
  }
  const byClientPays = new Map<number, MoneyRow[]>();
  for (const row of pays) {
    const clientId = Number(row.client_id);
    const list = byClientPays.get(clientId) ?? [];
    list.push(row);
    byClientPays.set(clientId, list);
  }
  const fresh: { tenant_id: number; payment_id: number; order_id: number; amount: number }[] = [];
  for (const [clientId, clientOrders] of byClientOrders) {
    if (!target.has(clientId)) continue;
    const keep = target.get(clientId) ?? 0;
    let unpaid = 0;
    for (const o of clientOrders) unpaid += Math.max(0, n(o.amount) - n(o.used));
    let need = Math.round((unpaid - keep) * 100) / 100;
    if (need < 0.01) continue;
    const clientPays = byClientPays.get(clientId) ?? [];
    let pi = 0;
    for (const order of clientOrders) {
      if (need < 0.01) break;
      let room = Math.round((n(order.amount) - n(order.used)) * 100) / 100;
      while (room >= 0.01 && need >= 0.01 && pi < clientPays.length) {
        const pay = clientPays[pi];
        const left = Math.round((n(pay.amount) - n(pay.used)) * 100) / 100;
        if (left < 0.01) {
          pi += 1;
          continue;
        }
        const take = Math.min(room, left, need);
        const amount = Math.round(take * 100) / 100;
        if (amount >= 0.01) {
          fresh.push({ tenant_id: TENANT, payment_id: pay.id, order_id: order.id, amount });
          pay.used = new Prisma.Decimal(n(pay.used) + amount);
          room = Math.round((room - amount) * 100) / 100;
          need = Math.round((need - amount) * 100) / 100;
        }
      }
    }
  }
  let written = 0;
  for (let i = 0; i < fresh.length; i += 500) {
    written += (await prisma.paymentAllocation.createMany({ data: fresh.slice(i, i + 500) })).count;
  }
  console.log(JSON.stringify({ warehouse: name, orders: orders.length, allocations: written }));
}

async function main() {
  const rows = await prisma.warehouse.findMany({
    where: { tenant_id: TENANT, code: { in: CODES } },
    select: { id: true, name: true, code: true },
    orderBy: { id: "asc" }
  });
  for (const row of rows) await alignWarehouse(row.id, `${row.name} ${row.code}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
