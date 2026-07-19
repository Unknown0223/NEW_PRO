import { describe, expect, it } from "vitest";
import type { PivotRow } from "@salec/pivot-engine";
import {
  blankRepeatedParentLabels,
  buildClassicPathLabels,
  classicPathPrefixKey,
  flattenPivotRowsLocal,
  splitPivotRowPath
} from "../lib/pivot-flatten";
import { resolveClassicLabels as resolveClassicLabelsUi } from "../components/pivot/PivotTable/PivotRow";

function cell(formatted: string) {
  return { value: formatted, rawValue: null, formatted, columnKey: "__row_label__", isEmpty: false };
}

describe("splitPivotRowPath", () => {
  it("ajratadi: | ", () => {
    expect(splitPivotRowPath("T-SVR-01 | Agent 01 | Mahsulot 1")).toEqual([
      "T-SVR-01",
      "Agent 01",
      "Mahsulot 1"
    ]);
  });

  it("ajratadi: > ", () => {
    expect(splitPivotRowPath("T-SVR-01 > Agent 01 > Mahsulot 1")).toEqual([
      "T-SVR-01",
      "Agent 01",
      "Mahsulot 1"
    ]);
  });

  it("ajratadi aralash | va >", () => {
    expect(splitPivotRowPath("T-SVR-01 | Agent 01 TEST > Mahsulot 1")).toEqual([
      "T-SVR-01",
      "Agent 01 TEST",
      "Mahsulot 1"
    ]);
  });
});

describe("blankRepeatedParentLabels (klassik ko‘rinish)", () => {
  it("chapdan bir xil otalarni blank qiladi", () => {
    const r1 = ["Andijon", "livial", "A"];
    const r2 = blankRepeatedParentLabels(["Andijon", "livial", "B"], r1);
    expect(r2).toEqual(["", "", "B"]);
    const r3 = blankRepeatedParentLabels(["Andijon", "Iviai", "C"], ["Andijon", "livial", "B"]);
    expect(r3).toEqual(["", "Iviai", "C"]);
  });

  it("oxirgi a’zo hech qachon blank emas", () => {
    expect(blankRepeatedParentLabels(["A", "B", "C"], ["A", "B", "C"])).toEqual(["", "", "C"]);
  });

  it("birinchi qator to‘liq qoladi", () => {
    expect(blankRepeatedParentLabels(["Andijon", "livial", "A"], null)).toEqual([
      "Andijon",
      "livial",
      "A"
    ]);
  });
});

describe("classicPathPrefixKey", () => {
  it("prefix mustaqil", () => {
    const labels = ["T-SVR-01", "Agent 01 TEST", "Mahsulot 1"];
    expect(classicPathPrefixKey(labels, 0)).toBe("T-SVR-01");
    expect(classicPathPrefixKey(labels, 1)).toBe("T-SVR-01 | Agent 01 TEST");
    expect(classicPathPrefixKey(labels, 2)).toBe("T-SVR-01 | Agent 01 TEST | Mahsulot 1");
  });

  it("bo‘sh o‘rta → null (boshqa branch ga ta’sir qilmasin)", () => {
    expect(classicPathPrefixKey(["T-SVR-01", "", "Mahsulot"], 1)).toBeNull();
  });
});

