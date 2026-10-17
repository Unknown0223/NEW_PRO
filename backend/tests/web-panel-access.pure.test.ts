import { describe, expect, it } from "vitest";
import {
  WEB_ACCESS_DENIED,
  assertWebPanelBrowserAllowed,
  assertWebPanelLoginAllowed,
  isBrowserWebRequest,
  isMobileAppLogin
} from "../src/modules/auth/web-panel-access";
import { isWebPanelDeniedRole } from "../src/lib/tenant-user-roles";

describe("isWebPanelDeniedRole", () => {
  it("blocks agent, expeditor, collector and van-seller aliases", () => {
    expect(isWebPanelDeniedRole("agent")).toBe(true);
    expect(isWebPanelDeniedRole("expeditor")).toBe(true);
    expect(isWebPanelDeniedRole("collector")).toBe(true);
    expect(isWebPanelDeniedRole("vanseller")).toBe(true);
    expect(isWebPanelDeniedRole("vansell")).toBe(true);
  });

  it("allows supervisor, auditor, operator, admin", () => {
    expect(isWebPanelDeniedRole("supervisor")).toBe(false);
    expect(isWebPanelDeniedRole("auditor")).toBe(false);
    expect(isWebPanelDeniedRole("operator")).toBe(false);
    expect(isWebPanelDeniedRole("admin")).toBe(false);
    expect(isWebPanelDeniedRole("skladchik")).toBe(false);
  });
});

describe("web vs mobile client detection", () => {
  it("treats missing apk_version as web login", () => {
    expect(isMobileAppLogin({})).toBe(false);
    expect(isMobileAppLogin({ apk_version: "  " })).toBe(false);
    expect(isMobileAppLogin({ apk_version: "3.1.21" })).toBe(true);
  });

  it("treats Origin / Mozilla as browser, Dart/okhttp as mobile", () => {
    expect(isBrowserWebRequest({ origin: "https://sales-arena.up.railway.app" })).toBe(true);
    expect(
      isBrowserWebRequest({
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120"
      })
    ).toBe(true);
    expect(isBrowserWebRequest({ "user-agent": "Dart/3.5 (dart:io)" })).toBe(false);
    expect(isBrowserWebRequest({ "user-agent": "okhttp/4.12.0" })).toBe(false);
    expect(isBrowserWebRequest({})).toBe(false);
  });
});

describe("assertWebPanelLoginAllowed", () => {
  it("rejects field roles on web login and allows mobile apk login", () => {
    expect(() => assertWebPanelLoginAllowed("agent", {})).toThrow(WEB_ACCESS_DENIED);
    expect(() => assertWebPanelLoginAllowed("expeditor", {})).toThrow(WEB_ACCESS_DENIED);
    expect(() => assertWebPanelLoginAllowed("collector", {})).toThrow(WEB_ACCESS_DENIED);
    expect(() => assertWebPanelLoginAllowed("agent", { apk_version: "3.1.0" })).not.toThrow();
    expect(() => assertWebPanelLoginAllowed("operator", {})).not.toThrow();
  });
});

describe("assertWebPanelBrowserAllowed", () => {
  it("kicks field roles out of the browser session", () => {
    expect(() =>
      assertWebPanelBrowserAllowed("agent", {
        "user-agent": "Mozilla/5.0 Chrome/120"
      })
    ).toThrow(WEB_ACCESS_DENIED);
    expect(() =>
      assertWebPanelBrowserAllowed("agent", { "user-agent": "Dart/3.5 (dart:io)" })
    ).not.toThrow();
  });
});
