/**
 * Lokal smoke: dastavchikni slotga bog‘lab, listStaff da work_slot_territories chiqishini tekshiradi.
 * NODE_PATH / tsx orqali: npx tsx scripts/smoke-expeditor-slot-territories.ts
 */
import { PrismaClient } from "@prisma/client";
import { assignUserToSlot } from "../src/modules/work-slots/work-slots.assign";
import { listStaff } from "../src/modules/staff/staff.crud.list";
import { loadActiveWorkSlotsByUserIds } from "../src/modules/work-slots/work-slots.query.read";

const prisma = new PrismaClient();

async function main() {
  const tenantId = 1;

  const slot = await prisma.workSlot.findFirst({
    where: {
      tenant_id: tenantId,
      deleted_at: null,
      slot_type: "expeditor",
      is_active: true
    },
    select: {
      id: true,
      slot_code: true,
      territory: true,
      territories: true
    },
    orderBy: { id: "asc" }
  });
  if (!slot) {
    throw new Error("No expeditor work slot found");
  }

  const multi =
    Array.isArray(slot.territories) && slot.territories.length > 1
      ? slot.territories
      : null;
  if (!multi || multi.length < 2) {
    const ensured = [
      slot.territory?.trim() || "LOCAL-ZONE / LOCAL-OBLAST / LOCAL-CITY",
      "LOCAL-ZONE / LOCAL-OBLAST / LOCAL-CITY-2"
    ];
    await prisma.workSlot.update({
      where: { id: slot.id },
      data: {
        territory: ensured[0]!,
        territories: ensured
      }
    });
    console.log(`[setup] slot ${slot.slot_code} territories →`, ensured);
  } else {
    console.log(`[ok] slot ${slot.slot_code} already has`, multi.length, "territories");
  }

  const occupied = await prisma.slotUserLink.findFirst({
    where: { slot_id: slot.id, ended_at: null },
    select: {
      user_id: true,
      user: { select: { id: true, role: true, login: true, is_active: true } }
    }
  });

  let userId: number | null = null;
  if (occupied?.user.role === "expeditor" && occupied.user.is_active) {
    userId = occupied.user_id;
    console.log(`[occupy] ${occupied.user.login} (#${userId}) already on slot ${slot.slot_code}`);
  } else {
    if (occupied) {
      const { unassignUserFromSlot } = await import("../src/modules/work-slots/work-slots.assign");
      await unassignUserFromSlot(tenantId, slot.id, null, "smoke: clear inactive/non-exp");
      console.log(
        `[clear] removed #${occupied.user_id} role=${occupied.user.role} active=${occupied.user.is_active}`
      );
    }
    const free = await prisma.user.findFirst({
      where: {
        tenant_id: tenantId,
        role: "expeditor",
        is_active: true,
        slot_user_links: { none: { ended_at: null } }
      },
      select: { id: true, login: true, name: true },
      orderBy: { id: "asc" }
    });
    if (!free) throw new Error("No free expeditor to assign");
    await assignUserToSlot(tenantId, slot.id, free.id, null, "smoke-expeditor-slot-territories");
    userId = free.id;
    console.log(`[assign] ${free.login} (#${free.id}) → slot ${slot.slot_code}`);
  }

  const map = await loadActiveWorkSlotsByUserIds([userId]);
  const info = map.get(userId);
  console.log("[loadActiveWorkSlotsByUserIds]", {
    slot_code: info?.slot_code,
    territories: info?.territories
  });

  const rows = await listStaff(tenantId, "expeditor", { is_active: true });
  const row = rows.find((r) => r.id === userId);
  console.log("[listStaff row]", {
    id: row?.id,
    fio: row?.fio,
    work_slot_code: (row as { work_slot_code?: string | null })?.work_slot_code,
    territory: row?.territory,
    work_slot_territories: (row as { work_slot_territories?: string[] })?.work_slot_territories
  });

  const terrs = (row as { work_slot_territories?: string[] } | undefined)?.work_slot_territories ?? [];
  if (terrs.length < 1) {
    throw new Error("FAIL: work_slot_territories empty on listStaff");
  }
  if (terrs.length < 2) {
    console.warn("WARN: only one territory — multi overflow UI needs ≥2");
  } else {
    console.log("PASS: listStaff returns multi work_slot_territories for expeditor");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
