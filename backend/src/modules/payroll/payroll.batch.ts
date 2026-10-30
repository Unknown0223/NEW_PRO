import { logger } from "../../config/logger";

const DEBOUNCE_MS = 400;
const MAX_WAIT_MS = 2_000;

type Slot = {
  all: boolean;
  ids: Set<number>;
  timer: ReturnType<typeof setTimeout>;
  started: number;
};

const pending = new Map<string, Slot>();
const running = new Map<string, Promise<void>>();

/**
 * Bir oy ichidagi qayta hisoblarni bitta ishga yig'adi.
 * `userIds === null` — shu oyda eskirgan barcha yozuvlar.
 */
export function schedulePayrollBatch(tenantId: number, year: number, month: number, userIds: number[] | null): void {
  const key = `${tenantId}:${year}:${month}`;
  const now = Date.now();
  let slot = pending.get(key);
  if (!slot) {
    slot = { all: false, ids: new Set(), started: now, timer: setTimeout(() => undefined, DEBOUNCE_MS) };
    pending.set(key, slot);
  }
  if (userIds == null) slot.all = true;
  else for (const id of userIds) slot.ids.add(id);
  clearTimeout(slot.timer);
  const delay = Math.min(DEBOUNCE_MS, Math.max(0, slot.started + MAX_WAIT_MS - now));
  slot.timer = setTimeout(() => {
    void flush(key, tenantId, year, month);
  }, delay);
}

async function flush(key: string, tenantId: number, year: number, month: number): Promise<void> {
  const slot = pending.get(key);
  if (!slot) return;
  pending.delete(key);
  clearTimeout(slot.timer);
  if (!slot.all && slot.ids.size === 0) return;
  const prev = running.get(key);
  const run = (async () => {
    if (prev) await prev.catch(() => undefined);
    const { recalcPayrollMonth } = await import("./payroll.recalc-month");
    const sum = await recalcPayrollMonth(tenantId, year, month, {
      trigger: "batch",
      userIds: slot.all ? undefined : [...slot.ids],
      onlyDirty: slot.all
    });
    logger.info({ tenantId, year, month, ...sum }, "payroll batch recalc");
  })().catch((e) => {
    logger.warn({ err: e, tenantId, year, month }, "payroll batch recalc failed");
  });
  running.set(key, run);
  try {
    await run;
  } finally {
    if (running.get(key) === run) running.delete(key);
  }
}
