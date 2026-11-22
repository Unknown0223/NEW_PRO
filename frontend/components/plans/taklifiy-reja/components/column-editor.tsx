import { Check, X } from "lucide-react";
import { DEFAULT_CONFIG } from "@salec/plans-proposal";
import type { ProposalController } from "@taklifiy/hooks/use-proposal";
import { useFormulaFields } from "@taklifiy/hooks/use-formula-fields";
import { sumBlockBasis } from "@taklifiy/lib/block-basis-totals";
import { kpiLabel } from "@taklifiy/lib/catalog";
import { fmt } from "@taklifiy/lib/format";
import type { MatrixRow } from "@taklifiy/lib/grouping";
import { selectableCells } from "@taklifiy/lib/selection";
import { FormulaFields } from "./formula-fields";

/** Ustun sarlavhasida joyida kengayadigan ixcham, faqat shu blokka qaraydigan editor. */
export function ColumnEditor({
  c,
  kpiId,
  rows,
  blockLabel,
  onClose
}: {
  c: ProposalController;
  kpiId: number;
  rows: MatrixRow[];
  blockLabel: string;
  onClose: () => void;
}) {
  const fields = useFormulaFields(DEFAULT_CONFIG.defaultFormula);
  const cells = selectableCells(rows, [kpiId]);
  const name = kpiLabel(c, kpiId);
  const sourceStatus = c.configs[String(kpiId)]?.settings.sourceStatus ?? "approved_only";
  const basisTotal = sumBlockBasis(rows, kpiId, fields.basis, sourceStatus);
  const basisLabel = fields.basis === "fact" ? "Sof fakt" : "Eski reja";
  const apply = () => {
    const formula = fields.read();
    if (!formula) return;
    c.applyCellFormulas(cells, formula, `${blockLabel} · ${name}`);
    onClose();
  };
  return (
    <div
      role="group"
      aria-label={`${name} ustun blok editori`}
      className="animate-expand mt-1.5 space-y-1 rounded-md border border-brand-200 bg-white p-1.5 normal-case tracking-normal shadow-[inset_2px_0_0_#28735b]"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="flex items-center gap-1">
        <p
          className="min-w-0 flex-1 truncate text-[10px] font-semibold text-brand-800"
          title={blockLabel}
        >
          Butun blokka · {name}
        </p>
        <span
          className="shrink-0 rounded bg-brand-50 px-1 text-[8px] leading-4 text-brand-700"
          title="Faqat shu KPI · shu blok; qo‘lda/chiqarilgan kataklar o‘zgarmaydi"
        >
          {cells.length} katak
        </span>
        <button
          className="icon-btn size-5 shrink-0"
          aria-label="Ustun editorini yopish"
          title="Yopish (Escape)"
          onClick={onClose}
        >
          <X size={11} />
        </button>
      </div>
      <p className="numeric px-0.5 text-[9px] text-[#5d7264]">
        <span className="font-semibold text-brand-700">{fmt(basisTotal.toString())}</span>
        <span className="ml-1 text-[#93a198]">
          {basisLabel} jami (shu KPI mahsulotlari)
        </span>
      </p>
      <FormulaFields
        state={fields}
        labelPrefix={`${name} ustuni`}
        autoFocus
        onEnter={apply}
        trailing={
          <button
            type="button"
            disabled={!cells.length}
            onClick={apply}
            title="Faqat shu blokning ochiq kataklariga qo‘llanadi"
            className="flex h-6 items-center gap-1 rounded-md bg-brand-700 px-2 text-[9px] font-semibold text-white hover:bg-brand-800 disabled:opacity-40"
          >
            <Check size={10} /> Blokka qo‘llash
          </button>
        }
      />
    </div>
  );
}
