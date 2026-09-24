import {
  enrichScopedReportActor,
  resolveAllowedAgentIdsForActor
} from "../access/access-agent-scope";
import { actorHasUnrestrictedDataScope } from "../access/access-staff-scope";
import { prisma } from "../../config/database";

export type TelegramIntakeScopeDto = {
  unrestricted: boolean;
  agent_ids: number[];
  territory_ids: number[];
  bound_staff_ids: number[];
};

/**
 * Platforma Dostup + ish o‘rni scope — bot Excel/statistika shu agentlar bilan cheklanadi.
 */
export async function resolveTelegramIntakeScope(input: {
  tenantId: number;
  userId: number;
  role: string;
}): Promise<TelegramIntakeScopeDto> {
  if (actorHasUnrestrictedDataScope(input.role)) {
    const agents = await prisma.user.findMany({
      where: { tenant_id: input.tenantId, role: "agent", is_active: true },
      select: { id: true }
    });
    return {
      unrestricted: true,
      agent_ids: agents.map((a) => a.id),
      territory_ids: [],
      bound_staff_ids: agents.map((a) => a.id)
    };
  }

  const enriched = await enrichScopedReportActor(input.tenantId, {
    userId: input.userId,
    role: input.role
  });
  const allowed = resolveAllowedAgentIdsForActor(enriched);
  return {
    unrestricted: false,
    agent_ids: allowed ?? [],
    territory_ids: enriched.territory_ids ?? [],
    bound_staff_ids: enriched.bound_staff_ids ?? []
  };
}
