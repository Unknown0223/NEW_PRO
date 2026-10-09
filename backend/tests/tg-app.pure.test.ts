import { describe, expect, it } from "vitest";
import {
  LIMITS,
  blockUntil,
  contactIsOwn,
  decideClientLinkStart,
  formatLinkCode,
  generateLinkCode,
  hashLinkCode,
  normLinkCode,
  orderNumberMatches,
  phoneMatchesClient,
  CODE_ALPHABET,
  CODE_LEN
} from "../src/modules/tg-app/tg-link.pure";
import { bar, cb, kb, maskName, money, pagerRow, parseCb, periodRange, phoneKey, todayYmd, ymdToUtcStart } from "../src/modules/tg-app/tg-ui.pure";
import { readPrefs } from "../src/modules/tg-app/tg-prefs.pure";

describe("tg link codes", () => {
  it("generates codes from the unambiguous alphabet", () => {
    for (let i = 0; i < 50; i++) {
      const c = generateLinkCode();
      expect(c).toHaveLength(CODE_LEN);
      for (const ch of c) expect(CODE_ALPHABET).toContain(ch);
      expect(normLinkCode(c)).toBe(c);
    }
  });

  it("normalizes user input and deep-link prefix", () => {
    expect(normLinkCode("abcd-efgh")).toBe("ABCDEFGH");
    expect(normLinkCode("c_ABCDEFGH")).toBe("ABCDEFGH");
    expect(normLinkCode(" abcd efgh ")).toBe("ABCDEFGH");
    expect(normLinkCode("ABCD-EFG0")).toBeNull();
    expect(normLinkCode("ABC")).toBeNull();
    expect(normLinkCode(null)).toBeNull();
    expect(formatLinkCode("ABCDEFGH")).toBe("ABCD-EFGH");
  });

  it("hashes per tenant", () => {
    expect(hashLinkCode(1, "ABCDEFGH")).not.toBe(hashLinkCode(2, "ABCDEFGH"));
    expect(hashLinkCode(1, "ABCDEFGH")).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("order number match", () => {
  it("matches full and digit-only forms", () => {
    expect(orderNumberMatches("ORD-000123", "ord 000123")).toBe(true);
    expect(orderNumberMatches("123", "ORD-000123")).toBe(true);
    expect(orderNumberMatches("№ 123", "ORD-123")).toBe(true);
  });
  it("rejects short or different numbers", () => {
    expect(orderNumberMatches("1", "ORD-1")).toBe(false);
    expect(orderNumberMatches("12", "X-12")).toBe(false);
    expect(orderNumberMatches("124", "ORD-123")).toBe(false);
    expect(orderNumberMatches("", "ORD-123")).toBe(false);
  });
  it("still allows exact match of short numbers", () => {
    expect(orderNumberMatches("ORD-1", "ord-1")).toBe(true);
  });
});

describe("decideClientLinkStart", () => {
  const now = new Date("2026-09-30T10:00:00Z");
  const code = { used_at: null, expires_at: new Date("2026-10-01T00:00:00Z"), attempts: 0 };
  const base = {
    telegramIsStaff: false,
    code,
    clientActive: true,
    activeLinksForClient: 0,
    activeLinksForTelegram: 0,
    alreadyLinkedThisClient: false,
    now
  };

  it("accepts a fresh code", () => {
    expect(decideClientLinkStart(base)).toEqual({ ok: true, already: false });
  });
  it("refuses staff telegram accounts first", () => {
    expect(decideClientLinkStart({ ...base, telegramIsStaff: true, code: null })).toEqual({ ok: false, reason: "staff_telegram" });
  });
  it("refuses used / expired / exhausted codes", () => {
    expect(decideClientLinkStart({ ...base, code: null })).toMatchObject({ reason: "code_not_found" });
    expect(decideClientLinkStart({ ...base, code: { ...code, used_at: now } })).toMatchObject({ reason: "code_used" });
    expect(decideClientLinkStart({ ...base, code: { ...code, expires_at: now } })).toMatchObject({ reason: "code_expired" });
    expect(decideClientLinkStart({ ...base, code: { ...code, attempts: LIMITS.maxCodeAttempts } })).toMatchObject({ reason: "code_attempts" });
  });
  it("refuses inactive clients and enforces link limits", () => {
    expect(decideClientLinkStart({ ...base, clientActive: false })).toMatchObject({ reason: "client_inactive" });
    expect(decideClientLinkStart({ ...base, activeLinksForClient: LIMITS.maxTelegramPerClient })).toMatchObject({
      reason: "too_many_for_client"
    });
    expect(decideClientLinkStart({ ...base, activeLinksForTelegram: LIMITS.maxClientsPerTelegram })).toMatchObject({
      reason: "too_many_for_telegram"
    });
  });
  it("treats an existing link as already linked even at the limit", () => {
    expect(
      decideClientLinkStart({ ...base, alreadyLinkedThisClient: true, activeLinksForClient: LIMITS.maxTelegramPerClient })
    ).toEqual({ ok: true, already: true });
  });
});

describe("phone / contact checks", () => {
  it("compares last 9 digits", () => {
    expect(phoneKey("+998 90 123-45-67")).toBe("901234567");
    expect(phoneKey("901234567")).toBe("901234567");
    expect(phoneKey("12345")).toBeNull();
    expect(phoneMatchesClient("901234567", [null, "901234567"])).toBe(true);
    expect(phoneMatchesClient("901234567", ["991234567"])).toBe(false);
    expect(phoneMatchesClient(null, ["901234567"])).toBe(false);
  });
  it("accepts only the sender's own contact", () => {
    expect(contactIsOwn(42, 42)).toBe(true);
    expect(contactIsOwn(43, 42)).toBe(false);
    expect(contactIsOwn(undefined, 42)).toBe(false);
  });
});

describe("blockUntil", () => {
  const now = new Date("2026-09-30T10:00:00Z");
  const ago = (min: number) => new Date(now.getTime() - min * 60_000);
  it("does not block below the hourly limit", () => {
    expect(blockUntil([ago(1), ago(2), ago(3), ago(4)], now)).toBeNull();
  });
  it("ignores failures older than an hour", () => {
    expect(blockUntil([ago(61), ago(70), ago(1), ago(2), ago(3)], now)).toBeNull();
  });
  it("blocks for an hour from the last failure", () => {
    const until = blockUntil([ago(1), ago(2), ago(3), ago(4), ago(5)], now);
    expect(until?.toISOString()).toBe(new Date(ago(1).getTime() + LIMITS.blockMinutes * 60_000).toISOString());
  });
});

describe("tg ui helpers", () => {
  it("callback data stays within 64 bytes and strips separators", () => {
    expect(cb("c", "o", 123, 2)).toBe("c:o:123:2");
    expect(cb("r", "x", "a:b")).toBe("r:x:ab");
    expect(() => cb("x", "y".repeat(80))).toThrow();
    expect(parseCb("c:o:1:2")).toEqual(["c", "o", "1", "2"]);
    expect(parseCb("z".repeat(65))).toEqual([]);
    expect(parseCb(undefined)).toEqual([]);
  });
  it("longest real callbacks fit", () => {
    expect(() => cb("c", "actf", "2026-01-01_2026-12-31", "xlsx")).not.toThrow();
    expect(() => cb("r", "x", 2147483647, "2026-01-01_2026-12-31")).not.toThrow();
  });
  it("keyboard drops empty rows", () => {
    expect(kb(null, [], false, [{ text: "a", callback_data: "noop" }]).inline_keyboard).toHaveLength(1);
  });
  it("pager row", () => {
    expect(pagerRow("c:ord", 1, 1)).toEqual([]);
    expect(pagerRow("c:ord", 2, 3).map((b) => b.callback_data)).toEqual(["c:ord:1", "noop", "c:ord:3"]);
  });
  it("money formatting", () => {
    expect(money(1234567.4)).toBe("1 234 567 so'm");
    expect(money(-500)).toBe("−500 so'm");
    expect(money("abc")).toBe("0 so'm");
    expect(money(null)).toBe("0 so'm");
  });
  it("masks names", () => {
    expect(maskName("Baraka Savdo")).toBe("Ba**** Sa***");
    expect(maskName("OK")).toBe("OK");
  });
  it("progress bar is clamped", () => {
    expect(bar(150, 4)).toBe("▓▓▓▓ 100%");
    expect(bar(-5, 4)).toBe("░░░░ 0%");
  });
});

describe("work timezone periods (UTC+5)", () => {
  it("today shifts across midnight", () => {
    expect(todayYmd(new Date("2026-09-30T19:30:00Z"))).toBe("2026-10-01");
    expect(ymdToUtcStart("2026-10-01").toISOString()).toBe("2026-09-30T19:00:00.000Z");
  });
  it("period keys", () => {
    const now = new Date("2026-03-15T06:00:00Z");
    expect(periodRange("tm", now)).toEqual({ from: "2026-03-01", to: "2026-03-15" });
    expect(periodRange("pm", now)).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(periodRange("30", now)).toEqual({ from: "2026-02-14", to: "2026-03-15" });
    expect(periodRange("ty", now)).toEqual({ from: "2026-01-01", to: "2026-03-15" });
    expect(periodRange("pm", new Date("2026-01-10T06:00:00Z"))).toEqual({ from: "2025-12-01", to: "2025-12-31" });
  });
});

describe("notify prefs", () => {
  it("sanitizes stored json", () => {
    expect(readPrefs(null)).toEqual({ off: [], quiet: false });
    expect(readPrefs({ off: ["bonus", 1], quiet: true })).toEqual({ off: ["bonus", "1"], quiet: true });
    expect(readPrefs({ off: "x", quiet: "yes" })).toEqual({ off: [], quiet: false });
  });
});
