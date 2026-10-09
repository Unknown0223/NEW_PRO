import { describe, expect, it } from "vitest";
import {
  MAX_SESSIONS_CAP,
  UNLIMITED_MAX_SESSIONS,
  clampAdjustedMaxSessions,
  isSessionLimitReached,
  isUnlimitedMaxSessions,
  isValidMaxSessions,
  maxSessionsValueSchema,
  normalizeMaxSessionsOrDefault
} from "../src/lib/max-sessions";

describe("max-sessions", () => {
  it("treats 0 as unlimited", () => {
    expect(isUnlimitedMaxSessions(UNLIMITED_MAX_SESSIONS)).toBe(true);
    expect(isUnlimitedMaxSessions(1)).toBe(false);
    expect(isValidMaxSessions(0)).toBe(true);
    expect(isValidMaxSessions(MAX_SESSIONS_CAP)).toBe(true);
    expect(isValidMaxSessions(100)).toBe(false);
    expect(isValidMaxSessions(-1)).toBe(false);
  });

  it("does not enforce a limit when unlimited", () => {
    expect(isSessionLimitReached(0, 0)).toBe(false);
    expect(isSessionLimitReached(50, 0)).toBe(false);
    expect(isSessionLimitReached(1, 1)).toBe(true);
    expect(isSessionLimitReached(0, 1)).toBe(false);
    expect(isSessionLimitReached(2, null)).toBe(true);
  });

  it("keeps 0 on create normalize", () => {
    expect(normalizeMaxSessionsOrDefault(0)).toBe(0);
    expect(normalizeMaxSessionsOrDefault(undefined)).toBe(1);
    expect(normalizeMaxSessionsOrDefault(5)).toBe(5);
  });

  it("does not clamp unlimited when adjusting", () => {
    expect(clampAdjustedMaxSessions(0, 1)).toBe(0);
    expect(clampAdjustedMaxSessions(2, 1)).toBe(3);
    expect(clampAdjustedMaxSessions(99, 1)).toBe(99);
  });

  it("zod accepts 0..99", () => {
    expect(maxSessionsValueSchema.parse(0)).toBe(0);
    expect(maxSessionsValueSchema.parse(12)).toBe(12);
    expect(maxSessionsValueSchema.safeParse(100).success).toBe(false);
  });
});
