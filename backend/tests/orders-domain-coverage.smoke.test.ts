/**
 * Orders domain modullari importlanishi — coverage include uchun minimal smoke.
 */
import { describe, expect, it } from "vitest";

describe("orders domain smoke (coverage include)", () => {
  it("domain barrel importlanadi", async () => {
    const mod = await import("../src/modules/orders/domain/index");
    expect(mod).toBeDefined();
  });
});
