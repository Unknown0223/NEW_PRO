import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";

type Tx = Prisma.TransactionClient;

function uniquePositiveIds(ids: number[]): number[] {
  return [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
}

/** Barcha id lar tenant dagi faol (void qilinmagan) agent slotlari bo‘lishi shart. */
export async function validateSuperviseeAgentSlotIds(
  tx: Tx,
  tenantId: number,
  ids: number[]
): Promise<number[]> {
  const clean = uniquePositiveIds(ids);
  if (clean.length === 0) return [];

  const found = await tx.workSlot.findMany({
    where: {
      tenant_id: tenantId,
      id: { in: clean },
      slot_type: "agent",
      deleted_at: null
    },
    select: { id: true }
  });
  if (found.length !== clean.length) {
    throw new Error("BAD_SUPERVISEE_AGENT_SLOTS");
  }
  return clean;
}

async function activeUserIdOnSlot(tx: Tx, slotId: number): Promise<number | null> {
  const link = await tx.slotUserLink.findFirst({
    where: { slot_id: slotId, ended_at: null },
    select: { user_id: true }
  });
  return link?.user_id ?? null;
}

/**
 * SVR slot jamoasini agent user.supervisor_user_id ga sinxronlaydi.
 * Manba: supervisee_agent_slot_ids + faol SVR xodim.
 */
export async function syncSupervisorTeamToUsers(
  tx: Tx,
  tenantId: number,
  supervisorSlotId: number
): Promise<void> {
  const slot = await tx.workSlot.findFirst({
    where: { id: supervisorSlotId, tenant_id: tenantId, deleted_at: null },
    select: { id: true, slot_type: true, supervisee_agent_slot_ids: true }
  });
  if (!slot || slot.slot_type !== "supervisor") return;

  const teamIds = uniquePositiveIds(slot.supervisee_agent_slot_ids ?? []);
  const svrUserId = await activeUserIdOnSlot(tx, supervisorSlotId);

  const teamLinks =
    teamIds.length > 0
      ? await tx.slotUserLink.findMany({
          where: { slot_id: { in: teamIds }, ended_at: null },
          select: { slot_id: true, user_id: true }
        })
      : [];
  const teamUserIds = new Set(teamLinks.map((l) => l.user_id));

  for (const uid of teamUserIds) {
    await tx.user.update({
      where: { id: uid },
      data: { supervisor_user_id: svrUserId }
    });
  }

  // Jamoadan chiqqan / boshqa agent slotdagi xodimlar — faqat shu SVR bo‘lsa tozalash
  if (svrUserId != null) {
    const leftovers = await tx.user.findMany({
      where: {
        tenant_id: tenantId,
        supervisor_user_id: svrUserId,
        ...(teamUserIds.size > 0 ? { id: { notIn: [...teamUserIds] } } : {})
      },
      select: { id: true }
    });
    for (const u of leftovers) {
      const activeLink = await tx.slotUserLink.findFirst({
        where: { user_id: u.id, ended_at: null, slot: { tenant_id: tenantId, deleted_at: null } },
        select: { slot_id: true, slot: { select: { slot_type: true } } }
      });
      if (!activeLink || activeLink.slot.slot_type !== "agent") continue;
      if (teamIds.includes(activeLink.slot_id)) continue;
      await tx.user.update({
        where: { id: u.id },
        data: { supervisor_user_id: null }
      });
    }
  }
}

/** Ushbu agent slot id ni jamoaga olgan SVR slotlar. */
export async function findSupervisorSlotsForAgentSlot(
  tx: Tx,
  tenantId: number,
  agentSlotId: number
): Promise<number[]> {
  if (!Number.isFinite(agentSlotId) || agentSlotId < 1) return [];
  const rows = await tx.workSlot.findMany({
    where: {
      tenant_id: tenantId,
      slot_type: "supervisor",
      deleted_at: null,
      supervisee_agent_slot_ids: { has: agentSlotId }
    },
    select: { id: true }
  });
  return rows.map((r) => r.id);
}

/** Agent slot bandligi o‘zgaganda — tegishli SVR jamoalarini qayta sinxronlash. */
export async function syncAfterAgentSlotOccupancyChange(
  tx: Tx,
  tenantId: number,
  agentSlotId: number
): Promise<void> {
  const svrIds = await findSupervisorSlotsForAgentSlot(tx, tenantId, agentSlotId);
  for (const sid of svrIds) {
    await syncSupervisorTeamToUsers(tx, tenantId, sid);
  }
}

/**
 * Mavjud supervisor_user_id bog‘lanishlaridan SVR slot jamoasini to‘ldirish (ixtiyoriy backfill).
 */
export async function backfillSuperviseeAgentSlotsFromUsers(tenantId: number): Promise<{
  slots_updated: number;
  links_synced: number;
}> {
  const agents = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      role: "agent",
      is_active: true,
      supervisor_user_id: { not: null }
    },
    select: { id: true, supervisor_user_id: true }
  });

  let slotsUpdated = 0;
  let linksSynced = 0;

  for (const agent of agents) {
    const svrId = agent.supervisor_user_id;
    if (svrId == null) continue;

    const agentLink = await prisma.slotUserLink.findFirst({
      where: {
        user_id: agent.id,
        ended_at: null,
        slot: { tenant_id: tenantId, slot_type: "agent", deleted_at: null }
      },
      select: { slot_id: true }
    });
    if (!agentLink) continue;

    const svrLink = await prisma.slotUserLink.findFirst({
      where: {
        user_id: svrId,
        ended_at: null,
        slot: { tenant_id: tenantId, slot_type: "supervisor", deleted_at: null }
      },
      select: { slot_id: true }
    });
    if (!svrLink) continue;

    const svrSlot = await prisma.workSlot.findFirst({
      where: { id: svrLink.slot_id, tenant_id: tenantId },
      select: { id: true, supervisee_agent_slot_ids: true }
    });
    if (!svrSlot) continue;

    const next = uniquePositiveIds([
      ...(svrSlot.supervisee_agent_slot_ids ?? []),
      agentLink.slot_id
    ]);
    const prev = uniquePositiveIds(svrSlot.supervisee_agent_slot_ids ?? []);
    if (next.length === prev.length && next.every((id) => prev.includes(id))) continue;

    await prisma.workSlot.update({
      where: { id: svrSlot.id },
      data: { supervisee_agent_slot_ids: next }
    });
    slotsUpdated += 1;

    await prisma.$transaction(async (tx) => {
      await syncSupervisorTeamToUsers(tx, tenantId, svrSlot.id);
    });
    linksSynced += 1;
  }

  return { slots_updated: slotsUpdated, links_synced: linksSynced };
}
