import { calculateProposal, summarizeRows, validateContext } from "./calculate";
import { validateConfig } from "./config";
import { addMoney } from "./money";
import type {
  DirectionContext,
  MultiProposalInput,
  MultiProposalResult,
  ProposalRow,
  ProposalTotals
} from "./types";

export function emptyTotals(): ProposalTotals {
  return {
    eligible: 0,
    ready: 0,
    excluded: 0,
    warnings: 0,
    blockers: 0,
    base: "0",
    proposed: "0",
    previousPlan: "0",
    fact: "0"
  };
}

export function combineTotals(items: ProposalTotals[]): ProposalTotals {
  const out = emptyTotals();
  for (const t of items) {
    out.eligible += t.eligible;
    out.ready += t.ready;
    out.excluded += t.excluded;
    out.warnings += t.warnings;
    out.blockers += t.blockers;
    out.base = addMoney(out.base, t.base);
    out.proposed = addMoney(out.proposed, t.proposed);
    out.previousPlan = addMoney(out.previousPlan, t.previousPlan);
    out.fact = addMoney(out.fact, t.fact);
  }
  return out;
}

/** Bir yo'nalishdagi barcha KPI guruhlari uchun deterministik hisob. */
export function calculateMultiProposal(input: MultiProposalInput): MultiProposalResult {
  const ctx = input.context;
  if (!input.datasets.length) throw new Error("Kamida bitta KPI dataset kerak");
  const seen = new Set<number>();
  for (const d of input.datasets) {
    if (!Number.isInteger(d.kpiGroupId) || d.kpiGroupId <= 0)
      throw new Error("Noto‘g‘ri KPI guruhi");
    if (seen.has(d.kpiGroupId)) throw new Error("KPI guruhi takrorlangan");
    seen.add(d.kpiGroupId);
    const config = input.configs[String(d.kpiGroupId)];
    if (!config) throw new Error(`KPI ${d.kpiGroupId} uchun konfiguratsiya yo‘q`);
    const error = validateConfig(config);
    if (error) throw new Error(`KPI ${d.kpiGroupId}: ${error}`);
    validateContext({ ...ctx, kpiGroupId: d.kpiGroupId });
  }
  const kpis = input.datasets.map((d) => ({
    kpiGroupId: d.kpiGroupId,
    result: calculateProposal({
      context: { ...ctx, kpiGroupId: d.kpiGroupId },
      config: input.configs[String(d.kpiGroupId)]!,
      employees: d.employees
    })
  }));
  return { kpis, totals: combineTotals(kpis.map((k) => k.result.totals)) };
}

/** KPI kesimidagi qatorlarni bitta xodim kaliti bo'yicha birlashtirish uchun yordamchi. */
export function rowsByEmployee(kpis: MultiProposalResult["kpis"]): Map<string, ProposalRow[]> {
  const map = new Map<string, ProposalRow[]>();
  for (const k of kpis) {
    for (const row of k.result.rows) {
      const list = map.get(row.key) ?? [];
      list.push(row);
      map.set(row.key, list);
    }
  }
  return map;
}

export function totalsForRows(
  rows: ProposalRow[],
  sourceStatus: "approved_only" | "official" = "approved_only"
): ProposalTotals {
  return summarizeRows(rows, sourceStatus);
}

export type { DirectionContext };
