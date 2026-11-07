/**
 * Tabel media/yuz retention — har kuni 03:00 va 04:00 (Asia/Tashkent).
 * Reja §5.5: rasm/video + bo‘shagan xodim yuzi. Shift-close alohida (10 daqiqa).
 */
import { purgeTabelMediaAndFaces } from "../modules/tabel/tabel-media-telegram.service";

const CHECK_INTERVAL_MS = Number.parseInt(process.env.TABEL_RETENTION_CRON_MS ?? String(15 * 60 * 1000), 10);
const TZ = process.env.TABEL_RETENTION_TZ ?? "Asia/Tashkent";
/** Reja: tungi 03:00 va 04:00. */
export const TABEL_RETENTION_HOURS = [3, 4] as const;

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;
const ranKeys = new Set<string>();

export function hourInTimeZone(now: Date, timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone }).format(now)
  );
}

export function ymdInTimeZone(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

export function shouldRunTabelRetentionAt(hour: number, hours: readonly number[] = TABEL_RETENTION_HOURS): boolean {
  return hours.includes(hour);
}

export async function runTabelRetentionSweep(now = new Date()): Promise<{
  skipped: boolean;
  key?: string;
  result?: Awaited<ReturnType<typeof purgeTabelMediaAndFaces>>;
}> {
  const hour = hourInTimeZone(now, TZ);
  if (!shouldRunTabelRetentionAt(hour)) return { skipped: true };
  const key = `${ymdInTimeZone(now, TZ)}:${hour}`;
  if (ranKeys.has(key)) return { skipped: true, key };
  if (running) return { skipped: true, key };
  running = true;
  try {
    ranKeys.add(key);
    // Eski kalitlarni tozalash (xotira)
    if (ranKeys.size > 8) {
      const keep = [...ranKeys].slice(-4);
      ranKeys.clear();
      keep.forEach((k) => ranKeys.add(k));
    }

    // API jarayonida tozalash (Redis/worker bo‘lmasa ham). BullMQ: `tabel_retention_purge` job.
    const result = await purgeTabelMediaAndFaces();

    if (result.photosPurged > 0 || result.videosPurged > 0 || result.facesPurged > 0) {
      console.log(
        "[tabel-retention] purged photos=%d videos=%d faces=%d tenants=%d key=%s",
        result.photosPurged,
        result.videosPurged,
        result.facesPurged,
        result.tenants,
        key
      );
    } else {
      console.log("[tabel-retention] nothing to purge key=%s", key);
    }
    return { skipped: false, key, result };
  } finally {
    running = false;
  }
}

export function enableTabelRetentionCron(): void {
  if (timer != null) return;
  setTimeout(() => {
    void runTabelRetentionSweep().catch((err) => console.error("[tabel-retention] error:", err));
  }, 120_000);
  timer = setInterval(() => {
    void runTabelRetentionSweep().catch((err) => console.error("[tabel-retention] error:", err));
  }, CHECK_INTERVAL_MS);
  console.log(
    "[tabel-retention] cron enabled (tz=%s hours=%s interval=%d ms)",
    TZ,
    TABEL_RETENTION_HOURS.join(","),
    CHECK_INTERVAL_MS
  );
}

export function disableTabelRetentionCron(): void {
  if (timer != null) {
    clearInterval(timer);
    timer = null;
  }
}
