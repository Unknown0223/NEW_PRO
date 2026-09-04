import type { Prisma } from "@prisma/client";

/**
 * Foydalanuvchining faol slotiga bog‘liq yozuvlarni yangilash
 * (KPI target, KPI guruh aʼzolik, marshrut kunlari).
 */
export async function syncUserLinksToWorkSlotTx(
  tx: Prisma.TransactionClient,
  tenantId: number,
  userId: number,
  slotId: number | null
): Promise<void> {
  if (!Number.isFinite(userId) || userId < 1) return;

  await tx.salesKpiPlanTarget.updateMany({
    where: { tenant_id: tenantId, user_id: userId },
    data: { work_slot_id: slotId }
  });

  const groups = await tx.kpiGroup.findMany({
    where: { tenant_id: tenantId },
    select: { id: true }
  });
  if (groups.length > 0) {
    await tx.kpiGroupAgent.updateMany({
      where: {
        user_id: userId,
        kpi_group_id: { in: groups.map((g) => g.id) }
      },
      data: { work_slot_id: slotId }
    });
  }

  // Marshrut: faqat hali slot yozilmagan kunlar (mavjud snapshotni saqlash)
  if (slotId != null) {
    await tx.agentRouteDay.updateMany({
      where: { tenant_id: tenantId, agent_id: userId, work_slot_id: null },
      data: { work_slot_id: slotId }
    });
  }
}
