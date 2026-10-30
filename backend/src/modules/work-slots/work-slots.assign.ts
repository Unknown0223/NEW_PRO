import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { applyAccessResetToRoleDefaultTx } from "../access/access.reset.service";
import { isWorkSlotType, userRoleMatchesSlotType } from "./work-slots.constants";
import {
    migrateClientsOnAgentSlotSwap,
    migrateClientsOnVacantSlotAssign,
    migrateExpeditorAssignmentsOnSlotSwap
} from "./work-slots.client-sync";
import {
  clearWorkplaceFieldsOnUser,
  mirrorSlotConfigToUser
} from "./work-slots.config-mirror";
import { syncUserLinksToWorkSlotTx } from "./work-slots.link-sync";
import {
  syncAfterAgentSlotOccupancyChange,
  syncSupervisorTeamToUsers
} from "./work-slots.supervisor-team";

/** Slotdan chiqarilganda shaxsiy ekstra ruxsatlar olib tashlanadi — rol standarti qoladi. */
async function resetLeavingUserAccess(
  tx: Prisma.TransactionClient,
  tenantId: number,
  userId: number
): Promise<void> {
  const user = await tx.user.findFirst({
    where: { id: userId, tenant_id: tenantId },
    select: { role: true }
  });
  if (!user?.role?.trim()) return;
  await applyAccessResetToRoleDefaultTx(tx, tenantId, userId, user.role.trim());
}

export function assertUserMatchesSlotType(userRole: string, slotType: string): void {
  if (!isWorkSlotType(slotType)) throw new Error("BAD_SLOT_TYPE");
  if (!userRoleMatchesSlotType(userRole, slotType)) throw new Error("BAD_SLOT_TYPE");
}

export async function assignUserToSlot(
  tenantId: number,
  slotId: number,
  newUserId: number,
  actorId: number | null,
  note?: string | null
) {
  return prisma.$transaction(async (tx) => {
    const slot = await tx.workSlot.findFirst({
      where: { id: slotId, tenant_id: tenantId },
      select: { id: true, slot_type: true, is_active: true }
    });
    if (!slot) throw new Error("NOT_FOUND");
    if (!slot.is_active) throw new Error("SLOT_INACTIVE");

    const user = await tx.user.findFirst({
      where: { id: newUserId, tenant_id: tenantId },
      select: { id: true, role: true, branch: true, is_active: true, hired_at: true }
    });
    if (!user) throw new Error("BAD_USER");
    assertUserMatchesSlotType(user.role, slot.slot_type);
    const reactivated = !user.is_active;
    if (reactivated) {
      await tx.user.update({
        where: { id: user.id },
        data: { is_active: true, dismissed_at: null, ...(user.hired_at ? {} : { hired_at: new Date() }) }
      });
    }

    const current = await tx.slotUserLink.findFirst({
      where: { slot_id: slotId, ended_at: null },
      select: { id: true, user_id: true }
    });

    if (current?.user_id === newUserId) {
      return current;
    }

    if (current) {
      await tx.slotUserLink.update({
        where: { id: current.id },
        data: { ended_at: new Date(), ended_by: actorId }
      });
      await clearWorkplaceFieldsOnUser(tx, tenantId, current.user_id);
      await resetLeavingUserAccess(tx, tenantId, current.user_id);
    }

    const link = await tx.slotUserLink.create({
      data: {
        tenant_id: tenantId,
        slot_id: slotId,
        user_id: newUserId,
        note: note?.trim() || null
      }
    });

    // Yangi xodim: shaxsiy ekstra ruxsatlar o‘tkazilmaydi — rol standarti + slot config mirror.
    await resetLeavingUserAccess(tx, tenantId, newUserId);
    await mirrorSlotConfigToUser(tx, tenantId, slotId, newUserId);

    if (current?.user_id != null && current.user_id !== newUserId) {
      await syncUserLinksToWorkSlotTx(tx, tenantId, current.user_id, null);
    }
    await syncUserLinksToWorkSlotTx(tx, tenantId, newUserId, slotId);

    const auditNoteParts = [
      note?.trim() || null,
      current
        ? "Права сотрудников сброшены к стандарту роли (предшественник не копируется)"
        : "Права нового сотрудника сброшены к стандарту роли",
      reactivated ? "Сотрудник активирован" : null
    ].filter(Boolean);

    await tx.slotAuditEntry.create({
      data: {
        tenant_id: tenantId,
        slot_id: slotId,
        prev_user_id: current?.user_id ?? null,
        next_user_id: newUserId,
        action: current ? "swap" : "assign",
        actor_id: actorId,
        note: auditNoteParts.join(" · ") || null
      }
    });

    if (slot.slot_type === "agent") {
      if (current?.user_id != null && current.user_id !== newUserId) {
        await migrateClientsOnAgentSlotSwap(
          tx,
          tenantId,
          slotId,
          current.user_id,
          newUserId
        );
      } else {
        // VACANT / birinchi biriktirish: slotdagi eski assignmentlar yangi agentga.
        await migrateClientsOnVacantSlotAssign(tx, tenantId, slotId, newUserId);
      }
      await syncAfterAgentSlotOccupancyChange(tx, tenantId, slotId);
    } else if (slot.slot_type === "expeditor") {
      if (current?.user_id != null && current.user_id !== newUserId) {
        await migrateExpeditorAssignmentsOnSlotSwap(tx, tenantId, current.user_id, newUserId);
      }
    } else if (slot.slot_type === "supervisor") {
      await syncSupervisorTeamToUsers(tx, tenantId, slotId);
    }

    return link;
  });
}

