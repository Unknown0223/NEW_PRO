import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { SLOT_TYPE_TO_USER_ROLE, isWorkSlotType } from "./work-slots.constants";
import {
  linkAgentAssignmentsToWorkSlot,
  migrateClientsOnAgentSlotSwap
} from "./work-slots.client-sync";

export function assertUserMatchesSlotType(userRole: string, slotType: string): void {
  if (!isWorkSlotType(slotType)) throw new Error("BAD_SLOT_TYPE");
  const need = SLOT_TYPE_TO_USER_ROLE[slotType];
  if (userRole !== need) throw new Error("BAD_SLOT_TYPE");
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
      where: { id: newUserId, tenant_id: tenantId, is_active: true },
      select: { id: true, role: true, branch: true }
    });
    if (!user) throw new Error("BAD_USER");
    assertUserMatchesSlotType(user.role, slot.slot_type);

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
    }

    const link = await tx.slotUserLink.create({
      data: {
        tenant_id: tenantId,
        slot_id: slotId,
        user_id: newUserId,
        note: note?.trim() || null
      }
    });

    await tx.slotAuditEntry.create({
      data: {
        tenant_id: tenantId,
        slot_id: slotId,
        prev_user_id: current?.user_id ?? null,
        next_user_id: newUserId,
        action: current ? "swap" : "assign",
        actor_id: actorId,
        note: note?.trim() || null
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
        await linkAgentAssignmentsToWorkSlot(tx, tenantId, slotId, newUserId);
      }
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
    const current = await tx.slotUserLink.findFirst({
      where: { tenant_id: tenantId, slot_id: slotId, ended_at: null },
      select: { id: true, user_id: true }
    });
    if (!current) throw new Error("NO_ACTIVE_USER");

    await tx.slotUserLink.update({
      where: { id: current.id },
      data: { ended_at: new Date(), ended_by: actorId }
    });

    await tx.slotAuditEntry.create({
      data: {
        tenant_id: tenantId,
        slot_id: slotId,
        prev_user_id: current.user_id,
        next_user_id: null,
        action: "unassign",
        actor_id: actorId,
        note: note?.trim() || null
      }
    });
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
      ? prisma.client.count({
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
            agent_id: activeUserId,
            lock_type: { in: ["manual", "contract"] }
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
