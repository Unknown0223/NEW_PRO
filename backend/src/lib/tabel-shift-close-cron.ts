/**
 * Har 10 daqiqada smenasi tugagan xodimlarning oxirgi belgisini `out` qiladi
 * va belgi qo‘ymaganlarga `absent` yozadi.
 */
import { closeEndedShiftsAndMarkAbsent } from "../modules/tabel/tabel-shift-close.service";

const RUN_INTERVAL_MS = Number.parseInt(process.env.TABEL_SHIFT_CLOSE_MS ?? String(10 * 60 * 1000), 10);

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

export async function runTabelShiftCloseSweep(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const result = await closeEndedShiftsAndMarkAbsent();
    if (result.shiftsClosed > 0 || result.absentMarked > 0) {
      console.log(
        "[tabel-shift-close] tenants=%d closed=%d absent=%d",
        result.tenants,
        result.shiftsClosed,
        result.absentMarked
      );
    }
  } finally {
    running = false;
  }
}

export function enableTabelShiftCloseCron(): void {
  if (timer != null) return;
  setTimeout(() => {
    void runTabelShiftCloseSweep().catch((err) => console.error("[tabel-shift-close] error:", err));
  }, 45_000);
  timer = setInterval(() => {
    void runTabelShiftCloseSweep().catch((err) => console.error("[tabel-shift-close] error:", err));
  }, RUN_INTERVAL_MS);
  console.log("[tabel-shift-close] cron enabled (interval = %d ms)", RUN_INTERVAL_MS);
}

export function disableTabelShiftCloseCron(): void {
  if (timer != null) {
    clearInterval(timer);
    timer = null;
  }
}
