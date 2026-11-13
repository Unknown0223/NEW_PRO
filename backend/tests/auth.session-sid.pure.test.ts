import { describe, expect, it } from "vitest";
import { decideAccessSidActive } from "../src/modules/auth/auth.session-sid";

describe("decideAccessSidActive", () => {
  const now = new Date("2026-11-12T10:00:00.000Z");
  const later = new Date("2026-11-12T11:00:00.000Z");

  it("aktiv sid — ok", () => {
    expect(
      decideAccessSidActive(
        { user_id: 1, revoked_at: null, expires_at: later, family_id: "f1" },
        1,
        now,
        false
      )
    ).toBe(true);
  });

  it("revoked sid + oilada sibling — refresh rotation, ok", () => {
    expect(
      decideAccessSidActive(
        { user_id: 1, revoked_at: now, expires_at: later, family_id: "f1" },
        1,
        now,
        true
      )
    ).toBe(true);
  });

  it("revoked sid + sibling yo‘q — logout / boshqa kirish, yopiq", () => {
    expect(
      decideAccessSidActive(
        { user_id: 1, revoked_at: now, expires_at: later, family_id: "f1" },
        1,
        now,
        false
      )
    ).toBe(false);
  });

  it("boshqa user sid — yopiq", () => {
    expect(
      decideAccessSidActive(
        { user_id: 2, revoked_at: null, expires_at: later, family_id: "f1" },
        1,
        now,
        true
      )
    ).toBe(false);
  });
});
