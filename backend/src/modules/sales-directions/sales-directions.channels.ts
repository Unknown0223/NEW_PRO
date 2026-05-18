import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";
import { normCode } from "./sales-directions.shared";

export type SalesChannelRefRow = {
  id: number;
  name: string;
  code: string | null;
  comment: string | null;
  sort_order: number;
  is_active: boolean;
};

export async function listSalesChannelRefs(
  tenantId: number,
  q: { is_active?: boolean; search?: string }
): Promise<SalesChannelRefRow[]> {
  const where: Prisma.SalesChannelRefWhereInput = { tenant_id: tenantId };
  if (q.is_active !== undefined) where.is_active = q.is_active;
  const s = q.search?.trim();
  if (s) {
    where.OR = [
      { name: { contains: s, mode: "insensitive" } },
      { code: { contains: s, mode: "insensitive" } }
    ];
  }
  const rows = await prisma.salesChannelRef.findMany({
    where,
    orderBy: [{ sort_order: "asc" }, { name: "asc" }, { id: "asc" }]
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    comment: r.comment,
    sort_order: r.sort_order,
    is_active: r.is_active
  }));
}

export async function createSalesChannelRef(
  tenantId: number,
  input: {
    name: string;
    code?: string | null;
    comment?: string | null;
    sort_order?: number;
    is_active?: boolean;
  },
  actorUserId: number | null
): Promise<SalesChannelRefRow> {
  const code = normCode(input.code ?? null);
  if (code) {
    const dup = await prisma.salesChannelRef.findFirst({
      where: { tenant_id: tenantId, code }
    });
    if (dup) throw new Error("DUPLICATE_CODE");
  }
  const row = await prisma.salesChannelRef.create({
    data: {
      tenant_id: tenantId,
      name: input.name.trim(),
      code,
      comment: input.comment?.trim() || null,
      sort_order: input.sort_order ?? 0,
      is_active: input.is_active ?? true
    }
  });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: "sales_channel_ref",
    entityId: row.id,
    action: "create",
    payload: { name: row.name, code: row.code }
  });
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    comment: row.comment,
    sort_order: row.sort_order,
    is_active: row.is_active
  };
}

export async function patchSalesChannelRef(
  tenantId: number,
  id: number,
  input: Partial<{
    name: string;
    code: string | null;
    comment: string | null;
    sort_order: number;
    is_active: boolean;
  }>,
  actorUserId: number | null
): Promise<SalesChannelRefRow> {
  const existing = await prisma.salesChannelRef.findFirst({
    where: { id, tenant_id: tenantId }
  });
  if (!existing) throw new Error("NOT_FOUND");

  const code =
    input.code !== undefined ? normCode(input.code) : (existing.code as string | null);
  if (code && input.code !== undefined) {
    const dup = await prisma.salesChannelRef.findFirst({
      where: { tenant_id: tenantId, code, NOT: { id } }
    });
    if (dup) throw new Error("DUPLICATE_CODE");
  }

  const row = await prisma.salesChannelRef.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.sort_order !== undefined ? { sort_order: input.sort_order } : {}),
      ...(input.code !== undefined ? { code } : {}),
      ...(input.comment !== undefined ? { comment: input.comment?.trim() || null } : {}),
      ...(input.is_active !== undefined ? { is_active: input.is_active } : {})
    }
  });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: "sales_channel_ref",
    entityId: row.id,
    action: "patch",
    payload: input
  });
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    comment: row.comment,
    sort_order: row.sort_order,
    is_active: row.is_active
  };
}
