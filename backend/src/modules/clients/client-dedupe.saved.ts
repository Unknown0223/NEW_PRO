import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";

export async function listSavedDuplicateGroups(tenantId: number) {
  const rows = await prisma.clientSavedDuplicateGroup.findMany({
    where: { tenant_id: tenantId },
    orderBy: { created_at: "desc" },
    include: {
      master_client: { select: { id: true, name: true } },
      created_by: { select: { id: true, name: true } }
    }
  });
  const ids = [...new Set(rows.flatMap((r) => r.client_ids))];
  const clients = await prisma.client.findMany({
    where: { tenant_id: tenantId, id: { in: ids } },
    select: { id: true, merged_into_client_id: true }
  });
  const mergedMap = new Map(clients.map((c) => [c.id, c.merged_into_client_id]));
  return rows.map((r) => {
    const masterId = r.master_client_id;
    const notMerged = r.client_ids.filter((id) => id !== masterId && mergedMap.get(id) == null).length;
    return {
      id: r.id,
      created_at: r.created_at.toISOString(),
      master_client_id: r.master_client_id,
      master_name: r.master_client.name,
      note: r.note,
      created_by_user_id: r.created_by_user_id,
      created_by_name: r.created_by?.name ?? null,
      similar_count: r.client_ids.length,
      not_merged_count: notMerged
    };
  });
}

export async function createSavedDuplicateGroup(
  tenantId: number,
  input: { master_client_id: number; client_ids: number[]; note?: string | null },
  actorUserId?: number | null
) {
  const ids = [...new Set(input.client_ids)].filter((x) => x > 0);
  if (ids.length < 2) throw new Error("TOO_FEW_CLIENTS");
  if (!ids.includes(input.master_client_id)) throw new Error("MASTER_NOT_IN_SET");
  const row = await prisma.clientSavedDuplicateGroup.create({
    data: {
      tenant_id: tenantId,
      master_client_id: input.master_client_id,
      client_ids: ids,
      note: input.note?.trim() || null,
      created_by_user_id: actorUserId ?? null
    }
  });
  return { id: row.id };
}

export async function deleteSavedDuplicateGroup(tenantId: number, id: number) {
  const r = await prisma.clientSavedDuplicateGroup.deleteMany({
    where: { id, tenant_id: tenantId }
  });
  if (r.count === 0) throw new Error("NOT_FOUND");
}

