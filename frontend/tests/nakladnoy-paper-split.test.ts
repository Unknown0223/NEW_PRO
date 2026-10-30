import { describe, expect, it } from "vitest";
import { splitNakladnoyGridIntoPapers } from "@/lib/nakladnoy-preview";

const row = (v: string) => [{ v }];

describe("splitNakladnoyGridIntoPapers", () => {
  const rows = ["a", "b", "c", "d", "e"].map(row);

  it("splits rows after each page break", () => {
    const papers = splitNakladnoyGridIntoPapers({
      colCount: 1,
      rows,
      pageBreakAfterRows: [1, 3],
      rowHeightsPt: [10, 11, 12, 13, 14]
    });
    expect(papers.map((p) => p.rows.map((r) => r[0]!.v))).toEqual([["a", "b"], ["c", "d"], ["e"]]);
    expect(papers.map((p) => p.start)).toEqual([0, 2, 4]);
    expect(papers[1]!.rowHeightsPt).toEqual([12, 13]);
  });

  it("returns one paper without breaks and ignores invalid ones", () => {
    const papers = splitNakladnoyGridIntoPapers({ colCount: 1, rows, pageBreakAfterRows: [4, -1, 9] });
    expect(papers).toHaveLength(1);
    expect(papers[0]!.rows).toHaveLength(5);
  });
});
