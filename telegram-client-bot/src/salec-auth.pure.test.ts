import { describe, expect, it } from "vitest";
import { normSmart } from "./salec.js";

describe("staff smart code match", () => {
  it("ignores case, spaces and dashes", () => {
    expect(normSmart("a-andijon-001")).toBe(normSmart("A ANDIJON 001"));
    expect(normSmart("PMAND008")).toBe("PMAND008");
  });
});
