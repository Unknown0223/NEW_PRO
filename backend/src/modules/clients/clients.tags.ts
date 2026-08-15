import { prisma } from "../../config/database";
import { invalidateClientDetailCache } from "../../lib/redis-cache";
import { appendClientAuditLog } from "./clients.audit";

export type ClientTagRow = {
  id: number;
  name: string;
  created_at: string;
};

export async function listClientTags(tenantId: number): Promise<ClientTagRow[]> {
  const rows = await prisma.clientTag.findMany({
    where: { tenant_id: tenantId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, created_at: true }
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    created_at: r.created_at.toISOString()
  }));
}

export async function createClientTag(tenantId: number, nameRaw: string): Promise<ClientTagRow> {
  const name = nameRaw.trim().slice(0, 128);
  if (!name) throw new Error("VALIDATION");
  try {
    const row = await prisma.clientTag.create({
      data: { tenant_id: tenantId, name },
      select: { id: true, name: true, created_at: true }
    });
    return { id: row.id, name: row.name, created_at: row.created_at.toISOString() };
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
    if (code === "P2002") throw new Error("DUPLICATE");
    throw e;
  }
}

export async function bulkPatchClientTags(
  tenantId: number,
  clientIds: number[],
  addTagIds: number[] | undefined,
  removeTagIds: number[] | undefined,
  actorUserId?: number | null
): Promise<{ updated: number; failed: Array<{ id: number; error: string }> }> {
  const MAX = 500;
  const ids = [...new Set(clientIds.map((x) => Math.floor(Number(x))).filter((x) => Number.isFinite(x) && x > 0))].slice(
    0,
    MAX
  );
  const add = [...new Set((addTagIds ?? []).map((x) => Math.floor(Number(x))).filter((x) => x > 0))];
  const remove = [...new Set((removeTagIds ?? []).map((x) => Math.floor(Number(x))).filter((x) => x > 0))];
  if (ids.length === 0 || (add.length === 0 && remove.length === 0)) {
    return { updated: 0, failed: [] };
  }

  if (add.length > 0) {
    const found = await prisma.clientTag.count({
      where: { tenant_id: tenantId, id: { in: add } }
    });
    if (found !== add.length) throw new Error("BAD_TAG");
  }
  if (remove.length > 0) {
    const found = await prisma.clientTag.count({
      where: { tenant_id: tenantId, id: { in: remove } }
    });
    if (found !== remove.length) throw new Error("BAD_TAG");
  }

  const existingClients = await prisma.client.findMany({
    where: { tenant_id: tenantId, id: { in: ids }, merged_into_client_id: null },
    select: { id: true }
  });
  const existingSet = new Set(existingClients.map((c) => c.id));

  let updated = 0;
  const failed: Array<{ id: number; error: string }> = [];

  for (const id of ids) {
    if (!existingSet.has(id)) {
      failed.push({ id, error: "NOT_FOUND" });
      continue;
    }
    try {
      await prisma.$transaction(async (tx) => {
        if (remove.length > 0) {
          await tx.clientTagLink.deleteMany({
            where: { client_id: id, tag_id: { in: remove } }
          });
        }
        if (add.length > 0) {
          await tx.clientTagLink.createMany({
            data: add.map((tag_id) => ({ client_id: id, tag_id })),
            skipDuplicates: true
          });
        }
      });
      await invalidateClientDetailCache(tenantId, id);
      await appendClientAuditLog(tenantId, id, actorUserId ?? null, "client.tags.patch", {
        add,
        remove
      });
      updated += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "UNKNOWN";
      failed.push({ id, error: msg });
    }
  }

  return { updated, failed };
}
