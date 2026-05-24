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
