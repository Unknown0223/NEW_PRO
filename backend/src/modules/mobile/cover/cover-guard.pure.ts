/** Faol cover paytida agent buyurtma/mijoz mutatsiyasi bloklanadi. */
export function shouldBlockAgentMutationsWhileCovered(
  isAgentWithActiveCover: boolean
): boolean {
  return isAgentWithActiveCover === true;
}

export type CoverActivePair = {
  agent_user_id: number;
  svr_user_id: number;
};

/**
 * SVR JWT + faol cover → covered agent id (impersonation emas, scope remap).
 * Agent o‘zi yoki cover yo‘q — null.
 */
export function resolveCoverActingAgentId(input: {
  viewerRole: string;
  viewerUserId: number;
  activeCover: CoverActivePair | null;
}): number | null {
  if (input.viewerRole !== "supervisor") return null;
  if (!input.activeCover) return null;
  if (input.activeCover.svr_user_id !== input.viewerUserId) return null;
  const agentId = input.activeCover.agent_user_id;
  if (!Number.isFinite(agentId) || agentId < 1) return null;
  return agentId;
}

/** Marshrut/order/client scope: cover orqali agent, aks holda viewer. */
export function resolveCoverScopeAgentUserId(input: {
  viewerRole: string;
  viewerUserId: number;
  activeCover: CoverActivePair | null;
}): number {
  const acting = resolveCoverActingAgentId(input);
  return acting ?? input.viewerUserId;
}