describe("flatten classic 3 daraja", () => {
  const product1: PivotRow = {
    key: "T-SVR-01 | Agent 01 TEST | Mahsulot 1",
    depth: 2,
    cells: [cell("Mahsulot 1")]
  };
  const product2: PivotRow = {
    key: "T-SVR-01 | Agent 01 TEST | Mahsulot 2",
    depth: 2,
    cells: [cell("Mahsulot 2")]
  };
  const agent: PivotRow = {
    key: "T-SVR-01 | Agent 01 TEST",
    depth: 1,
    cells: [cell("Agent 01 TEST")],
    children: [product1, product2]
  };
  const agentSeed: PivotRow = {
    key: "T-SVR-01 | Agent (seed)",
    depth: 1,
    cells: [cell("Agent (seed)")],
    children: [
      {
        key: "T-SVR-01 | Agent (seed) | Mahsulot A",
        depth: 2,
        cells: [cell("Mahsulot A")]
      },
      {
        key: "T-SVR-01 | Agent (seed) | Mahsulot B",
        depth: 2,
        cells: [cell("Mahsulot B")]
      }
    ]
  };
  const svr: PivotRow = {
    key: "T-SVR-01",
    depth: 0,
    cells: [cell("T-SVR-01")],
    children: [agent, agentSeed]
  };

  it("ochiq: har ustun alohida, Agent hech qachon bo‘sh emas", () => {
    const flat = flattenPivotRowsLocal(
      [svr],
      new Set(["T-SVR-01", "T-SVR-01 | Agent 01 TEST", "T-SVR-01 | Agent (seed)"]),
      undefined,
      undefined,
      "classic",
      3
    );
    const rows = flat.filter((r) => r.type === "row");
    expect(rows).toHaveLength(4);

    expect(rows[0]?.type === "row" && rows[0].pathLabels).toEqual([
      "T-SVR-01",
      "Agent 01 TEST",
      "Mahsulot 1"
    ]);
    expect(rows[1]?.type === "row" && rows[1].pathLabels).toEqual([
      "T-SVR-01",
      "Agent 01 TEST",
      "Mahsulot 2"
    ]);
    // Sibling product under same agent — Agent MUST repeat (not blank)
    expect(rows[0]?.type === "row" && rows[0].pathLabels[1]).toBe("Agent 01 TEST");
    expect(rows[1]?.type === "row" && rows[1].pathLabels[1]).toBe("Agent 01 TEST");

    expect(rows[2]?.type === "row" && rows[2].pathLabels).toEqual([
      "T-SVR-01",
      "Agent (seed)",
      "Mahsulot A"
    ]);
    expect(rows[3]?.type === "row" && rows[3].pathLabels).toEqual([
      "T-SVR-01",
      "Agent (seed)",
      "Mahsulot B"
    ]);
  });

  it("faqat bitta agent ochiq — boshqa agentga tegmaydi", () => {
    const flat = flattenPivotRowsLocal(
      [svr],
      new Set(["T-SVR-01", "T-SVR-01 | Agent 01 TEST"]),
      undefined,
      undefined,
      "classic",
      3
    );
    const rows = flat.filter((r) => r.type === "row");
    expect(rows).toHaveLength(3);
    expect(rows[0]?.type === "row" && rows[0].pathLabels[2]).toBe("Mahsulot 1");
    expect(rows[1]?.type === "row" && rows[1].pathLabels[2]).toBe("Mahsulot 2");
    // Agent (seed) collapsed — o‘z qatori, products yo‘q
    expect(rows[2]?.type === "row" && rows[2].pathLabels).toEqual(["T-SVR-01", "Agent (seed)"]);
    expect(rows[2]?.type === "row" && rows[2].rowKey).toBe("T-SVR-01 | Agent (seed)");
  });

  it("eski aralash key ham ajraladi", () => {
    const legacy: PivotRow = {
      key: "T-SVR-01 | Agent 01 TEST > Mahsulot 1",
      depth: 2,
      cells: [cell("Mahsulot 1")]
    };
    expect(buildClassicPathLabels(legacy, ["T-SVR-01", "Agent 01 TEST"], 3)).toEqual([
      "T-SVR-01",
      "Agent 01 TEST",
      "Mahsulot 1"
    ]);
  });

  it("resolveClassicLabels: pathLabels dan Agent blank emas", () => {
    const row: PivotRow = {
      key: "T-SVR-01 | Agent 01 TEST | Mahsulot 2",
      depth: 2,
      cells: [cell("Mahsulot 2")]
    };
    expect(
      resolveClassicLabelsUi(
        ["T-SVR-01", "Agent 01 TEST", "Mahsulot 2"],
        row,
        2,
        3
      )
    ).toEqual(["T-SVR-01", "Agent 01 TEST", "Mahsulot 2"]);
  });
});

