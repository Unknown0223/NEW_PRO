/**
 * Yetishmayotgan Andijon cash to‘lovlarini qo‘shadi (tenant 1).
 * Mavjud qatorning vaqtini o‘zgartirmaydi: manbada soat yo‘q.
 * npx tsx scripts/backfill-andijon-cash-payments.ts
 */
import { prisma } from "../src/config/database";
import { LIVE_CUTOFF, loadSalesDoc } from "./lib/salesdoc-andijon-load";
import { salesDocInstant } from "./lib/salesdoc-andijon-docs";

const ROOT = process.argv[2] ?? "C:\\Users\\UNKNOWN_007\\Desktop\\salesdoc-andijon";
const TENANT = 1;

function regionOk(region: string | null): boolean {
  const r = (region ?? "").trim();
  return !r || /andij|андиж/i.test(r);
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { id: TENANT }, select: { slug: true } });
  if (tenant?.slug !== "aksit") throw new Error("tenant 1 aksit emas");
  const data = loadSalesDoc(ROOT);
  const cash = data.cash.filter((c) => c.sum !== 0 && c.date.slice(0, 10) && c.date.slice(0, 10) < LIVE_CUTOFF);
  const numbers = cash.map((c) => c.id.slice(0, 64));
  const existing = await prisma.payment.findMany({
    where: { tenant_id: TENANT, number: { in: numbers } },
    select: { number: true, created_by_user_id: true, ledger_agent_id: true, cash_desk_id: true }
  });
  const have = new Set(existing.map((p) => p.number));
  const byUser = new Map<string, number>();
  const byAgent = new Map<string, number>();
  const byBox = new Map<string, number>();
  for (const c of cash) {
    const row = existing.find((p) => p.number === c.id);
    if (!row) continue;
    if (c.userId && row.created_by_user_id && !byUser.has(c.userId)) byUser.set(c.userId, row.created_by_user_id);
    if (c.agentId && row.ledger_agent_id && !byAgent.has(c.agentId)) byAgent.set(c.agentId, row.ledger_agent_id);
    if (c.cashbox && row.cash_desk_id && !byBox.has(c.cashbox)) byBox.set(c.cashbox, row.cash_desk_id);
  }
  const missing = cash.filter((c) => !have.has(c.id.slice(0, 64)));
  const codes = [...new Set(missing.map((c) => c.clientId))];
  const clients = await prisma.client.findMany({
    where: { tenant_id: TENANT, client_code: { in: codes } },
    select: { id: true, client_code: true, region: true }
  });
  const clientId = new Map<string, number>();
  for (const c of clients) {
    if (c.client_code && regionOk(c.region)) clientId.set(c.client_code, c.id);
  }
  const orderNums = [...new Set(missing.map((c) => c.orderId).filter((id) => id && id !== "0"))];
  const orders = await prisma.order.findMany({
    where: { tenant_id: TENANT, number: { in: orderNums }, id: { not: 868 } },
    select: { id: true, number: true }
  });
  const orderPk = new Map(orders.map((o) => [o.number, o.id]));
  const desk = await prisma.cashDesk.findFirst({ where: { tenant_id: TENANT }, select: { id: true } });
  let inserted = 0;
  let noClient = 0;
  for (const c of missing) {
    const cid = clientId.get(c.clientId);
    if (!cid) {
      noClient += 1;
      continue;
    }
    await prisma.payment.create({
      data: {
        tenant_id: TENANT,
        number: c.id.slice(0, 64),
        client_id: cid,
        amount: Math.round(c.sum * 100) / 100,
        payment_type: c.kind === "Приход" ? "Наличные" : c.kind.slice(0, 64),
        cash_desk_id: byBox.get(c.cashbox) ?? desk?.id ?? null,
        created_by_user_id: c.userId ? byUser.get(c.userId) ?? null : null,
        ledger_agent_id: c.agentId ? byAgent.get(c.agentId) ?? null : null,
        order_id: c.orderId && c.orderId !== "0" ? orderPk.get(c.orderId) ?? null : null,
        paid_at: salesDocInstant(c.date),
        note: c.comment || null,
        workflow_status: "confirmed",
        entry_kind: "payment"
      }
    });
    inserted += 1;
  }
  const withComment = cash.filter((c) => c.comment).length;
  const withClock = cash.filter((c) => /\d{2}:\d{2}/.test(c.date)).length;
  console.log(JSON.stringify({ cash: cash.length, already: have.size, missing: missing.length, inserted, noClient, withComment, withClock }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
