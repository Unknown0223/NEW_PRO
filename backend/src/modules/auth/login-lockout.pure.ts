/** Progressive account lockout after failed password attempts. */
export const LOGIN_LOCKOUT_DELAYS_MS = [
  0,
  0,
  0,
  30_000,
  120_000,
  900_000,
  3_600_000
] as const;

export type LoginLockoutDecision =
  | { action: "allow" }
  | { action: "reject_locked"; retryAfterMs: number };

export function decideLoginLockout(args: {
  nowMs: number;
  lockedUntilMs: number | null;
}): LoginLockoutDecision {
  if (args.lockedUntilMs == null || args.lockedUntilMs <= args.nowMs) {
    return { action: "allow" };
  }
  return {
    action: "reject_locked",
    retryAfterMs: args.lockedUntilMs - args.nowMs
  };
}

/** `failCount` — shu muvaffaqiyatsiz urinishdan keyingi jami son. */
export function nextLockedUntilMs(failCount: number, nowMs: number): number | null {
  const idx = Math.min(Math.max(failCount, 0), LOGIN_LOCKOUT_DELAYS_MS.length - 1);
  const delay = LOGIN_LOCKOUT_DELAYS_MS[idx] ?? 0;
  return delay > 0 ? nowMs + delay : null;
}

export function resetLockoutFields(): { failed_login_count: number; locked_until: null } {
  return { failed_login_count: 0, locked_until: null };
}
