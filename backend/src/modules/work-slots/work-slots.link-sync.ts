import type { Prisma } from "@prisma/client";
import { loadTimezoneFromSettingsJson } from "../tenant-settings/tenant-timezone";
import { ymdInTimeZone } from "../../lib/workday-calendar";

async function currentTenantYearMonth(
  tx: Prisma.TransactionClient,
  tenantId: number
): Promise<{ year: number; month: number }> {
  const t = await tx.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  const ymd = ymdInTimeZone(new Date(), loadTimezoneFromSettingsJson(t?.settings ?? {}));
  return { year: Number(ymd.slice(0, 4)), month: Number(ymd.slice(5, 7)) };
}

/**
 * Foydalanuvchining faol slotiga bog‘liq yozuvlarni yangilash
 * (KPI target, KPI guruh aʼzolik, marshrut kunlari).
 *
 * KPI targetlar: o'tgan oylar tarixi o'zgarmaydi. Tayinlashda joriy va keyingi oylar,
 * chiqarishda faqat keyingi oylar yangilanadi (joriy oy rejasi o'rinda qoladi —
 * payroll uni ishlangan kunlarga bo'lib taqsimlaydi).
 */
export async function syncUserLinksToWorkSlotTx(
  tx: Prisma.TransactionClient,
  tenantId: number,
  userId: number,
  slotId: number | null
): Promise<void> {
  if (!Number.isFinite(userId) || userId < 1) return;

  const { year, month } = await currentTenantYearMonth(tx, tenantId);
  const monthFilter: Prisma.SalesKpiPlanWhereInput =
    slotId != null
      ? { OR: [{ year: { gt: year } }, { year, month: { gte: month } }] }
      : { OR: [{ year: { gt: year } }, { year, month: { gt: month } }] };

  await tx.salesKpiPlanTarget.updateMany({
    where: { tenant_id: tenantId, user_id: userId, plan: monthFilter },
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
