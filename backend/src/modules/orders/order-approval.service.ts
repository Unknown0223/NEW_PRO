/**
 * Buyurtma tasdiqlash zanjiri — PlanApproverConfig + leaders dan zanjir yig‘ish va bosqichlar.
 */
import { prisma } from "../../config/database";
import type { Prisma } from "@prisma/client";

export type ApprovalChainStep = {
  user_id: number;
  name: string;
  role: string;
  kind: "level" | "leader";
};

export type OrderApprovalView = {
  approval_status: string | null;
  approval_step: number;
  approval_chain: ApprovalChainStep[];
  current_approver: ApprovalChainStep | null;
  can_advance: boolean;
};

function personName(u: { name: string | null; login: string }): string {
  const n = (u.name ?? "").trim();
  return n.length > 0 ? n : u.login;
}

async function resolveDirectionId(
  tenantId: number,
  agent: { trade_direction_id: number | null; trade_direction: string | null }
): Promise<number | null> {
  if (agent.trade_direction_id != null) return agent.trade_direction_id;
  const raw = (agent.trade_direction ?? "").trim();
  if (!raw) return null;
  const dir = await prisma.tradeDirection.findFirst({
    where: {
      tenant_id: tenantId,
      OR: [
        { code: { equals: raw, mode: "insensitive" } },
        { name: { equals: raw, mode: "insensitive" } }
      ]
    },
    select: { id: true }
  });
  return dir?.id ?? null;
}

/** Agent supervayzeri + yo‘nalish bo‘yicha tasdiqlash zanjirini yig‘adi. */
export async function resolveApprovalChainForAgent(
  tenantId: number,
  agentId: number
): Promise<ApprovalChainStep[]> {
  const agent = await prisma.user.findFirst({
    where: { id: agentId, tenant_id: tenantId },
    select: {
      supervisor_user_id: true,
      trade_direction_id: true,
      trade_direction: true
    }
  });
  if (!agent?.supervisor_user_id) return [];

  const directionId = await resolveDirectionId(tenantId, agent);
  if (directionId == null) return [];

  const config = await prisma.planApproverConfig.findFirst({
    where: {
      tenant_id: tenantId,
      direction_id: directionId,
      supervisor_user_id: agent.supervisor_user_id
    },
    select: {
      levels: {
        orderBy: { position: "asc" },
        select: {
          approver_user_id: true,
          approver: { select: { id: true, name: true, login: true, role: true } }
        }
      }
    }
  });

  const chain: ApprovalChainStep[] = [];
  for (const lvl of config?.levels ?? []) {
    if (lvl.approver_user_id == null || !lvl.approver) continue;
    chain.push({
      user_id: lvl.approver.id,
      name: personName(lvl.approver),
      role: lvl.approver.role,
      kind: "level"
    });
  }

  const leaders = await prisma.planApproverLeader.findMany({
    where: { tenant_id: tenantId },
    orderBy: { position: "asc" },
    select: {
      leader_user_id: true,
      leader: { select: { id: true, name: true, login: true, role: true } }
    }
  });
  for (const row of leaders) {
    chain.push({
      user_id: row.leader.id,
      name: personName(row.leader),
      role: row.leader.role,
      kind: "leader"
    });
  }

  return chain;
}

export function parseApprovalChain(raw: unknown): ApprovalChainStep[] {
  if (!Array.isArray(raw)) return [];
  const out: ApprovalChainStep[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const userId = Number(o.user_id);
    if (!Number.isInteger(userId) || userId < 1) continue;
    out.push({
      user_id: userId,
      name: typeof o.name === "string" ? o.name : `#${userId}`,
      role: typeof o.role === "string" ? o.role : "",
      kind: o.kind === "leader" ? "leader" : "level"
    });
  }
  return out;
}

export function buildApprovalView(
  approvalStatus: string | null,
  approvalStep: number,
  chain: ApprovalChainStep[],
  actorUserId: number | null,
  actorRole: string
): OrderApprovalView {
  const current = chain[approvalStep] ?? null;
  const canAdvance =
    approvalStatus === "pending" &&
    current != null &&
    (actorRole === "admin" || (actorUserId != null && actorUserId === current.user_id));

  return {
    approval_status: approvalStatus,
    approval_step: approvalStep,
    approval_chain: chain,
    current_approver: current,
    can_advance: canAdvance
  };
}

