import { describe, expect, it } from "vitest";
import {
  canTrustCoverFaceOkMark,
  softBypassFaceWhenPolicyDisabled
} from "../src/modules/mobile/mobile-face.shared";

describe("softBypassFaceWhenPolicyDisabled", () => {
  it("never soft-bypasses cover_accept", () => {
    expect(softBypassFaceWhenPolicyDisabled("cover_accept", false)).toBe(false);
    expect(softBypassFaceWhenPolicyDisabled("cover_accept", true)).toBe(false);
  });

  it("soft-bypasses other contexts when policy off", () => {
    expect(softBypassFaceWhenPolicyDisabled("daily_login", false)).toBe(true);
    expect(softBypassFaceWhenPolicyDisabled("order_submit", false)).toBe(true);
    expect(softBypassFaceWhenPolicyDisabled("daily_login", true)).toBe(false);
  });
});

describe("canTrustCoverFaceOkMark", () => {
  it("requires recent approved cover_accept verify for face_ok true", () => {
    expect(canTrustCoverFaceOkMark(true, true)).toBe(true);
    expect(canTrustCoverFaceOkMark(true, false)).toBe(false);
    expect(canTrustCoverFaceOkMark(false, false)).toBe(true);
  });
});
