import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Building2, Users } from "lucide-react";
import type { ProposalController } from "@taklifiy/hooks/use-proposal";
import { kpiLabel } from "@taklifiy/lib/catalog";
import { fmt } from "@taklifiy/lib/format";
import { buildMatrix, groupByBranch, rowMatches, type StatusFilter } from "@taklifiy/lib/grouping";
import { selectableCellIds, selectionState } from "@taklifiy/lib/selection";
import { MatrixTable } from "./matrix-table";
import { Badge, Button, EmptyState, Select, SelectionCheckbox, cx } from "./ui";
import { Search, X } from "lucide-react";

export function BlocksView({
  c,
  onInspect
}: {
  c: ProposalController;
  onInspect: (key: string, kpiGroupId: number) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [openBranch, setOpenBranch] = useState<string | null>(null);
  const [openBlock, setOpenBlock] = useState<string | null>(null);
  useEffect(() => {
    c.clearSelection();
  }, [search, status, c.clearSelection]);
  const matrix = useMemo(
    () => buildMatrix(c.visibleResult, c.visibleKpiIds),
    [c.visibleResult, c.visibleKpiIds]
  );
  const filtered = useMemo(
    () => matrix.filter((r) => rowMatches(r, search, status)),
    [matrix, search, status]
  );
  const branches = useMemo(
    () => groupByBranch(filtered, c.visibleKpiIds, c.configs),
    [filtered, c.visibleKpiIds, c.configs]
  );
  const toggleBranch = (key: string) => {
    setOpenBranch((old) => (old === key ? null : key));
    setOpenBlock(null);
  };
  const toggleBlock = (key: string) => setOpenBlock((old) => (old === key ? null : key));
  return (
    <section className="card min-w-0 overflow-hidden" aria-label="Filial bloklari bo‘yicha taklif">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#eef2ef] px-4 py-3">
        <div className="relative">
          <Search size={13} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-[#9ba79f]" />
          <input
            aria-label="Agent qidirish"
            className="h-8 w-52 rounded-lg border border-[#e3e9e5] bg-[#fcfdfc] pr-2 pl-8 text-[11px]"
            placeholder="Agent, kod yoki filial…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          aria-label="Holat filtri"
          className="h-8 w-auto py-0 pl-2 text-[10px]"
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
        >
          <option value="all">Barcha holatlar</option>
          <option value="ready">Tayyor</option>
          <option value="warning">Tekshirish kerak</option>
          <option value="blocked">Ma’lumot kerak</option>
          <option value="manual">Qo‘lda kiritilgan</option>
          <option value="excluded">Chiqarilgan</option>
        </Select>
        {(search || status !== "all") && (
          <button
            className="icon-btn size-6"
            title="Filtrlarni tozalash"
            onClick={() => {
              setSearch("");
              setStatus("all");
            }}
          >
            <X size={12} />
          </button>
        )}
        <span className="ml-auto text-[10px] text-[#93a198]">
          {filtered.length} agent · {branches.length} filial
        </span>
        <Button
          className="h-7 px-2 text-[10px]"
          onClick={() => {
            setOpenBranch(null);
            setOpenBlock(null);
          }}
        >
          Hammasini yig‘ish
        </Button>
      </div>
      <div className="divide-y divide-[#e8eee9]">
        {branches.map((branch) => {
          const open = openBranch === branch.key;
          const keys = selectableCellIds(branch.rows, c.visibleKpiIds);
          const branchSelection = selectionState(c.selected, keys);
          return (
            <div key={branch.key}>
              <div
                className={cx(
                  "flex flex-wrap items-center gap-2 px-4 py-3 transition",
                  open ? "bg-brand-50/50" : "bg-[#fbfdfb] hover:bg-[#f6faf7]"
                )}
              >
                <SelectionCheckbox
                  label={`${branch.branch} filialidagi kataklarni tanlash`}
                  checked={branchSelection.checked}
                  indeterminate={branchSelection.indeterminate}
                  disabled={!keys.length}
                  onChange={(on) => c.selectIds(keys, on)}
                />
                <button
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  aria-expanded={open}
                  onClick={() => toggleBranch(branch.key)}
                >
                  <ChevronDown
                    size={15}
                    className={cx("shrink-0 text-[#8fa296] transition", open && "rotate-180")}
                  />
                  <Building2 size={15} className="shrink-0 text-brand-600" />
                  <span className="truncate text-xs font-semibold text-[#3d5548]">
                    {branch.branch}
                  </span>
                  <Badge tone="neutral">{branch.rows.length} agent</Badge>
                  {branch.totals.blockers > 0 && (
                    <Badge tone="red">{branch.totals.blockers} to‘siq</Badge>
                  )}
                </button>
                <div className="numeric ml-auto text-right">
                  <p className="text-[13px] font-bold text-brand-700">
                    {fmt(branch.totals.proposed)}{" "}
                    <span className="text-[9px] font-normal text-[#93a198]">so‘m</span>
                  </p>
                  <p className="text-[9px] text-[#93a198]">
                    {branch.totals.ready}/{branch.totals.eligible} tayyor katak
                  </p>
                </div>
              </div>
              {open && (
                <div className="space-y-2 bg-white px-3 py-3 sm:px-4">
                  <div className="flex flex-wrap gap-1.5">
                    {c.visibleKpiIds.map((id) => (
                      <span
                        key={id}
                        className="numeric rounded-md bg-[#f3f7f4] px-2 py-1 text-[9px] text-[#6d8073]"
                      >
                        {kpiLabel(c, id)}:{" "}
                        <strong>{fmt(branch.byKpi[id]?.proposed)}</strong>
                      </span>
                    ))}
                  </div>
                  {branch.blocks.map((block) => {
                    const blockOpen = openBlock === block.key;
                    const blockKeys = selectableCellIds(block.rows, c.visibleKpiIds);
                    const blockSelection = selectionState(c.selected, blockKeys);
                    return (
                      <div
                        key={block.key}
                        className="overflow-hidden rounded-lg border border-[#e4ebe6]"
                      >
                        <div
                          className={cx(
                            "flex flex-wrap items-center gap-2 px-3 py-2",
                            blockOpen ? "bg-[#f6faf7]" : "bg-white hover:bg-[#fafcfb]"
                          )}
                        >
                          <SelectionCheckbox
                            label={`${block.supervisor} blokidagi kataklarni tanlash`}
                            checked={blockSelection.checked}
                            indeterminate={blockSelection.indeterminate}
                            disabled={!blockKeys.length}
                            onChange={(on) => c.selectIds(blockKeys, on)}
                          />
                          <button
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                            aria-expanded={blockOpen}
                            onClick={() => toggleBlock(block.key)}
                          >
                            <ChevronDown
                              size={13}
                              className={cx(
                                "shrink-0 text-[#9bab9f] transition",
                                blockOpen && "rotate-180"
                              )}
                            />
                            <Users size={13} className="shrink-0 text-[#8fa296]" />
                            <span className="truncate text-[11px] font-semibold text-[#506459]">
                              {block.supervisor}
                            </span>
                            <Badge tone="neutral">{block.rows.length}</Badge>
                          </button>
                          <span className="numeric text-[11px] font-semibold text-brand-700">
                            {fmt(block.totals.proposed)}
                          </span>
                        </div>
                        {blockOpen && (
                          <MatrixTable
                            c={c}
                            rows={block.rows}
                            onInspect={onInspect}
                            caption={`${branch.branch} · ${block.supervisor}`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {branches.length === 0 && (
          <EmptyState
            title="Mos agent topilmadi"
            description="Qidiruv yoki filtrlarni o‘zgartiring."
            action={
              <Button
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                }}
              >
                Filtrlarni tozalash
              </Button>
            }
          />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e4ebe6] bg-[#fafcfb] px-4 py-3 text-[10px] text-[#8d9a91]">
        <span>
          Faqat tayyor kataklar jami summasiga kiradi. Katakni bosib bevosita % yoki summa kiriting.
        </span>
        <span className="numeric text-sm font-bold text-brand-700">
          {fmt(c.visibleResult.totals.proposed)} so‘m
        </span>
      </div>
    </section>
  );
}
