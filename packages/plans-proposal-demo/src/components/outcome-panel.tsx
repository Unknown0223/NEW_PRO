import { useMemo, useState } from "react";
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
import { DEMO_TODAY, DIRECTIONS, buildDemoEmployees, directionKpiIds } from "@/data/demo-data";
import type { ProposalController } from "@/hooks/use-proposal";
import type { OutcomeEmployeeMeta } from "@/lib/outcome-rows";
import { OutcomeMatrix } from "./outcome-matrix";
import { VerdictBadge } from "./outcome-cells";
import { Field, Select } from "./ui";

const [TODAY_YEAR, TODAY_MONTH] = DEMO_TODAY.split("-").map(Number);
const CURRENT: Period = { year: TODAY_YEAR!, month: TODAY_MONTH! };
const CLOSED_MONTHS = Array.from({ length: 8 }, (_, i) => shiftPeriod(CURRENT, -(i + 1)));
const TOLERANCES = [3, 5, 8, 10, 15];

/** Yopilgan oy: usullar oldingi oy ma’lumotlari bilan hisoblanib, haqiqiy fakt bilan solishtiriladi. */
export function OutcomePanel({ c }: { c: ProposalController }) {
  const [targetKey, setTargetKey] = useState(periodKey(CLOSED_MONTHS[0]!));
  const [tolerance, setTolerance] = useState(DEFAULT_OUTCOME_TOLERANCE);
  const target = CLOSED_MONTHS.find((p) => periodKey(p) === targetKey) ?? CLOSED_MONTHS[0]!;
  const source = previousPeriod(target);
  const directionId = c.context.directionId;
  const kpiIds = directionKpiIds(directionId);

  const { report, metaByKey } = useMemo(() => {
    const meta = new Map<string, OutcomeEmployeeMeta>();
    const datasets: OutcomeDataset[] = kpiIds.map((kpiGroupId) => {
      const base = { ...c.context, kpiGroupId, target, source };
      const actualByKey: Record<string, Money | null> = {};
      for (const employee of buildDemoEmployees({ ...base, source: target })) {
        const net = employee.fact?.net ?? null;
        actualByKey[employeeKey(employee.employeeId, employee.workSlotId)] =
          net != null && BigInt(net) > 0n ? net : null;
      }
      const sourceEmployees = buildDemoEmployees(base);
      for (const employee of sourceEmployees) {
        meta.set(`${kpiGroupId}:${employeeKey(employee.employeeId, employee.workSlotId)}`, {
          employeeId: employee.employeeId,
          code: employee.code ?? "—",
          branchId: employee.branchId,
          branch: employee.branch,
          supervisorId: employee.supervisorId,
          supervisor: employee.supervisor
        });
      }
      return { kpiGroupId, sourceEmployees, actualByKey };
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
  }, [c.context, c.configs, directionId, targetKey, tolerance]);

  const best = [...report.summaries].sort(
    (a, b) => (b.accuracyPercent ?? -1) - (a.accuracyPercent ?? -1)
  )[0]!;
  const justifiedTotal = report.summaries.reduce((sum, s) => sum + s.justified, 0);
  const direction =
    DIRECTIONS.find((d) => d.id === directionId)?.name ?? `Yo‘nalish ${directionId}`;

  return (
    <div className="animate-enter space-y-5">
      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="section-title flex items-center gap-2">
              <Target size={17} className="text-brand-600" /> Qaysi taklif o‘zini oqladi?
            </h2>
            <p className="mt-1 max-w-2xl text-[11px] leading-5 text-[#8c9b91]">
              Har bir usul {periodLabel(source)} ma’lumotlari bilan {periodLabel(target)} rejasini
              hisoblaydi, so‘ng o‘sha oyning <strong>haqiqiy sof fakti</strong> bilan
              solishtiriladi. Farq ±{tolerance}% ichida bo‘lsa «o‘zini oqladi», undan katta bo‘lsa
              yuqori/past deb baholanadi. {direction} yo‘nalishi, {kpiIds.length} ta KPI.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Field label="BAHOLASH OYI (YOPILGAN)" className="w-[168px]">
              <Select
                aria-label="Baholash oyi"
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
            <Field label="CHEGARA" className="w-[112px]">
              <Select
                aria-label="Baholash chegarasi"
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
            Bu <strong>tarixiy backtest</strong>: kelajakdagi oy uchun emas, yopilgan oy uchun
            «qaysi taklif usuli haqiqatga yaqin chiqqan» ko‘rsatiladi. Fakt mavjud bo‘lmagan
            xodim×KPI kataklari «Ma’lumot yo‘q» sifatida alohida hisoblanadi.
          </p>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            label: "Eng aniq usul",
            value: best.name,
            hint: `${best.accuracyPercent ?? 0}% katak o‘zini oqladi`,
            Icon: CheckCircle2
          },
          {
            label: "O‘zini oqlagan takliflar",
            value: `${justifiedTotal} ta`,
            hint: `${report.methods.length} usul · ${report.cells.length} katak`,
            Icon: BarChart3
          },
          {
            label: "Solishtirilgan kataklar",
            value: `${report.comparedCells} ta`,
            hint: `${periodLabel(target)} fakti mavjud`,
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
            <BarChart3 size={16} className="text-brand-600" /> Usullar ro‘yxati: oqladi / oqlanmadi
          </h3>
          <span className="text-[10px] text-[#98a69c]">
            {periodLabel(source)} → {periodLabel(target)} · chegara ±{tolerance}%
          </span>
        </div>
        <div className="overflow-x-auto">
          <table
            className="w-full min-w-[920px] border-collapse text-left"
            aria-label="Taklif usullari xulosasi"
          >
            <thead className="table-head">
              <tr>
                {[
                  "USUL",
                  "TA’RIF",
                  "SOLISHTIRILDI",
                  "OQLADI",
                  "YUQORI",
                  "PAST",
                  "MA’LUMOT YO‘Q",
                  "ANIQLIK",
                  "O‘RT. XATOLIK",
                  "XULOSA"
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
        source={source}
        target={target}
        tolerance={tolerance}
      />
    </div>
  );
}
