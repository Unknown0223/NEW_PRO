import { describe, expect, it } from "vitest";
import {
  OUTCOME_METHOD_IDS,
  type Money,
  type OutcomeCell,
  type OutcomeMethodId,
  type OutcomeVerdict
} from "@salec/plans-proposal";
import { KPI_GROUPS } from "../../src/data/demo-data";
import {
  buildOutcomeGroups,
  buildOutcomeRows,
  closestMethod,
  draftJustified,
  usableActual,
  type OutcomeEmployeeMeta
} from "../../src/lib/outcome-rows";

const money = (som: number): Money => (BigInt(som) * 100n).toString();

function cell(
  kpiGroupId: number,
  key: string,
  employeeName: string,
  actual: Money | null,
  predicted: Money | null,
  deviation: number | null,
  draftVerdict: OutcomeVerdict = "justified"
): OutcomeCell {
  const predictions = {} as Record<OutcomeMethodId, Money | null>;
  const deviations = {} as Record<OutcomeMethodId, number | null>;
  const verdicts = {} as Record<OutcomeMethodId, OutcomeVerdict>;
  for (const id of OUTCOME_METHOD_IDS) {
    predictions[id] = predicted;
    deviations[id] = deviation;
    verdicts[id] = id === "draft" ? draftVerdict : "justified";
  }
  return { key, employeeName, kpiGroupId, actual, predictions, deviations, verdicts };
}

const meta = new Map<string, OutcomeEmployeeMeta>([
  [
    "1:1:1001",
    {
      employeeId: 1,
      code: "AG-001",
      branchId: 1,
      branch: "Toshkent markaz",
      supervisorId: 101,
      supervisor: "Akbar Sodiqov"
    }
  ],
  [
    "2:1:1001",
    {
      employeeId: 1,
      code: "AG-001",
      branchId: 1,
      branch: "Toshkent markaz",
      supervisorId: 101,
      supervisor: "Akbar Sodiqov"
    }
  ],
  [
    "1:2:1002",
    {
      employeeId: 2,
      code: "AG-002",
      branchId: 2,
      branch: "Chirchiq",
      supervisorId: 102,
      supervisor: "Lola Mirzayeva"
    }
  ],
  [
    "2:2:1002",
    {
      employeeId: 2,
      code: "AG-002",
      branchId: 2,
      branch: "Chirchiq",
      supervisorId: 102,
      supervisor: "Lola Mirzayeva"
    }
  ]
]);

const cells: OutcomeCell[] = [
  cell(1, "1:1001", "Aziz Karimov", money(100), money(110), 10),
  cell(2, "1:1001", "Aziz Karimov", money(200), money(220), 10),
  cell(1, "2:1002", "Dilnoza Rahimova", money(300), money(360), 20, "over"),
  cell(2, "2:1002", "Dilnoza Rahimova", null, money(50), null, "no_data")
];

describe("takliflar natijasi matritsasi", () => {
  it("katakka ierarxiya va KPI nomini biriktiradi", () => {
    const rows = buildOutcomeRows(cells, meta);
    expect(rows).toHaveLength(4);
    const first = rows[0]!;
    expect(first.branch).toBe("Toshkent markaz");
    expect(first.supervisor).toBe("Akbar Sodiqov");
    expect(first.code).toBe("AG-001");
    expect(first.kpiName).toBe(KPI_GROUPS.find((g) => g.id === 1)!.name);
    const fallback = buildOutcomeRows(
      [cell(9, "77:1077", "Noma’lum", null, null, null)],
      new Map()
    )[0]!;
    expect(fallback.branch).toBe("Noma’lum filial");
    expect(fallback.kpiName).toBe("KPI 9");
    expect(fallback.employeeId).toBe(77);
  });

  it("faqat musbat haqiqiy faktni jami summaga qo‘shadi", () => {
    expect(usableActual(null)).toBe(0n);
    expect(usableActual("0")).toBe(0n);
    expect(usableActual("-100")).toBe(0n);
    expect(usableActual(money(250))).toBe(BigInt(money(250)));
  });

  it("haqiqiy faktga eng yaqin usulni topadi", () => {
    const row = buildOutcomeRows([cells[0]!], meta)[0]!;
    row.deviations.fact_10 = 12;
    row.deviations.fact_5 = 4;
    row.deviations.previous_plan = -7;
    row.deviations.history_median = null;
    row.deviations.draft = 2;
    expect(closestMethod(row)?.id).toBe("draft");
    expect(closestMethod(row)?.deviation).toBe(2);
    const noFact = buildOutcomeRows([cells[3]!], meta)[0]!;
    expect(closestMethod(noFact)).toBeNull();
  });

  it("ierarxiya bloklarida yopiq fakt jami va draft oqlagan kataklarni hisoblaydi", () => {
    const rows = buildOutcomeRows(cells, meta);
    const groups = buildOutcomeGroups(rows, [1, 2]);
    expect(groups).toHaveLength(2);
    const toshkent = groups[0]!;
    const chirchiq = groups[1]!;
    expect(toshkent.name).toBe("Toshkent markaz");
    expect(toshkent.agentCount).toBe(1);
    expect(toshkent.byKpi.get(1)).toBe(BigInt(money(100)));
    expect(toshkent.byKpi.get(2)).toBe(BigInt(money(200)));
    expect(toshkent.total).toBe(BigInt(money(300)));
    expect(toshkent.justified).toBe(2);
    expect(toshkent.count).toBe(2);
    expect(chirchiq.byKpi.get(1)).toBe(BigInt(money(300)));
    expect(chirchiq.byKpi.get(2)).toBe(0n); // fakt yo‘q
    expect(chirchiq.total).toBe(BigInt(money(300)));
    expect(chirchiq.justified).toBe(0);
    expect(chirchiq.count).toBe(2);
    expect(draftJustified(rows[0])).toBe(true);
    expect(draftJustified(rows[2])).toBe(false);

    const onlyKpi1 = buildOutcomeGroups(rows, [1]);
    expect(onlyKpi1[0]!.byKpi.size).toBe(1);
    expect(onlyKpi1[0]!.byKpi.get(1)).toBe(BigInt(money(100)));
    expect(onlyKpi1[0]!.total).toBe(BigInt(money(100)));
  });
});
