import { AlertTriangle, Check, Info, RotateCcw, X } from "lucide-react";
import type { ProposalRow } from "@salec/plans-proposal";
import type { ProposalController } from "@taklifiy/hooks/use-proposal";
import { useFormulaFields } from "@taklifiy/hooks/use-formula-fields";
import { fmt } from "@taklifiy/lib/format";
import type { MatrixRow } from "@taklifiy/lib/grouping";
import { acceptedPreviousPlan, hasUsableFact } from "@taklifiy/lib/source";
import { canSelectCell, cellId, selectableCellIds } from "@taklifiy/lib/selection";
import { FormulaFields } from "./formula-fields";
import { SelectionCheckbox, cx } from "./ui";

/** Katak ichida joyida kengayadigan ixcham editor; modal/popover emas. */
export function CellEditor({
  c,
  row,
  kpiId,
  employeeName,
  blockRows,
  onClose,
  onInspect
}: {
  c: ProposalController;
  row: ProposalRow;
  kpiId: number;
  employeeName: string;
  blockRows: MatrixRow[];
  onClose: () => void;
  onInspect: (key: string, kpiGroupId: number) => void;
}) {
  const fields = useFormulaFields(row.formula);
  const id = cellId(kpiId, row.key);
  const selectable = canSelectCell(row);
  const protectedCell = row.origin === "manual" || row.origin === "excluded";
  const disabled = !selectable;
  const columnIds = selectableCellIds(blockRows, [kpiId]);
  const blockIds = selectableCellIds(blockRows, c.visibleKpiIds);
  const issue =
    row.issues.find((i) => i.severity === "blocking") ??
    row.issues.find((i) => i.severity === "warning");
  const sourceStatus = c.configs[String(kpiId)]?.settings.sourceStatus ?? "approved_only";
  const previousPlan = acceptedPreviousPlan(row, sourceStatus);
  const factMissing = !hasUsableFact(row);
  const usingPreviousPlan = fields.basis === "previous_plan";

  const save = () => {
    const formula = fields.read();
    if (!formula) return;
    c.setCellFormula(kpiId, row.key, formula);
    onClose();
  };
  const applySelected = () => {
    const formula = fields.read();
    if (!formula) return;
    c.applyCellFormulas(c.selectedCells, formula, "Tanlangan kataklar");
  };

  return (
    <div
      role="group"
      aria-label={`${employeeName} KPI ${kpiId} katak editori`}
      className="animate-expand space-y-1 rounded-md border border-brand-200 bg-white p-1.5 shadow-[inset_2px_0_0_#28735b]"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      {issue && (
        <p
          title={issue.message}
          className={cx(
            "flex items-center gap-1 rounded px-1 py-0.5 text-[9px] leading-3",
            issue.severity === "blocking" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
          )}
        >
          <AlertTriangle size={9} className="shrink-0" />
          <span className="truncate">{issue.message}</span>
        </p>
      )}
      {factMissing && (
        <p
          className={cx(
            "flex items-center gap-1 rounded px-1 py-0.5 text-[9px] leading-3",
            previousPlan ? "bg-sky-50 text-sky-800" : "bg-amber-50 text-amber-800"
          )}
        >
          <Info size={9} className="shrink-0" />
          <span className="truncate">
            {previousPlan
              ? `Fakt yo‘q · eski reja ${fmt(previousPlan.value)} so‘m${usingPreviousPlan ? " — asos shu" : ""}`
              : "Fakt yo‘q · eski reja ham yo‘q, qo‘lda kiriting"}
          </span>
          {previousPlan && !usingPreviousPlan && (
            <button
              type="button"
              aria-label="Eski rejani asos qilib olish"
              className="ml-auto shrink-0 font-semibold text-brand-700 hover:underline"
              onClick={() => fields.reset({ basis: "previous_plan", mode: "percent", value: 0 })}
            >
              Eski rejaga o‘tish
            </button>
          )}
        </p>
      )}
      {protectedCell && (
        <p className="flex items-center gap-1 rounded bg-[#f3f7f4] px-1 py-0.5 text-[9px] leading-3 text-[#6d8375]">
          <span className="truncate">
            {row.origin === "manual"
              ? "Qo‘lda qiymat formulasidan ustun."
              : "Katak hisobdan chiqarilgan."}
          </span>
          <button
            className="ml-auto shrink-0 font-semibold text-brand-700 hover:underline"
            onClick={() => {
              if (row.origin === "manual") c.setManual(kpiId, row.key, null);
              else c.toggleExcluded(kpiId, row.key);
            }}
          >
            {row.origin === "manual" ? "Olib tashlash" : "Qaytarish"}
          </button>
        </p>
      )}
      <FormulaFields
        state={fields}
        labelPrefix={`${employeeName} KPI ${kpiId}`}
        disabled={disabled}
        autoFocus
        onEnter={save}
        trailing={
          <>
            <button
              type="button"
              aria-label="Saqlash"
              title="Saqlash (Enter)"
              disabled={disabled}
              onClick={save}
              className="flex size-6 items-center justify-center rounded-md bg-brand-700 text-white hover:bg-brand-800 disabled:opacity-40"
            >
              <Check size={12} />
            </button>
            {row.origin === "inline" && (
              <button
                type="button"
                aria-label="Reset"
                title="Katak formulasini olib tashlash"
                className="icon-btn size-6"
                onClick={() => {
                  c.setCellFormula(kpiId, row.key, null);
                  onClose();
                }}
              >
                <RotateCcw size={11} />
              </button>
            )}
            <button
              type="button"
              aria-label="Tafsilot"
              title="Hisob tafsiloti va qo‘lda reja"
              className="icon-btn size-6"
              onClick={() => onInspect(row.key, kpiId)}
            >
              <Info size={11} />
            </button>
            <button
              type="button"
              aria-label="Editorni yopish"
              title="Yopish (Escape)"
              className="icon-btn size-6"
              onClick={onClose}
            >
              <X size={12} />
            </button>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-[#e6eee8] pt-1">
        <SelectionCheckbox
          className="size-3"
          label={`${employeeName} KPI ${kpiId} katagini tanlash`}
          checked={c.selected.has(id)}
          disabled={!selectable}
          onChange={() => c.toggleCell(kpiId, row.key)}
        />
        <button
          className="text-[9px] font-semibold text-brand-700 hover:underline"
          onClick={() => c.selectIds(columnIds, true)}
        >
          Ustunni tanlash
        </button>
        <button
          className="text-[9px] font-semibold text-brand-700 hover:underline"
          onClick={() => c.selectIds(blockIds, true)}
        >
          Blokda hammasini tanlash
        </button>
      </div>
      {c.selectedCells.length > 0 && (
        <button
          type="button"
          disabled={disabled}
          onClick={applySelected}
          className="h-6 w-full rounded-md border border-brand-200 bg-brand-50 text-[9px] font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-40"
        >
          Tanlangan {c.selectedCells.length} katakka qo‘llash
        </button>
      )}
    </div>
  );
}
