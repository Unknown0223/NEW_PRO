import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { sumUnpaidDeliveredRemainderForAgent } from "../client-balances/client-debt-by-agent";

/**
 * Slotdan chiqqan agentning unpaid delivered qarzlari 0 bo‘lsa — is_active=false.
 * Faol SlotUserLink bo‘lsa yoki qarz qolgan bo‘lsa — tegilmaydi.
 */
export async function maybeArchiveAgentsIfDebtCleared(
  tenantId: number,
  agentIds: number[],
  actorUserId: number | null,
  tx?: Prisma.TransactionClient
): Promise<number[]> {
  const unique = [
    ...new Set(
      agentIds.filter((id) => Number.isFinite(id) && id > 0).map((id) => Number(id))
    )
  ];
  if (unique.length === 0) return [];

  const db = tx ?? prisma;
  const archived: number[] = [];

  for (const agentId of unique) {
    const user = await db.user.findFirst({
      where: { id: agentId, tenant_id: tenantId, role: "agent", is_active: true },
      select: { id: true }
    });
    if (!user) continue;

    const activeLink = await db.slotUserLink.findFirst({
      where: { tenant_id: tenantId, user_id: agentId, ended_at: null },
      select: { id: true }
    });
    if (activeLink) continue;

    const unpaid = await sumUnpaidDeliveredRemainderForAgent(tenantId, agentId, db);
    if (unpaid.gt(0.01)) continue;

    await db.user.update({
      where: { id: agentId },
      data: { is_active: false }
    });
    archived.push(agentId);

    if (actorUserId) {
      await appendTenantAuditEvent({
        tenantId,
        actorUserId,
        entityType: AuditEntityType.user,
        entityId: String(agentId),
        action: "user.auto_archive_debt_cleared",
        payload: { agent_id: agentId, unpaid: unpaid.toString() }
      });
    }
  }

  return archived;
}