describe("flatten compact multi-column (tree)", () => {
  const product1: PivotRow = {
    key: "T-SVR-01 | Agent 01 TEST | Mahsulot 1",
    depth: 2,
    cells: [cell("Mahsulot 1")]
  };
  const product2: PivotRow = {
    key: "T-SVR-01 | Agent 01 TEST | Mahsulot 2",
    depth: 2,
    cells: [cell("Mahsulot 2")]
  };
  const agent: PivotRow = {
    key: "T-SVR-01 | Agent 01 TEST",
    depth: 1,
    cells: [cell("Agent 01 TEST")],
    children: [product1, product2]
  };
  const agentSeed: PivotRow = {
    key: "T-SVR-01 | Agent (seed)",
    depth: 1,
    cells: [cell("Agent (seed)")],
    children: [
      {
        key: "T-SVR-01 | Agent (seed) | Mahsulot A",
        depth: 2,
        cells: [cell("Mahsulot A")]
      }
    ]
  };
  const svr: PivotRow = {
    key: "T-SVR-01",
    depth: 0,
    cells: [cell("T-SVR-01")],
    children: [agent, agentSeed]
  };

  it("yig‘ilgan: ota qatori, pathLabels alohida ustunlar (concat YO‘Q)", () => {
    const flat = flattenPivotRowsLocal([svr], new Set(), undefined, undefined, "compact", 3);
    const rows = flat.filter((r) => r.type === "row");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.type === "row" && rows[0].pathLabels).toEqual(["T-SVR-01"]);
    expect(rows[0]?.type === "row" && rows[0].hasChildren).toBe(true);
    // Bitta katakda «Agent > Product» yo‘q
    expect(rows[0]?.type === "row" && rows[0].pathLabels.join("")).not.toContain(">");
  });

  it("ochiq daraxt: ota qoladi + bolalar; har field alohida; ota labels takrorlanadi", () => {
    const flat = flattenPivotRowsLocal(
      [svr],
      new Set(["T-SVR-01", "T-SVR-01 | Agent 01 TEST"]),
      undefined,
      undefined,
      "compact",
      3
    );
    const rows = flat.filter((r) => r.type === "row");
    // ota SVR + agent + 2 product + agentSeed collapsed = 5
    expect(rows).toHaveLength(5);

    expect(rows[0]?.type === "row" && rows[0].pathLabels).toEqual(["T-SVR-01"]);
    expect(rows[0]?.type === "row" && rows[0].depth).toBe(0);

    expect(rows[1]?.type === "row" && rows[1].pathLabels).toEqual(["T-SVR-01", "Agent 01 TEST"]);
    expect(rows[2]?.type === "row" && rows[2].pathLabels).toEqual([
      "T-SVR-01",
      "Agent 01 TEST",
      "Mahsulot 1"
    ]);
    expect(rows[3]?.type === "row" && rows[3].pathLabels).toEqual([
      "T-SVR-01",
      "Agent 01 TEST",
      "Mahsulot 2"
    ]);
    // Sibling — Agent mustaqil takrorlanadi
    expect(rows[2]?.type === "row" && rows[2].pathLabels[1]).toBe("Agent 01 TEST");
    expect(rows[3]?.type === "row" && rows[3].pathLabels[1]).toBe("Agent 01 TEST");

    // Faqat Agent 01 ochiq — Agent (seed) products yo‘q
    expect(rows[4]?.type === "row" && rows[4].pathLabels).toEqual(["T-SVR-01", "Agent (seed)"]);
    expect(rows[4]?.type === "row" && rows[4].expanded).toBe(false);
  });

  it("branch independence: boshqa agent ochilishi birinchiga tegmaydi", () => {
    const flat = flattenPivotRowsLocal(
      [svr],
      new Set(["T-SVR-01", "T-SVR-01 | Agent (seed)"]),
      undefined,
      undefined,
      "compact",
      3
    );
    const rows = flat.filter((r) => r.type === "row");
    expect(rows).toHaveLength(4); // SVR + Agent01 collapsed + AgentSeed + Mahsulot A
    expect(rows[1]?.type === "row" && rows[1].rowKey).toBe("T-SVR-01 | Agent 01 TEST");
    expect(rows[1]?.type === "row" && rows[1].expanded).toBe(false);
    expect(rows[2]?.type === "row" && rows[2].pathLabels).toEqual(["T-SVR-01", "Agent (seed)"]);
    expect(rows[3]?.type === "row" && rows[3].pathLabels).toEqual([
      "T-SVR-01",
      "Agent (seed)",
      "Mahsulot A"
    ]);
  });
});

describe("flatten values-on-rows (WDR Measures in Rows)", () => {
  const region: PivotRow = {
    key: "Toshkent",
    depth: 0,
    cells: [cell("Toshkent")],
    children: [
      {
        key: "Toshkent | __v__ | amount",
        depth: 1,
        cells: [cell("Summa")]
      },
      {
        key: "Toshkent | __v__ | qty",
        depth: 1,
        cells: [cell("Miqdor")]
      }
    ]
  };

  it("metrika bolalari expand qilinmasdan ham ko‘rinadi (classic)", () => {
    const flat = flattenPivotRowsLocal([region], new Set(), undefined, undefined, "classic", 1);
    const rows = flat.filter((r) => r.type === "row");
    expect(rows).toHaveLength(2);
    const labels = rows.map((r) => (r.type === "row" ? r.row.cells[0]?.formatted : ""));
    expect(labels).toContain("Summa");
    expect(labels).toContain("Miqdor");
  });

  it("metrika bolalari expand qilinmasdan ham ko‘rinadi (compact)", () => {
    const flat = flattenPivotRowsLocal([region], new Set(), undefined, undefined, "compact", 1);
    const rows = flat.filter((r) => r.type === "row");
    expect(rows).toHaveLength(3);
    expect(rows[0]?.type === "row" && rows[0].pathLabels).toEqual(["Toshkent"]);
    const childLabels = rows.slice(1).map((r) => (r.type === "row" ? r.row.cells[0]?.formatted : ""));
    expect(childLabels).toEqual(["Summa", "Miqdor"]);
  });
});
