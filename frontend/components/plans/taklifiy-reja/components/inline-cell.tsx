import { memo } from "react";
import type { ProposalRow } from "@salec/plans-proposal";
import type { ProposalController } from "@taklifiy/hooks/use-proposal";
import { fmt } from "@taklifiy/lib/format";
import type { MatrixRow } from "@taklifiy/lib/grouping";
import { acceptedPreviousPlan, hasUsableFact } from "@taklifiy/lib/source";
import { canSelectCell, cellId } from "@taklifiy/lib/selection";
import { CellEditor } from "./cell-editor";
import { SelectionCheckbox, cx } from "./ui";

type Props = {
  c: ProposalController;
  row: ProposalRow | undefined;
  kpiGroupId: number;
  employeeName: string;
  blockRows: MatrixRow[];
  expanded: boolean;
  onExpand: () => void;
  onClose: () => void;
  onInspect: (key: string, kpiGroupId: number) => void;
};

/** Katak bosilganda modal emas, shu ustun joyida kengayadi. */
export const InlineCell = memo(function InlineCell({
  c,
  row,
  kpiGroupId,
  employeeName,
  blockRows,
  expanded,
  onExpand,
  onClose,
  onInspect
}: Props) {
  if (!row) return <td className="px-2 py-2 text-center text-[10px] text-[#b1bbb4]">—</td>;
  if (expanded) {
    return (
      <td className="bg-brand-50/60 p-1.5 align-top">
        <CellEditor
          c={c}
          row={row}
          kpiId={kpiGroupId}
          employeeName={employeeName}
          blockRows={blockRows}
          onClose={onClose}
          onInspect={onInspect}
        />
      </td>
    );
  }
  const blocked = row.issues.some((i) => i.severity === "blocking");
  const warning = row.issues.some((i) => i.severity === "warning");
  const selectable = canSelectCell(row);
  const id = cellId(kpiGroupId, row.key);
  const sourceStatus = c.configs[String(kpiGroupId)]?.settings.sourceStatus ?? "approved_only";
  const previousPlan = acceptedPreviousPlan(row, sourceStatus);
  const showPreviousPlan = !hasUsableFact(row) && previousPlan;
  return (
    <td className="px-2 py-2 align-top">
      <div className="flex items-start gap-1.5">
        <SelectionCheckbox
          className="mt-2"
          label={`${employeeName} KPI ${kpiGroupId} katagini tanlash`}
          checked={c.selected.has(id)}
          disabled={!selectable}
          onChange={() => c.toggleCell(kpiGroupId, row.key)}
        />
        <button
          className={cx(
            "group/cell min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1.5 text-left transition hover:border-brand-200 hover:bg-brand-50/50",
            !selectable && "opacity-60"
          )}
          onClick={onExpand}
          aria-expanded={false}
          aria-label={`${employeeName} KPI ${kpiGroupId} taklifini tahrirlash`}
          title="Joyida kengaytirib tahrirlash"
        >
          <span
            className={cx(
              "numeric block truncate text-[12px] font-bold",
              row.value == null ? "text-[#b1bbb4]" : blocked ? "text-red-500" : "text-brand-700"
            )}
          >
            {fmt(row.value)}
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-[8px] text-[#93a198]">
            <span
              className={cx(
                "size-1.5 shrink-0 rounded-full",
                row.origin === "excluded"
                  ? "bg-[#c5d1c8]"
                  : blocked
                    ? "bg-red-400"
                    : warning
                      ? "bg-amber-400"
                      : "bg-brand-500"
              )}
            />
            <span className="truncate">
              {row.origin === "manual"
                ? "Qo‘lda"
                : row.origin === "excluded"
                  ? "Chiqarilgan"
                  : row.origin === "inline"
                    ? "Jadval formula"
                    : row.formula.basis === "fact"
                      ? "Fakt"
                      : "Eski reja"}
            </span>
            {row.origin !== "manual" && row.origin !== "excluded" && (
              <span className="shrink-0 text-[#7f9185]">
                {row.formula.mode === "percent"
                  ? `${row.formula.value > 0 ? "+" : ""}${row.formula.value}%`
                  : `${row.formula.value > 0 ? "+" : ""}${fmt(String(Math.round(row.formula.value * 100)))}`}
              </span>
            )}
          </span>
          {showPreviousPlan && (
            <span className="mt-0.5 block truncate text-[8px] font-medium text-sky-700">
              Eski reja {fmt(previousPlan!.value)} so‘m
            </span>
          )}
        </button>
      </div>
    </td>
  );
});
