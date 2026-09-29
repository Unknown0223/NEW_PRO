/**
 * Payroll avtonom hisoblash:
 * - har 2 daqiqada: 2 daqiqadan ko'p «eskirgan» recordlarni qayta hisoblash (Redis/BullMQ bo'lmasa ham ishlaydi);
 * - kuniga bir marta (tenant vaqti 02:00 dan keyin): yangi oyni ochish, bonus biriktirmalarini ko'chirish,
 *   ochiq oylarni to'liq sweep (Qarzdorlik shu yerda yangi oyga o'tadi).
 * Bir nechta instansda parallel ishlamasligi uchun `pg_try_advisory_xact_lock`.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { ymdInTimeZone } from "./workday-calendar";
import { loadTenantTimezone } from "../modules/tenant-settings/tenant-timezone";
import { currentPayrollMonth, prevYm } from "../modules/payroll/payroll.dirty";

const CHECK_INTERVAL_MS = Number.parseInt(process.env.PAYROLL_CRON_MS ?? String(2 * 60 * 1000), 10);
const DIRTY_AGE_MS = 2 * 60 * 1000;
const DIRTY_BATCH = 300;
const NIGHTLY_HOUR = 2;
const LOCK_KEY = "payroll_cron";

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let running = false;
const nightlyDone = new Set<string>();

async function processDirty(tenantId: number): Promise<number> {
  const { recalcPayrollRecord } = await import("../modules/payroll/payroll.recalc");
  const { loadPayrollCalcContext } = await import("../modules/payroll/payroll.calc-context");
  const rows = await prisma.payrollRecord.findMany({
    where: { tenant_id: tenantId, dirty_at: { lt: new Date(Date.now() - DIRTY_AGE_MS) } },
    select: { user_id: true, year: true, month: true },
    orderBy: { dirty_at: "asc" },
    take: DIRTY_BATCH
  });
  if (!rows.length) return 0;
  const ctx = await loadPayrollCalcContext(tenantId);
  for (const r of rows) {
    await recalcPayrollRecord(tenantId, r.user_id, r.year, r.month, { trigger: "cron", ctx }).catch((e) =>
      console.error("[payroll-cron] recalc failed", { tenantId, userId: r.user_id, err: e instanceof Error ? e.message : e })
    );
  }
  return rows.length;
}

/** Oldingi oy bonus biriktirmalarini yangi oyga (agar yangi oyda hali yo'q bo'lsa). */
async function carryBonusAssignments(tenantId: number, year: number, month: number): Promise<number> {
  const exists = await prisma.payrollBonusAssignment.count({ where: { tenant_id: tenantId, year, month } });
  if (exists) return 0;
  const p = prevYm({ year, month });
  const prev = await prisma.payrollBonusAssignment.findMany({ where: { tenant_id: tenantId, year: p.year, month: p.month } });
  if (!prev.length) return 0;
  const formulas = new Map(
    (
      await prisma.payrollFormula.findMany({
        where: { tenant_id: tenantId, id: { in: [...new Set(prev.map((a) => a.formula_id))] }, is_active: true },
        select: { id: true, text: true }
      })
    ).map((f) => [f.id, f.text])
  );
  const res = await prisma.payrollBonusAssignment.createMany({
    data: prev
      .filter((a) => formulas.has(a.formula_id))
      .map((a) => ({
        tenant_id: tenantId,
        year,
        month,
        user_id: a.user_id,
        kpi_group_id: a.kpi_group_id,
        trade_direction_id: a.trade_direction_id,
        formula_id: a.formula_id,
        formula_text_snapshot: formulas.get(a.formula_id)!,
        target_item_id: a.target_item_id,
        created_by: a.created_by
      })),
    skipDuplicates: true
  });
  return res.count;
}

async function nightly(tenantId: number): Promise<void> {
  const tz = await loadTenantTimezone(tenantId);
  const now = new Date();
  const ymd = ymdInTimeZone(now, tz);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: tz }).format(now));
  const key = `${tenantId}:${ymd}`;
  if (hour < NIGHTLY_HOUR || nightlyDone.has(key)) return;
  nightlyDone.add(key);
  const { ensurePayrollPeriod, recalcPayrollMonth } = await import("../modules/payroll/payroll.recalc-month");
  const cur = await currentPayrollMonth(tenantId);
  const prev = prevYm(cur);
  await ensurePayrollPeriod(tenantId, cur.year, cur.month);
  const copied = await carryBonusAssignments(tenantId, cur.year, cur.month);
  const prevPeriod = await prisma.payrollPeriod.findUnique({
    where: { tenant_id_year_month: { tenant_id: tenantId, year: prev.year, month: prev.month } },
    select: { status: true }
  });
  if (prevPeriod?.status !== "closed") await recalcPayrollMonth(tenantId, prev.year, prev.month, { trigger: "nightly" });
  const sum = await recalcPayrollMonth(tenantId, cur.year, cur.month, { trigger: "nightly" });
  console.log("[payroll-cron] nightly tenant=%d copied_bonus=%d %j", tenantId, copied, sum);
}

export async function runPayrollCron(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await prisma.$transaction(
      async (tx) => {
        const got = await tx.$queryRaw<Array<{ ok: boolean }>>(Prisma.sql`SELECT pg_try_advisory_xact_lock(hashtext(${LOCK_KEY})) AS ok`);
        if (!got[0]?.ok) return;
        const tenants = await prisma.payrollSettings.findMany({ where: { enabled: true }, select: { tenant_id: true } });
        for (const t of tenants) {
          try {
            await processDirty(t.tenant_id);
            await nightly(t.tenant_id);
          } catch (e) {
            console.error("[payroll-cron] tenant failed", { tenantId: t.tenant_id, err: e instanceof Error ? e.message : e });
          }
        }
      },
      { timeout: 30 * 60 * 1000, maxWait: 10_000 }
    );
  } finally {
    running = false;
  }
}

export function enablePayrollCron(): void {
  if (intervalHandle != null) return;
  intervalHandle = setInterval(() => {
    void runPayrollCron().catch((err) => console.error("[payroll-cron] error:", err));
  }, CHECK_INTERVAL_MS);
  console.log("[payroll-cron] Timer started (interval = %d ms)", CHECK_INTERVAL_MS);
}

export function disablePayrollCron(): void {
  if (intervalHandle != null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
