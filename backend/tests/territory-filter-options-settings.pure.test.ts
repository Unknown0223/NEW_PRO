import { describe, expect, it } from "vitest";
import { mergeTerritoryFilterOptions } from "../src/modules/reports/territory-nodes";

describe("mergeTerritoryFilterOptions — settings tree full cities", () => {
  it("Xorazm daraxtidagi barcha shaharlar — mijoz distinct bilan siqilmasin", () => {
    const refs = {
      territory_nodes: [
        {
          name: "SOUTH-WEST",
          children: [
            {
              name: "XORAZM VILOYATI",
              children: [
                { name: "BERUNIY" },
                { name: "BO'STON" },
                { name: "BOG'OT" },
                { name: "GURLAN" },
                { name: "PITNAK" },
                { name: "QO'SHKO'PIR" },
                { name: "SHOVOT" },
                { name: "TO'RTKO'L" },
                { name: "URGANCH" },
                { name: "URGANCH TUMANI" },
                { name: "XAZORASP" },
                { name: "XIVA" },
                { name: "XONQA" },
                { name: "YANGIARIQ" },
                { name: "YANGIBOZOR" }
              ]
            }
          ]
        },
        {
          name: "FV",
          children: [{ name: "ANDIJON VILOYATI", children: [{ name: "ASAKA" }] }]
        }
      ]
    };
    // Mijozlarda faqat 3 shahar bor
    const rows = [
      { t1: "SOUTH-WEST", t2: "XORAZM VILOYATI", t3: "BERUNIY" },
      { t1: "SOUTH-WEST", t2: "XORAZM VILOYATI", t3: "GURLAN" },
      { t1: "FV", t2: "ANDIJON VILOYATI", t3: "ASAKA" }
    ];
    const opts = mergeTerritoryFilterOptions(refs, rows);
    expect(opts.territory_3).toHaveLength(16); // 15 xorazm + ASAKA (full unpruned tree in this unit test)
    expect(opts.territory_3).toContain("XIVA");
    expect(opts.territory_3).toContain("YANGIBOZOR");
    expect(opts.territory_3).toContain("PITNAK");
    expect(opts.cities_by_zone_region["SOUTH-WEST|||XORAZM VILOYATI"]).toHaveLength(15);
  });
});
