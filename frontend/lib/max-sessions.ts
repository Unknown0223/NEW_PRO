/** 0 = cheksiz. Backend `User.max_sessions` bilan mos. */
export const UNLIMITED_MAX_SESSIONS = 0;
export const MAX_SESSIONS_CAP = 99;

export function isUnlimitedMaxSessions(n: number | null | undefined): boolean {
  return n === UNLIMITED_MAX_SESSIONS;
}

export function formatMaxSessionsLabel(n: number | null | undefined): string {
  if (isUnlimitedMaxSessions(n)) return "Неограниченно";
  return String(n ?? 1);
}

export function clampFiniteMaxSessions(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(MAX_SESSIONS_CAP, Math.max(1, Math.trunc(n)));
}

export function isValidMaxSessionsValue(n: number): boolean {
  return Number.isInteger(n) && n >= UNLIMITED_MAX_SESSIONS && n <= MAX_SESSIONS_CAP;
}
