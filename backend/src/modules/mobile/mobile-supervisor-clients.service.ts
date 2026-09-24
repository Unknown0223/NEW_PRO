import type { z } from "zod";
import { prisma } from "../../config/database";
import type { mobilePatchClientBodySchema } from "../../contracts/mobile.schemas";
import { updateClientFields } from "../clients/clients.write.update";
import { createNotification } from "../notifications/notifications.service";
import {
  assertMobileClientPolicy,
  mobileClientPatchToUpdateFields,
  type MobileClientInput
} from "../staff/agent-mobile-config.client-mobile";
import { sendPushToUserTokens } from "./fcm-push.service";
import {
  compactClient,
  clientSyncSelectBase,
  loadAgentMobileConfig,
  type CompactClientRow
} from "./mobile-agent-sync.service";
import { mergeMobileConfigWithDefaults } from "../staff/agent-mobile-config.defaults";
import { resolveUserPermissionKeys } from "../access/rbac.service";
import { listSupervisorLinkedAgents } from "./mobile-supervisor-kpi.service";

type PatchClientBody = z.infer<typeof mobilePatchClientBodySchema>;

/** Savdo Konfig `can_edit: false` bo‘lsa ham Dostup `clients.klient.update` ochiq bo‘lsa ruxsat. */
async function supervisorMayEditClient(
  tenantId: number,
  supervisorUserId: number,
  cfgCanEdit: boolean | undefined
): Promise<boolean> {
  if (cfgCanEdit !== false) return true;
  const keys = await resolveUserPermissionKeys(tenantId, supervisorUserId, "supervisor");
  return keys.has("clients.klient.update");
}

const supervisorClientSelect = {
  ...clientSyncSelectBase,
  agent_id: true,
  client_photo_reports: {
    where: { deleted_at: null },
    orderBy: { created_at: "desc" as const },
    take: 1,
    select: { image_url: true }
  },
  agent_assignments: {
    orderBy: { slot: "asc" as const },
    take: 12,
    select: {
      visit_weekdays: true,
      visit_date: true,
      agent_id: true,
      work_slot_id: true,
      agent: { select: { id: true, name: true, first_name: true, last_name: true, supervisor_user_id: true } }
    }
  }
} as const;

function supervisorScopedClientWhere(tenantId: number, agentIds: number[]) {
  return {
    tenant_id: tenantId,
    merged_into_client_id: null,
    OR: [{ agent_id: { in: agentIds } }, { agent_assignments: { some: { agent_id: { in: agentIds } } } }]
  };
}

async function linkedAgentIds(tenantId: number, supervisorUserId: number): Promise<number[]> {
  const agents = await listSupervisorLinkedAgents(tenantId, supervisorUserId);
  return agents.map((a) => a.id);
}

export async function assertSupervisorScopedClient(
  tenantId: number,
  supervisorUserId: number,
  clientId: number
): Promise<boolean> {
  const agentIds = await linkedAgentIds(tenantId, supervisorUserId);
  if (agentIds.length === 0) return false;
  const n = await prisma.client.count({
    where: { id: clientId, ...supervisorScopedClientWhere(tenantId, agentIds) }
  });
  return n > 0;
}

export async function listMobileSupervisorClients(
  tenantId: number,
  supervisorUserId: number,
  opts?: { q?: string; limit?: number }
) {
  const agentIds = await linkedAgentIds(tenantId, supervisorUserId);
  if (agentIds.length === 0) return [] as ReturnType<typeof compactClient>[];

  const q = opts?.q?.trim() ?? "";
  const limit = Math.min(Math.max(opts?.limit ?? 200, 1), 500);
  const rows = await prisma.client.findMany({
    where: {
      ...supervisorScopedClientWhere(tenantId, agentIds),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
              { address: { contains: q, mode: "insensitive" } },
              { inn: { contains: q, mode: "insensitive" } },
              { client_code: { contains: q, mode: "insensitive" } }
            ]
          }
        : {})
    },
    orderBy: { name: "asc" },
    take: limit,
    select: supervisorClientSelect
  });

  return rows.map((r) => {
    const compact = compactClient(r as unknown as CompactClientRow);
    const linked = (r.agent_assignments ?? [])
      .map((a) => a.agent)
      .filter((a): a is NonNullable<typeof a> => a != null && agentIds.includes(a.id));
    const names = [...new Set(linked.map((a) => a.name).filter(Boolean))];
    return {
      ...compact,
      linked_agent_ids: linked.map((a) => a.id),
      linked_agent_names: names
    };
  });
}

export async function getMobileSupervisorClient(
  tenantId: number,
  supervisorUserId: number,
  clientId: number
) {
  const agentIds = await linkedAgentIds(tenantId, supervisorUserId);
  if (agentIds.length === 0) throw new Error("NOT_FOUND");
  const row = await prisma.client.findFirst({
    where: { id: clientId, ...supervisorScopedClientWhere(tenantId, agentIds) },
    select: supervisorClientSelect
  });
  if (!row) throw new Error("NOT_FOUND");
  const compact = compactClient(row as unknown as CompactClientRow);
  const linked = (row.agent_assignments ?? [])
    .map((a) => a.agent)
    .filter((a): a is NonNullable<typeof a> => a != null && agentIds.includes(a.id));
  return {
    ...compact,
    linked_agent_ids: linked.map((a) => a.id),
    linked_agent_names: [...new Set(linked.map((a) => a.name).filter(Boolean))]
  };
}

