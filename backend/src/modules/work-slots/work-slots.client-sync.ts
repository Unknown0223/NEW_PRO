import type { Prisma } from "@prisma/client";

/** Slotga agent biriktirilganda `work_slot_id` ni assignmentlarga yozish (qulf ham joyga yopishadi). */
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
      OR: [{ work_slot_id: null }, { work_slot_id: slotId }]
    },
    data: { work_slot_id: slotId }
  });
  return r.count;
}

/**
 * Agent slotida xodim almashganda: barcha mijozlar va assignmentlar yangi agentga.
 * Qulf (manual/contract) saqlanadi, lekin joy bilan birga yangi xodimga o‘tadi.
 * Zakazlar `agent_id` si o‘zgarmaydi — tarix eski xodimda qoladi.
 */
export async function migrateClientsOnAgentSlotSwap(
  tx: Prisma.TransactionClient,
  tenantId: number,
  slotId: number,
  fromUserId: number,
  toUserId: number
): Promise<{ clients_updated: number; assignments_updated: number }> {
  const clientWhere: Prisma.ClientWhereInput = {
    tenant_id: tenantId,
    agent_id: fromUserId,
    merged_into_client_id: null
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
      agent_id: fromUserId
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
      agent_id: { not: toUserId }
    },
    select: { client_id: true, agent_id: true }
  });

  if (slotAssignments.length === 0) {
    await linkAgentAssignmentsToWorkSlot(tx, tenantId, slotId, toUserId);
    return { clients_updated: 0, assignments_updated: 0 };
  }

  const clientIds = [...new Set(slotAssignments.map((r) => r.client_id))];
  const fromAgentIds = [...new Set(slotAssignments.map((r) => r.agent_id).filter((id): id is number => id != null))];
  const migrateClientIds = clientIds;

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
      agent_id: { not: toUserId }
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
 * Dastavchik slotida xodim almashganda: barcha assignmentlar (qulf bilan) + ochiq zakazlar.
 * Yetkazilgan zakazlar eski dastavchikda qoladi.
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
      expeditor_user_id: fromUserId
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
