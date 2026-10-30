import { z } from "zod";

/** 0 = cheksiz (login paytida limit tekshirilmaydi). */
export const UNLIMITED_MAX_SESSIONS = 0;
export const MAX_SESSIONS_CAP = 99;

export const maxSessionsValueSchema = z.number().int().min(0).max(MAX_SESSIONS_CAP);

export function isUnlimitedMaxSessions(n: number | null | undefined): boolean {
  return n === UNLIMITED_MAX_SESSIONS;
}

export function isValidMaxSessions(n: unknown): n is number {
  return Number.isInteger(n) && (n as number) >= UNLIMITED_MAX_SESSIONS && (n as number) <= MAX_SESSIONS_CAP;
}

export function assertValidMaxSessions(n: unknown): asserts n is number {
  if (!isValidMaxSessions(n)) throw new Error("BAD_MAX_SESSIONS");
}

/** Create form: 0 saqlanadi; noto‘g‘ri / bo‘sh → fallback (odatda 1). */
export function normalizeMaxSessionsOrDefault(n: number | null | undefined, fallback = 1): number {
  if (n == null || !isValidMaxSessions(n)) return fallback;
  return n;
}

/** Adjust bulk: cheksiz (0) o‘zgarmaydi. */
export function clampAdjustedMaxSessions(current: number, delta: number): number {
  if (isUnlimitedMaxSessions(current)) return UNLIMITED_MAX_SESSIONS;
  return Math.min(MAX_SESSIONS_CAP, Math.max(1, current + delta));
}

export function isSessionLimitReached(
  activeCount: number,
  maxSessions: number | null | undefined
): boolean {
  const cap = maxSessions ?? 1;
  if (isUnlimitedMaxSessions(cap)) return false;
  return activeCount >= Math.max(1, cap);
}
