import type { AgentMobileSyncConfig } from "./agent-mobile-config.types";

export type SyncPolicyResult = { allowed: boolean; message?: string };

/**
 * Sinxron oynasi qaysi vaqt mintaqasida tekshiriladi.
 *
 * MUHIM: server jarayonining mintaqasiga (`Date#getHours`, odatda UTC)
 * tayanmaymiz — admin «08:00–17:30»ni firma (ish mintaqasi) vaqtida kiritadi.
 * Aks holda oyna ~5 soatga siljiydi va sinxron noto‘g‘ri rad/ruxsat etiladi.
 */
export const MOBILE_SYNC_TIME_ZONE = "Asia/Tashkent";

/** Berilgan instant uchun IANA mintaqadagi kun daqiqasi (0..1439). */
export function minutesOfDayInTimeZone(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(instant);
  let h = 0;
  let m = 0;
  for (const p of parts) {
    if (p.type === "hour") h = Number(p.value) % 24;
    else if (p.type === "minute") m = Number(p.value);
  }
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function parseHm(hm: string): number | null {
  const p = hm.trim().split(":");
  if (p.length < 2) return null;
  const h = Number(p[0]);
  const m = Number(p[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function isSyncAllowedNowForMinutes(sync: AgentMobileSyncConfig, minutes: number): boolean {
  const from = sync.allowed_window_from?.trim();
  const to = sync.allowed_window_to?.trim();
  if ((!from || !from.length) && (!to || !to.length)) return true;

  const fromM = from && from.length ? parseHm(from) : null;
  const toM = to && to.length ? parseHm(to) : null;
  if (fromM == null && toM == null) return true;
  if (fromM != null && toM != null) {
    if (fromM <= toM) return minutes >= fromM && minutes <= toM;
    return minutes >= fromM || minutes <= toM;
  }
  if (fromM != null) return minutes >= fromM;
  return minutes <= (toM ?? 24 * 60);
}

export function syncWindowMessage(sync: AgentMobileSyncConfig): string {
  const from = sync.allowed_window_from ?? "—";
  const to = sync.allowed_window_to ?? "—";
  return `Sinxron faqat ${from} – ${to} oralig'ida mumkin`;
}

/**
 * Mobil `evaluateSyncPolicy` bilan bir xil mantiq, lekin oyna firma vaqt
 * mintaqasida ([timeZone], standart Asia/Tashkent) tekshiriladi — server
 * jarayonining mintaqasiga bog‘liq emas.
 */
export function evaluateMobileSyncPolicy(
  sync: AgentMobileSyncConfig | undefined,
  now: Date = new Date(),
  timeZone: string = MOBILE_SYNC_TIME_ZONE
): SyncPolicyResult {
  if (!sync) return { allowed: true };
  if (sync.block_sync) {
    return { allowed: false, message: "Sinxronizatsiya bloklangan" };
  }
  const minutes = minutesOfDayInTimeZone(now, timeZone);
  if (!isSyncAllowedNowForMinutes(sync, minutes)) {
    return { allowed: false, message: syncWindowMessage(sync) };
  }
  return { allowed: true };
}
