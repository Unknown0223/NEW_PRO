import { describe, expect, it } from "vitest";
import { mobileEnqueueBodySchema } from "../src/contracts/mobile.schemas";

describe("mobile schemas (unit)", () => {
  it("mobileEnqueueBodySchema — items va client majburiy", () => {
    expect(mobileEnqueueBodySchema.safeParse({}).success).toBe(false);
    expect(
      mobileEnqueueBodySchema.safeParse({
        client_id: 1,
        items: [{ product_id: 1, qty: 1 }]
      }).success
    ).toBe(true);
  });
});
