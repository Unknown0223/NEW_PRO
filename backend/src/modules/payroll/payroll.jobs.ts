import { getBackgroundQueue } from "../../jobs/background-queue";

export const PAYROLL_RECALC_JOB = "payroll_recalc";
export const PAYROLL_SWEEP_JOB = "payroll_sweep";

export type PayrollRecalcJobData = { tenant_id: number; user_id: number; year: number; month: number };
export type PayrollSweepJobData = { tenant_id: number; year: number; month: number };

const ENQUEUE_TIMEOUT_MS = 2000;
const RECALC_DELAY_MS = 30_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("ENQUEUE_TIMEOUT")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

function ymKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Bir xil (tenant, xodim, oy) uchun 30s ichidagi o'zgarishlar bitta hisoblashga birlashadi. */
export async function enqueuePayrollRecalc(data: PayrollRecalcJobData, delayMs = RECALC_DELAY_MS): Promise<void> {
  try {
    const q = getBackgroundQueue();
    await withTimeout(
      q.add(PAYROLL_RECALC_JOB, data, {
        jobId: `payroll-${data.tenant_id}-${data.user_id}-${ymKey(data.year, data.month)}`,
        delay: delayMs,
        removeOnComplete: true,
        removeOnFail: 200,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 }
      }),
      ENQUEUE_TIMEOUT_MS
    );
  } catch {
    // Redis yo'q: dirty belgisi qoladi, `payroll-cron` uni oladi.
  }
}

export async function enqueuePayrollSweep(data: PayrollSweepJobData, delayMs = RECALC_DELAY_MS): Promise<void> {
  try {
    const q = getBackgroundQueue();
    await withTimeout(
      q.add(PAYROLL_SWEEP_JOB, data, {
        jobId: `payroll-sweep-${data.tenant_id}-${ymKey(data.year, data.month)}`,
        delay: delayMs,
        removeOnComplete: true,
        removeOnFail: 50,
        attempts: 2
      }),
      ENQUEUE_TIMEOUT_MS
    );
  } catch {
    // cron fallback
  }
}

export async function processPayrollRecalcJob(data: PayrollRecalcJobData): Promise<unknown> {
  const { recalcPayrollRecord } = await import("./payroll.recalc");
  return recalcPayrollRecord(data.tenant_id, data.user_id, data.year, data.month, { trigger: "job" });
}

export async function processPayrollSweepJob(data: PayrollSweepJobData): Promise<unknown> {
  const { recalcPayrollMonth } = await import("./payroll.recalc-month");
  return recalcPayrollMonth(data.tenant_id, data.year, data.month, { trigger: "sweep" });
}