export async function getOrderApprovalView(
  tenantId: number,
  orderId: number,
  actorUserId: number | null,
  actorRole: string
): Promise<OrderApprovalView | null> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, tenant_id: tenantId },
    select: {
      approval_status: true,
      approval_step: true,
      approval_chain: true
    }
  });
  if (!order) return null;
  const chain = parseApprovalChain(order.approval_chain);
  return buildApprovalView(order.approval_status, order.approval_step, chain, actorUserId, actorRole);
}

/** new→confirmed urinishida zanjir bo‘lsa — pending holatga o‘tkazadi (status o‘zgarmaydi). */
export async function startOrderApprovalIfNeeded(
  tenantId: number,
  orderId: number,
  agentId: number | null
): Promise<{ started: boolean; chain: ApprovalChainStep[] }> {
  if (agentId == null) return { started: false, chain: [] };

  const existing = await prisma.order.findFirst({
    where: { id: orderId, tenant_id: tenantId },
    select: { approval_status: true, approval_chain: true }
  });
  if (!existing) return { started: false, chain: [] };
  if (existing.approval_status === "approved") return { started: false, chain: parseApprovalChain(existing.approval_chain) };
  if (existing.approval_status === "pending") {
    return { started: true, chain: parseApprovalChain(existing.approval_chain) };
  }

  const chain = await resolveApprovalChainForAgent(tenantId, agentId);
  if (chain.length === 0) return { started: false, chain: [] };

  await prisma.order.update({
    where: { id: orderId },
    data: {
      approval_status: "pending",
      approval_step: 0,
      approval_chain: chain as unknown as Prisma.InputJsonValue
    }
  });

  return { started: true, chain };
}

export async function advanceOrderApproval(
  tenantId: number,
  orderId: number,
  actorUserId: number,
  actorRole: string
): Promise<{ done: boolean; view: OrderApprovalView }> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, tenant_id: tenantId },
    select: {
      id: true,
      status: true,
      approval_status: true,
      approval_step: true,
      approval_chain: true
    }
  });
  if (!order) throw new Error("NOT_FOUND");
  if (order.approval_status !== "pending") throw new Error("APPROVAL_NOT_PENDING");

  const chain = parseApprovalChain(order.approval_chain);
  const current = chain[order.approval_step];
  if (!current) throw new Error("APPROVAL_COMPLETE");

  if (actorRole !== "admin" && actorUserId !== current.user_id) {
    throw new Error("FORBIDDEN_APPROVER");
  }

  const nextStep = order.approval_step + 1;
  if (nextStep >= chain.length) {
    await prisma.order.update({
      where: { id: order.id },
      data: { approval_status: "approved", approval_step: nextStep }
    });
    const view = buildApprovalView("approved", nextStep, chain, actorUserId, actorRole);
    return { done: true, view };
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { approval_step: nextStep }
  });
  const view = buildApprovalView("pending", nextStep, chain, actorUserId, actorRole);
  return { done: false, view };
}

export async function rejectOrderApproval(
  tenantId: number,
  orderId: number,
  actorUserId: number,
  actorRole: string
): Promise<OrderApprovalView> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, tenant_id: tenantId },
    select: {
      approval_status: true,
      approval_step: true,
      approval_chain: true
    }
  });
  if (!order) throw new Error("NOT_FOUND");
  if (order.approval_status !== "pending") throw new Error("APPROVAL_NOT_PENDING");

  const chain = parseApprovalChain(order.approval_chain);
  const current = chain[order.approval_step];
  if (actorRole !== "admin" && current && actorUserId !== current.user_id) {
    throw new Error("FORBIDDEN_APPROVER");
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { approval_status: "rejected" }
  });

  return buildApprovalView("rejected", order.approval_step, chain, actorUserId, actorRole);
}
