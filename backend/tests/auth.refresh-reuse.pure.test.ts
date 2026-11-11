import { describe, expect, it } from "vitest";
import { decideRefreshReuse } from "../src/modules/auth/refresh-reuse.pure";

const GRACE = 30_000;

describe("decideRefreshReuse", () => {
  it("rejects expired tokens", () => {
    expect(
      decideRefreshReuse({
        nowMs: 1_000_000,
        expiresAtMs: 999_000,
        revokedAtMs: null,
        graceMs: GRACE
      })
    ).toEqual({ action: "reject_expired" });
  });

  it("rotates active unrevoked tokens", () => {
    expect(
      decideRefreshReuse({
        nowMs: 1_000_000,
        expiresAtMs: 2_000_000,
        revokedAtMs: null,
        graceMs: GRACE
      })
    ).toEqual({ action: "rotate" });
  });

  it("allows parallel refresh inside grace", () => {
    expect(
      decideRefreshReuse({
        nowMs: 1_000_000,
        expiresAtMs: 2_000_000,
        revokedAtMs: 1_000_000 - 5_000,
        graceMs: GRACE
      })
    ).toEqual({ action: "allow_grace_replay" });
  });

  it("treats reuse after grace as theft", () => {
    expect(
      decideRefreshReuse({
        nowMs: 1_000_000,
        expiresAtMs: 2_000_000,
        revokedAtMs: 1_000_000 - 60_000,
        graceMs: GRACE
      })
    ).toEqual({ action: "reject_reuse_theft" });
  });
});
