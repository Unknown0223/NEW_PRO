/** Pure logic tests — AI token (no DB, no Redis). */
import { describe, it, expect } from "vitest";
import { signToken, verifyToken, newJti, tokenBelongsTo } from "../src/modules/ai/ai.token";

describe("signToken / verifyToken", () => {
  const payload = {
    kind: "confirm" as const,
    jti: newJti(),
    sub: 42,
    tid: 7,
    tool: "write.set_price",
    params: { product_id: 1, price: 150000 },
    iat: Date.now(),
    exp: Date.now() + 300_000
  };

  it("round-trip", () => {
    const token = signToken(payload);
    const verified = verifyToken(token);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.payload.sub).toBe(42);
      expect(verified.payload.tool).toBe("write.set_price");
    }
  });

  it("expired → error", () => {
    const old = signToken({ ...payload, exp: Date.now() - 1000 });
    const verified = verifyToken(old);
    expect(verified.ok).toBe(false);
    expect(verified.error).toBe("expired");
  });

  it("tampered → invalid", () => {
    const token = signToken(payload);
    const bad = token.slice(0, -2) + (token[token.length - 2] === "a" ? "b" : "a");
    expect(verifyToken(bad).ok).toBe(false);
  });

  it("empty / garbage → invalid", () => {
    expect(verifyToken("").ok).toBe(false);
    expect(verifyToken("not-a-token").ok).toBe(false);
  });

  it("export kind allowed", () => {
    const exp = signToken({ ...payload, kind: "export", jti: newJti(), tool: "__export__" });
    expect(verifyToken(exp).ok).toBe(true);
  });
});

describe("tokenBelongsTo", () => {
  const p = { sub: 42, tid: 7 } as any;
  expect(tokenBelongsTo(p, 42, 7)).toBe(true);
  expect(tokenBelongsTo(p, 43, 7)).toBe(false);
  expect(tokenBelongsTo(p, 42, 8)).toBe(false);
  expect(tokenBelongsTo(p, null, 7)).toBe(false);
});
