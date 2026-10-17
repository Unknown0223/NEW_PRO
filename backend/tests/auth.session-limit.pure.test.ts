import { describe, expect, it } from "vitest";
import { otherActiveSessionsWhere } from "../src/modules/auth/auth.service";

describe("otherActiveSessionsWhere", () => {
  const now = new Date("2026-09-03T12:00:00.000Z");

  it("without device counts all active sessions", () => {
    expect(otherActiveSessionsWhere({ userId: 8, tenantId: 1, deviceId: null, now })).toEqual({
      user_id: 8,
      tenant_id: 1,
      revoked_at: null,
      expires_at: { gt: now }
    });
  });

  it("excludes the current device so re-login cannot revoke then hit SESSION_LIMIT", () => {
    const w = otherActiveSessionsWhere({
      userId: 8,
      tenantId: 1,
      deviceId: "m-abc",
      now
    });
    expect(w.OR).toEqual([{ device_id: null }, { device_id: { not: "m-abc" } }]);
    expect(w.user_id).toBe(8);
  });
});
