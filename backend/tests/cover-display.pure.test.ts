import { describe, expect, it } from "vitest";
import { coverPersonDisplayName } from "../src/modules/mobile/cover/cover-display.pure";

describe("coverPersonDisplayName", () => {
  it("prefers last+first without codes", () => {
    expect(
      coverPersonDisplayName({
        name: "loginish",
        first_name: "Muslima",
        last_name: "Jakbarova"
      })
    ).toBe("Jakbarova Muslima");
  });

  it("falls back to name when parts empty", () => {
    expect(
      coverPersonDisplayName({
        name: "Agent One",
        first_name: null,
        last_name: "  "
      })
    ).toBe("Agent One");
  });

  it("empty when nothing usable", () => {
    expect(coverPersonDisplayName(null)).toBe("");
    expect(coverPersonDisplayName({})).toBe("");
  });
});
