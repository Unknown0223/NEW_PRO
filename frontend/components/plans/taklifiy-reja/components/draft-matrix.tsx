import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronRight, FileClock, Info, RotateCcw } from "lucide-react";
import { kpiLabel } from "@taklifiy/lib/catalog";
import type { ProposalController } from "@taklifiy/hooks/use-proposal";
import { fmt } from "@taklifiy/lib/format";
import {
  buildDraftGroups,
  buildDraftRows,
  type AgentGroup,
  type CellRefState,
  type DraftRow
} from "@taklifiy/lib/draft-rows";
import { CompactCell, DetailCells } from "./draft-cells";
import { DraftRowEditor } from "./draft-row-editor";
import { Badge, Button, EmptyState, Select, cx } from "./ui";

const DETAIL_COLUMNS = [
  "MANBA FAKT",
  "FORMULA",
  "TAKLIF",
  "HOLAT",
  "OXIRGI O‘ZGARTIRISH",
  "AMALLAR"
] as const;
const DETAIL_WIDTHS = [130, 150, 125, 105, 175, 150];
const LABEL_WIDTH = 220;
const COMPACT_WIDTH = 176;
const TOTAL_WIDTH = 130;
const STICKY_LEFT =
  "sticky left-0 z-20 border-r border-[#e5ebe7] bg-[#f8faf9] shadow-[1px_0_0_#e5ebe7]";
const STICKY_LEFT_BODY =
  "sticky left-0 z-20 border-r border-[#e5ebe7] bg-white shadow-[1px_0_0_#e5ebe7]";
const STICKY_RIGHT =
  "sticky right-0 z-20 border-l border-[#e5ebe7] bg-[#f8faf9] shadow-[-1px_0_0_#e5ebe7]";
const STICKY_RIGHT_BODY =
  "sticky right-0 z-20 border-l border-[#e5ebe7] bg-white shadow-[-1px_0_0_#e5ebe7]";

type GroupTotals = { byKpi: Map<number, bigint>; total: bigint };

const fmtBig = (value: bigint) => fmt(value.toString());

