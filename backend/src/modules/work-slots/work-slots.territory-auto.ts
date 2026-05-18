import { prisma } from "../../config/database";
import { getAgentPickerContextForAddress } from "../linkage/linkage.service";
import { markAssignmentPendingReview } from "./work-slots.lock";

const ADDRESS_KEYS = [
  "region",
  "district",
  "city",
  "zone",
  "latitude",
  "longitude",
  "neighborhood"
] as const;

export function clientUpdateTouchesAddress(input: Record<string, unknown>): boolean {
  return ADDRESS_KEYS.some((k) => input[k] !== undefined);
}

async function activeAgentWorkSlotId(tenantId: number, userId: number): Promise<number | null> {
  const link = await prisma.slotUserLink.findFirst({
    where: {
      tenant_id: tenantId,
      user_id: userId,
      ended_at: null,
      slot: { tenant_id: tenantId, slot_type: "agent", is_active: true }
    },
    orderBy: { started_at: "desc" },
    select: { slot_id: true }
  });
  return link?.slot_id ?? null;
}

/**
 * Mijoz manzili o‘zgarganda: 2+ hudud agenti → pending_review; 1 ta → avto biriktirish (lock yo‘q).
 */
export async function applyTerritoryAutoAssignAfterAddressChange(
  tenantId: number,
  clientId: number
): Promise<void> {
  const client = await prisma.client.findFirst({
    where: { id: clientId, tenant_id: tenantId, merged_into_client_id: null },
    select: {
      id: true,
      region: true,
      city: true,
      district: true,
      zone: true,
      latitude: true,
      longitude: true
    }
  });
  if (!client) return;

  const slot1 = await prisma.clientAgentAssignment.findUnique({
    where: { client_id_slot: { client_id: clientId, slot: 1 } },
    select: { id: true, lock_type: true, agent_id: true }
  });

  const lock = slot1?.lock_type ?? "none";
  if (lock === "manual" || lock === "contract") return;

  const ctx = await getAgentPickerContextForAddress(tenantId, {
    region: client.region,
    city: client.city,
    district: client.district,
    zone: client.zone,
    latitude: client.latitude != null ? String(client.latitude) : null,
    longitude: client.longitude != null ? String(client.longitude) : null
  });

  if (!ctx.territory_matched) return;

  const agents = [...new Set(ctx.agent_ids)].filter((id) => id > 0);

  if (agents.length >= 2) {
    if (slot1) {
      await markAssignmentPendingReview(tenantId, slot1.id);
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.clientAgentAssignment.create({
          data: {
            tenant_id: tenantId,
            client_id: clientId,
            slot: 1,
            agent_id: null,
            auto_assign_status: "pending_review",
            lock_type: "none"
          }
        });
        await tx.client.update({
          where: { id: clientId },
          data: { agent_id: null }
        });
      });
    }
    return;
  }

  if (agents.length !== 1) return;

  const agentId = agents[0]!;
  const workSlotId = await activeAgentWorkSlotId(tenantId, agentId);

  await prisma.$transaction(async (tx) => {
    if (slot1) {
      await tx.clientAgentAssignment.update({
        where: { id: slot1.id },
        data: {
          agent_id: agentId,
          auto_assign_status: "assigned",
          work_slot_id: workSlotId
        }
      });
    } else {
      await tx.clientAgentAssignment.create({
        data: {
          tenant_id: tenantId,
          client_id: clientId,
          slot: 1,
          agent_id: agentId,
          auto_assign_status: "assigned",
          lock_type: "none",
          work_slot_id: workSlotId
        }
      });
    }
    await tx.client.update({
      where: { id: clientId },
      data: { agent_id: agentId }
    });
  });
}
