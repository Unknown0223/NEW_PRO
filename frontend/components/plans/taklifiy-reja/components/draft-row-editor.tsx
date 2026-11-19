import { Check, X } from "lucide-react";
import type { Formula } from "@salec/plans-proposal";
import { useFormulaFields } from "@taklifiy/hooks/use-formula-fields";
import type { DraftRow } from "@taklifiy/lib/draft-rows";
import { FormulaFields } from "./formula-fields";
import { Button } from "./ui";

/** Kengaytirilgan KPI ustuni ichida joyida ochiladigan ixcham qator editori. */
export function DraftRowEditor({
  row,
  colSpan,
  onSave,
  onCancel
}: {
  row: DraftRow;
  colSpan: number;
  onSave: (formula: Formula) => void;
  onCancel: () => void;
}) {
  const fields = useFormulaFields(row.formula);
  const save = () => {
    const formula = fields.read();
    if (formula) onSave(formula);
  };
  const label = `${row.employeeName} KPI ${row.kpiGroupId}`;
  return (
    <tr className="bg-brand-50/40">
      <td colSpan={colSpan} className="px-3 py-2">
        <div
          role="group"
          aria-label={`${label} qator editori`}
          className="animate-expand max-w-[520px] space-y-2 rounded-lg border border-brand-200 bg-white p-2.5 shadow-[inset_2px_0_0_#28735b]"
          onKeyDown={(e) => e.key === "Escape" && onCancel()}
        >
          <p className="text-[10px] font-semibold text-[#5d7264]">
            {row.employeeName} · {row.kpiName} — formulani tahrirlash
          </p>
          {row.row?.origin === "manual" || row.row?.origin === "excluded" ? (
            <p className="rounded bg-amber-50 px-2 py-1 text-[9px] text-amber-800">
              Bu katakda qo‘lda qiymat / chiqarish belgisi ustun turibdi; avval uni hisob-kitob
              sahifasida olib tashlang.
            </p>
          ) : null}
          <FormulaFields
            state={fields}
            labelPrefix={label}
            autoFocus
            onEnter={save}
            trailing={
              <>
                <Button
                  variant="primary"
                  aria-label="Qatorni saqlash"
                  className="h-7 px-2 text-[10px]"
                  onClick={save}
                >
                  <Check size={12} /> Qatorni saqlash
                </Button>
                <Button
                  aria-label="Tahrirni bekor qilish"
                  className="h-7 px-2 text-[10px]"
                  onClick={onCancel}
                >
                  <X size={12} /> Bekor
                </Button>
              </>
            }
          />
        </div>
      </td>
    </tr>
  );
}
