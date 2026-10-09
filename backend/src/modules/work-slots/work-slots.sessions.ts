import { prisma } from "../../config/database";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";
import { assertValidMaxSessions } from "../../lib/max-sessions";
import { isWorkSlotType } from "./work-slots.constants";

export type WorkSlotSessionRowDto = {
  id: number;
  device_name: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

async function requireSlotOccupantUserId(tenantId: number, slotId: number): Promise<number> {
  const slot = await prisma.workSlot.findFirst({
    where: { id: slotId, tenant_id: tenantId, deleted_at: null },
    select: { id: true }
  });
  if (!slot) throw new Error("NOT_FOUND");
  const link = await prisma.slotUserLink.findFirst({
    where: { tenant_id: tenantId, slot_id: slotId, ended_at: null },
    select: { user_id: true }
  });
  if (!link) throw new Error("NO_ACTIVE_USER");
  return link.user_id;
}

export async function listWorkSlotSessions(
  tenantId: number,
  slotId: number
): Promise<WorkSlotSessionRowDto[]> {
  const userId = await requireSlotOccupantUserId(tenantId, slotId);
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

export async function revokeWorkSlotSessions(
  tenantId: number,
  slotId: number,
  mode: { tokenIds?: number[]; all?: boolean },
  actorUserId: number | null = null
): Promise<void> {
  const userId = await requireSlotOccupantUserId(tenantId, slotId);
  const baseWhere = {
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
      where: { ...baseWhere, id: { in: mode.tokenIds } },
      data: { revoked_at: new Date() }
    });
  } else {
    throw new Error("EMPTY_REVOKE");
  }

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: "work_slot",
    entityId: slotId,
    action: "work_slot.sessions.revoke",
    payload: { all: Boolean(mode.all), count: mode.tokenIds?.length ?? 0, user_id: userId }
  });
}

export async function setMaxSessionsForSlotType(
  tenantId: number,
  slotType: string,
  maxSessions: number,
  actorUserId: number | null = null
): Promise<{ updated: number }> {
  assertValidMaxSessions(maxSessions);
  if (!isWorkSlotType(slotType)) throw new Error("BAD_SLOT_TYPE");

  const links = await prisma.slotUserLink.findMany({
    where: {
      tenant_id: tenantId,
      ended_at: null,
      slot: { tenant_id: tenantId, slot_type: slotType, deleted_at: null }
    },
    select: { user_id: true }
  });
  const userIds = [...new Set(links.map((l) => l.user_id))];
  if (userIds.length > 0) {
    await prisma.user.updateMany({
      where: { tenant_id: tenantId, id: { in: userIds } },
      data: { max_sessions: maxSessions }
    });
  }

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: "work_slot",
    entityId: slotType,
    action: "work_slot.sessions.max_by_type",
    payload: { slot_type: slotType, max_sessions: maxSessions, updated: userIds.length }
  });

  return { updated: userIds.length };
}
