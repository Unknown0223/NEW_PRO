import { Eye, EyeOff } from "lucide-react";
import type { ProposalController } from "@taklifiy/hooks/use-proposal";
import { kpiLabel } from "@taklifiy/lib/catalog";
import { cx } from "./ui";

export function KpiColumns({ c }: { c: ProposalController }) {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label="Ko‘rinadigan KPI ustunlari"
    >
      <span className="mr-1 text-[10px] font-semibold text-[#8a998f]">KPI ustunlari:</span>
      {c.allKpiIds.map((id) => {
        const visible = c.visibleKpiIds.includes(id);
        return (
          <button
            key={id}
            aria-pressed={visible}
            onClick={() => c.toggleVisibleKpi(id)}
            className={cx(
              "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium transition",
              visible
                ? "border-brand-200 bg-brand-50 text-brand-700"
                : "border-[#e1e7e3] bg-white text-[#93a198] hover:border-brand-200"
            )}
          >
            {visible ? <Eye size={11} /> : <EyeOff size={11} />}
            {kpiLabel(c, id)}
          </button>
        );
      })}
    </div>
  );
}
