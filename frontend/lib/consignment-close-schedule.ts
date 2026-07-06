export const CONSIGNMENT_CLOSE_DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1);
export const CONSIGNMENT_CLOSE_HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);
export const CONSIGNMENT_CLOSE_MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => i);

/** Konsignatsiya yopilish jadvali — ko‘rsatish matni. */
export function formatConsignmentCloseSchedule(
  day: number,
  hour: number,
  minute: number
): string {
  const h = String(hour).padStart(2, "0");
  const m = String(minute).padStart(2, "0");
  return `${day} число, ${h}:${m}`;
}

export function parseCloseTimeInput(raw: string): { hour: number; minute: number } | null {
  const t = raw.trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const hour = Number.parseInt(m[1]!, 10);
  const minute = Number.parseInt(m[2]!, 10);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

export function formatCloseTimeInput(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
