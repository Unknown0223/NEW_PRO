/**
 * test1 uchun `pending_confirmation` ekspeditor to'lovlari — veb «Заявки» sahifasini sinash.
 *   npx tsx scripts/seed-expeditor-pending-payments-once.ts
 */
import { Prisma, PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const tenant = await p.tenant.findUnique({ where: { slug: "test1" } });
  if (!tenant) {
    console.error("tenant test1 not found");
    process.exit(1);
  }

  const order = await p.order.findFirst({
    where: {
      tenant_id: tenant.id,
      order_type: "order",
      status: { not: "cancelled" },
      expeditor_user_id: { not: null }
    },
    orderBy: { id: "desc" },
    select: {
      id: true,
      client_id: true,
      agent_id: true,
      expeditor_user_id: true,
      total_sum: true
    }
  });

  if (!order?.expeditor_user_id) {
    console.error("no expeditor order for test1");
    process.exit(1);
  }

  const existing = await p.payment.count({
    where: {
      tenant_id: tenant.id,
      workflow_status: "pending_confirmation",
      entry_kind: "payment",
      deleted_at: null
    }
  });

  if (existing >= 2) {
    console.log(`already have ${existing} pending payments — skip`);
    await p.$disconnect();
    return;
  }

  const now = new Date();
  const amounts = [500_000, 750_000];
  const types = ["naqd", "terminal"];
  const created: number[] = [];

  for (let i = 0; i < amounts.length; i++) {
    const row = await p.payment.create({
      data: {
        tenant_id: tenant.id,
        client_id: order.client_id,
        order_id: order.id,
        amount: new Prisma.Decimal(amounts[i]!),
        payment_type: types[i]!,
        note: `[seed] Ekspeditor ariza #${i + 1}`,
        created_by_user_id: order.expeditor_user_id,
        cash_desk_id: null,
        workflow_status: "pending_confirmation",
        received_at: now,
        paid_at: null,
        confirmed_at: null,
        entry_kind: "payment",
        expeditor_user_id: order.expeditor_user_id,
        ledger_agent_id: order.agent_id
      },
      select: { id: true }
    });
    created.push(row.id);
  }

  console.log("created pending payments:", created.join(", "));
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
