import { CheckCheck, Sparkles, X } from "lucide-react";
import { DEFAULT_CONFIG } from "@salec/plans-proposal";
import type { ProposalController } from "@/hooks/use-proposal";
import { useFormulaFields } from "@/hooks/use-formula-fields";
import { FormulaFields } from "./formula-fields";

/** Tanlangan kataklar uchun yopishqoq, ixcham, modal bo‘lmagan ommaviy panel. */
export function BulkBar({ c, onClear }: { c: ProposalController; onClear: () => void }) {
  const fields = useFormulaFields(DEFAULT_CONFIG.defaultFormula);
  if (c.selectedCells.length === 0) return null;
  const agents = new Set(c.selectedCells.map((cell) => cell.key)).size;
  const kpis = new Set(c.selectedCells.map((cell) => cell.kpiId)).size;
  const apply = () => {
    const formula = fields.read();
    if (!formula) return;
    c.applyCellFormulas(c.selectedCells, formula, `${agents} ta agent × ${kpis} ta KPI`);
  };
  return (
    <div className="sticky top-14 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-brand-200 bg-brand-50/95 px-2.5 py-1.5 shadow-sm backdrop-blur-sm">
      <span className="flex items-center gap-1.5 text-[10px] font-semibold whitespace-nowrap text-brand-700">
        <CheckCheck size={13} className="text-brand-600" />
        {c.selectedCells.length} katak · {agents} agent · {kpis} KPI
      </span>
      <div className="min-w-[240px] max-w-[420px] flex-1">
        <FormulaFields
          state={fields}
          labelPrefix="Ommaviy"
          onEnter={apply}
          trailing={
            <button
              type="button"
              onClick={apply}
              className="flex h-6 items-center gap-1 rounded-md bg-brand-700 px-2 text-[9px] font-semibold text-white hover:bg-brand-800"
            >
              <Sparkles size={10} /> Qo‘llash
            </button>
          }
        />
      </div>
      <button
        className="ml-auto flex items-center gap-1 text-[10px] whitespace-nowrap text-[#82958a] hover:text-brand-700"
        onClick={onClear}
      >
        <X size={11} /> Tanlovni tozalash
      </button>
    </div>
  );
}
