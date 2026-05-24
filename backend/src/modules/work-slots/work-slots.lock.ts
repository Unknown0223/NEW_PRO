import { prisma } from "../../config/database";
import type { AutoAssignStatus, LockType, PendingAssignmentRow } from "./work-slots.types";

export async function patchAssignmentLock(
  tenantId: number,
  assignmentId: number,
  lockType: LockType,
  lockReason: string | null,
  actorId: number | null
) {
  if (lockType !== "none" && !(lockReason?.trim())) {
    throw new Error("LOCK_REASON_REQUIRED");
  }

  const row = await prisma.clientAgentAssignment.findFirst({
    where: { id: assignmentId, tenant_id: tenantId },
    select: { id: true }
  });
  if (!row) throw new Error("NOT_FOUND");

  const autoStatus: AutoAssignStatus =
    lockType === "contract" ? "locked" : lockType === "manual" ? "assigned" : "assigned";

  return prisma.clientAgentAssignment.update({
    where: { id: assignmentId },
    data: {
      lock_type: lockType,
      lock_reason: lockType === "none" ? null : lockReason?.trim() ?? null,
      lock_set_by: lockType === "none" ? null : actorId,
      auto_assign_status: autoStatus
    }
  });
}

export async function listPendingAssignments(
  tenantId: number,
  page = 1,
  limit = 50
): Promise<{ data: PendingAssignmentRow[]; total: number }> {
  const skip = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit));
  const take = Math.min(100, Math.max(1, limit));

  const [rows, total] = await Promise.all([
    prisma.clientAgentAssignment.findMany({
      where: { tenant_id: tenantId, auto_assign_status: "pending_review" },
      skip,
      take,
      orderBy: { updated_at: "desc" },
      include: {
        client: { select: { id: true, name: true } },
        agent: { select: { id: true, name: true } }
      }
    }),
    prisma.clientAgentAssignment.count({
      where: { tenant_id: tenantId, auto_assign_status: "pending_review" }
    })
  ]);

  return {
    data: rows.map((r) => ({
      id: r.id,
      client_id: r.client_id,
      client_name: r.client.name,
      slot: r.slot,
      agent_id: r.agent_id,
      agent_name: r.agent?.name ?? null,
      lock_type: r.lock_type,
      auto_assign_status: r.auto_assign_status
    })),
    total
  };
}

export async function resolvePendingAssignment(
  tenantId: number,
  assignmentId: number,
  agentId: number | null,
  lockAfter: boolean,
  actorId: number | null
) {
  const row = await prisma.clientAgentAssignment.findFirst({
    where: { id: assignmentId, tenant_id: tenantId, auto_assign_status: "pending_review" },
    select: { id: true, client_id: true, slot: true }
  });
  if (!row) throw new Error("NOT_FOUND");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.clientAgentAssignment.update({
      where: { id: assignmentId },
      data: {
        agent_id: agentId,
        auto_assign_status: lockAfter ? "locked" : "assigned",
        lock_type: lockAfter ? "manual" : "none",
        lock_reason: lockAfter ? "Supervisor qarori" : null,
        lock_set_by: lockAfter ? actorId : null
      }
    });

    if (row.slot === 1 && agentId != null) {
      await tx.client.update({
        where: { id: row.client_id },
        data: { agent_id: agentId }
      });
    }

    return updated;
  });
}

/** Ikki qoida mos kelsa — pending_review (auto-assign tiebreaker). */
export async function markAssignmentPendingReview(tenantId: number, assignmentId: number): Promise<void> {
  await prisma.clientAgentAssignment.updateMany({
    where: { id: assignmentId, tenant_id: tenantId },
    data: { auto_assign_status: "pending_review", agent_id: null }
  });
}

export async function countPendingReviews(tenantId: number): Promise<number> {
  return prisma.clientAgentAssignment.count({
    where: { tenant_id: tenantId, auto_assign_status: "pending_review" }
  });
}

/** Zakaz yaratishda contract qulflash tekshiruvi. */
export async function assertOrderAgentAllowedForClient(
  tenantId: number,
  clientId: number,
  agentId: number | null
): Promise<void> {
  if (agentId == null) return;
  const a = await prisma.clientAgentAssignment.findFirst({
    where: { tenant_id: tenantId, client_id: clientId, slot: 1 },
    select: { lock_type: true, agent_id: true }
  });
  if (
    a?.lock_type === "contract" &&
    a.agent_id != null &&
    a.agent_id !== agentId
  ) {
    throw new Error("CONTRACT_AGENT_MISMATCH");
  }
}
