import type { Prisma } from "@prisma/client";

const LOCK_SKIP = ["manual", "contract"] as const;

/** Slotga agent biriktirilganda `work_slot_id` ni qulflanmagan assignmentlarga yozish. */
export async function linkAgentAssignmentsToWorkSlot(
  tx: Prisma.TransactionClient,
  tenantId: number,
  slotId: number,
  userId: number
): Promise<number> {
  const r = await tx.clientAgentAssignment.updateMany({
    where: {
      tenant_id: tenantId,
      agent_id: userId,
      lock_type: { notIn: [...LOCK_SKIP] },
      OR: [{ work_slot_id: null }, { work_slot_id: slotId }]
    },
    data: { work_slot_id: slotId }
  });
  return r.count;
}

/**
 * Agent slotida xodim almashganda: qulflanmagan mijozlar va assignmentlar yangi agentga.
 */
export async function migrateClientsOnAgentSlotSwap(
  tx: Prisma.TransactionClient,
  tenantId: number,
  slotId: number,
  fromUserId: number,
  toUserId: number
): Promise<{ clients_updated: number; assignments_updated: number }> {
  const lockedRows = await tx.clientAgentAssignment.findMany({
    where: {
      tenant_id: tenantId,
      slot: 1,
      lock_type: { in: [...LOCK_SKIP] },
      client: {
        tenant_id: tenantId,
        agent_id: fromUserId,
        merged_into_client_id: null
      }
    },
    select: { client_id: true }
  });
  const skipClientIds = lockedRows.map((r) => r.client_id);

  const clientWhere: Prisma.ClientWhereInput = {
    tenant_id: tenantId,
    agent_id: fromUserId,
    merged_into_client_id: null,
    ...(skipClientIds.length > 0 ? { id: { notIn: skipClientIds } } : {})
  };

  const clients = await tx.client.findMany({
    where: clientWhere,
    select: { id: true }
  });

  if (clients.length > 0) {
    await tx.client.updateMany({
      where: { id: { in: clients.map((c) => c.id) } },
      data: { agent_id: toUserId }
    });
  }

  const assignResult = await tx.clientAgentAssignment.updateMany({
    where: {
      tenant_id: tenantId,
      agent_id: fromUserId,
      lock_type: { notIn: [...LOCK_SKIP] }
    },
    data: { agent_id: toUserId, work_slot_id: slotId }
  });

  await linkAgentAssignmentsToWorkSlot(tx, tenantId, slotId, toUserId);

  return {
    clients_updated: clients.length,
    assignments_updated: assignResult.count
  };
}

/**
 * Bo‘sh (VACANT) slotga agent biriktirilganda: oldingi xodim unassign qilingan,
 * lekin assignmentlar `work_slot_id` bilan qolgan bo‘lishi mumkin.
 * Ularni yangi agentga o‘tkazamiz — aks holda sync da mijozlar bor, visit_weekdays yo‘q.
 */
export async function migrateClientsOnVacantSlotAssign(
  tx: Prisma.TransactionClient,
  tenantId: number,
  slotId: number,
  toUserId: number
): Promise<{ clients_updated: number; assignments_updated: number }> {
  const slotAssignments = await tx.clientAgentAssignment.findMany({
    where: {
      tenant_id: tenantId,
      work_slot_id: slotId,
      agent_id: { not: toUserId },
      lock_type: { notIn: [...LOCK_SKIP] }
    },
    select: { client_id: true, agent_id: true }
  });

  if (slotAssignments.length === 0) {
    await linkAgentAssignmentsToWorkSlot(tx, tenantId, slotId, toUserId);
    return { clients_updated: 0, assignments_updated: 0 };
  }

  const clientIds = [...new Set(slotAssignments.map((r) => r.client_id))];
  const fromAgentIds = [...new Set(slotAssignments.map((r) => r.agent_id).filter((id): id is number => id != null))];

  const lockedRows =
    fromAgentIds.length > 0
      ? await tx.clientAgentAssignment.findMany({
          where: {
            tenant_id: tenantId,
            slot: 1,
            lock_type: { in: [...LOCK_SKIP] },
            client_id: { in: clientIds },
            agent_id: { in: fromAgentIds }
          },
          select: { client_id: true }
        })
      : [];
  const skipClientIds = new Set(lockedRows.map((r) => r.client_id));
  const migrateClientIds = clientIds.filter((id) => !skipClientIds.has(id));

  if (migrateClientIds.length > 0) {
    await tx.client.updateMany({
      where: {
        tenant_id: tenantId,
        id: { in: migrateClientIds },
        merged_into_client_id: null,
        ...(fromAgentIds.length > 0 ? { agent_id: { in: fromAgentIds } } : {})
      },
      data: { agent_id: toUserId }
    });
  }

  const assignResult = await tx.clientAgentAssignment.updateMany({
    where: {
      tenant_id: tenantId,
      work_slot_id: slotId,
      agent_id: { not: toUserId },
      lock_type: { notIn: [...LOCK_SKIP] },
      ...(skipClientIds.size > 0 ? { client_id: { notIn: [...skipClientIds] } } : {})
    },
    data: { agent_id: toUserId, work_slot_id: slotId }
  });

  await linkAgentAssignmentsToWorkSlot(tx, tenantId, slotId, toUserId);

  return {
    clients_updated: migrateClientIds.length,
    assignments_updated: assignResult.count
  };
}

/** Hali yetkazilmagan savdo zakazlari — joydagi yangi dastavchikka o‘tadi. */
export const EXPEDITOR_OPEN_ORDER_STATUSES = ["new", "confirmed", "picking", "delivering"] as const;

export function isExpeditorOpenOrderStatus(status: string): boolean {
  return (EXPEDITOR_OPEN_ORDER_STATUSES as readonly string[]).includes(status);
}

/**
 * Dastavchik slotida xodim almashganda: qulflanmagan assignmentlar + ochiq zakazlar.
 */
export async function migrateExpeditorAssignmentsOnSlotSwap(
  tx: Prisma.TransactionClient,
  tenantId: number,
  fromUserId: number,
  toUserId: number
): Promise<{ assignments_updated: number; orders_updated: number }> {
  if (fromUserId === toUserId) return { assignments_updated: 0, orders_updated: 0 };
  const assignResult = await tx.clientAgentAssignment.updateMany({
    where: {
      tenant_id: tenantId,
      expeditor_user_id: fromUserId,
      lock_type: { notIn: [...LOCK_SKIP] }
    },
    data: { expeditor_user_id: toUserId }
  });
  const orderResult = await tx.order.updateMany({
    where: {
      tenant_id: tenantId,
      expeditor_user_id: fromUserId,
      order_type: "order",
      status: { in: [...EXPEDITOR_OPEN_ORDER_STATUSES] }
    },
    data: { expeditor_user_id: toUserId }
  });
  return { assignments_updated: assignResult.count, orders_updated: orderResult.count };
}
