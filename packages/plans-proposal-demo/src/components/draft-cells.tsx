import { ChevronRight, History, Pencil, Trash2 } from "lucide-react";
import { auditTime } from "@/lib/audit";
import type { CellRefState, DraftRow } from "@/lib/draft-rows";
import { fmt, formulaLabel, rowStatus } from "@/lib/format";
import { Badge, Button, cx } from "./ui";

function statusTone(status: string): "green" | "red" | "amber" | "neutral" {
  return status === "Tayyor"
    ? "green"
    : status === "Ma’lumot kerak"
      ? "red"
      : status === "Tekshiring"
        ? "amber"
        : "neutral";
}

type CellProps = {
  row: DraftRow | undefined;
  id: number;
  employeeName: string;
  onHistory: (cell: NonNullable<CellRefState>) => void;
};

/** Yopiq KPI ustuni: faqat taklif summasi + holat + bitta tarix tugmasi. */
export function CompactCell({
  row,
  id,
  employeeName,
  onExpand,
  onHistory
}: CellProps & { onExpand: (id: number) => void }) {
  const status = row?.row ? rowStatus(row.row) : "—";
  return (
    <td key={id} className="px-2 py-1.5 align-top">
      <button
        type="button"
        aria-label={`${employeeName} KPI ${id} katagi`}
        title="KPI ustunini kengaytirib tafsilotni ko‘rish"
        onClick={() => onExpand(id)}
        className="w-full rounded-md border border-transparent px-2 py-1 text-left transition hover:border-brand-200 hover:bg-brand-50/50"
      >
        <span
          className={cx(
            "numeric block text-[11px] font-bold",
            row?.row?.value == null
              ? "text-[#b1bbb4]"
              : status === "Ma’lumot kerak"
                ? "text-red-500"
                : "text-brand-700"
          )}
        >
          {fmt(row?.row?.value)}
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-[8px] text-[#93a198]">
          <span
            className={cx(
              "size-1.5 shrink-0 rounded-full",
              status === "Tayyor"
                ? "bg-brand-500"
                : status === "Ma’lumot kerak"
                  ? "bg-red-400"
                  : status === "Tekshiring"
                    ? "bg-amber-400"
                    : "bg-[#c5d1c8]"
            )}
          />
          {status}
          <ChevronRight size={9} className="ml-auto" />
        </span>
      </button>
      {row ? (
        <div className="mt-1 flex justify-end">
          <button
            type="button"
            aria-label={`${employeeName} KPI ${id} tarixi`}
            title="Katak tarixi (kim / qachon / nima)"
            className="icon-btn size-5"
            onClick={() => onHistory({ kpiGroupId: id, key: row.key, employeeName })}
          >
            <History size={10} />
          </button>
        </div>
      ) : (
        <p className="mt-1 text-right text-[9px] text-[#a0aba4]">Qator o‘chirilgan</p>
      )}
    </td>
  );
}

/** Kengaygan KPI ustuni ichidagi 6 ta tafsilot katagi. */
export function DetailCells({
  row,
  id,
  employeeName,
  onEdit,
  onDelete,
  onHistory
}: CellProps & {
  onEdit: (cell: { kpiGroupId: number; key: string }) => void;
  onDelete: (row: DraftRow) => void;
}) {
  const label = `${employeeName} KPI ${id}`;
  const status = row?.row ? rowStatus(row.row) : "O‘chirilgan";
  return (
    <>
      <td className="px-2 py-1.5 align-top">
        <span className="numeric block text-[10px] font-semibold">{fmt(row?.fact)}</span>
        {row && !row.factUsable && row.previousPlan && (
          <span className="block truncate text-[8px] font-medium text-sky-700">
            Eski reja {fmt(row.previousPlan)} so‘m
          </span>
        )}
      </td>
      <td className="px-2 py-1.5 text-[10px] whitespace-nowrap">
        {row ? formulaLabel(row.formula) : "—"}
      </td>
      <td className="numeric px-2 py-1.5 text-[10px] font-semibold">{fmt(row?.row?.value)}</td>
      <td className="px-2 py-1.5">
        <Badge tone={row ? statusTone(status) : "neutral"}>{status}</Badge>
      </td>
      <td className="max-w-[170px] px-2 py-1.5 text-[9px] leading-4 text-[#7d8e82]">
        {row?.lastChange ? (
          <>
            <span className="font-semibold">{row.lastChange.actor}</span> ·{" "}
            {auditTime(row.lastChange.at)}
            <span className="block truncate text-[#a0aba4]">{row.lastChange.action}</span>
          </>
        ) : (
          <span className="text-[#b0bbb3]">O‘zgartirilmagan</span>
        )}
      </td>
      <td className="px-2 py-1.5">
        {row ? (
          <div className="flex flex-wrap gap-1">
            <Button
              aria-label={`${label} qatorini tahrirlash`}
              title="Qatorni joyida tahrirlash"
              className="h-7 px-2 text-[10px]"
              onClick={() => onEdit({ kpiGroupId: id, key: row.key })}
            >
              <Pencil size={10} /> Tahrir
            </Button>
            <Button
              aria-label={`${label} tarixi`}
              title="Katak tarixi"
              className="h-7 px-2 text-[10px]"
              onClick={() => onHistory({ kpiGroupId: id, key: row.key, employeeName })}
            >
              <History size={10} /> Tarix
              {row.changes > 0 && (
                <span className="rounded bg-brand-50 px-1 text-[9px] text-brand-700">
                  {row.changes}
                </span>
              )}
            </Button>
            <Button
              aria-label={`${label} qatorini o‘chirish`}
              title="Qatorni o‘chirish"
              variant="ghost"
              className="h-7 px-2 text-[10px] hover:text-red-600"
              onClick={() => onDelete(row)}
            >
              <Trash2 size={10} />
            </Button>
          </div>
        ) : (
          <span className="text-[9px] text-[#a0aba4]">Qator o‘chirilgan</span>
        )}
      </td>
    </>
  );
}
