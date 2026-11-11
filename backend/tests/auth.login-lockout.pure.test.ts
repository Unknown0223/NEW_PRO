import { describe, expect, it } from "vitest";
import {
  decideLoginLockout,
  nextLockedUntilMs,
  resetLockoutFields
} from "../src/modules/auth/login-lockout.pure";
import {
  isPasswordAllowed,
  passwordPolicyError,
  PASSWORD_MIN_LEN
} from "../src/modules/auth/password-policy.pure";

describe("decideLoginLockout", () => {
  it("allows when not locked", () => {
    expect(decideLoginLockout({ nowMs: 1000, lockedUntilMs: null })).toEqual({ action: "allow" });
    expect(decideLoginLockout({ nowMs: 1000, lockedUntilMs: 500 })).toEqual({ action: "allow" });
  });

  it("rejects while locked", () => {
    expect(decideLoginLockout({ nowMs: 1000, lockedUntilMs: 1500 })).toEqual({
      action: "reject_locked",
      retryAfterMs: 500
    });
  });
});

describe("nextLockedUntilMs", () => {
  it("stays unlocked for early failures", () => {
    expect(nextLockedUntilMs(1, 10_000)).toBeNull();
    expect(nextLockedUntilMs(2, 10_000)).toBeNull();
    expect(nextLockedUntilMs(3, 10_000)).toBe(40_000);
  });

  it("caps at longest delay", () => {
    expect(nextLockedUntilMs(99, 0)).toBe(3_600_000);
  });
});

describe("resetLockoutFields", () => {
  it("clears counters", () => {
    expect(resetLockoutFields()).toEqual({ failed_login_count: 0, locked_until: null });
  });
});

describe("password policy", () => {
  it(`requires min ${PASSWORD_MIN_LEN} with letter and digit`, () => {
    expect(passwordPolicyError("short1")).toBe("TOO_SHORT");
    expect(passwordPolicyError("password")).toBe("TOO_WEAK");
    expect(passwordPolicyError("12345678")).toBe("TOO_WEAK");
    expect(isPasswordAllowed("Parol123!")).toBe(true);
  });
});
