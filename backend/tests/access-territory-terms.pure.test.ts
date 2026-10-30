import { describe, expect, it } from "vitest";
import { mergeTerritoryTermsForScope } from "../src/modules/access/access-scope-from-slot";

describe("mergeTerritoryTermsForScope — generic tokens", () => {
  it("Xorazm path — viloyati yolg‘iz term bo‘lmasin", () => {
    const terms = mergeTerritoryTermsForScope(null, {
      territory: "South West / Xorazm Viloyati / Bo'ston",
      territories: []
    });
    expect(terms.some((t) => t.toLowerCase() === "viloyati")).toBe(false);
    expect(terms.some((t) => /xorazm/i.test(t))).toBe(true);
    expect(terms.some((t) => /bo'?ston/i.test(t))).toBe(true);
  });

  it("zona (South West) geo termga kirmasin — Andijon sizib chiqmasin", () => {
    const terms = mergeTerritoryTermsForScope(null, {
      territory: "South West / Xorazm Viloyati / Bo'ston",
      territories: []
    });
    expect(terms.some((t) => /^south\s*west$/i.test(t.trim()))).toBe(false);
    expect(terms.join("|").toLowerCase()).not.toMatch(/(^|\|)south west($|\|)/);
  });
});
