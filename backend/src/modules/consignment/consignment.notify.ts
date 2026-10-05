import { prisma } from "../../config/database";
import { logger } from "../../config/logger";
import { notifyUsers } from "../payroll/payroll.notify";

export type AgentConsignmentSnapshot = Map<number, { consignment: boolean; limit: string | null }>;

export async function snapshotAgentConsignment(tenantId: number, userIds: number[]): Promise<AgentConsignmentSnapshot> {
  const rows = await prisma.user.findMany({
    where: { tenant_id: tenantId, id: { in: userIds } },
    select: { id: true, consignment: true, consignment_limit_amount: true }
  });
  return new Map(rows.map((r) => [r.id, { consignment: r.consignment === true, limit: r.consignment_limit_amount?.toString() ?? null }]));
}

const sum = (v: string | null) => (v == null ? "без лимита" : `${Math.round(Number(v)).toLocaleString("ru-RU")} сум`);

/** O'zgarishlarni topish (sof) — test uchun alohida. */
export function diffConsignment(
  before: { consignment: boolean; limit: string | null } | undefined,
  after: { consignment: boolean; limit: string | null }
): { title: string; body: string | null } | null {
  if (!before) return null;
  if (!before.consignment && after.consignment) {
    return { title: "🧾 Вам открыта консигнация", body: `Лимит: ${sum(after.limit)}` };
  }
  if (before.consignment && !after.consignment) return { title: "⛔ Консигнация закрыта", body: null };
  const a = before.limit == null ? null : Number(before.limit);
  const b = after.limit == null ? null : Number(after.limit);
  if (a !== b && after.consignment) {
    const up = b == null || (a != null && b > a);
    return { title: `${up ? "📈" : "📉"} Лимит консигнации изменён`, body: `${sum(before.limit)} → ${sum(after.limit)}` };
  }
  return null;
}

/** Oldingi holat bilan solishtirib, faqat o'zgargan agentlarga xabar. */
export async function notifyConsignmentChanges(tenantId: number, before: AgentConsignmentSnapshot, actorUserId: number | null): Promise<void> {
  try {
    const after = await snapshotAgentConsignment(tenantId, [...before.keys()]);
    for (const [uid, cur] of after) {
      if (uid === actorUserId) continue;
      const d = diffConsignment(before.get(uid), cur);
      if (d) await notifyUsers(tenantId, [uid], { title: d.title, body: d.body, href: "/client-balances/consignment" });
    }
  } catch (e) {
    logger.warn({ err: e, tenantId }, "consignment notify failed");
  }
}
