import { describe, expect, it } from "vitest";
import { normalizeClientUuid } from "../src/modules/orders/domain/order-idempotency.pure";

describe("normalizeClientUuid", () => {
  it("accepts uuid", () => {
    expect(normalizeClientUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "550e8400-e29b-41d4-a716-446655440000"
    );
  });

  it("rejects garbage", () => {
    expect(normalizeClientUuid("")).toBeNull();
    expect(normalizeClientUuid("not-a-uuid")).toBeNull();
    expect(normalizeClientUuid(null)).toBeNull();
  });
});
