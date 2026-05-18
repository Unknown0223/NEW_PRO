import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";

import { validatePolygon } from "./territory.helpers";

export async function listTerritories(
  tenantId: number,
  opts: { is_active?: boolean; q?: string; page: number; limit: number; archive?: boolean }
) {
  const where: Prisma.TerritoryWhereInput = { tenant_id: tenantId };
  if (opts.archive) {
    where.deleted_at = { not: null };
  } else {
    where.deleted_at = null;
  }
  if (opts.is_active !== undefined) where.is_active = opts.is_active;
  const q = (opts.q ?? "").trim();
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } }
    ];
  }
  const skip = (opts.page - 1) * opts.limit;
  const [total, rows] = await Promise.all([
    prisma.territory.count({ where }),
    prisma.territory.findMany({
      where,
      orderBy: [{ created_at: "desc" }, { name: "asc" }],
      skip,
      take: opts.limit,
      include: {
        userLinks: {
          include: {
            assignedByUser: { select: { id: true, name: true } }
          }
        }
      }
    })
  ]);
  const data = rows.map((t) => ({
    id: t.id,
    name: t.name,
    code: t.code,
    description: t.description,
    polygon: t.polygon as unknown,
    is_active: t.is_active,
    created_at: t.created_at.toISOString(),
    updated_at: t.updated_at.toISOString(),
    user_count: t.userLinks.length,
    deleted_at: t.deleted_at ? t.deleted_at.toISOString() : null,
    deleted_by_user_id: t.deleted_by_user_id ?? null
  }));
  return { data, total, page: opts.page, limit: opts.limit };
}

export async function getTerritory(tenantId: number, id: number) {
  const t = await prisma.territory.findFirst({
    where: { id, tenant_id: tenantId },
    include: {
      userLinks: {
        include: {
          assignedByUser: { select: { id: true, name: true } }
        }
      }
    }
  });
  return t;
}

export async function createTerritory(
  tenantId: number,
  body: {
    name: string;
    code?: string | null;
    description?: string | null;
    polygon?: unknown;
    is_active?: boolean;
  }
) {
  if (body.code) {
    const clash = await prisma.territory.findFirst({
      where: { tenant_id: tenantId, code: body.code, deleted_at: null }
    });
    if (clash) throw new Error("CodeTaken");
  }

  let polygon: Prisma.InputJsonValue = "[]" as unknown as Prisma.InputJsonValue;
  if (body.polygon !== undefined && body.polygon !== null) {
    const pts = validatePolygon(body.polygon);
    polygon = pts as unknown as Prisma.InputJsonValue;
  }

  const t = await prisma.territory.create({
    data: {
      tenant_id: tenantId,
      name: body.name.trim().slice(0, 256),
      code: body.code?.trim() || null,
      description: body.description?.trim() || null,
      polygon,
      is_active: body.is_active !== false
    }
  });
  return t;
}

export async function updateTerritory(
  tenantId: number,
  id: number,
  body: {
    name?: string;
    code?: string | null;
    description?: string | null;
    polygon?: unknown;
    is_active?: boolean;
  }
) {
  const existing = await prisma.territory.findFirst({
    where: { id, tenant_id: tenantId }
  });
  if (!existing) return null;
  if (existing.deleted_at != null) throw new Error("VOIDED");

  if (body.code !== undefined && body.code) {
    const clash = await prisma.territory.findFirst({
      where: { tenant_id: tenantId, code: body.code, deleted_at: null, NOT: { id } }
    });
    if (clash) throw new Error("CodeTaken");
  }

  let polygon: Prisma.InputJsonValue | undefined;
  if (body.polygon !== undefined && body.polygon !== null) {
    const pts = validatePolygon(body.polygon);
    polygon = pts as unknown as Prisma.InputJsonValue;
  }

  const data: Prisma.TerritoryUpdateInput = {};
  if (body.name !== undefined) data.name = body.name.trim().slice(0, 256);
  if (body.code !== undefined) data.code = body.code?.trim() || null;
  if (body.description !== undefined)
    data.description = body.description?.trim() || null;
  if (polygon !== undefined) data.polygon = polygon;
  if (body.is_active !== undefined) data.is_active = body.is_active;

  const updated = await prisma.territory.update({ where: { id }, data });
  return updated;
}

export async function deleteTerritory(
  tenantId: number,
  id: number,
  actorUserId: number | null
): Promise<void> {
  const existing = await prisma.territory.findFirst({
    where: { id, tenant_id: tenantId },
    select: { id: true, deleted_at: true }
  });
  if (!existing) throw new Error("NOT_FOUND");
  if (existing.deleted_at != null) throw new Error("ALREADY_VOIDED");
  const uid =
    actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;
  await prisma.territory.update({
    where: { id },
    data: { deleted_at: new Date(), deleted_by_user_id: uid }
  });
}

export async function restoreTerritory(tenantId: number, id: number): Promise<void> {
  const existing = await prisma.territory.findFirst({
    where: { id, tenant_id: tenantId },
    select: { id: true, deleted_at: true }
  });
  if (!existing) throw new Error("NOT_FOUND");
  if (existing.deleted_at == null) throw new Error("NOT_VOIDED");
  await prisma.territory.update({
    where: { id },
    data: { deleted_at: null, deleted_by_user_id: null }
  });
}
