import { describe, expect, it } from "vitest";
import { resolveStaffVisibilityByDimensions } from "../src/modules/access/access-staff-scope";
import { branchFieldMatchesKeys, normalizeBranchKey } from "../src/modules/access/access-scope-from-slot";

describe("resolveStaffVisibilityByDimensions — barcha cheklovlar kesishadi", () => {
  const branch5 = [1, 2, 3, 4, 5];

  it("hech narsa biriktirilmagan → []", () => {
    expect(resolveStaffVisibilityByDimensions([])).toEqual([]);
    expect(resolveStaffVisibilityByDimensions([{ bound: false, staffIds: branch5 }])).toEqual([]);
  });

  it("faqat filial → filialdagi barcha hodimlar", () => {
    expect(resolveStaffVisibilityByDimensions([{ bound: true, staffIds: branch5 }])).toEqual(branch5);
  });

  it("filial + 1 hodim → faqat shu hodim", () => {
    expect(
      resolveStaffVisibilityByDimensions([
        { bound: true, staffIds: branch5 },
        { bound: true, staffIds: [3] }
      ])
    ).toEqual([3]);
  });

  it("hudud ∩ filial ∩ hodimlar", () => {
    expect(
      resolveStaffVisibilityByDimensions([
        { bound: true, staffIds: [1, 2, 3, 9] },
        { bound: true, staffIds: branch5 },
        { bound: true, staffIds: [2, 3, 9] }
      ])
    ).toEqual([2, 3]);
  });

  it("filialdan tashqaridagi hodim ko‘rinmaydi", () => {
    expect(
      resolveStaffVisibilityByDimensions([
        { bound: true, staffIds: branch5 },
        { bound: true, staffIds: [42] }
      ])
    ).toEqual([]);
  });

  it("biriktirilgan, lekin hodim topilmagan geo o‘lcham natijani nollamaydi", () => {
    expect(
      resolveStaffVisibilityByDimensions([
        { bound: true, staffIds: [] },
        { bound: true, staffIds: [7, 8] }
      ])
    ).toEqual([7, 8]);
  });
});

describe("normalizeBranchKey — filial nomlari", () => {
  it("apostrof va registr farqini e’tiborsiz qoldiradi", () => {
    expect(normalizeBranchKey("Farg'ona")).toBe(normalizeBranchKey("Fargona"));
    expect(normalizeBranchKey("FARG`ONA")).toBe("fargona");
    expect(normalizeBranchKey("Farg‘ona ")).toBe("fargona");
  });

  it("branch maydonidagi bir nechta filial", () => {
    const keys = new Set([normalizeBranchKey("Fargona")]);
    expect(branchFieldMatchesKeys("Andijon, Farg'ona", keys)).toBe(true);
    expect(branchFieldMatchesKeys("Andijon", keys)).toBe(false);
    expect(branchFieldMatchesKeys(null, keys)).toBe(false);
  });
});
