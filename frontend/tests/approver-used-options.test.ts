import { describe, expect, it } from "vitest";
import {
  filterSelectOptions,
  hasUnusedLeaderOption,
  usedLeaderExcludeIds,
  usedLevelExcludeIds
} from "../components/plans/approver-used-options";
import type { EditableRow } from "../components/plans/approver-table";

const rows: EditableRow[] = [
  { supervisor_user_id: 1, supervisor_name: "S1", levels: [10, 20] },
  { supervisor_user_id: 2, supervisor_name: "S2", levels: [10, 30] }
];

describe("approver-used-options", () => {
  it("filterSelectOptions keeps current value", () => {
    const options = [{ id: 10, name: "A" }, { id: 20, name: "B" }];
    expect(filterSelectOptions(options, 10, [10, 20])).toEqual([{ id: 10, name: "A" }]);
  });

  it("usedLeaderExcludeIds excludes other leaders and level values", () => {
    const exclude = usedLeaderExcludeIds([10, 20, 30], rows, 1);
    expect(exclude).toContain(10);
    expect(exclude).toContain(30);
    expect(exclude).toContain(20);
  });

  it("usedLevelExcludeIds excludes leaders and other cells", () => {
    const exclude = usedLevelExcludeIds([40], rows, 0, 0);
    expect(exclude).toContain(40);
    expect(exclude).toContain(20);
    expect(exclude).toContain(10);
  });

  it("hasUnusedLeaderOption is false when all taken", () => {
    const options = [{ id: 10 }, { id: 20 }, { id: 30 }];
    expect(hasUnusedLeaderOption(options, [40], rows)).toBe(false);
  });
});
