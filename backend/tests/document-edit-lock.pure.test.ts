import { describe, expect, it } from "vitest";
import {
  defaultDocumentEditLockSettings,
  evaluateDocumentEditLockPure,
  isDocumentDateWithinLockWindow,
  normalizeDocumentEditLockSettings,
  utcCalendarDaysSince
} from "../src/lib/document-edit-lock";

describe("document-edit-lock pure", () => {
  it("defaults enabled=false with section days", () => {
    const d = defaultDocumentEditLockSettings();
    expect(d.enabled).toBe(false);
    expect(d.sections.payments.days).toBe(1);
    expect(d.sections.orders.days).toBe(3);
  });

  it("normalizes partial settings", () => {
    const n = normalizeDocumentEditLockSettings({
      enabled: true,
      sections: { payments: { enabled: false, days: 99 } }
    });
    expect(n.enabled).toBe(true);
    expect(n.sections.payments).toEqual({ enabled: false, days: 99 });
    expect(n.sections.orders.days).toBe(3);
  });

  it("utc calendar days and window", () => {
    const now = new Date("2026-07-11T15:00:00.000Z");
    const today = new Date("2026-07-11T01:00:00.000Z");
    const yesterday = new Date("2026-07-10T23:00:00.000Z");
    const twoDaysAgo = new Date("2026-07-09T12:00:00.000Z");
    expect(utcCalendarDaysSince(today, now)).toBe(0);
    expect(utcCalendarDaysSince(yesterday, now)).toBe(1);
    expect(isDocumentDateWithinLockWindow(today, 1, now)).toBe(true);
    expect(isDocumentDateWithinLockWindow(yesterday, 1, now)).toBe(false);
    expect(isDocumentDateWithinLockWindow(twoDaysAgo, 3, now)).toBe(true);
    expect(isDocumentDateWithinLockWindow(twoDaysAgo, 2, now)).toBe(false);
  });

  it("evaluate: admin / off / window / need_grant", () => {
    const settings = normalizeDocumentEditLockSettings({
      enabled: true,
      sections: { payments: { enabled: true, days: 1 } }
    });
    const now = new Date("2026-07-11T12:00:00.000Z");
    const old = new Date("2026-07-01T12:00:00.000Z");
    expect(
      evaluateDocumentEditLockPure({
        settings,
        section: "payments",
        documentDate: old,
        actorRole: "admin",
        now
      })
    ).toBe("allow");
    expect(
      evaluateDocumentEditLockPure({
        settings: { ...settings, enabled: false },
        section: "payments",
        documentDate: old,
        actorRole: "operator",
        now
      })
    ).toBe("allow");
    expect(
      evaluateDocumentEditLockPure({
        settings,
        section: "payments",
        documentDate: new Date("2026-07-11T08:00:00.000Z"),
        actorRole: "operator",
        now
      })
    ).toBe("allow");
    expect(
      evaluateDocumentEditLockPure({
        settings,
        section: "payments",
        documentDate: old,
        actorRole: "operator",
        now
      })
    ).toBe("need_grant");
  });
});
