import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";

export async function appendClientAuditLogsBatch(
  tenantId: number,
  clientIds: number[],
  userId: number | null | undefined,
  action: string,
  detail: Record<string, unknown>
): Promise<void> {
  if (clientIds.length === 0) return;
  const uid =
    userId != null && Number.isFinite(userId) && userId > 0 ? Math.floor(Number(userId)) : null;
  const detailJson = detail as Prisma.InputJsonValue;
  await prisma.clientAuditLog.createMany({
    data: clientIds.map((client_id) => ({
      tenant_id: tenantId,
      client_id,
      user_id: uid,
      action,
      detail: detailJson
    }))
  });
}

export async function appendClientAuditLog(
  tenantId: number,
  clientId: number,
  userId: number | null | undefined,
  action: string,
  detail: Record<string, unknown>
): Promise<void> {
  const uid =
    userId != null && Number.isFinite(userId) && userId > 0 ? Math.floor(Number(userId)) : null;
  await prisma.clientAuditLog.create({
    data: {
      tenant_id: tenantId,
      client_id: clientId,
      user_id: uid,
      action,
      detail: detail as Prisma.InputJsonValue
    }
  });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId: uid,
    entityType: "client",
    entityId: clientId,
    action,
    payload: detail
  });
}
