import {
  periodKey,
  type MultiProposalInput,
  type MultiProposalResult
} from "@salec/plans-proposal";
import { moneyDecimal } from "./format";

function cell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[=+@]/.test(text) || (/^-/.test(text) && !/^-?\d+(\.\d+)?$/.test(text))) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function proposalCsv(
  input: MultiProposalInput,
  result: MultiProposalResult,
  visibleKpiIds: number[],
  groups: Array<{ id: number; name: string }>
): string {
  const header = [
    "Maqsad oyi",
    "Manba oyi",
    "Yo‘nalish ID",
    "KPI ID",
    "KPI nomi",
    "Xodim ID",
    "Ish o‘rni ID",
    "Xodim",
    "Kod",
    "Filial",
    "Supervayzer",
    "Sof fakt (so‘m)",
    "Eski reja (so‘m)",
    "Eski reja maqomi",
    "Asos",
    "Usul",
    "Qiymat",
    "Hisob asosi (so‘m)",
    "Taklif (so‘m)",
    "Farq (so‘m)",
    "O‘sish %",
    "Qoida",
    "Tayyor",
    "Sabab",
    "Ogohlantirishlar"
  ];
  const lines = result.kpis
    .filter((k) => visibleKpiIds.includes(k.kpiGroupId))
    .flatMap((k) => {
      const config = input.configs[String(k.kpiGroupId)]!;
      const groupName = groups.find((g) => g.id === k.kpiGroupId)?.name ?? `KPI ${k.kpiGroupId}`;
      return k.result.rows.map((r) =>
        [
          periodKey(input.context.target),
          periodKey(input.context.source),
          input.context.directionId,
          k.kpiGroupId,
          groupName,
          r.employee.employeeId,
          r.employee.workSlotId,
          r.employee.name,
          r.employee.code,
          r.employee.branch,
          r.employee.supervisor,
          r.employee.fact ? moneyDecimal(r.employee.fact.net) : "",
          r.employee.previousPlan ? moneyDecimal(r.employee.previousPlan.value) : "",
          r.employee.previousPlan?.status ?? "missing",
          r.formula.basis,
          r.formula.mode,
          r.formula.value,
          r.base ? moneyDecimal(r.base) : "",
          r.value ? moneyDecimal(r.value) : "",
          r.adjustment ? moneyDecimal(r.adjustment) : "",
          r.growthPercent ?? "",
          r.ruleName,
          r.ready ? "ha" : "yo‘q",
          config.overrides[r.key]?.reason ?? "",
          r.issues.map((i) => `${i.code}: ${i.message}`).join(" | ")
        ]
          .map(cell)
          .join(",")
      );
    });
  return "\uFEFF" + [header.map(cell).join(","), ...lines].join("\r\n");
}
