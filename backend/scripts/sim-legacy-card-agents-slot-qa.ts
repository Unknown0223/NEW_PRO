/**
 * QA sim: По агентам (order_debt), mijoz kartochkasi (legacy_debt_show_on_card),
 * work-slot debt-collectors (nom bilan).
 *
 *   cd backend && npx tsx scripts/sim-legacy-card-agents-slot-qa.ts
 *
 * Default: ma’lumotlar QOLDADİ (web tekshiruvi uchun).
 * Tozalash: --cleanup
 * Arxiv demo: --then-archive  (Davron qarzini to‘liq yopib arxivlaydi)
 */
import { Prisma, PrismaClient } from "@prisma/client";
import {
  loadUnpaidDeliveredByOrderAgent,
  splitClientDeliveryDebt
} from "../src/modules/client-balances/client-debt-by-agent";
import { allocatePayment } from "../src/modules/payments/payment-allocations.allocate";
import { maybeArchiveAgentsIfDebtCleared } from "../src/modules/work-slots/work-slots.archive-agent";
import { listSlotDebtCollectors } from "../src/modules/work-slots/work-slots.query.read";

const prisma = new PrismaClient();
const CLEANUP = process.argv.includes("--cleanup");
const THEN_ARCHIVE = process.argv.includes("--then-archive");
const SLUG = process.env.AUDIT_TENANT_SLUG ?? "test1";
const PREFIX = `qa_leg_${Date.now()}`;

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

