import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { validateCheckin } from "../territory/territory.service";
import type { ClientAddressTerritoryInput } from "./linkage.types";

async function resolveTerritoryIdsForClient(
  tenantId: number,
  client: {
    latitude: unknown;
    longitude: unknown;
    region: string | null;
    city: string | null;
    district: string | null;
    zone: string | null;
  }
): Promise<number[]> {
  const ids = new Set<number>();
  const lat = client.latitude != null ? Number(client.latitude as number | string) : NaN;
  const lng = client.longitude != null ? Number(client.longitude as number | string) : NaN;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const hit = await validateCheckin(tenantId, null, lat, lng);
    if (hit.inside && hit.territory_id != null) ids.add(hit.territory_id);
  }
  const terms = [
    ...new Set(
      [client.region, client.city, client.district, client.zone]
        .map((s) => (s ?? "").trim())
        .filter((s) => s.length > 0)
    )
  ];
  if (terms.length === 0) return [...ids];
  const rows = await prisma.territory.findMany({
    where: {
      tenant_id: tenantId,
      deleted_at: null,
      is_active: true,
      OR: terms.flatMap((t) => [
        { code: { equals: t, mode: "insensitive" } },
        { name: { equals: t, mode: "insensitive" } }
      ])
    },
    select: { id: true }
  });
  for (const r of rows) ids.add(r.id);
  return [...ids];
}

async function listStaffUserIdsLinkedToTerritories(
  tenantId: number,
  territoryIds: number[],
  role: "agent" | "expeditor"
): Promise<number[]> {
  if (territoryIds.length === 0) return [];
  const linkRows = await prisma.territoryUserLink.findMany({
    where: { territory_id: { in: territoryIds } },
    select: { user_id: true }
  });
  const uids = [...new Set(linkRows.map((r) => r.user_id))].filter((n) => Number.isInteger(n) && n > 0);
  if (uids.length === 0) return [];
  const rows = await prisma.user.findMany({
    where: { tenant_id: tenantId, id: { in: uids }, role, is_active: true },
    select: { id: true }
  });
  return rows.map((r) => r.id);
}

/**
 * Klient manzili / GPS bo‘yicha `territories` + `territory_user_links` orqali agent va dastavchik tanlovi (UI / API).
 */
export async function getAgentPickerContextForAddress(
  tenantId: number,
  input: ClientAddressTerritoryInput
): Promise<{
  territory_matched: boolean;
  territory_ids: number[];
  agent_ids: number[];
  expeditor_ids: number[];
  /** 2+ hudud agenti — avtomatik tanlash mumkin emas (Q-05). */
  agent_pick_ambiguous: boolean;
  requires_supervisor_review: boolean;
}> {
  const territory_ids = await resolveTerritoryIdsForClient(tenantId, input);
  if (territory_ids.length === 0) {
    return {
      territory_matched: false,
      territory_ids: [],
      agent_ids: [],
      expeditor_ids: [],
      agent_pick_ambiguous: false,
      requires_supervisor_review: false
    };
  }
  const [agent_ids, expeditor_ids] = await Promise.all([
    listStaffUserIdsLinkedToTerritories(tenantId, territory_ids, "agent"),
    listStaffUserIdsLinkedToTerritories(tenantId, territory_ids, "expeditor")
  ]);
  const uniqueAgents = [...new Set(agent_ids)].filter((id) => id > 0);
  const ambiguous = uniqueAgents.length >= 2;
  return {
    territory_matched: true,
    territory_ids,
    agent_ids,
    expeditor_ids,
    agent_pick_ambiguous: ambiguous,
    requires_supervisor_review: ambiguous
  };
}

export async function mergeAgentsFromClientTerritories(
  tenantId: number,
  client: ClientAddressTerritoryInput,
  agentIds: Set<number>
): Promise<void> {
  const { agent_ids } = await getAgentPickerContextForAddress(tenantId, client);
  for (const id of agent_ids) agentIds.add(id);
}
