import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DEFAULT_OUTCOME_TOLERANCE,
  buildOutcomeReport,
  employeeKey,
  periodKey,
  periodLabel,
  previousPeriod,
  shiftPeriod,
  type Money,
  type OutcomeDataset,
  type Period
} from "@salec/plans-proposal";
import { BarChart3, CheckCircle2, Info, Target } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import type { ProposalController } from "@taklifiy/hooks/use-proposal";
import { directionLabel } from "@taklifiy/lib/catalog";
import { fetchProposalContext, proposalKeys } from "@taklifiy/lib/proposals-api";
import type { OutcomeEmployeeMeta } from "@taklifiy/lib/outcome-rows";
import { OutcomeMatrix } from "./outcome-matrix";
import { VerdictBadge } from "./outcome-cells";
import { Field, Select } from "./ui";

function nowPeriod(): Period {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

const CURRENT = nowPeriod();
const CLOSED_MONTHS = Array.from({ length: 8 }, (_, i) => shiftPeriod(CURRENT, -(i + 1)));
const TOLERANCES = [3, 5, 8, 10, 15];

/** Yopilgan oy: usullar oldingi oy ma’lumotlari bilan hisoblanib, haqiqiy fakt bilan solishtiriladi. */
export function OutcomePanel({ c }: { c: ProposalController }) {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const [targetKey, setTargetKey] = useState(periodKey(CLOSED_MONTHS[0]!));
  const [tolerance, setTolerance] = useState(DEFAULT_OUTCOME_TOLERANCE);
  const target = CLOSED_MONTHS.find((p) => periodKey(p) === targetKey) ?? CLOSED_MONTHS[0]!;
  const source = previousPeriod(target);
  const directionId = c.context.directionId;

  const sourceQ = useQuery({
    queryKey: proposalKeys.context(tenantSlug, directionId, target, source),
    queryFn: () => fetchProposalContext(tenantSlug!, directionId, target, source),
    enabled: Boolean(tenantSlug)
  });
  const actualQ = useQuery({
    queryKey: proposalKeys.context(tenantSlug, directionId, shiftPeriod(target, 1), target),
    queryFn: () =>
      fetchProposalContext(tenantSlug!, directionId, shiftPeriod(target, 1), target),
    enabled: Boolean(tenantSlug)
  });

  const kpiIds = useMemo(
    () =>
      sourceQ.data?.kpi_groups.map((g) => g.id) ??
      c.liveMeta?.kpiGroups.map((g) => g.id) ??
      c.allKpiIds,
    [sourceQ.data, c.liveMeta, c.allKpiIds]
  );
  const kpiNames = sourceQ.data?.kpi_groups ?? c.liveMeta?.kpiGroups ?? [];

  const { report, metaByKey } = useMemo(() => {
    const meta = new Map<string, OutcomeEmployeeMeta>();
    const sourceDatasets = sourceQ.data?.datasets ?? [];
    const actualByKpi = new Map(
      (actualQ.data?.datasets ?? []).map((d) => [d.kpiGroupId, d.employees] as const)
    );
    const datasets: OutcomeDataset[] = sourceDatasets.map((d) => {
      const actualByKey: Record<string, Money | null> = {};
      for (const employee of actualByKpi.get(d.kpiGroupId) ?? []) {
        const net = employee.fact?.net ?? null;
        actualByKey[employeeKey(employee.employeeId, employee.workSlotId)] =
          net != null && BigInt(net) > 0n ? net : null;
      }
      for (const employee of d.employees) {
        meta.set(`${d.kpiGroupId}:${employeeKey(employee.employeeId, employee.workSlotId)}`, {
          employeeId: employee.employeeId,
          code: employee.code ?? "—",
          branchId: employee.branchId,
          branch: employee.branch,
          supervisorId: employee.supervisorId,
          supervisor: employee.supervisor
        });
      }
      return { kpiGroupId: d.kpiGroupId, sourceEmployees: d.employees, actualByKey };
    });
    return {
      report: buildOutcomeReport({
        context: {
          tenantId: c.context.tenantId,
          directionId,
          target,
          source,
          metric: "cost"
        },
        datasets,
        draftConfigs: c.configs,
        tolerancePercent: tolerance
      }),
      metaByKey: meta
    };
  }, [sourceQ.data, actualQ.data, c.context.tenantId, c.configs, directionId, target, source, tolerance]);

  const best = [...report.summaries].sort(
    (a, b) => (b.accuracyPercent ?? -1) - (a.accuracyPercent ?? -1)
  )[0];
  const justifiedTotal = report.summaries.reduce((sum, s) => sum + s.justified, 0);
  const direction = directionLabel(c, directionId);
  const loading = sourceQ.isLoading || actualQ.isLoading;

  return (
    <div className="animate-enter space-y-5">
      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="section-title flex items-center gap-2">
              <Target size={17} className="text-brand-600" /> Какое предложение оправдалось?
            </h2>
            <p className="mt-1 max-w-2xl text-[11px] leading-5 text-[#8c9b91]">
              Каждый метод считает план {periodLabel(target)} по данным {periodLabel(source)}, затем
              сравнивает с <strong>фактическим нетто</strong> того же месяца. Отклонение в пределах ±
              {tolerance}% — «оправдалось», больше — завышено/занижено. Направление {direction}, KPI:{" "}
              {kpiIds.length}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Field label="МЕСЯЦ ОЦЕНКИ (ЗАКРЫТЫЙ)" className="w-[168px]">
              <Select
                aria-label="Месяц оценки"
                value={targetKey}
                onChange={(e) => setTargetKey(e.target.value)}
              >
                {CLOSED_MONTHS.map((p) => (
                  <option key={periodKey(p)} value={periodKey(p)}>
                    {periodLabel(p)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="ПОРОГ" className="w-[112px]">
              <Select
                aria-label="Порог оценки"
                value={tolerance}
                onChange={(e) => setTolerance(Number(e.target.value))}
              >
                {TOLERANCES.map((t) => (
                  <option key={t} value={t}>
                    ±{t}%
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-sky-100 bg-sky-50/60 p-3 text-[11px] leading-5 text-sky-800">
          <Info size={15} className="mt-0.5 shrink-0" />
          <p>
            Это <strong>исторический backtest</strong>: не для будущего месяца, а для закрытого —
            какой метод предложения ближе к факту. Ячейки без факта считаются отдельно как «Нет
            данных».
          </p>
        </div>
      </section>

      {loading ? (
        <p className="px-1 text-[11px] text-slate-500">Загрузка данных анализа…</p>
      ) : kpiIds.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-[11px] text-amber-900">
          Нет KPI-групп для сравнения. Сначала настройте KPI и агентов в «Установка планов».
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                label: "Самый точный метод",
                value: best?.name ?? "—",
                hint: `${best?.accuracyPercent ?? 0}% ячеек оправдались`,
                Icon: CheckCircle2
              },
              {
                label: "Оправдавшиеся предложения",
                value: `${justifiedTotal}`,
                hint: `${report.methods.length} методов · ${report.cells.length} ячеек`,
                Icon: BarChart3
              },
              {
                label: "Сравнённые ячейки",
                value: `${report.comparedCells}`,
                hint: `факт ${periodLabel(target)}`,
                Icon: Target
              }
            ].map(({ label, value, hint, Icon }) => (
              <div key={label} className="card p-4">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#8b9a90]">
                  <Icon size={13} className="text-brand-600" /> {label}
                </div>
                <p className="mt-2 text-base font-bold text-[#263e35]">{value}</p>
                <p className="mt-0.5 text-[10px] text-[#9aa79e]">{hint}</p>
              </div>
            ))}
          </div>

          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e8eee9] px-5 py-4">
              <h3 className="section-title flex items-center gap-2">
                <BarChart3 size={16} className="text-brand-600" /> Методы: оправдалось / нет
              </h3>
              <span className="text-[10px] text-[#98a69c]">
                {periodLabel(source)} → {periodLabel(target)} · порог ±{tolerance}%
              </span>
            </div>
            <div className="overflow-x-auto">
              <table
                className="w-full min-w-[920px] border-collapse text-left"
                aria-label="Сводка методов предложения"
              >
                <thead className="table-head">
                  <tr>
                    {[
                      "МЕТОД",
                      "ОПИСАНИЕ",
                      "СРАВНЕНО",
                      "ОПРАВДАЛОСЬ",
                      "ВЫШЕ",
                      "НИЖЕ",
                      "НЕТ ДАННЫХ",
                      "ТОЧНОСТЬ",
                      "СР. ОШИБКА",
                      "ИТОГ"
                    ].map((h) => (
                      <th key={h} className="px-3 py-2.5 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-[11px] text-[#5d7264]">
                  {report.summaries.map((s) => (
                    <tr key={s.id} className="border-t border-[#edf1ee] hover:bg-[#fafcfb]">
                      <td className="px-3 py-2.5 font-semibold whitespace-nowrap">{s.name}</td>
                      <td className="max-w-[240px] px-3 py-2.5 text-[10px] text-[#8b9a90]">
                        {s.description}
                      </td>
                      <td className="numeric px-3 py-2.5">{s.compared}</td>
                      <td className="numeric px-3 py-2.5 font-semibold text-brand-700">
                        {s.justified}
                      </td>
                      <td className="numeric px-3 py-2.5 text-red-600">{s.over}</td>
                      <td className="numeric px-3 py-2.5 text-amber-600">{s.under}</td>
                      <td className="numeric px-3 py-2.5 text-[#a0aba4]">{s.noData}</td>
                      <td className="numeric px-3 py-2.5 font-semibold">
                        {s.accuracyPercent == null ? "—" : `${s.accuracyPercent}%`}
                      </td>
                      <td className="numeric px-3 py-2.5">
                        {s.meanAbsErrorPercent == null ? "—" : `${s.meanAbsErrorPercent}%`}
                      </td>
                      <td className="px-3 py-2.5">
                        <VerdictBadge verdict={s.verdict} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <OutcomeMatrix
            report={report}
            metaByKey={metaByKey}
            kpiIds={kpiIds}
            kpiNames={kpiNames}
            source={source}
            target={target}
            tolerance={tolerance}
          />
        </>
      )}
    </div>
  );
}
