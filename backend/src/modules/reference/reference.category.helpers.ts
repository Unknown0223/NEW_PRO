import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";

export async function depthFromRoot(tenantId: number, id: number): Promise<number> {
  let d = 0;
  let cur = await prisma.productCategory.findFirst({
    where: { id, tenant_id: tenantId },
    select: { parent_id: true }
  });
  while (cur?.parent_id != null) {
    d++;
    cur = await prisma.productCategory.findFirst({
      where: { id: cur.parent_id, tenant_id: tenantId },
      select: { parent_id: true }
    });
    if (d > 20) throw new Error("BAD_CHAIN");
  }
  return d;
}

export async function maxDepthBelow(tenantId: number, rootId: number): Promise<number> {
  const children = await prisma.productCategory.findMany({
    where: { tenant_id: tenantId, parent_id: rootId },
    select: { id: true }
  });
  if (children.length === 0) return 0;
  let m = 0;
  for (const ch of children) {
    m = Math.max(m, 1 + (await maxDepthBelow(tenantId, ch.id)));
  }
  return m;
}

export async function assertParentAllowed(tenantId: number, parentId: number | null): Promise<void> {
  if (parentId == null) return;
  const d = await depthFromRoot(tenantId, parentId);
  if (d > 1) {
    throw new Error("BAD_PARENT");
  }
}

export function normalizeCategoryCode(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const u = raw.trim().toUpperCase();
  if (!u) return null;
  if (!/^[A-Z0-9_]+$/.test(u)) {
    throw new Error("BAD_CODE");
  }
  return u.slice(0, 24);
}
