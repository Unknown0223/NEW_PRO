import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";
import { salesRefStoredValue, sortRu } from "./sales-directions.shared";

export async function listActiveTradeDirectionLabels(tenantId: number): Promise<string[]> {
  const rows = await prisma.tradeDirection.findMany({
    where: { tenant_id: tenantId, is_active: true },
    select: { code: true, name: true }
  });
  const set = new Set<string>();
  for (const r of rows) {
    const v = salesRefStoredValue(r);
    if (v) set.add(v);
  }
  return [...set].sort(sortRu);
}

export async function listActiveSalesChannelLabels(tenantId: number): Promise<string[]> {
  const rows = await prisma.salesChannelRef.findMany({
    where: { tenant_id: tenantId, is_active: true },
    select: { code: true, name: true }
  });
  const set = new Set<string>();
  for (const r of rows) {
    const v = salesRefStoredValue(r);
    if (v) set.add(v);
  }
  return [...set].sort(sortRu);
}
