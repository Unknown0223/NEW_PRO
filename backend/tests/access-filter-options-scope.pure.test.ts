import { describe, expect, it } from "vitest";
import {
  filterStringListByTerms,
  filterTerritoryRowsByTerms,
  pruneTerritoryNodesByTerms,
  textMatchesTerritoryTerms
} from "../src/modules/access/access-filter-options-scope";

describe("access-filter-options-scope — territory prune", () => {
  it("null terms — cheklov yo‘q", () => {
    expect(filterStringListByTerms(["A", "B"], null)).toEqual(["A", "B"]);
    expect(filterTerritoryRowsByTerms([{ t1: "Z", t2: "R", t3: "C" }], null)).toHaveLength(1);
  });

  it("bo‘sh terms — hech narsa", () => {
    expect(filterStringListByTerms(["A"], [])).toEqual([]);
    expect(filterTerritoryRowsByTerms([{ t1: "Z", t2: null, t3: null }], [])).toEqual([]);
  });

  it("faqat mos hududlar", () => {
    expect(
      filterTerritoryRowsByTerms(
        [
          { t1: "Andijon", t2: "Asaka", t3: "City" },
          { t1: "Buxoro", t2: "X", t3: "Y" }
        ],
        ["Asaka"]
      )
    ).toEqual([{ t1: "Andijon", t2: "Asaka", t3: "City" }]);
  });

  it("prunes territory tree", () => {
    const pruned = pruneTerritoryNodesByTerms(
      [
        {
          name: "Zona1",
          children: [
            { name: "Andijon", children: [{ name: "CityA" }, { name: "CityB" }] },
            { name: "Buxoro", children: [{ name: "Other" }] }
          ]
        }
      ],
      ["Andijon"]
    );
    expect(pruned).toHaveLength(1);
    expect(pruned[0]?.children).toHaveLength(1);
    expect(pruned[0]?.children?.[0]?.name).toBe("Andijon");
  });

  it("Xorazm terms Andijonni ushlamasin", () => {
    expect(textMatchesTerritoryTerms("ANDIJON VILOYATI", ["Xorazm Viloyati", "Xorazm", "South West"])).toBe(
      false
    );
    expect(textMatchesTerritoryTerms("XORAZM VILOYATI", ["Xorazm Viloyati", "Xorazm"])).toBe(true);
    expect(
      filterTerritoryRowsByTerms(
        [
          { t1: "SW", t2: "ANDIJON VILOYATI", t3: null },
          { t1: "SW", t2: "XORAZM VILOYATI", t3: "Bo'ston" }
        ],
        ["Xorazm", "Xorazm Viloyati"]
      )
    ).toEqual([{ t1: "SW", t2: "XORAZM VILOYATI", t3: "Bo'ston" }]);
  });

  it("zona yolg‘iz match — begona shaharlar chiqmasin", () => {
    expect(
      filterTerritoryRowsByTerms(
        [
          { t1: "SOUTH-WEST", t2: "XORAZM VILOYATI", t3: "BERUNIY" },
          { t1: "SOUTH-WEST", t2: "ANDIJON VILOYATI", t3: "ASAKA" },
          { t1: "FV", t2: "BUXORO VILOYATI", t3: "BUXORO TUMANI" }
        ],
        ["Xorazm", "Xorazm Viloyati"]
      )
    ).toEqual([{ t1: "SOUTH-WEST", t2: "XORAZM VILOYATI", t3: "BERUNIY" }]);
  });

  it("pruned tree — faqat Xorazm zoni", () => {
    const pruned = pruneTerritoryNodesByTerms(
      [
        {
          name: "FV",
          children: [
            { name: "ANDIJON VILOYATI", children: [{ name: "ASAKA" }] },
            { name: "BUXORO VILOYATI", children: [{ name: "BUXORO TUMANI" }] }
          ]
        },
        {
          name: "SOUTH-WEST",
          children: [
            {
              name: "XORAZM VILOYATI",
              children: [{ name: "BERUNIY" }, { name: "GURLAN" }]
            }
          ]
        }
      ],
      ["Xorazm", "Xorazm Viloyati"]
    );
    expect(pruned.map((n) => n.name)).toEqual(["SOUTH-WEST"]);
    expect(pruned[0]?.children?.map((c) => c.name)).toEqual(["XORAZM VILOYATI"]);
    expect(pruned[0]?.children?.[0]?.children?.map((c) => c.name)).toEqual(["BERUNIY", "GURLAN"]);
  });

  it("text match", () => {
    expect(textMatchesTerritoryTerms("Zona / Andijon", ["Andijon"])).toBe(true);
    expect(textMatchesTerritoryTerms("Buxoro", ["Andijon"])).toBe(false);
  });
});