export async function unassignUserFromSlot(
  tenantId: number,
  slotId: number,
  actorId: number | null,
  note?: string | null
) {
  return prisma.$transaction(async (tx) => {
    const slot = await tx.workSlot.findFirst({
      where: { id: slotId, tenant_id: tenantId },
      select: { id: true, slot_type: true }
    });
    if (!slot) throw new Error("NOT_FOUND");

    const current = await tx.slotUserLink.findFirst({
      where: { tenant_id: tenantId, slot_id: slotId, ended_at: null },
      select: { id: true, user_id: true }
    });
    if (!current) throw new Error("NO_ACTIVE_USER");

    await tx.slotUserLink.update({
      where: { id: current.id },
      data: { ended_at: new Date(), ended_by: actorId }
    });

    await clearWorkplaceFieldsOnUser(tx, tenantId, current.user_id);
    await resetLeavingUserAccess(tx, tenantId, current.user_id);
    await syncUserLinksToWorkSlotTx(tx, tenantId, current.user_id, null);

    const auditNoteParts = [
      note?.trim() || null,
      "Права снятого сотрудника сброшены к стандарту роли"
    ].filter(Boolean);

    await tx.slotAuditEntry.create({
      data: {
        tenant_id: tenantId,
        slot_id: slotId,
        prev_user_id: current.user_id,
        next_user_id: null,
        action: "unassign",
        actor_id: actorId,
        note: auditNoteParts.join(" · ") || null
      }
    });

    if (slot.slot_type === "agent") {
      await syncAfterAgentSlotOccupancyChange(tx, tenantId, slotId);
    } else if (slot.slot_type === "supervisor") {
      await syncSupervisorTeamToUsers(tx, tenantId, slotId);
    }
  });
}

export async function getAssignChecklist(tenantId: number, slotId: number) {
  const slot = await prisma.workSlot.findFirst({
    where: { id: slotId, tenant_id: tenantId },
    select: { id: true, slot_type: true }
  });
  if (!slot) throw new Error("NOT_FOUND");

  const active = await prisma.slotUserLink.findFirst({
    where: { slot_id: slotId, ended_at: null },
    select: { user_id: true }
  });

  let cash_desk_conflicts: Array<{
    cash_desk_id: number;
    cash_desk_name: string;
    other_user_id: number;
  }> = [];

  if (active && slot.slot_type === "collector") {
    const desks = await prisma.cashDeskUserLink.findMany({
      where: { user_id: active.user_id, link_role: { in: ["collector", "cashier"] } },
      include: { cash_desk: { select: { id: true, name: true, tenant_id: true } } }
    });
    for (const d of desks) {
      if (d.cash_desk.tenant_id !== tenantId) continue;
      const other = await prisma.cashDeskUserLink.findFirst({
        where: {
          cash_desk_id: d.cash_desk_id,
          user_id: { not: active.user_id },
          link_role: { in: ["collector", "cashier"] }
        },
        select: { user_id: true }
      });
      if (other) {
        cash_desk_conflicts.push({
          cash_desk_id: d.cash_desk.id,
          cash_desk_name: d.cash_desk.name,
          other_user_id: other.user_id
        });
      }
    }
  }

  const activeUserId = active?.user_id ?? null;
  const [clientsAffected, lockedSkipped] = await Promise.all([
    activeUserId
      ? slot.slot_type === "expeditor"
        ? prisma.clientAgentAssignment.count({
            where: {
              tenant_id: tenantId,
              expeditor_user_id: activeUserId
            }
          })
        : prisma.client.count({
            where: {
              tenant_id: tenantId,
              merged_into_client_id: null,
              agent_id: activeUserId
            }
          })
      : Promise.resolve(0),
    activeUserId
      ? prisma.clientAgentAssignment.count({
          where: {
            tenant_id: tenantId,
            lock_type: { in: ["manual", "contract"] },
            ...(slot.slot_type === "expeditor"
              ? { expeditor_user_id: activeUserId }
              : { agent_id: activeUserId })
          }
        })
      : Promise.resolve(0)
  ]);

  return {
    cash_desk_conflicts,
    clients_affected_estimate: clientsAffected,
    locked_clients_skipped: lockedSkipped,
    slot_has_active_user: active != null,
    active_user_id: activeUserId
  };
}
