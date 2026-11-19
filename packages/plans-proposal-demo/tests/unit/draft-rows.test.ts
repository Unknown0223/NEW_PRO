import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  calculateMultiProposal,
  cloneConfig,
  type MultiProposalInput,
  type MultiProposalResult
} from "@salec/plans-proposal";
import { buildMultiDemoInput, INITIAL_CONTEXT } from "../../src/data/demo-data";
import { makeAuditEntries } from "../../src/lib/audit";
import {
  buildDraftGroups,
  buildDraftRows,
  proposalTotal,
  type DraftRow
} from "../../src/lib/draft-rows";
import type { ProposalController } from "../../src/hooks/use-proposal";

const kpiIds = [1, 2, 3];
const context = { ...INITIAL_CONTEXT, source: { year: 2026, month: 10 } };
const configs = Object.fromEntries(kpiIds.map((id) => [String(id), cloneConfig(DEFAULT_CONFIG)]));
const input: MultiProposalInput = buildMultiDemoInput(context, configs, kpiIds);
const result: MultiProposalResult = calculateMultiProposal(input);

function controller(
  removed: Array<{ kpiGroupId: number; key: string }> = [],
  audit: ReturnType<typeof makeAuditEntries> = []
): ProposalController {
  return {
    input,
    result,
    configs,
    allKpiIds: kpiIds,
    sharedDraft: { removed },
    audit
  } as unknown as ProposalController;
}

function sum(values: Iterable<bigint>): bigint {
  return [...values].reduce((a, b) => a + b, 0n);
}

function rowOf(rows: DraftRow[], kpiGroupId: number, employeeId: number): DraftRow {
  const source = result.kpis
    .find((k) => k.kpiGroupId === kpiGroupId)!
    .result.rows.find((r) => r.employee.employeeId === employeeId)!;
  return rows.find((r) => r.kpiGroupId === kpiGroupId && r.key === source.key)!;
}

describe("umumiy draft matritsasi", () => {
  it("har bir xodim × KPI uchun bitta qator chiqaradi, o‘chirilganini yashiradi", () => {
    const rows = buildDraftRows(controller());
    const expected = input.datasets.reduce((n, d) => n + d.employees.length, 0);
    expect(rows).toHaveLength(expected);
    expect(new Set(rows.map((r) => `${r.kpiGroupId}:${r.key}`)).size).toBe(expected);

    const target = rows[0]!;
    const withRemoved = buildDraftRows(
      controller([{ kpiGroupId: target.kpiGroupId, key: target.key }])
    );
    expect(withRemoved).toHaveLength(expected - 1);
    expect(
      withRemoved.some((r) => r.kpiGroupId === target.kpiGroupId && r.key === target.key)
    ).toBe(false);
  });

  it("filial → supervayzer → xodim bloklarida yopiq totalni hisoblaydi", () => {
    const rows = buildDraftRows(controller());
    const groups = buildDraftGroups(rows, kpiIds);
    expect(groups.length).toBeGreaterThan(1);
    for (const branch of groups) {
      expect(branch.supervisors.length).toBeGreaterThan(0);
      expect(branch.total).toBe(sum(branch.byKpi.values()));
      expect(branch.agentCount).toBe(branch.supervisors.reduce((n, s) => n + s.agents.length, 0));
      for (const kpiId of kpiIds) {
        expect(branch.byKpi.get(kpiId)).toBe(
          branch.supervisors.reduce((n, s) => n + (s.byKpi.get(kpiId) ?? 0n), 0n)
        );
      }
      for (const svr of branch.supervisors) {
        expect(svr.agents.length).toBeGreaterThan(0);
        expect(svr.total).toBe(sum(svr.byKpi.values()));
        for (const agent of svr.agents) {
          expect(agent.total).toBe(
            [...agent.byKpi.values()].reduce((n, row) => n + proposalTotal(row), 0n)
          );
          expect(agent.byKpi.size).toBe(kpiIds.length);
        }
      }
    }
    expect(groups[0]!.total).toBeGreaterThan(0n);
  });

  it("tayyor bo‘lmagan yoki manfiy taklifni jami summaga qo‘shmaydi", () => {
    const rows = buildDraftRows(controller());
    expect(proposalTotal(undefined)).toBe(0n);
    const blocked = rows.find((r) => !r.row?.ready);
    expect(blocked).toBeDefined();
    expect(proposalTotal(blocked)).toBe(0n);
    const ready = rows.find((r) => r.row?.ready && BigInt(r.row.value) > 0n)!;
    expect(proposalTotal(ready)).toBe(BigInt(ready.row!.value));
  });

  it("fakt yo‘q katakda eski reja va oxirgi audit yozuvi saqlanadi", () => {
    const rows = buildDraftRows(controller());
    const missing = rowOf(rows, 1, 11);
    expect(missing.factUsable).toBe(false);
    expect(missing.previousPlan).toBeTruthy();
    expect(BigInt(missing.previousPlan!)).toBeGreaterThan(0n);

    const key = missing.key;
    const audit = [
      ...makeAuditEntries(
        [
          {
            action: "formula",
            kpiGroupId: 1,
            cellKey: key,
            employeeName: missing.employeeName,
            field: "formula",
            before: "Sof fakt + 10%",
            after: "Sof fakt + 7%",
            summary: "Eski formula"
          }
        ],
        "1:1:2026-12",
        { at: "2026-11-14T09:00:00.000Z", makeId: () => "a1" }
      ),
      ...makeAuditEntries(
        [
          {
            action: "formula",
            kpiGroupId: 1,
            cellKey: key,
            employeeName: missing.employeeName,
            field: "formula",
            before: "Sof fakt + 7%",
            after: "Eski reja + 0%",
            summary: "Yangi formula"
          }
        ],
        "1:1:2026-12",
        { at: "2026-11-14T10:00:00.000Z", makeId: () => "a2" }
      )
    ];
    const withAudit = rowOf(buildDraftRows(controller([], audit)), 1, 11);
    expect(withAudit.changes).toBe(2);
    expect(withAudit.lastChange?.actor).toBe("Planlovchi");
    expect(withAudit.lastChange?.action).toBe("Yangi formula");
  });
});
