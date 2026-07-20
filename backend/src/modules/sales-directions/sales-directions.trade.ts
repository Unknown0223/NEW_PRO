import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { invalidateTenantSettingsCache } from "../../lib/redis-cache";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";
import { normCode } from "./sales-directions.shared";

export type TradeDirectionRow = {
  id: number;
  name: string;
  sort_order: number;
  code: string | null;
  comment: string | null;
  is_active: boolean;
  use_in_order_proposal: boolean;
};

export async function listTradeDirections(
  tenantId: number,
  q: {
    is_active?: boolean;
    search?: string;
    use_in_order_proposal?: boolean;
    allowed_ids?: number[];
  }
): Promise<TradeDirectionRow[]> {
  const where: Prisma.TradeDirectionWhereInput = { tenant_id: tenantId };
  if (q.allowed_ids !== undefined) {
    where.id = { in: q.allowed_ids };
  }
  if (q.is_active !== undefined) where.is_active = q.is_active;
  if (q.use_in_order_proposal === true) where.use_in_order_proposal = true;
  const s = q.search?.trim();
  if (s) {
    where.OR = [
      { name: { contains: s, mode: "insensitive" } },
      { code: { contains: s, mode: "insensitive" } },
      { comment: { contains: s, mode: "insensitive" } }
    ];
  }
  const rows = await prisma.tradeDirection.findMany({
    where,
    orderBy: [{ sort_order: "asc" }, { name: "asc" }, { id: "asc" }]
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    sort_order: r.sort_order,
    code: r.code,
    comment: r.comment,
    is_active: r.is_active,
    use_in_order_proposal: r.use_in_order_proposal
  }));
}

export async function createTradeDirection(
  tenantId: number,
  input: {
    name: string;
    sort_order?: number;
    code?: string | null;
    comment?: string | null;
    is_active?: boolean;
    use_in_order_proposal?: boolean;
  },
  actorUserId: number | null
): Promise<TradeDirectionRow> {
  const code = normCode(input.code ?? null);
  if (code) {
    const dup = await prisma.tradeDirection.findFirst({
      where: { tenant_id: tenantId, code }
    });
    if (dup) throw new Error("DUPLICATE_CODE");
  }
  const row = await prisma.tradeDirection.create({
    data: {
      tenant_id: tenantId,
      name: input.name.trim(),
      sort_order: input.sort_order ?? 0,
      code,
      comment: input.comment?.trim() || null,
      is_active: input.is_active ?? true,
      use_in_order_proposal: input.use_in_order_proposal ?? false
    }
  });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: "trade_direction",
    entityId: row.id,
    action: "create",
    payload: { name: row.name, code: row.code }
  });
  await invalidateTenantSettingsCache(tenantId);
  return {
    id: row.id,
    name: row.name,
    sort_order: row.sort_order,
    code: row.code,
    comment: row.comment,
    is_active: row.is_active,
    use_in_order_proposal: row.use_in_order_proposal
  };
}

export async function patchTradeDirection(
  tenantId: number,
  id: number,
  input: Partial<{
    name: string;
    sort_order: number;
    code: string | null;
    comment: string | null;
    is_active: boolean;
    use_in_order_proposal: boolean;
  }>,
  actorUserId: number | null
): Promise<TradeDirectionRow> {
  const existing = await prisma.tradeDirection.findFirst({
    where: { id, tenant_id: tenantId }
  });
  if (!existing) throw new Error("NOT_FOUND");

  const code =
    input.code !== undefined ? normCode(input.code) : (existing.code as string | null);
  if (code && input.code !== undefined) {
    const dup = await prisma.tradeDirection.findFirst({
      where: { tenant_id: tenantId, code, NOT: { id } }
    });
    if (dup) throw new Error("DUPLICATE_CODE");
  }

  const row = await prisma.tradeDirection.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.sort_order !== undefined ? { sort_order: input.sort_order } : {}),
      ...(input.code !== undefined ? { code } : {}),
      ...(input.comment !== undefined ? { comment: input.comment?.trim() || null } : {}),
      ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
      ...(input.use_in_order_proposal !== undefined
        ? { use_in_order_proposal: input.use_in_order_proposal }
        : {})
    }
  });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: "trade_direction",
    entityId: row.id,
    action: "patch",
    payload: input
  });
  await invalidateTenantSettingsCache(tenantId);
  return {
    id: row.id,
    name: row.name,
    sort_order: row.sort_order,
    code: row.code,
    comment: row.comment,
    is_active: row.is_active,
    use_in_order_proposal: row.use_in_order_proposal
  };
}
