import { prisma } from "../../config/database";
import { uniquePositiveIds } from "../access/access-staff-scope";

/**
 * SVR jamoa agentlari: user.supervisor_user_id ∪ slot.supervisee_agent_slot_ids faol xodimlari.
 * Sync kechiksa ham dashboard nollanmasin.
 */
export async function listAgentIdsForSupervisorTeam(
  tenantId: number,
  supervisorUserIds: number[]
): Promise<number[]> {
  const supIds = uniquePositiveIds(supervisorUserIds);
  if (supIds.length === 0) return [];

  const [bySupervisorField, svrSlotLinks] = await Promise.all([
    prisma.user.findMany({
      where: {
        tenant_id: tenantId,
        is_active: true,
        role: "agent",
        supervisor_user_id: { in: supIds }
      },
      select: { id: true }
    }),
    prisma.slotUserLink.findMany({
      where: {
        user_id: { in: supIds },
        ended_at: null,
        slot: { tenant_id: tenantId, slot_type: "supervisor", deleted_at: null }
      },
      select: { slot: { select: { supervisee_agent_slot_ids: true } } }
    })
  ]);

  const teamSlotIds = uniquePositiveIds(
    svrSlotLinks.flatMap((l) => l.slot.supervisee_agent_slot_ids ?? [])
  );
  const byTeamSlots =
    teamSlotIds.length === 0
      ? []
      : await prisma.slotUserLink.findMany({
          where: { slot_id: { in: teamSlotIds }, ended_at: null },
          select: { user_id: true }
        });

  const ids = uniquePositiveIds([
    ...bySupervisorField.map((u) => u.id),
    ...byTeamSlots.map((l) => l.user_id)
  ]);
  if (ids.length === 0) return [];

  const agents = await prisma.user.findMany({
    where: { tenant_id: tenantId, id: { in: ids }, role: "agent", is_active: true },
    select: { id: true }
  });
  return agents.map((a) => a.id);
}

/**
 * Supervisor filtri → agent_ids ga yoyish; supervisor_user_id sync bo‘lmasa ham KPI ishlasin.
 * Access sentinel `[0]` ni o‘zgartirmaydi (bog‘lanishsiz foydalanuvchi).
 */
export async function expandSupervisorFiltersToAgentIds(
  tenantId: number,
  parsed: { agent_ids?: number[]; supervisor_ids?: number[] }
): Promise<void> {
  const supIds = uniquePositiveIds(parsed.supervisor_ids ?? []);
  if (supIds.length === 0) return;

  const team = await listAgentIdsForSupervisorTeam(tenantId, supIds);
  if (team.length === 0) return;

  const raw = parsed.agent_ids ?? [];
  const isDeniedSentinel = raw.length === 1 && raw[0] === 0;
  if (isDeniedSentinel) return;

  const cur = uniquePositiveIds(raw);
  if (cur.length === 0) {
    parsed.agent_ids = team;
  } else {
    const allowed = new Set(team);
    const hit = cur.filter((id) => allowed.has(id));
    parsed.agent_ids = hit.length > 0 ? hit : cur;
  }
  // AND supervisor_user_id unsynced bo‘lsa nollamasin — jamoa allaqachon agent_ids da
  parsed.supervisor_ids = [];
}
