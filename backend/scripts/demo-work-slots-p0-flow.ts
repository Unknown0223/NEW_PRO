/**
 * P0 demo: bir nechta slot + agent yaratadi, config/assign/swap/unassign o‘tkazadi.
 * Webda ko‘rish uchun ma’lumot qoldiradi.
 *
 *   npx.cmd tsx scripts/demo-work-slots-p0-flow.ts
 *   npx.cmd tsx scripts/demo-work-slots-p0-flow.ts --cleanup   # demo slot/agentlarni o‘chirish
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { createWorkSlot, patchWorkSlot } from "../src/modules/work-slots/work-slots.service";
import { assignUserToSlot, unassignUserFromSlot } from "../src/modules/work-slots/work-slots.assign";

const prisma = new PrismaClient();
const TAG = "DEMO-P0";
const PASSWORD = "secret12";

function stamp(): string {
  return new Date().toISOString().slice(5, 16).replace(/[-:T]/g, "");
}

async function main() {
  const cleanup = process.argv.includes("--cleanup");
  const tenant = await prisma.tenant.findFirst({
    where: { slug: "test1" },
    select: { id: true, slug: true }
  });
  if (!tenant) {
    console.error("Tenant test1 topilmadi. Avval seed qiling.");
    process.exit(1);
  }
  const tenantId = tenant.id;

  if (cleanup) {
    const slots = await prisma.workSlot.findMany({
      where: { tenant_id: tenantId, slot_code: { startsWith: TAG } },
      select: { id: true, slot_code: true }
    });
    for (const s of slots) {
      await prisma.slotUserLink.deleteMany({ where: { slot_id: s.id } });
      await prisma.slotAuditEntry.deleteMany({ where: { slot_id: s.id } });
      await prisma.workSlot.delete({ where: { id: s.id } });
      console.log(`  deleted slot ${s.slot_code}`);
    }
    const users = await prisma.user.findMany({
      where: { tenant_id: tenantId, login: { startsWith: "demo_p0_" } },
      select: { id: true, login: true }
    });
    for (const u of users) {
      await prisma.userPermission.deleteMany({ where: { user_id: u.id } });
      await prisma.userRole.deleteMany({ where: { user_id: u.id } });
      await prisma.warehouseUserLink.deleteMany({ where: { user_id: u.id } });
      await prisma.cashDeskUserLink.deleteMany({ where: { user_id: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
      console.log(`  deleted user ${u.login}`);
    }
    console.log("Cleanup done.");
    return;
  }

  const wh = await prisma.warehouse.findFirst({
    where: { tenant_id: tenantId, is_active: true },
    select: { id: true, name: true }
  });
  const desk = await prisma.cashDesk.findFirst({
    where: { tenant_id: tenantId, is_active: true },
    select: { id: true, name: true }
  });

  const s = stamp();
  console.log(`\n=== DEMO P0 flow (tenant=${tenant.slug}) ===\n`);

  // 1) Ikki bo‘sh slot
  const slotA = await createWorkSlot(tenantId, {
    slot_code: `${TAG}-A-${s}`.slice(0, 32),
    label: `Demo P0 Slot A (${s})`,
    slot_type: "agent",
    is_active: true
  });
  const slotB = await createWorkSlot(tenantId, {
    slot_code: `${TAG}-B-${s}`.slice(0, 32),
    label: `Demo P0 Slot B (${s})`,
    slot_type: "agent",
    is_active: true
  });
  console.log(`1) Slotlar yaratildi:`);
  console.log(`   A: #${slotA.id} ${slotA.slot_code}`);
  console.log(`   B: #${slotB.id} ${slotB.slot_code}`);

  // 2) Slot A ga joy config (ombor/hudud/kassa)
  await patchWorkSlot(tenantId, slotA.id, {
    territory_zone: "DemoZona",
    territory_oblast: "DemoOblast",
    territory_city: "DemoCity",
    warehouse_id: wh?.id ?? null,
    cash_desk_id: desk?.id ?? null,
    price_type: "demo_opt"
  });
  const slotAAfter = await prisma.workSlot.findUnique({
    where: { id: slotA.id },
    select: {
      territory: true,
      warehouse_id: true,
      cash_desk_id: true,
      price_type: true
    }
  });
  console.log(`2) Slot A config yozildi (DB):`, slotAAfter);
  if (!slotAAfter?.territory?.includes("DemoZona")) {
    throw new Error("FAIL: slot territory saqlanmadi");
  }
  console.log(`   OK  config slotga yozildi`);

  // 3) Ikki agent (prisma) — keyin assign
  const hash = await bcrypt.hash(PASSWORD, 10);
  const agentA = await prisma.user.create({
    data: {
      tenant_id: tenantId,
      name: `Demo P0 Agent A ${s}`,
      first_name: "Demo",
      last_name: `AgentA${s}`,
      login: `demo_p0_a_${s}`,
      password_hash: hash,
      role: "agent",
      is_active: true,
      code: `DA${s}`.slice(0, 20)
    }
  });
  const agentB = await prisma.user.create({
    data: {
      tenant_id: tenantId,
      name: `Demo P0 Agent B ${s}`,
      first_name: "Demo",
      last_name: `AgentB${s}`,
      login: `demo_p0_b_${s}`,
      password_hash: hash,
      role: "agent",
      is_active: true,
      code: `DB${s}`.slice(0, 20)
    }
  });
  console.log(`3) Agentlar:`);
  console.log(`   A: #${agentA.id} login=${agentA.login} / ${PASSWORD}`);
  console.log(`   B: #${agentB.id} login=${agentB.login} / ${PASSWORD}`);

  // 4) Assign A → slot A (mirror)
  await assignUserToSlot(tenantId, slotA.id, agentA.id, null, "demo assign A");
  const aAfterAssign = await prisma.user.findUnique({
    where: { id: agentA.id },
    select: { territory: true, warehouse_id: true, price_type: true }
  });
  console.log(`4) Assign A → Slot A; user A mirror:`, aAfterAssign);
  if (aAfterAssign?.territory !== slotAAfter?.territory) {
    throw new Error("FAIL: mirror territory A ga o‘tmadi");
  }
  if (wh && aAfterAssign?.warehouse_id !== wh.id) {
    throw new Error("FAIL: mirror warehouse A ga o‘tmadi");
  }
  console.log(`   OK  mirror ishladi`);

  // 5) Swap A → B
  await assignUserToSlot(tenantId, slotA.id, agentB.id, null, "demo swap A→B");
  const aAfterSwap = await prisma.user.findUnique({
    where: { id: agentA.id },
    select: { territory: true, warehouse_id: true, price_type: true, branch: true }
  });
  const bAfterSwap = await prisma.user.findUnique({
    where: { id: agentB.id },
    select: { territory: true, warehouse_id: true, price_type: true }
  });
  const slotStill = await prisma.workSlot.findUnique({
    where: { id: slotA.id },
    select: { territory: true, warehouse_id: true, price_type: true }
  });
  console.log(`5) Swap A→B:`);
  console.log(`   A (tozalangan bo‘lishi kerak):`, aAfterSwap);
  console.log(`   B (slot config):`, bAfterSwap);
  console.log(`   Slot (o‘zgarmas):`, slotStill);
  if (aAfterSwap?.territory != null || aAfterSwap?.warehouse_id != null) {
    throw new Error("FAIL: A dan joy maydonlari tozalanmadi");
  }
  if (bAfterSwap?.territory !== slotStill?.territory) {
    throw new Error("FAIL: B ga mirror bo‘lmadi");
  }
  if (slotStill?.territory !== slotAAfter?.territory) {
    throw new Error("FAIL: slot config yo‘qoldi");
  }
  console.log(`   OK  swap: clear A + mirror B + slot saqlangan`);

  // 6) Slot B ga ikkinchi agent (alohida joy) — webda ikkita slot ko‘rinsin
  await patchWorkSlot(tenantId, slotB.id, {
    territory_zone: "IkkinchiZona",
    territory_oblast: "Oblast2",
    territory_city: "City2",
    warehouse_id: wh?.id ?? null
  });
  // Agent B ni Slot A dan olib, yangi agent C yaratib Slot B ga qo‘yamiz — yoki B ni A da qoldiramiz
  // Slot B ni bo‘sh qoldiramiz + config — webda «bo‘sh joy» ko‘rinsin
  console.log(`6) Slot B config (bo‘sh joy, webda ko‘ring): #${slotB.id} ${slotB.slot_code}`);

  // 7) Qisqa unassign demo: yangi agent C → assign → unassign
  const agentC = await prisma.user.create({
    data: {
      tenant_id: tenantId,
      name: `Demo P0 Agent C ${s}`,
      first_name: "Demo",
      last_name: `AgentC${s}`,
      login: `demo_p0_c_${s}`,
      password_hash: hash,
      role: "agent",
      is_active: true,
      code: `DC${s}`.slice(0, 20)
    }
  });
  await assignUserToSlot(tenantId, slotB.id, agentC.id, null, "demo assign C");
  await unassignUserFromSlot(tenantId, slotB.id, null, "demo unassign C");
  const cAfter = await prisma.user.findUnique({
    where: { id: agentC.id },
    select: { territory: true, warehouse_id: true }
  });
  const slotBAfter = await prisma.workSlot.findUnique({
    where: { id: slotB.id },
    select: { territory: true, warehouse_id: true }
  });
  console.log(`7) Unassign C:`);
  console.log(`   C tozalangan:`, cAfter);
  console.log(`   Slot B config qolgan:`, slotBAfter);
  if (cAfter?.territory != null || cAfter?.warehouse_id != null) {
    throw new Error("FAIL: unassign clear ishlamadi");
  }
  if (!slotBAfter?.territory?.includes("IkkinchiZona")) {
    throw new Error("FAIL: slot B config yo‘qoldi");
  }
  console.log(`   OK  unassign clear + slot saqlangan`);

  const activeOnA = await prisma.slotUserLink.findFirst({
    where: { slot_id: slotA.id, ended_at: null },
    select: { user: { select: { id: true, login: true, name: true } } }
  });

  console.log(`\n========== WEBDA TEKSHIRISH ==========`);
  console.log(`URL: http://localhost:3000/work-slots`);
  console.log(`Login: admin / (seed parol, odatda secret123)`);
  console.log(``);
  console.log(`1) Ro‘yxatda qidiring: ${TAG}`);
  console.log(`   - ${slotA.slot_code} → faol: ${activeOnA?.user.login ?? "—"} (Agent B)`);
  console.log(`   - ${slotB.slot_code} → faol: YO‘Q (bo‘sh), lekin hudud IkkinchiZona`);
  console.log(``);
  console.log(`2) Slot A (#${slotA.id}) oching:`);
  console.log(`   - Hudud: DemoZona / DemoOblast / DemoCity`);
  console.log(`   - Ombor: ${wh ? `${wh.name} (#${wh.id})` : "yo‘q (DB da warehouse yo‘q)"}`);
  console.log(`   - Faol xodim: ${activeOnA?.user.name}`);
  console.log(``);
  console.log(`3) Пользователи / agentlar:`);
  console.log(`   - ${agentB.login} — territory/ombor TO‘LDIRILGAN (slotdan)`);
  console.log(`   - ${agentA.login} — territory/ombor BO‘SH (swapdan keyin)`);
  console.log(`   - ${agentC.login} — territory/ombor BO‘SH (unassigndan keyin)`);
  console.log(``);
  console.log(`Parol demo agentlar: ${PASSWORD}`);
  console.log(`Tozalash: npx.cmd tsx scripts/demo-work-slots-p0-flow.ts --cleanup`);
  console.log(`========================================\n`);
  console.log(`NATIJA: HAMMASI OK`);
}

main()
  .catch((e) => {
    console.error("\nFAIL:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
