import { describe, expect, it } from "vitest";
import { normalizeExternalDocNumber } from "../src/modules/clients/clients.import.flexible-id";

describe("document number standard (payment / order / return)", () => {
  it("accepts any non-empty string id", () => {
    expect(normalizeExternalDocNumber("ks_1652")).toBe("ks_1652");
    expect(normalizeExternalDocNumber("PAY-9")).toBe("PAY-9");
    expect(normalizeExternalDocNumber("  ORD_100  ")).toBe("ORD_100");
    expect(normalizeExternalDocNumber("12")).toBe("12");
  });

  it("treats empty / placeholder as absent (system generates)", () => {
    expect(normalizeExternalDocNumber(null)).toBeNull();
    expect(normalizeExternalDocNumber("")).toBeNull();
    expect(normalizeExternalDocNumber("---")).toBeNull();
  });
});
