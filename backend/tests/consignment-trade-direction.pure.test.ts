import { describe, expect, it } from "vitest";
import { tradeDirectionLegacyMatchVariants } from "../src/modules/consignment/consignment-trade-direction";

describe("tradeDirectionLegacyMatchVariants", () => {
  it("includes name, code, and display label", () => {
    const v = tradeDirectionLegacyMatchVariants({ name: "DIELUX", code: "DIELUX" });
    expect(v).toContain("DIELUX");
    expect(v).toContain("DIELUX (DIELUX)");
    expect(new Set(v).size).toBe(2);
  });

  it("includes name only when code missing", () => {
    expect(tradeDirectionLegacyMatchVariants({ name: "Retail", code: null })).toEqual(["Retail"]);
  });
});