async function main(): Promise<void> {
  console.log("=== QA SIM: card / По агентам / work-slot collectors ===\n");

  const tenant = await prisma.tenant.findFirst({
    where: { slug: SLUG },
    select: { id: true }
  });
  assert(Boolean(tenant), `tenant ${SLUG} yo‘q`);
  const tenantId = tenant!.id;

  const warehouse = await prisma.warehouse.findFirst({
    where: { tenant_id: tenantId },
    select: { id: true }
  });
  assert(Boolean(warehouse), "warehouse yo‘q");

  const hash =
    (
      await prisma.user.findFirst({
        where: { tenant_id: tenantId },
        select: { password_hash: true }
      })
    )?.password_hash ?? "qa_hash";

  const davron = await prisma.user.create({
    data: {
      tenant_id: tenantId,
      name: "Davron QA Eski",
      login: `${PREFIX}_davron`,
      password_hash: hash,
      role: "agent",
      is_active: true,
      code: `DV${String(Date.now()).slice(-4)}`
    }
  });
  const sardor = await prisma.user.create({
    data: {
      tenant_id: tenantId,
      name: "Sardor QA Yangi",
      login: `${PREFIX}_sardor`,
      password_hash: hash,
      role: "agent",
      is_active: true,
      code: `SR${String(Date.now()).slice(-4)}`
    }
  });

  const slot = await prisma.workSlot.create({
    data: {
      tenant_id: tenantId,
      slot_code: `QA-${String(Date.now()).slice(-8)}`.slice(0, 32),
      label: "QA Chilonzor Legacy",
      slot_type: "agent",
      is_active: true
    }
  });
  const linkDavron = await prisma.slotUserLink.create({
    data: {
      tenant_id: tenantId,
      slot_id: slot.id,
      user_id: davron.id,
      started_at: new Date()
    }
  });

  const client = await prisma.client.create({
    data: {
      tenant_id: tenantId,
      name: `Oazis QA ${PREFIX}`,
      address: "Chilonzor QA",
      is_active: true,
      agent_id: davron.id,
      client_code: `QA${String(Date.now()).slice(-6)}`
    }
  });
  await prisma.clientBalance.create({
    data: { tenant_id: tenantId, client_id: client.id, balance: 0 }
  });

  await prisma.order.create({
    data: {
      tenant_id: tenantId,
      number: `${PREFIX}-D`,
      client_id: client.id,
      warehouse_id: warehouse!.id,
      agent_id: davron.id,
      order_type: "order",
      status: "delivered",
      total_sum: new Prisma.Decimal(4_000_000),
      discount_sum: new Prisma.Decimal(0),
      bonus_sum: new Prisma.Decimal(0)
    }
  });

  await prisma.slotUserLink.update({
    where: { id: linkDavron.id },
    data: { ended_at: new Date() }
  });
  await prisma.slotUserLink.create({
    data: {
      tenant_id: tenantId,
      slot_id: slot.id,
      user_id: sardor.id,
      started_at: new Date()
    }
  });
  await prisma.slotAuditEntry.create({
    data: {
      tenant_id: tenantId,
      slot_id: slot.id,
      action: "assign",
      prev_user_id: davron.id,
      next_user_id: sardor.id,
      actor_id: sardor.id,
      note: "QA Davron→Sardor"
    }
  }).catch(() => undefined);

  await prisma.client.update({
    where: { id: client.id },
    data: { agent_id: sardor.id }
  });

  await prisma.order.create({
    data: {
      tenant_id: tenantId,
      number: `${PREFIX}-S`,
      client_id: client.id,
      warehouse_id: warehouse!.id,
      agent_id: sardor.id,
      order_type: "order",
      status: "delivered",
      total_sum: new Prisma.Decimal(2_000_000),
      discount_sum: new Prisma.Decimal(0),
      bonus_sum: new Prisma.Decimal(0)
    }
  });

  const split = await splitClientDeliveryDebt(tenantId, client.id, sardor.id);
  console.log(`[split] legacy=${split.legacy_debt} current=${split.current_debt} names=${split.legacy_agent_names}`);
  assert(Number(split.legacy_debt) === 4_000_000, "legacy 4M");
  assert(Number(split.current_debt) === 2_000_000, "current 2M");
  assert(split.legacy_agent_ids.includes(davron.id), "legacy_agent_ids has Davron");

  const activeLegacy = await prisma.user.count({
    where: { tenant_id: tenantId, id: { in: split.legacy_agent_ids }, is_active: true }
  });
  const showOnCard = activeLegacy > 0;
  assert(showOnCard === true, "legacy_debt_show_on_card true (Davron still active)");
  console.log("[PASS] Kartochka: Долг старого агента KO‘RINADI (Davron aktiv)");

  const orderDebt = await loadUnpaidDeliveredByOrderAgent(tenantId);
  const davronOrderDebt = orderDebt.get(davron.id);
  assert(davronOrderDebt != null && Number(davronOrderDebt) === 4_000_000, "Davron order_debt 4M");
  console.log("[PASS] По агентам: Davron order_debt=4_000_000 (mijoz endi Sardorda)");

  const collectors = await listSlotDebtCollectors(tenantId, slot.id);
  const davronRow = collectors.find((c) => c.user_id === davron.id);
  assert(Boolean(davronRow), "slot debt-collectors has Davron");
  assert(davronRow!.name.includes("Davron"), `name has Davron, got ${davronRow!.name}`);
  assert(Number(davronRow!.unpaid) === 4_000_000, "collector unpaid 4M");
  console.log(`[PASS] Work slot: debt-collectors → «${davronRow!.name}» unpaid=${davronRow!.unpaid}`);

  if (THEN_ARCHIVE) {
    const pay = await prisma.payment.create({
      data: {
        tenant_id: tenantId,
        client_id: client.id,
        amount: new Prisma.Decimal(4_000_000),
        payment_type: "cash",
        ledger_agent_id: sardor.id,
        created_by_user_id: sardor.id,
        paid_at: new Date(),
        received_at: new Date()
      }
    });
    await allocatePayment(tenantId, pay.id, sardor.id, {
      mode: "none",
      agent_id: null,
      priority: "legacy_first",
      current_agent_id: sardor.id
    });
    const archived = await maybeArchiveAgentsIfDebtCleared(tenantId, [davron.id], sardor.id);
    const davronAfter = await prisma.user.findUnique({
      where: { id: davron.id },
      select: { is_active: true }
    });
    assert(davronAfter?.is_active === false, "Davron archived");
    assert(archived.includes(davron.id), "archive list has Davron");

    const splitAfter = await splitClientDeliveryDebt(tenantId, client.id, sardor.id);
    const activeAfter = await prisma.user.count({
      where: { tenant_id: tenantId, id: { in: splitAfter.legacy_agent_ids }, is_active: true }
    });
    /** Legacy 0 → show_on_card false; agar qoldiq qolsa va agent arxiv — ham false. */
    const showAfter =
      splitAfter.legacy_debt.gt(0.01) &&
      (splitAfter.legacy_agent_ids.length === 0 || activeAfter > 0);
    assert(showAfter === false, "after archive(+legacy cleared) card hide");
    console.log("[PASS] --then-archive: Davron arxiv, kartochkada eski qarz yashirin");
  }

  console.log("\n========== WEB TEKSHIRUV (test1 tenant) ==========");
  console.log(`Tenant slug: ${SLUG}`);
  console.log(`Client id:   ${client.id}  name: Oazis QA ${PREFIX}`);
  console.log(`  → /clients/${client.id}`);
  console.log(`  → /clients/${client.id}/balances`);
  console.log(`Davron id:   ${davron.id}  «Davron QA Eski»  login: ${PREFIX}_davron`);
  console.log(`Sardor id:   ${sardor.id}  «Sardor QA Yangi»`);
  console.log(`Slot id:     ${slot.id}  code: ${slot.slot_code}`);
  console.log(`  → /work-slots/${slot.id}`);
  console.log(`              (pastda «Qarz yig‘ishdagi agentlar» — Davron nomi)`);
  console.log(`Балансы клиентов:`);
  console.log(`  → /client-balances?view=agents     (Davron: Долг по заказам 4 000 000)`);
  console.log(`  → /client-balances?view=clients_legacy  (Oazis QA…, Старый агент=Davron)`);
  if (!THEN_ARCHIVE) {
    console.log(`\nKartochkada «Долг старого агента» + Davron KO‘RINISHI KERAK.`);
    console.log(`Arxiv demo: npx tsx scripts/sim-legacy-card-agents-slot-qa.ts --then-archive`);
  }
  console.log(`Tozalash:     npx tsx scripts/sim-legacy-card-agents-slot-qa.ts --cleanup`);
  console.log(`              (PREFIX bilan topib tozalash — hozircha faqat shu running ID lari)`);
  console.log("=================================================\n");

  if (CLEANUP) {
    await prisma.paymentAllocation.deleteMany({
      where: { payment: { client_id: client.id } }
    });
    await prisma.payment.deleteMany({ where: { client_id: client.id } });
    await prisma.order.deleteMany({ where: { client_id: client.id } });
    await prisma.clientBalance.deleteMany({ where: { client_id: client.id } });
    await prisma.client.delete({ where: { id: client.id } });
    await prisma.slotUserLink.deleteMany({ where: { slot_id: slot.id } });
    await prisma.slotAuditEntry.deleteMany({ where: { slot_id: slot.id } }).catch(() => undefined);
    await prisma.workSlot.delete({ where: { id: slot.id } });
    await prisma.user.deleteMany({ where: { id: { in: [davron.id, sardor.id] } } });
    console.log("[cleanup] this-run QA rows removed");
  } else {
    console.log("[keep] QA rows retained for web check");
    console.log("Confirm OK → keyin script + ma’lumotni o‘chiramiz.");
  }

  console.log("=== QA SIM DONE ===");
}

