import { describe, expect, it } from "vitest";
import {
  branchLabelLookup,
  branchVisibleName,
  expandBranchFilterKeys,
  uniqueBranchVisibleNames
} from "../src/modules/tenant-settings/branch-display.pure";

const catalog = [
  { id: "7cda4ce4-89e9-4b30-b31b-78f1f07a9a40", name: "Andijon", code: "001", active: true },
  { id: "ab7d8f28-8cb1-431f-8469-224329879ddf", name: "Buxoro", code: "002", active: true }
];

describe("branch display", () => {
  it("shows the catalog name and hides unknown codes", () => {
    const lookup = branchLabelLookup(catalog);
    expect(branchVisibleName("001", lookup)).toBe("Andijon");
    expect(branchVisibleName("7cda4ce4-89e9-4b30-b31b-78f1f07a9a40", lookup)).toBe("Andijon");
    expect(branchVisibleName("andijon", lookup)).toBe("Andijon");
    expect(branchVisibleName("003", lookup)).toBeNull();
    expect(branchVisibleName("Qoqon", lookup)).toBe("Qoqon");
    expect(uniqueBranchVisibleNames(["001", "002", "Andijon", "003"], lookup)).toEqual(["Andijon", "Buxoro"]);
  });

  it("expands a selected name to code and id", () => {
    const keys = expandBranchFilterKeys(["Andijon"], catalog);
    expect(keys).toContain("Andijon");
    expect(keys).toContain("001");
    expect(keys).toContain("7cda4ce4-89e9-4b30-b31b-78f1f07a9a40");
    expect(keys).not.toContain("002");
  });

  it("treats Fargona and Farg'ona as the catalog name", () => {
    const rows = [{ name: "Farg'ona", code: "002", active: true }];
    const lookup = branchLabelLookup(rows);
    expect(branchVisibleName("Fargona", lookup)).toBe("Farg'ona");
    expect(branchVisibleName("Farg'ona", lookup)).toBe("Farg'ona");
    const keys = expandBranchFilterKeys(["Farg'ona"], rows);
    expect(keys).toContain("Fargona");
    expect(keys).toContain("Farg'ona");
  });
});
