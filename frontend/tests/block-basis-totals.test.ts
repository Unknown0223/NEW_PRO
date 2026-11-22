import { describe, expect, it } from "vitest";
import type { EmployeeSource, ProposalRow } from "@salec/plans-proposal";
import type { MatrixRow } from "../components/plans/taklifiy-reja/lib/grouping";
import {
  basisAmountForCell,
  sumBlockBasis
} from "../components/plans/taklifiy-reja/lib/block-basis-totals";

function employee(partial: Partial<EmployeeSource> = {}): EmployeeSource {
  return {
    employeeId: 1,
    workSlotId: null,
    name: "Agent",
    code: "A1",
    role: "agent",
    branchId: 1,
    branch: "Filial",
    supervisorId: 10,
    supervisor: "SVR",
    linked: true,
    active: true,
    fact: {
      status: "final",
      gross: "100000000",
      returns: "0",
      net: "100000000",
      observedDays: 30,
      daysInMonth: 30,
      updatedAt: "2026-10-01T00:00:00Z"
    },
    previousPlan: {
      status: "approved",
      value: "90000000",
      updatedAt: "2026-10-01T00:00:00Z"
    },
    history: [],
    ...partial
  };
}

function row(emp: EmployeeSource, overrides: Partial<ProposalRow> = {}): ProposalRow {
  return {
    key: `${emp.employeeId}`,
    employee: emp,
    origin: "formula",
    formula: { basis: "fact", mode: "percent", value: 10 },
    base: emp.fact?.net ?? null,
    value: null,
    issues: [],
    ready: false,
    ...overrides
  };
}

function matrix(cells: Record<number, ProposalRow | undefined>): MatrixRow {
  const first = Object.values(cells).find(Boolean)!;
  return { key: first.employee.employeeId.toString(), employee: first.employee, cells };
}

describe("block-basis-totals", () => {
  it("Sof fakt: faqat musbat net, tayyor taklif bo‘lmasa ham", () => {
    const cell = row(employee(), { ready: false, value: null });
    expect(basisAmountForCell(cell, "fact")).toBe(100000000n);
  });

  it("Eski reja: faqat approved (yoki official+pending) musbat qiymat", () => {
    const cell = row(employee(), { ready: false, value: null });
    expect(basisAmountForCell(cell, "previous_plan")).toBe(90000000n);
    expect(
      basisAmountForCell(
        row(
          employee({
            previousPlan: { status: "pending_approval", value: "50000000", updatedAt: null }
          })
        ),
        "previous_plan",
        "approved_only"
      )
    ).toBe(0n);
    expect(
      basisAmountForCell(
        row(
          employee({
            previousPlan: { status: "pending_approval", value: "50000000", updatedAt: null }
          })
        ),
        "previous_plan",
        "official"
      )
    ).toBe(50000000n);
  });

  it("sumBlockBasis: faqat tanlangan KPI kataklari, boshqa KPI aralashmaydi", () => {
    const a = employee({ employeeId: 1, fact: { ...employee().fact!, net: "100000000" } });
    const b = employee({
      employeeId: 2,
      fact: { ...employee().fact!, net: "40000000" },
      previousPlan: { status: "approved", value: "30000000", updatedAt: null }
    });
    const rows: MatrixRow[] = [
      matrix({
        7: row(a),
        8: row(a, {
          employee: {
            ...a,
            fact: { ...a.fact!, net: "999999999" },
            previousPlan: { status: "approved", value: "888888888", updatedAt: null }
          }
        })
      }),
      matrix({
        7: row(b),
        8: row(b, {
          employee: {
            ...b,
            fact: { ...b.fact!, net: "1" },
            previousPlan: { status: "approved", value: "1", updatedAt: null }
          }
        })
      })
    ];
    // KPI 7: 100M + 40M fakt; KPI 8 ning katta summalari aralashmasin
    expect(sumBlockBasis(rows, 7, "fact")).toBe(140000000n);
    expect(sumBlockBasis(rows, 7, "previous_plan")).toBe(90000000n + 30000000n);
    expect(sumBlockBasis(rows, 8, "fact")).toBe(999999999n + 1n);
  });

  it("0 yoki yo‘q fakt/reja jamga kirmaydi", () => {
    const cell = row(
      employee({
        fact: { ...employee().fact!, net: "0" },
        previousPlan: { status: "missing", value: "0", updatedAt: null }
      })
    );
    expect(basisAmountForCell(cell, "fact")).toBe(0n);
    expect(basisAmountForCell(cell, "previous_plan")).toBe(0n);
    expect(basisAmountForCell(undefined, "fact")).toBe(0n);
  });
});
