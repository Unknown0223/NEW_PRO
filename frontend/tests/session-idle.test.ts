import { afterEach, describe, expect, it } from "vitest";
import {
  IDLE_TIMEOUT_DEFAULT_MS,
  IDLE_TIMEOUT_REMEMBER_MS,
  SESSION_ABSOLUTE_MAX_MS,
  clearWebSessionStarted,
  idleTimeoutMs,
  isWebSessionAbsoluteExpired,
  loginUrlWithReturn,
  markWebSessionStarted,
  safePostLoginPath
} from "@/lib/session-idle";

describe("session idle timeout", () => {
  afterEach(() => {
    clearWebSessionStarted();
  });

  it("без Запомнить — 15 минут", () => {
    expect(idleTimeoutMs(false)).toBe(IDLE_TIMEOUT_DEFAULT_MS);
    expect(IDLE_TIMEOUT_DEFAULT_MS).toBe(15 * 60 * 1000);
  });

  it("Запомнить — 1 час", () => {
    expect(idleTimeoutMs(true)).toBe(IDLE_TIMEOUT_REMEMBER_MS);
    expect(IDLE_TIMEOUT_REMEMBER_MS).toBe(60 * 60 * 1000);
  });

  it("абсолютный максимум — 1 час", () => {
    expect(SESSION_ABSOLUTE_MAX_MS).toBe(60 * 60 * 1000);
    markWebSessionStarted(1_000);
    expect(isWebSessionAbsoluteExpired(1_000 + SESSION_ABSOLUTE_MAX_MS - 1)).toBe(false);
    expect(isWebSessionAbsoluteExpired(1_000 + SESSION_ABSOLUTE_MAX_MS)).toBe(true);
  });

  it("login qaytish — oxirgi sahifa", () => {
    expect(safePostLoginPath("/tabel/marks?day=1")).toBe("/tabel/marks?day=1");
    expect(safePostLoginPath("/login")).toBe("/dashboard");
    expect(safePostLoginPath("//evil.example")).toBe("/dashboard");
    expect(loginUrlWithReturn("/warehouse/receipts", "?id=3")).toBe(
      "/login?from=%2Fwarehouse%2Freceipts%3Fid%3D3"
    );
  });
});