/** Oldingi keep qoldiqlarini tozalash: --purge-kept */
async function purgeKept(): Promise<void> {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: SLUG },
    select: { id: true }
  });
  if (!tenant) throw new Error(`tenant ${SLUG} yo‘q`);
  const clients = await prisma.client.findMany({
    where: { tenant_id: tenant.id, name: { startsWith: "Oazis QA qa_leg_" } },
    select: { id: true, name: true }
  });
  const users = await prisma.user.findMany({
    where: {
      tenant_id: tenant.id,
      OR: [
        { login: { startsWith: "qa_leg_" } },
        { name: { in: ["Davron QA Eski", "Sardor QA Yangi"] } }
      ]
    },
    select: { id: true, login: true }
  });
  const slots = await prisma.workSlot.findMany({
    where: { tenant_id: tenant.id, label: "QA Chilonzor Legacy" },
    select: { id: true, slot_code: true }
  });
  for (const c of clients) {
    await prisma.paymentAllocation.deleteMany({ where: { payment: { client_id: c.id } } });
    await prisma.payment.deleteMany({ where: { client_id: c.id } });
    await prisma.order.deleteMany({ where: { client_id: c.id } });
    await prisma.clientBalance.deleteMany({ where: { client_id: c.id } });
    await prisma.client.delete({ where: { id: c.id } });
    console.log(`[purge] client ${c.id} ${c.name}`);
  }
  for (const s of slots) {
    await prisma.slotUserLink.deleteMany({ where: { slot_id: s.id } });
    await prisma.slotAuditEntry.deleteMany({ where: { slot_id: s.id } }).catch(() => undefined);
    await prisma.workSlot.delete({ where: { id: s.id } });
    console.log(`[purge] slot ${s.id} ${s.slot_code}`);
  }
  if (users.length) {
    await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    console.log(`[purge] users ${users.map((u) => u.login).join(", ")}`);
  }
  console.log("[purge] done");
}

const args = process.argv.slice(2);
if (args.includes("--purge-kept")) {
  purgeKept()
    .catch((e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
} else {
  main()
    .catch((e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}