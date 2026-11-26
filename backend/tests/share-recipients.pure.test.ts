import { describe, expect, it } from "vitest";
import { sharePersonDisplayName } from "../src/modules/mobile/share/share-display.pure";

describe("sharePersonDisplayName", () => {
  it("names only — no login/code", () => {
    expect(
      sharePersonDisplayName({
        name: "login",
        first_name: "Ali",
        last_name: "Karimov"
      })
    ).toBe("Karimov Ali");
  });
});