/** KPI ustunlari tepada, ierarxiya bloklari yopiq holda total, ochilganda katak tafsiloti. */
export function DraftMatrix({
  c,
  onDelete,
  onHistory
}: {
  c: ProposalController;
  onDelete: (row: DraftRow) => void;
  onHistory: (cell: NonNullable<CellRefState>) => void;
}) {
  const [query, setQuery] = useState("");
  const [kpiFilter, setKpiFilter] = useState(0);
  const [expandedKpi, setExpandedKpi] = useState<number | null>(null);
  const [openBranches, setOpenBranches] = useState<Set<number>>(new Set());
  const [openSupervisors, setOpenSupervisors] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ kpiGroupId: number; key: string } | null>(null);

  const kpiIds = useMemo(
    () => (kpiFilter === 0 ? c.allKpiIds : [kpiFilter]),
    [c.allKpiIds, kpiFilter]
  );
  const rows = useMemo(
    () => buildDraftRows(c),
    [c.input.datasets, c.result.kpis, c.configs, c.sharedDraft.removed, c.audit]
  );
  const groups = useMemo(
    () =>
      buildDraftGroups(
        rows.filter((r) => kpiIds.includes(r.kpiGroupId)),
        kpiIds
      ),
    [rows, kpiIds]
  );

  useEffect(() => {
    if (!groups.length) return;
    setOpenBranches((old) => (old.size ? old : new Set([groups[0]!.id])));
    setOpenSupervisors((old) => (old.size ? old : new Set([groups[0]!.supervisors[0]!.key])));
  }, [groups]);
  // KPI ustunlari default yopiq: faqat umumiy total ko‘rinadi, bosilganda tafsilot ochiladi.
  useEffect(() => {
    setExpandedKpi((old) => (old != null && kpiIds.includes(old) ? old : null));
    setEditing(null);
  }, [kpiIds]);
  useEffect(() => {
    setEditing((old) => (old && old.kpiGroupId === expandedKpi ? old : null));
  }, [expandedKpi]);

  const q = query.trim().toLowerCase();
  const forceOpen = q.length > 0;
  const branchOpen = (id: number) => forceOpen || openBranches.has(id);
  const supervisorOpen = (key: string) => forceOpen || openSupervisors.has(key);
  const matches = (agent: AgentGroup) =>
    q === "" || `${agent.name} ${agent.code}`.toLowerCase().includes(q);
  const visibleGroups = groups
    .map((branch) => ({
      ...branch,
      supervisors: branch.supervisors
        .map((svr) => ({ ...svr, agents: svr.agents.filter(matches) }))
        .filter((svr) => svr.agents.length > 0)
    }))
    .filter((branch) => branch.supervisors.length > 0);

  const colWidths = [LABEL_WIDTH];
  for (const id of kpiIds) {
    if (expandedKpi === id) colWidths.push(...DETAIL_WIDTHS);
    else colWidths.push(COMPACT_WIDTH);
  }
  colWidths.push(TOTAL_WIDTH);
  const totalCols = colWidths.length;
  const minWidth = colWidths.reduce((a, b) => a + b, 0);
  const kpiName = (id: number) => kpiLabel(c, id);

  const toggleBranch = (id: number) =>
    setOpenBranches((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleSupervisor = (key: string) =>
    setOpenSupervisors((old) => {
      const next = new Set(old);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const groupRow = (
    group: GroupTotals,
    label: string,
    agentCount: number,
    depth: number,
    open: boolean,
    onToggle: () => void
  ) => (
    <tr className="border-t border-[#e5ebe7] bg-[#f8faf9] text-[11px] text-[#4c6256]">
      <td className={cx(STICKY_LEFT, "px-3 py-2")} style={{ paddingLeft: 12 + depth * 18 }}>
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${label} blokini ${open ? "yopish" : "ochish"}`}
          onClick={onToggle}
          className="flex w-full items-center gap-1.5 text-left font-semibold hover:text-brand-700"
        >
          <ChevronRight
            size={13}
            className={cx("shrink-0 transition-transform", open && "rotate-90")}
          />
          <span className="truncate">{label}</span>
          <Badge tone="neutral">{agentCount} agent</Badge>
        </button>
      </td>
      {kpiIds.map((id) =>
        expandedKpi === id ? (
          <td key={id} colSpan={DETAIL_COLUMNS.length} className="numeric px-3 py-2 font-semibold">
            {fmtBig(group.byKpi.get(id) ?? 0n)}{" "}
            <span className="text-[9px] font-normal text-[#98a69c]">jami</span>
          </td>
        ) : (
          <td key={id} className="numeric px-3 py-2 font-semibold">
            {fmtBig(group.byKpi.get(id) ?? 0n)}
          </td>
        )
      )}
      <td className={cx(STICKY_RIGHT, "numeric px-3 py-2 font-bold text-brand-700")}>
        {fmtBig(group.total)}
      </td>
    </tr>
  );

  const editingRow = editing
    ? rows.find((r) => r.key === editing.key && r.kpiGroupId === editing.kpiGroupId)
    : undefined;

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e8eee9] px-5 py-4">
        <div>
          <h3 className="section-title flex items-center gap-2">
            <FileClock size={16} className="text-brand-600" /> Tayyor draft jadvali
          </h3>
          <p className="mt-1 flex items-center gap-1 text-[10px] text-[#98a69c]">
            <Info size={11} /> Ierarxiya bo‘yicha bloklar: yopiq holda jami, KPI ustunini bossangiz
            6 ta tafsilot ustuni KPI ichida gorizontal surilib ochiladi
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="field h-9 w-[168px] text-[11px]"
            aria-label="Draft jadvalida qidirish"
            placeholder="Xodim qidirish…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Select
            aria-label="Draft jadvali KPI filtri"
            className="h-9 w-[172px] text-[11px]"
            value={kpiFilter}
            onChange={(e) => setKpiFilter(Number(e.target.value))}
          >
            <option value={0}>Barcha KPI</option>
            {c.allKpiIds.map((id) => (
              <option key={id} value={id}>
                {kpiName(id)}
              </option>
            ))}
          </Select>
          <Button
            onClick={() => {
              setOpenBranches(new Set());
              setOpenSupervisors(new Set());
            }}
          >
            <RotateCcw size={12} /> Bloklarni yig‘ish
          </Button>
        </div>
      </div>

      {visibleGroups.length === 0 ? (
        <EmptyState
          title="Mos qator topilmadi"
          description="Qidiruvni o‘zgartiring yoki o‘chirilgan qatorlarni tiklang."
          action={
            c.sharedDraft.removed.length > 0 ? (
              <Button variant="primary" onClick={c.restoreAllRows}>
                <RotateCcw size={13} /> Barcha qatorlarni tiklash
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div
          className="overflow-x-auto"
          role="region"
          aria-label="KPI tafsilotlari gorizontal surish maydoni"
          tabIndex={0}
        >
          <table
            className="w-full table-fixed border-collapse text-left text-[11px] text-[#5d7264]"
            style={{ minWidth }}
            aria-label="Umumiy taklifiy reja draft jadvali"
          >
            <colgroup>
              {colWidths.map((width, index) => (
                <col key={index} style={{ width }} />
              ))}
            </colgroup>
            <thead className="table-head">
              <tr>
                <th rowSpan={expandedKpi ? 2 : 1} className={cx(STICKY_LEFT, "z-30 px-3 py-2.5")}>
                  XODIM / BLOK
                </th>
                {kpiIds.map((id) => {
                  const open = expandedKpi === id;
                  return (
                    <th
                      key={id}
                      colSpan={open ? DETAIL_COLUMNS.length : 1}
                      rowSpan={open ? 1 : expandedKpi ? 2 : 1}
                      className="px-2 py-2.5"
                    >
                      <button
                        type="button"
                        aria-label={`${kpiName(id)} ustunini ${open ? "yopish" : "kengaytirish"}`}
                        onClick={() => setExpandedKpi(open ? null : id)}
                        className="flex w-full items-center gap-1.5 text-left hover:text-brand-700"
                      >
                        <ChevronRight
                          size={12}
                          className={cx("shrink-0 transition-transform", open && "rotate-90")}
                        />
                        <span className="truncate">{kpiName(id)}</span>
                        {open && <Badge tone="green">tafsilot · suring →</Badge>}
                      </button>
                    </th>
                  );
                })}
                <th rowSpan={expandedKpi ? 2 : 1} className={cx(STICKY_RIGHT, "z-30 px-3 py-2.5")}>
                  JAMI
                </th>
              </tr>
              {expandedKpi != null && (
                <tr>
                  {DETAIL_COLUMNS.map((h) => (
                    <th key={h} className="px-2 py-2 text-[9px] whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {visibleGroups.map((branch) => (
                <Fragment key={branch.id}>
                  {groupRow(branch, branch.name, branch.agentCount, 0, branchOpen(branch.id), () =>
                    toggleBranch(branch.id)
                  )}
                  {branchOpen(branch.id) &&
                    branch.supervisors.map((svr) => (
                      <Fragment key={svr.key}>
                        {groupRow(
                          svr,
                          svr.name,
                          svr.agents.length,
                          1,
                          supervisorOpen(svr.key),
                          () => toggleSupervisor(svr.key)
                        )}
                        {supervisorOpen(svr.key) &&
                          svr.agents.map((agent) => (
                            <Fragment key={agent.key}>
                              <tr className="border-t border-[#edf1ee] hover:bg-[#fafcfb]">
                                <td
                                  className={cx(STICKY_LEFT_BODY, "px-3 py-2 whitespace-nowrap")}
                                  style={{ paddingLeft: 12 + 2 * 18 }}
                                >
                                  <span className="font-medium">{agent.name}</span>
                                  <span className="ml-1.5 text-[9px] text-[#a0aba4]">
                                    {agent.code}
                                  </span>
                                </td>
                                {kpiIds.map((id) =>
                                  expandedKpi === id ? (
                                    <Fragment key={id}>
                                      <DetailCells
                                        row={agent.byKpi.get(id)}
                                        id={id}
                                        employeeName={agent.name}
                                        onEdit={setEditing}
                                        onDelete={onDelete}
                                        onHistory={onHistory}
                                      />
                                    </Fragment>
                                  ) : (
                                    <CompactCell
                                      key={id}
                                      row={agent.byKpi.get(id)}
                                      id={id}
                                      employeeName={agent.name}
                                      onExpand={setExpandedKpi}
                                      onHistory={onHistory}
                                    />
                                  )
                                )}
                                <td
                                  className={cx(
                                    STICKY_RIGHT_BODY,
                                    "numeric px-3 py-2 font-semibold"
                                  )}
                                >
                                  {fmtBig(agent.total)}
                                </td>
                              </tr>
                              {editingRow &&
                                editing?.key === agent.key &&
                                editing.kpiGroupId === expandedKpi && (
                                  <DraftRowEditor
                                    row={editingRow}
                                    colSpan={totalCols}
                                    onSave={(formula) => {
                                      c.setCellFormula(
                                        editingRow.kpiGroupId,
                                        editingRow.key,
                                        formula
                                      );
                                      setEditing(null);
                                      c.notify(
                                        `${editingRow.employeeName} KPI ${editingRow.kpiGroupId} formulasi yangilandi va tarixga yozildi`
                                      );
                                    }}
                                    onCancel={() => setEditing(null)}
                                  />
                                )}
                            </Fragment>
                          ))}
                      </Fragment>
                    ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
