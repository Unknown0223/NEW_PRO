import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { logger } from "../../config/logger";
import { tenantMonthRangeUtc, ymdOf } from "../../lib/workday-calendar";
import { loadPayrollCalcContext } from "./payroll.calc-context";
import { prevYm } from "./payroll.dirty";
import { recalcPayrollRecord } from "./payroll.recalc";
import { isPayrollEnabled } from "./payroll.settings";

export async function ensurePayrollPeriod(tenantId: number, year: number, month: number) {
  return prisma.payrollPeriod.upsert({
    where: { tenant_id_year_month: { tenant_id: tenantId, year, month } },
    create: { tenant_id: tenantId, year, month },
    update: {}
  });
}

/**
 * Oy ro'yxatiga kiradiganlar: mavjud recordlar, oyda o'rin oralig'i bo'lganlar, zakaz fakti,
 * tabelda belgilanganlar, avansi borlar, oldingi oy qoldig'i ≠ 0, oklad sozlangan va shu oyda ishlaganlar.
 */
export async function listPayrollCandidateUserIds(tenantId: number, year: number, month: number, timeZone: string): Promise<number[]> {
  const { from, to } = tenantMonthRangeUtc(year, month, timeZone);
  const p = prevYm({ year, month });
  const prefix = ymdOf(year, month, 1).slice(0, 7);
  const [records, links, orders, advances, prevRecs, empCfg, roleCfg, tenant] = await Promise.all([
    prisma.payrollRecord.findMany({ where: { tenant_id: tenantId, year, month }, select: { user_id: true } }),
    prisma.slotUserLink.findMany({
      where: { tenant_id: tenantId, started_at: { lt: to }, OR: [{ ended_at: null }, { ended_at: { gt: from } }] },
      select: { user_id: true },
      distinct: ["user_id"]
    }),
    prisma.$queryRaw<Array<{ uid: number }>>(Prisma.sql`
      SELECT DISTINCT u.uid FROM (
        SELECT o.agent_id AS uid FROM orders o
        WHERE o.tenant_id = ${tenantId} AND o.agent_id IS NOT NULL AND o.updated_at >= ${from}
        UNION
        SELECT o.expeditor_user_id AS uid FROM orders o
        WHERE o.tenant_id = ${tenantId} AND o.expeditor_user_id IS NOT NULL AND o.updated_at >= ${from}
      ) u`),
    prisma.payrollAdvance.findMany({
      where: { tenant_id: tenantId, year, month, status: { notIn: ["cancelled", "rejected"] } },
      select: { user_id: true },
      distinct: ["user_id"]
    }),
    prisma.payrollRecord.findMany({
      where: { tenant_id: tenantId, year: p.year, month: p.month, NOT: { balance: 0 } },
      select: { user_id: true }
    }),
    prisma.payrollEmployeeConfig.findMany({ where: { tenant_id: tenantId }, select: { user_id: true } }),
    prisma.payrollRoleConfig.findMany({ where: { tenant_id: tenantId }, select: { role: true } }),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } })
  ]);
  const ids = new Set<number>();
  for (const r of [...records, ...links, ...advances, ...prevRecs]) ids.add(r.user_id);
  for (const o of orders) ids.add(Number(o.uid));
  const ts = (tenant?.settings as { timesheet?: { overrides?: Record<string, unknown> } } | null)?.timesheet?.overrides ?? {};
  for (const key of Object.keys(ts)) {
    const [uid, date] = key.split(":");
    if (date?.startsWith(prefix)) ids.add(Number(uid));
  }
  const configured = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      OR: [{ id: { in: empCfg.map((e) => e.user_id) } }, { role: { in: roleCfg.map((r) => r.role) } }],
      AND: [
        { OR: [{ hired_at: null }, { hired_at: { lt: to } }] },
        { OR: [{ dismissed_at: null }, { dismissed_at: { gte: from } }] }
      ]
    },
    select: { id: true }
  });
  configured.forEach((u) => ids.add(u.id));
  if (!ids.size) return [];
  const users = await prisma.user.findMany({
    where: { tenant_id: tenantId, id: { in: [...ids] }, NOT: { role: "admin" } },
    select: { id: true, hired_at: true, dismissed_at: true }
  });
  const hasRecord = new Set(records.map((r) => r.user_id));
  return users
    .filter((u) => hasRecord.has(u.id) || ((!u.hired_at || u.hired_at < to) && (!u.dismissed_at || u.dismissed_at >= from)))
    .map((u) => u.id)
    .sort((a, b) => a - b);
}

export type MonthRecalcSummary = { processed: number; updated: number; unchanged: number; errors: number; skipped: number };

export async function recalcPayrollMonth(
  tenantId: number,
  year: number,
  month: number,
  opts: { trigger: string; force?: boolean; userIds?: number[]; onlyDirty?: boolean }
): Promise<MonthRecalcSummary> {
  const sum: MonthRecalcSummary = { processed: 0, updated: 0, unchanged: 0, errors: 0, skipped: 0 };
  if (!(await isPayrollEnabled(tenantId))) return sum;
  await ensurePayrollPeriod(tenantId, year, month);
  const ctx = await loadPayrollCalcContext(tenantId);
  let ids: number[];
  if (opts.userIds?.length) ids = opts.userIds;
  else if (opts.onlyDirty) {
    ids = (
      await prisma.payrollRecord.findMany({
        where: { tenant_id: tenantId, year, month, NOT: { dirty_at: null } },
        select: { user_id: true }
      })
    ).map((r) => r.user_id);
  } else ids = await listPayrollCandidateUserIds(tenantId, year, month, ctx.env.timeZone);

  for (const uid of ids) {
    sum.processed++;
    try {
      const r = await recalcPayrollRecord(tenantId, uid, year, month, { trigger: opts.trigger, force: opts.force, ctx });
      if (r.status === "updated" || r.status === "frozen") sum.updated++;
      else if (r.status === "unchanged") sum.unchanged++;
      else if (r.status === "error") sum.errors++;
      else sum.skipped++;
    } catch (e) {
      sum.errors++;
      logger.warn({ err: e, tenantId, uid, year, month }, "payroll month recalc user failed");
    }
  }
  return sum;
}