/** Mijozga bog‘langan agentlarning boshqa supervayzerlari. */
export async function listOtherSupervisorsForClient(
  tenantId: number,
  clientId: number,
  excludeSupervisorId: number
): Promise<number[]> {
  const client = await prisma.client.findFirst({
    where: { id: clientId, tenant_id: tenantId, merged_into_client_id: null },
    select: {
      agent_id: true,
      agent_assignments: { select: { agent_id: true } }
    }
  });
  if (!client) return [];
  const agentIds = new Set<number>();
  if (client.agent_id != null) agentIds.add(client.agent_id);
  for (const a of client.agent_assignments) {
    if (a.agent_id != null) agentIds.add(a.agent_id);
  }
  if (agentIds.size === 0) return [];
  const agents = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      id: { in: [...agentIds] },
      role: "agent",
      supervisor_user_id: { not: null }
    },
    select: { supervisor_user_id: true }
  });
  const out = new Set<number>();
  for (const a of agents) {
    const sid = a.supervisor_user_id;
    if (sid != null && sid > 0 && sid !== excludeSupervisorId) out.add(sid);
  }
  return [...out];
}

function coordsChanged(
  before: { latitude: unknown; longitude: unknown },
  patch: PatchClientBody
): boolean {
  if (patch.latitude === undefined && patch.longitude === undefined) return false;
  const blat = before.latitude != null ? Number(before.latitude) : null;
  const blon = before.longitude != null ? Number(before.longitude) : null;
  const alat = patch.latitude !== undefined ? (patch.latitude == null ? null : Number(patch.latitude)) : blat;
  const alon = patch.longitude !== undefined ? (patch.longitude == null ? null : Number(patch.longitude)) : blon;
  const round = (n: number | null) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 1e6) / 1e6);
  return round(blat) !== round(alat) || round(blon) !== round(alon);
}

export async function notifyOtherSupervisorsClientSharedChange(params: {
  tenantId: number;
  clientId: number;
  clientName: string;
  actorSupervisorId: number;
  actorName: string;
  changedLabels: string[];
}): Promise<number> {
  if (params.changedLabels.length === 0) return 0;
  const others = await listOtherSupervisorsForClient(
    params.tenantId,
    params.clientId,
    params.actorSupervisorId
  );
  if (others.length === 0) return 0;
  const title = "Изменение клиента (общие данные)";
  const body = `${params.actorName} изменил(а) у «${params.clientName}»: ${params.changedLabels.join(", ")}`;
  const link = `/clients?id=${params.clientId}`;
  for (const userId of others) {
    await createNotification({
      tenant_id: params.tenantId,
      user_id: userId,
      title,
      body,
      link_href: link
    });
    await sendPushToUserTokens(params.tenantId, userId, {
      title,
      body,
      data: {
        type: "client_shared_change",
        client_id: String(params.clientId)
      }
    });
  }
  return others.length;
}

export async function patchMobileSupervisorClient(
  tenantId: number,
  supervisorUserId: number,
  clientId: number,
  patch: PatchClientBody
) {
  const rawCfg = await loadAgentMobileConfig(tenantId, supervisorUserId);
  const cfg = mergeMobileConfigWithDefaults("supervisor", rawCfg ?? undefined);
  if (!(await supervisorMayEditClient(tenantId, supervisorUserId, cfg.client?.can_edit))) {
    throw new Error("CLIENT_EDIT_FORBIDDEN");
  }

  const ok = await assertSupervisorScopedClient(tenantId, supervisorUserId, clientId);
  if (!ok) throw new Error("NOT_FOUND");

  const existing = await prisma.client.findFirst({
    where: { id: clientId, tenant_id: tenantId },
    select: { id: true, name: true, latitude: true, longitude: true }
  });
  if (!existing) throw new Error("NOT_FOUND");

  assertMobileClientPolicy(cfg.client, patch as MobileClientInput, "patch");

  const coordTouch = coordsChanged(existing, patch);
  if (coordTouch && cfg.client?.can_change_client_location === false) {
    throw new Error("CLIENT_LOCATION_FORBIDDEN");
  }

  const fields = mobileClientPatchToUpdateFields(patch as Partial<MobileClientInput>);
  if (Object.keys(fields).length > 0) {
    await updateClientFields(tenantId, clientId, fields, supervisorUserId);
  }

  if (patch.visit_weekdays !== undefined) {
    const visitWeekdays = patch.visit_weekdays ?? [];
    const agentIds = await linkedAgentIds(tenantId, supervisorUserId);
    const assignments = await prisma.clientAgentAssignment.findMany({
      where: { client_id: clientId, tenant_id: tenantId, agent_id: { in: agentIds } },
      select: { id: true }
    });
    for (const a of assignments) {
      await prisma.clientAgentAssignment.update({
        where: { id: a.id },
        data: { visit_weekdays: visitWeekdays }
      });
    }
  }

  const changedLabels: string[] = [];
  if (coordTouch) changedLabels.push("координаты");
  if (patch.address !== undefined) changedLabels.push("адрес");
  if (patch.region !== undefined || patch.zone !== undefined || patch.city !== undefined) {
    changedLabels.push("территория");
  }

  if (changedLabels.length > 0) {
    const actor = await prisma.user.findFirst({
      where: { id: supervisorUserId, tenant_id: tenantId },
      select: { name: true, first_name: true, last_name: true }
    });
    const actorName =
      actor?.name?.trim() ||
      [actor?.last_name, actor?.first_name].filter(Boolean).join(" ").trim() ||
      `SVR #${supervisorUserId}`;
    await notifyOtherSupervisorsClientSharedChange({
      tenantId,
      clientId,
      clientName: existing.name,
      actorSupervisorId: supervisorUserId,
      actorName,
      changedLabels
    });
  }

  return getMobileSupervisorClient(tenantId, supervisorUserId, clientId);
}
