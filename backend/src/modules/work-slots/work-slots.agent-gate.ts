import { assertUserOnWorkSlot, tenantUsesWorkSlotsForRole } from "./work-slots.access-gate";
import { getActiveSlotForUser } from "./work-slots.query.read";

/**
 * Tenant agent work slot ishlatayotgan bo‘lsa — agentda faol SlotUserLink bo‘lishi shart.
 * Slot yo‘q tenantlarda (legacy) cheklov qo‘llanmaydi.
 */
export async function tenantUsesAgentWorkSlots(tenantId: number): Promise<boolean> {
  return tenantUsesWorkSlotsForRole(tenantId, "agent");
}

export async function isAgentDebtCollectionOnly(
  tenantId: number,
  agentId: number
): Promise<boolean> {
  if (!Number.isFinite(agentId) || agentId < 1) return false;
  if (!(await tenantUsesAgentWorkSlots(tenantId))) return false;
  const active = await getActiveSlotForUser(agentId);
  return active == null;
}

/** Yangi zakaz / marshrut / mijoz biriktirish uchun. */
export async function assertAgentCanTakeNewWork(
  tenantId: number,
  agentId: number | null | undefined
): Promise<void> {
  if (agentId == null || !Number.isFinite(agentId) || agentId < 1) return;
  try {
    await assertUserOnWorkSlot(tenantId, agentId, "agent");
  } catch (e) {
    if (e instanceof Error && e.message === "USER_NOT_ON_SLOT") {
      throw new Error("AGENT_NOT_ON_SLOT");
    }
    throw e;
  }
}
