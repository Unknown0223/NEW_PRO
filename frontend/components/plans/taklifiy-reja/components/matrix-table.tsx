import { memo, useEffect, useState } from "react";
import { Info, Wand2 } from "lucide-react";
import type { ProposalController } from "@taklifiy/hooks/use-proposal";
import { kpiLabel } from "@taklifiy/lib/catalog";
import { fmt } from "@taklifiy/lib/format";
import type { MatrixRow } from "@taklifiy/lib/grouping";
import { selectableCellIds, selectionState } from "@taklifiy/lib/selection";
import { ColumnEditor } from "./column-editor";
import { InlineCell } from "./inline-cell";
import { SelectionCheckbox, cx } from "./ui";

type Props = {
  c: ProposalController;
  rows: MatrixRow[];
  onInspect: (key: string, kpiGroupId: number) => void;
  caption?: string;
};
type Expanded = { type: "cell" | "column"; kpiId: number; key?: string } | null;
const PAGE_SIZE = 40;
const CELL_WIDTH = 176;
const OPEN_WIDTH = 304;

export const MatrixTable = memo(function MatrixTable({ c, rows, onInspect, caption }: Props) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [expanded, setExpanded] = useState<Expanded>(null);
  useEffect(() => {
    setLimit(PAGE_SIZE);
    setExpanded(null);
  }, [rows, caption]);
  const shown = rows.slice(0, limit);
  const visible = c.visibleKpiIds;
  const blockIds = selectableCellIds(rows, visible);
  const blockState = selectionState(c.selected, blockIds);
  const blockLabel = caption ?? "Blok";
  const minWidth = 264 + visible.length * CELL_WIDTH + (expanded ? OPEN_WIDTH - CELL_WIDTH : 0);

  return (
    <div className="overflow-x-auto">
      <table
        className="w-full table-fixed border-collapse text-left"
        style={{ minWidth }}
        aria-label={caption ?? "Agentlar va KPI taklif jadvali"}
      >
        <colgroup>
          <col style={{ width: 40 }} />
          <col style={{ width: 200 }} />
          {visible.map((id) => (
            <col
              key={id}
              className="transition-[width] duration-200"
              style={{ width: expanded?.kpiId === id ? OPEN_WIDTH : CELL_WIDTH }}
            />
          ))}
          <col style={{ width: 36 }} />
        </colgroup>
        <thead className="table-head">
          <tr>
            <th className="px-3 py-2.5 align-top">
              <SelectionCheckbox
                label="Blokdagi barcha kataklarni tanlash"
                checked={blockState.checked}
                indeterminate={blockState.indeterminate}
                disabled={!blockIds.length}
                onChange={(on) => c.selectIds(blockIds, on)}
              />
            </th>
            <th className="py-2.5 pr-3 align-top">XODIM</th>
            {visible.map((id) => {
              const name = kpiLabel(c, id);
              const total = rows.reduce((sum, r) => {
                const cell = r.cells[id];
                return cell?.ready && cell.value ? sum + BigInt(cell.value) : sum;
              }, 0n);
              const ids = selectableCellIds(rows, [id]);
              const state = selectionState(c.selected, ids);
              const open = expanded?.type === "column" && expanded.kpiId === id;
              return (
                <th key={id} className="px-2 py-2.5 align-top">
                  <div className="flex items-start gap-1.5">
                    <SelectionCheckbox
                      className="mt-0.5"
                      label={`${name} ustunidagi kataklarni tanlash`}
                      checked={state.checked}
                      indeterminate={state.indeterminate}
                      disabled={!ids.length}
                      onChange={(on) => c.selectIds(ids, on)}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[10px] font-semibold text-[#5d7264]">
                        {name}
                      </span>
                      <span className="numeric mt-0.5 block text-[9px] font-normal text-[#93a198]">
                        {fmt(total.toString())}
                      </span>
                    </div>
                  </div>
                  <button
                    className="mt-1.5 flex items-center gap-1 rounded-md border border-[#dbe6df] bg-white px-1.5 py-0.5 text-[9px] font-semibold text-brand-700 normal-case tracking-normal hover:border-brand-300"
                    aria-expanded={open}
                    aria-label={`${name} ustunida hammasiga o‘rnatish`}
                    onClick={() => setExpanded(open ? null : { type: "column", kpiId: id })}
                  >
                    <Wand2 size={10} /> Hammasiga
                  </button>
                  {open && (
                    <ColumnEditor
                      c={c}
                      kpiId={id}
                      rows={rows}
                      blockLabel={blockLabel}
                      onClose={() => setExpanded(null)}
                    />
                  )}
                </th>
              );
            })}
            <th />
          </tr>
        </thead>
        <tbody className="divide-y divide-[#edf1ee]">
          {shown.map((r) => {
            const rowIds = selectableCellIds([r], visible);
            const rowState = selectionState(c.selected, rowIds);
            const first = visible.map((id) => ({ id, row: r.cells[id] })).find((x) => x.row);
            return (
              <tr
                key={r.key}
                className={cx(
                  "group transition-colors hover:bg-[#f8fbf9]",
                  rowState.count > 0 && "bg-brand-50/70"
                )}
              >
                <td className="px-3 py-2 align-top">
                  <SelectionCheckbox
                    className="mt-2"
                    label={`${r.employee.name} tanlash`}
                    checked={rowState.checked}
                    indeterminate={rowState.indeterminate}
                    disabled={!rowIds.length}
                    onChange={(on) => c.selectIds(rowIds, on)}
                  />
                </td>
                <td className="py-2 pr-3 align-top">
                  <button
                    className="text-left"
                    onClick={() => first?.row && onInspect(first.row.key, first.id)}
                  >
                    <span className="block truncate text-[11px] font-semibold text-[#3d5548] group-hover:text-brand-700">
                      {r.employee.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[9px] text-[#99a49d]">
                      {r.employee.code} · {r.employee.supervisor}
                    </span>
                  </button>
                </td>
                {visible.map((id) => (
                  <InlineCell
                    key={id}
                    c={c}
                    row={r.cells[id]}
                    kpiGroupId={id}
                    employeeName={r.employee.name}
                    blockRows={rows}
                    expanded={
                      expanded?.type === "cell" && expanded.kpiId === id && expanded.key === r.key
                    }
                    onExpand={() => setExpanded({ type: "cell", kpiId: id, key: r.key })}
                    onClose={() => setExpanded(null)}
                    onInspect={onInspect}
                  />
                ))}
                <td className="pr-2 align-top">
                  <button
                    className="icon-btn size-6"
                    aria-label={`${r.employee.name} hisob tafsiloti`}
                    onClick={() => first?.row && onInspect(first.row.key, first.id)}
                  >
                    <Info size={12} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="px-4 py-8 text-center text-xs text-[#94a097]">Mos agent topilmadi</p>
      )}
      {rows.length > limit && (
        <div className="border-t border-[#edf1ee] px-4 py-2 text-center">
          <button
            className="text-[10px] font-semibold text-brand-600 hover:text-brand-800"
            onClick={() => setLimit((n) => n + PAGE_SIZE)}
          >
            Yana {Math.min(PAGE_SIZE, rows.length - limit)} ta agentni ko‘rsatish (
            {rows.length - limit} qoldi)
          </button>
        </div>
      )}
    </div>
  );
});
