import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { OPERATOR_LIKE_WEB_ROLES } from "../../lib/tenant-user-roles";
import type { SessionRowDto } from "./staff.crud";

export async function listStaffSessions(
  tenantId: number,
  userId: number,
  role: "agent" | "expeditor" | "supervisor" | "collector" | "auditor" | "operator" | "skladchik"
): Promise<SessionRowDto[]> {
  const roleWhere: Prisma.StringFilter | string =
    role === "operator" ? { in: [...OPERATOR_LIKE_WEB_ROLES] } : role;
  const u = await prisma.user.findFirst({
    where: { id: userId, tenant_id: tenantId, role: roleWhere }
  });
  if (!u) throw new Error("NOT_FOUND");
  const rows = await prisma.refreshToken.findMany({
    where: {
      user_id: userId,
      tenant_id: tenantId,
      revoked_at: null,
      expires_at: { gt: new Date() }
    },
    orderBy: { created_at: "desc" }
  });
  return rows.map((r) => ({
    id: r.id,
    device_name: r.device_name,
    ip_address: r.ip_address,
    user_agent: r.user_agent,
    created_at: r.created_at.toISOString()
  }));
}

export async function listAgentSessions(tenantId: number, agentId: number): Promise<SessionRowDto[]> {
  return listStaffSessions(tenantId, agentId, "agent");
}

export async function revokeStaffSessions(
  tenantId: number,
  userId: number,
  role: "agent" | "expeditor" | "supervisor" | "collector" | "auditor" | "operator" | "skladchik",
  mode: { tokenIds?: number[]; all?: boolean },
  actorUserId: number | null = null
): Promise<void> {
  const roleWhere: Prisma.StringFilter | string =
    role === "operator" ? { in: [...OPERATOR_LIKE_WEB_ROLES] } : role;
  const u = await prisma.user.findFirst({
    where: { id: userId, tenant_id: tenantId, role: roleWhere }
  });
  if (!u) throw new Error("NOT_FOUND");

  const baseWhere: Prisma.RefreshTokenWhereInput = {
    user_id: userId,
    tenant_id: tenantId,
    revoked_at: null
  };

  if (mode.all) {
    await prisma.refreshToken.updateMany({
      where: baseWhere,
      data: { revoked_at: new Date() }
    });
  } else if (mode.tokenIds?.length) {
    await prisma.refreshToken.updateMany({
      where: {
        ...baseWhere,
        id: { in: mode.tokenIds }
      },
      data: { revoked_at: new Date() }
    });
  } else {
    throw new Error("EMPTY_REVOKE");
  }

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.user,
    entityId: userId,
    action: "sessions.revoke",
    payload: { all: Boolean(mode.all), count: mode.tokenIds?.length ?? 0, role }
  });
}

export async function revokeAgentSessions(
  tenantId: number,
  agentId: number,
  mode: { tokenIds?: number[]; all?: boolean },
  actorUserId: number | null = null
): Promise<void> {
  await revokeStaffSessions(tenantId, agentId, "agent", mode, actorUserId);
}
