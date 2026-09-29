import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { loadTenantTimezone } from "../tenant-settings/tenant-timezone";
import { ymdInTimeZone } from "../../lib/workday-calendar";
import { enqueuePayrollRecalc, enqueuePayrollSweep } from "./payroll.jobs";

export type DirtyTarget = { userIds?: number[]; year?: number; month?: number };
type Ym = { year: number; month: number };

const ENABLED_TTL_MS = 30_000;
const enabledCache = new Map<number, { v: boolean; at: number }>();
const MAX_REASONS = 20;
const MAX_FANOUT_JOBS = 500;

export async function enabledCached(tenantId: number): Promise<boolean> {
  const hit = enabledCache.get(tenantId);
  if (hit && Date.now() - hit.at < ENABLED_TTL_MS) return hit.v;
  const row = await prisma.payrollSettings.findUnique({ where: { tenant_id: tenantId }, select: { enabled: true } });
  const v = Boolean(row?.enabled);
  enabledCache.set(tenantId, { v, at: Date.now() });
  return v;
}

export function invalidatePayrollEnabledCache(tenantId: number): void {
  enabledCache.delete(tenantId);
}

export async function currentPayrollMonth(tenantId: number): Promise<Ym> {
  const ymd = ymdInTimeZone(new Date(), await loadTenantTimezone(tenantId));
  return { year: Number(ymd.slice(0, 4)), month: Number(ymd.slice(5, 7)) };
}

export function prevYm({ year, month }: Ym): Ym {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export function nextYm({ year, month }: Ym): Ym {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

/** Joriy oy va yopilmagan o'tgan oy. */
async function openMonths(tenantId: number): Promise<Ym[]> {
  const cur = await currentPayrollMonth(tenantId);
  const prev = prevYm(cur);
  const closed = await prisma.payrollPeriod.findFirst({
    where: { tenant_id: tenantId, year: prev.year, month: prev.month, status: "closed" },
    select: { id: true }
  });
  return closed ? [cur] : [cur, prev];
}

const reasonSql = (reason: string) => Prisma.sql`
  CASE WHEN jsonb_array_length(payroll_records.dirty_reasons) < ${MAX_REASONS}
       THEN payroll_records.dirty_reasons || to_jsonb(${reason.slice(0, 40)}::text)
       ELSE payroll_records.dirty_reasons END`;

/**
 * Oylikni «eskirgan» deb belgilaydi va qayta hisoblashni navbatga qo'yadi.
 * Hech qachon xato tashlamaydi (asosiy oqimni buzmaslik uchun).
 */
export async function markPayrollDirty(tenantId: number, target: DirtyTarget, reason: string): Promise<void> {
  try {
    if (!(await enabledCached(tenantId))) return;
    const months: Ym[] =
      target.year && target.month ? [{ year: target.year, month: target.month }] : await openMonths(tenantId);
    const userIds = target.userIds ? [...new Set(target.userIds.filter((x) => Number.isInteger(x) && x > 0))] : null;
    if (userIds && userIds.length === 0) return;

    for (const ym of months) {
      if (userIds) {
        await prisma.$executeRaw`
          INSERT INTO payroll_records (tenant_id, user_id, year, month, dirty_at, dirty_reasons, updated_at)
          SELECT ${tenantId}, u.id, ${ym.year}, ${ym.month}, now(), jsonb_build_array(${reason.slice(0, 40)}::text), now()
          FROM users u
          WHERE u.tenant_id = ${tenantId} AND u.id = ANY(${userIds}::int[]) AND u.role <> 'admin'
          ON CONFLICT (tenant_id, user_id, year, month)
          DO UPDATE SET dirty_at = now(), dirty_reasons = ${reasonSql(reason)}`;
        for (const uid of userIds.slice(0, MAX_FANOUT_JOBS)) {
          await enqueuePayrollRecalc({ tenant_id: tenantId, user_id: uid, year: ym.year, month: ym.month });
        }
      } else {
        await prisma.$executeRaw`
          UPDATE payroll_records SET dirty_at = now(), dirty_reasons = ${reasonSql(reason)}
          WHERE tenant_id = ${tenantId} AND year = ${ym.year} AND month = ${ym.month}`;
        await enqueuePayrollSweep({ tenant_id: tenantId, year: ym.year, month: ym.month });
      }
    }
  } catch (e) {
    console.error("[payroll] markPayrollDirty failed", { tenantId, reason, err: e instanceof Error ? e.message : e });
  }
}

export function markPayrollDirtyForTenant(tenantId: number, reason: string): Promise<void> {
  return markPayrollDirty(tenantId, {}, reason);
}

/** Fire-and-forget: tranzaksiyadan keyin hook nuqtalarida. */
export function schedulePayrollDirty(tenantId: number, target: DirtyTarget, reason: string): void {
  void markPayrollDirty(tenantId, target, reason);
}

/** Sana (instant) → tenant oyi. */
export async function ymOfInstant(tenantId: number, at: Date): Promise<Ym> {
  const ymd = ymdInTimeZone(at, await loadTenantTimezone(tenantId));
  return { year: Number(ymd.slice(0, 4)), month: Number(ymd.slice(5, 7)) };
}
