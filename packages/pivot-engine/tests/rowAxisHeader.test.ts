import { describe, expect, it } from "vitest";
import { resolveRowAxisHeaderLabel } from "../src/utils/rowAxisHeader.js";
import type { PivotField } from "../src/types/pivot.types.js";

const FIELDS: PivotField[] = [
  { id: "agent", label: "Агент", dataType: "string" },
  { id: "region", label: "Hudud", dataType: "string" }
];

describe("resolveRowAxisHeaderLabel", () => {
  it("single row field → catalog caption, not «Группа»", () => {
    expect(resolveRowAxisHeaderLabel({ rows: ["agent"] }, FIELDS)).toBe("Агент");
    expect(resolveRowAxisHeaderLabel({ rows: ["region"] }, FIELDS)).toBe("Hudud");
  });

  it("multiple row fields → generic group label", () => {
    expect(resolveRowAxisHeaderLabel({ rows: ["agent", "region"] }, FIELDS)).toBe("Группа");
  });

  it("no row fields → empty", () => {
    expect(resolveRowAxisHeaderLabel({ rows: [] }, FIELDS)).toBe("");
  });
});
