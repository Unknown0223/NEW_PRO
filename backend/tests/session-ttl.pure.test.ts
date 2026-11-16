import { describe, expect, it } from "vitest";
import {
  MOBILE_REFRESH_TOKEN_TTL_MS,
  MOBILE_SESSION_UA_PREFIX,
  WEB_REFRESH_TOKEN_TTL_MS,
  isMobileSessionUserAgent,
  mobileSessionUserAgent,
  refreshExpiresAt,
  refreshTtlMs,
  sessionClientKindFromApk
} from "../src/modules/auth/session-ttl";

describe("session-ttl", () => {
  it("apk → mobile, yo‘q → web", () => {
    expect(sessionClientKindFromApk("3.2.8")).toBe("mobile");
    expect(sessionClientKindFromApk("")).toBe("web");
    expect(sessionClientKindFromApk(null)).toBe("web");
  });

  it("web 1 soat, mobile 30 kun", () => {
    expect(refreshTtlMs("web")).toBe(WEB_REFRESH_TOKEN_TTL_MS);
    expect(refreshTtlMs("mobile")).toBe(MOBILE_REFRESH_TOKEN_TTL_MS);
    expect(WEB_REFRESH_TOKEN_TTL_MS).toBe(60 * 60 * 1000);
    expect(MOBILE_REFRESH_TOKEN_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("refreshExpiresAt kind bo‘yicha", () => {
    const t0 = Date.UTC(2026, 10, 16, 6, 0, 0);
    expect(refreshExpiresAt(t0, "web").getTime()).toBe(t0 + WEB_REFRESH_TOKEN_TTL_MS);
    expect(refreshExpiresAt(t0, "mobile").getTime()).toBe(t0 + MOBILE_REFRESH_TOKEN_TTL_MS);
  });

  it("mobile user_agent prefix", () => {
    const ua = mobileSessionUserAgent("3.2.8", "okhttp/4");
    expect(ua.startsWith(MOBILE_SESSION_UA_PREFIX)).toBe(true);
    expect(isMobileSessionUserAgent(ua)).toBe(true);
    expect(isMobileSessionUserAgent("Mozilla/5.0")).toBe(false);
  });
});
