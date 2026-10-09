import { describe, expect, it } from "vitest";
import {
  ALERT_EVENTS_KEEP,
  decideAlertUpdate,
  ipMatchesWhitelist,
  isPrivateIp,
  mergeUserIds,
  normalizeIp,
  normalizeWhitelistEntry,
  platformOfLogin,
  pushAlertEvent,
  tashkentDay
} from "../src/modules/security/login-alerts.pure";

describe("login-alerts.pure", () => {
  it("platform: apk_version means mobile", () => {
    expect(platformOfLogin("3.2.8")).toBe("mobile");
    expect(platformOfLogin(null)).toBe("web");
    expect(platformOfLogin("  ")).toBe("web");
  });

  it("normalizeIp strips IPv4-mapped prefix", () => {
    expect(normalizeIp(" ::ffff:213.230.1.5 ")).toBe("213.230.1.5");
    expect(normalizeIp("2a02:4780::1")).toBe("2a02:4780::1");
    expect(normalizeIp("")).toBeNull();
  });

  it("private / local IPs are ignored for shared-IP rule", () => {
    for (const ip of ["10.0.0.4", "127.0.0.1", "172.20.1.1", "192.168.1.10", "100.64.3.2", "::1", "fd00::5", null]) {
      expect(isPrivateIp(ip)).toBe(true);
    }
    for (const ip of ["213.230.1.5", "172.32.0.1", "84.54.70.1", "2a02:4780::1"]) {
      expect(isPrivateIp(ip)).toBe(false);
    }
  });

  it("whitelist entry validation", () => {
    expect(normalizeWhitelistEntry(" 213.230.1.5 ")).toBe("213.230.1.5");
    expect(normalizeWhitelistEntry("213.230.1.0/24")).toBe("213.230.1.0/24");
    expect(normalizeWhitelistEntry("2a02:4780::1")).toBe("2a02:4780::1");
    expect(normalizeWhitelistEntry("213.230.1.0/4")).toBeNull();
    expect(normalizeWhitelistEntry("999.1.1.1")).toBeNull();
    expect(normalizeWhitelistEntry("office")).toBeNull();
    expect(normalizeWhitelistEntry("1.2.3.4/24/1")).toBeNull();
  });

  it("whitelist matching: exact IP and CIDR", () => {
    const wl = ["213.230.1.0/24", "84.54.70.9", "2a02:4780::1"];
    expect(ipMatchesWhitelist("213.230.1.200", wl)).toBe(true);
    expect(ipMatchesWhitelist("213.230.2.1", wl)).toBe(false);
    expect(ipMatchesWhitelist("84.54.70.9", wl)).toBe(true);
    expect(ipMatchesWhitelist("84.54.70.10", wl)).toBe(false);
    expect(ipMatchesWhitelist("::ffff:213.230.1.7", wl)).toBe(true);
    expect(ipMatchesWhitelist("2a02:4780::1", wl)).toBe(true);
    expect(ipMatchesWhitelist("10.1.1.1", ["10.0.0.0/8"])).toBe(true);
  });

  it("alert decision: create, merge open, touch / reopen reviewed", () => {
    expect(decideAlertUpdate(null, [1, 2])).toBe("create");
    expect(decideAlertUpdate({ status: "open", user_ids: [1, 2] }, [1, 3])).toBe("merge");
    expect(decideAlertUpdate({ status: "ok", user_ids: [1, 2] }, [2, 1])).toBe("touch");
    expect(decideAlertUpdate({ status: "ok", user_ids: [1, 2] }, [1, 3])).toBe("reopen");
    expect(decideAlertUpdate({ status: "confirmed", user_ids: [4] }, [4, 5])).toBe("reopen");
  });

  it("helpers: merge ids, cap events, Tashkent day", () => {
    expect(mergeUserIds([3, 1], [2, 3])).toEqual([1, 2, 3]);
    const many = Array.from({ length: ALERT_EVENTS_KEEP }, (_, i) => i);
    expect(pushAlertEvent(many, 99)).toHaveLength(ALERT_EVENTS_KEEP);
    expect(pushAlertEvent(many, 99).at(-1)).toBe(99);
    expect(tashkentDay(new Date("2026-10-04T20:30:00Z"))).toBe("2026-10-05");
    expect(tashkentDay(new Date("2026-10-04T18:00:00Z"))).toBe("2026-10-04");
  });
});
