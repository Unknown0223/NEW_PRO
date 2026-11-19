import { CalendarDays, ChevronRight, Link2, RotateCcw } from "lucide-react";
import { MONTHS_UZ, periodKey, previousPeriod, shiftPeriod } from "@salec/plans-proposal";
import { DIRECTIONS, DEMO_TODAY } from "@/data/demo-data";
import type { ProposalController } from "@/hooks/use-proposal";
import { Badge, Field, Select } from "./ui";

export function ContextBar({ c }: { c: ProposalController }) {
  const { context } = c;
  const sourceFinal = periodKey(context.source) < DEMO_TODAY.slice(0, 7);
  const sourceFuture = periodKey(context.source) > DEMO_TODAY.slice(0, 7);
  const years = [...new Set([2025, 2026, 2027, 2028, context.target.year])].sort();
  return (
    <section className="card p-4 sm:px-5" aria-label="Hisob konteksti">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-[1.2fr_1.2fr_1.2fr_.7fr]">
        <Field label="MAQSAD OYI" className="col-span-2 md:col-span-1">
          <div className="flex gap-1.5">
            <span className="min-w-0 flex-1">
              <Select
                aria-label="Maqsad oyi"
                value={context.target.month}
                onChange={(e) =>
                  c.changeContext({ target: { ...context.target, month: Number(e.target.value) } })
                }
              >
                {MONTHS_UZ.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </Select>
            </span>
            <span className="w-[92px] shrink-0">
              <Select
                aria-label="Maqsad yili"
                className="px-2"
                value={context.target.year}
                onChange={(e) =>
                  c.changeContext({ target: { ...context.target, year: Number(e.target.value) } })
                }
              >
                {years.map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </Select>
            </span>
          </div>
        </Field>
        <Field label="YO‘NALISH">
          <Select
            aria-label="Yo‘nalish"
            value={context.directionId}
            onChange={(e) => c.changeContext({ directionId: Number(e.target.value) })}
          >
            {DIRECTIONS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="MANBA / ESKI OY">
          <Select
            aria-label="Manba oyi"
            value={periodKey(context.source)}
            onChange={(e) => {
              const [year, month] = e.target.value.split("-").map(Number);
              c.setSource({ year, month });
            }}
          >
            {Array.from({ length: 6 }, (_, i) => {
              const p = shiftPeriod(context.target, -(i + 1));
              return (
                <option key={periodKey(p)} value={periodKey(p)}>
                  {MONTHS_UZ[p.month - 1]} {p.year}
                </option>
              );
            })}
          </Select>
        </Field>
        <Field label="KO‘RSATKICH">
          <div className="field flex items-center justify-between bg-[#fafbfa] text-[#65786c]">
            Summa<Badge tone="neutral">UZS</Badge>
          </div>
        </Field>
      </div>
      <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#eef1ef] pt-3 text-[10px] text-[#8a968e]">
        <span className="flex items-center gap-1.5">
          <CalendarDays size={12} />
          <span>Manba holati:</span>
          {sourceFinal ? (
            <Badge tone="green">Yakunlangan oy</Badge>
          ) : sourceFuture ? (
            <Badge tone="red">Kelajak oyi · ma’lumot yo‘q</Badge>
          ) : (
            <Badge tone="amber">To‘liq emas · MTD</Badge>
          )}
        </span>
        <span className="hidden items-center gap-1.5 sm:flex">
          <Link2 size={11} />
          {periodKey(context.source)}
          <ChevronRight size={10} />
          {periodKey(context.target)}
        </span>
        <span className="hidden md:inline">
          Barcha KPI guruhlari bir yo‘nalish ichida ko‘rsatiladi
        </span>
        <button
          onClick={() => c.setSource(previousPeriod(context.target))}
          className="ml-auto flex items-center gap-1 text-brand-600 hover:text-brand-800"
        >
          <RotateCcw size={11} /> Oxirgi oyga qaytarish
        </button>
      </div>
    </section>
  );
}
