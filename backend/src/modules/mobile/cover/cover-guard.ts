import { prisma } from "../../../config/database";
import { COVER_AGENT_BLOCKED, CoverError } from "./cover-codes";
import {
  resolveCoverScopeAgentUserId,
  shouldBlockAgentMutationsWhileCovered
} from "./cover-guard.pure";

/** Agent faol cover ostida — buyurtma/mijoz yozuvlarini bloklash. */
export async function assertAgentNotUnderActiveCover(
  tenantId: number,
  agentUserId: number
): Promise<void> {
  const active = await prisma.agentSvrCover.findFirst({
    where: {
      tenant_id: tenantId,
      agent_user_id: agentUserId,
      status: "faol"
    },
    select: { id: true }
  });
  if (shouldBlockAgentMutationsWhileCovered(Boolean(active))) {
    throw new CoverError(
      COVER_AGENT_BLOCKED,
      "Faol o‘rinbosar (cover) — agent buyurtma/mijoz yaratishi bloklangan"
    );
  }
}

export type CoverRouteScope = {
  /** Marshrut egasi (agent) — order/client scope */
  agentUserId: number;
  /** JWT user (SVR yoki agent) */
  executorUserId: number;
  viaCover: boolean;
};

/**
 * Agent API scope: SVR faol cover bilan covered agent id;
 * aks holda JWT user. Impersonation JWT yo‘q.
 */
export async function resolveCoverRouteScope(
  tenantId: number,
  viewer: { sub: string; role: string }
): Promise<CoverRouteScope> {
  const executorUserId = Number.parseInt(viewer.sub, 10);
  if (!Number.isFinite(executorUserId) || executorUserId < 1) {
    return { agentUserId: 0, executorUserId: 0, viaCover: false };
  }

  if (viewer.role === "supervisor") {
    const active = await prisma.agentSvrCover.findFirst({
      where: {
        tenant_id: tenantId,
        svr_user_id: executorUserId,
        status: "faol"
      },
      select: { agent_user_id: true, svr_user_id: true },
      orderBy: { accepted_at: "desc" }
    });
    const agentUserId = resolveCoverScopeAgentUserId({
      viewerRole: viewer.role,
      viewerUserId: executorUserId,
      activeCover: active
    });
    return {
      agentUserId,
      executorUserId,
      viaCover: agentUserId !== executorUserId
    };
  }

  return {
    agentUserId: executorUserId,
    executorUserId,
    viaCover: false
  };
}
