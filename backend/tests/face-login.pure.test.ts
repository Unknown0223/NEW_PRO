import { describe, expect, it } from "vitest";
import {
  FACE_LOGIN_RECREATE_WINDOW_MS,
  FACE_LOGIN_TTL_MS,
  faceBridgePath,
  hashFaceChallengeToken,
  newFaceChallengeToken,
  pickLivenessDirections,
  resolveChallengeLifecycle,
  resolveFaceBridgePublicOrigin,
  shouldChallengeFaceLogin,
  shouldRequireFaceLogin
} from "../src/modules/auth/face-login.pure";
import { validateLivenessSteps } from "../src/modules/tabel/tabel-antifraud.pure";

describe("face-login.pure", () => {
  it("hashes challenge token stably", () => {
    const raw = newFaceChallengeToken();
    expect(raw.length).toBeGreaterThan(20);
    expect(hashFaceChallengeToken(raw)).toBe(hashFaceChallengeToken(raw));
    expect(hashFaceChallengeToken(raw)).not.toBe(hashFaceChallengeToken(raw + "x"));
  });

  it("picks 4 or 8 unique directions", () => {
    const d4 = pickLivenessDirections(4);
    const d8 = pickLivenessDirections(8);
    expect(d4).toHaveLength(4);
    expect(d8).toHaveLength(8);
    expect(new Set(d4).size).toBe(4);
    expect(new Set(d8).size).toBe(8);
  });

  it("gates require_face_login per user or tenant; admin exempt", () => {
    expect(
      shouldRequireFaceLogin({ userRequireFaceLogin: false, tenantRequireFaceLogin: false })
    ).toBe(false);
    expect(
      shouldRequireFaceLogin({ userRequireFaceLogin: true, tenantRequireFaceLogin: false })
    ).toBe(true);
    expect(
      shouldRequireFaceLogin({ userRequireFaceLogin: false, tenantRequireFaceLogin: true })
    ).toBe(true);
    expect(
      shouldRequireFaceLogin({
        userRequireFaceLogin: true,
        tenantRequireFaceLogin: true,
        role: "admin"
      })
    ).toBe(false);
  });

  it("challenge only when toggle/tenant on AND reference exists", () => {
    expect(
      shouldChallengeFaceLogin({
        userRequireFaceLogin: true,
        tenantRequireFaceLogin: false,
        hasReference: false
      })
    ).toBe(false);
    expect(
      shouldChallengeFaceLogin({
        userRequireFaceLogin: true,
        tenantRequireFaceLogin: false,
        hasReference: true
      })
    ).toBe(true);
    expect(
      shouldChallengeFaceLogin({
        userRequireFaceLogin: false,
        tenantRequireFaceLogin: false,
        hasReference: true
      })
    ).toBe(false);
  });

  it("resolves challenge lifecycle", () => {
    const now = 1_000_000;
    expect(
      resolveChallengeLifecycle({ status: "pending", expiresAtMs: now + 1000, nowMs: now })
    ).toBe("pending");
    expect(
      resolveChallengeLifecycle({ status: "pending", expiresAtMs: now - 1, nowMs: now })
    ).toBe("expired");
    expect(
      resolveChallengeLifecycle({ status: "approved", expiresAtMs: now - 1, nowMs: now })
    ).toBe("approved");
  });

  it("bridge path encodes token", () => {
    expect(faceBridgePath("abc/def")).toBe("/face-bridge/abc%2Fdef");
  });

  it("TTL and recreate window constants", () => {
    expect(FACE_LOGIN_TTL_MS).toBe(120_000);
    expect(FACE_LOGIN_RECREATE_WINDOW_MS).toBe(30 * 60_000);
  });

  it("prefers Origin header over API host for bridge origin", () => {
    expect(
      resolveFaceBridgePublicOrigin({
        publicOrigin: "http://127.0.0.1:18080",
        headers: { origin: "http://127.0.0.1:3000" }
      })
    ).toBe("http://127.0.0.1:3000");
  });

  it("liveness steps validate with challenge directions count", () => {
    const ok4 = validateLivenessSteps(["left", "right", "up", "down"], 4);
    expect(ok4.ok).toBe(true);
    const bad = validateLivenessSteps(["left", "left"], 4);
    expect(bad.ok).toBe(false);
  });
});
