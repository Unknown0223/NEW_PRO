"use client";

import { ChevronDown, Plus, X } from "lucide-react";
import { money, RECORD_STATUS, roleLabel } from "@/lib/payroll/payroll-api";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/payroll/payroll-ui";
import { PayrollEmptyRow } from "@/components/payroll/kit/payroll-kit-table";

export type Metrics = { cost: number; count: number; volume: number; acb: number; order_count: number };
export type Assign = { id: number; kpi_group_id: number; formula_id: number; formula_name: string | null; formula_text: string; target_item_name: string | null; value: number | null };
export type GroupCell = { kpi_group_id: number; name: string; bonus_formula: string | null; fact: Metrics; plan: Metrics; assignments: Assign[] };
export type BonusRow = { user_id: number; fio: string; code: string | null; role: string; is_active: boolean; record_status: string | null; fact: Metrics; plan: Metrics; assignments_all: Assign[]; groups: GroupCell[] };

const METRICS: Array<{ key: keyof Metrics; label: string }> = [
  { key: "cost", label: "Сумма" },
  { key: "count", label: "Количество" },
  { key: "volume", label: "Обьем" },
  { key: "acb", label: "АКБ" },
  { key: "order_count", label: "Кол-во заказов" }
];

const TH = "whitespace-nowrap border-b border-border px-4 py-2.5 text-left text-[12.5px] font-semibold text-muted-foreground";
const TD = "px-4 py-2 align-middle";

function FxButton({ active, onClick }: { active: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      title={active ? "Формула назначена — изменить" : "Назначить формулу"}
      aria-label="Назначить формулу"
      className={cn(
        "flex size-[22px] shrink-0 items-center justify-center rounded-[7px] border leading-none text-white transition-all duration-150 disabled:cursor-default",
        active
          ? "border-[#198b89] bg-gradient-to-br from-[#39b9b5] to-[#218f8e] shadow-[0_0_0_3px_rgba(45,156,155,0.13),0_4px_9px_rgba(28,131,129,0.28)] hover:from-[#42c1bd] hover:to-[#258f8e]"
          : "border-[#c5ced9] bg-[#d2d8e1] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] hover:border-[#aeb9c7] hover:bg-[#c4ccd7] dark:border-border dark:bg-muted-foreground/40"
      )}
    >
      <span className="relative -mt-px font-serif text-[13px] font-bold italic">
        f<span className="absolute -bottom-[3px] -right-[5px] font-sans text-[7px] font-semibold not-italic">x</span>
      </span>
    </button>
  );
}

function MetricBox({ fact, plan, fx }: { fact: number; plan: number; fx?: { active: boolean; onClick?: () => void } }) {
  const pct = plan > 0 ? Math.round((fact / plan) * 100) : null;
  return (
    <td className={TD}>
      <div
        className="flex h-[39px] min-w-[130px] items-center gap-2 rounded-[9px] border border-[#d7e0de] bg-[#f6f8f7] px-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)] dark:border-border dark:bg-muted/40 dark:shadow-none"
        title={plan > 0 ? `План ${money(plan)} · ${pct}%` : undefined}
      >
        {fx ? <FxButton active={fx.active} onClick={fx.onClick} /> : null}
        <span className={cn("flex-1 text-right text-[12.5px] tabular-nums", fact ? "font-medium text-foreground/80" : "text-muted-foreground")}>{money(fact)}</span>
      </div>
      {pct != null ? <div className={cn("mt-0.5 text-right text-[10.5px] text-muted-foreground", pct >= 100 && "text-emerald-700")}>план {pct}%</div> : null}
    </td>
  );
}

type Props = {
  rows: BonusRow[];
  groupFilter: number | null;
  loading: boolean;
  editable: boolean;
  expanded: Set<number>;
  onExpand: (userId: number) => void;
  selected: Set<number>;
  onToggle: (id: number) => void;
  onToggleAll: (on: boolean) => void;
  onAssign: (userIds: number[], groupId: number) => void;
  onRemove: (a: Assign) => void;
};

export function PayrollBonusTable({ rows, groupFilter, loading, editable, expanded, onExpand, selected, onToggle, onToggleAll, onAssign, onRemove }: Props) {
  const colCount = 2 + METRICS.length + 1;
  const allOn = rows.length > 0 && rows.every((r) => selected.has(r.user_id));

  const formulas = (list: Assign[], userId: number, groupId: number) => (
    <td className={TD}>
      <div className="flex flex-wrap items-center gap-1">
        {list.map((a) => (
          <span
            key={a.id}
            className="inline-flex max-w-[260px] items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary"
            title={`${a.formula_text}\n→ ${a.target_item_name ?? ""}`}
          >
            <i className="font-serif font-bold">fx</i>
            <span className="truncate">{a.formula_name ?? `#${a.formula_id}`}</span>
            <b className="tabular-nums text-foreground">{a.value == null ? "…" : money(a.value)}</b>
            {editable ? (
              <button type="button" className="opacity-60 hover:opacity-100" aria-label="Удалить" onClick={() => onRemove(a)}>
                <X className="size-3" />
              </button>
            ) : null}
          </span>
        ))}
        {editable ? (
          <button
            type="button"
            className="inline-flex size-6 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
            onClick={() => onAssign([userId], groupId)}
            aria-label="Назначить формулу"
            title="Назначить формулу"
          >
            <Plus className="size-3.5" />
          </button>
        ) : null}
      </div>
    </td>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-[var(--pr-head)]">
          <tr>
            <th className={cn(TH, "w-10")}>
              <input type="checkbox" className="size-4 accent-primary" checked={allOn} onChange={(e) => onToggleAll(e.target.checked)} aria-label="Выбрать все" />
            </th>
            <th className={cn(TH, "min-w-[260px]")}>Пользователь</th>
            {METRICS.map((m) => <th key={m.key} className={cn(TH, "text-right")}>{m.label}</th>)}
            <th className={cn(TH, "min-w-[220px]")}>Формулы</th>
          </tr>
        </thead>
        <tbody>
          {loading || rows.length === 0 ? <PayrollEmptyRow colSpan={colCount} loading={loading} /> : null}
          {rows.map((r) => {
            const open = expanded.has(r.user_id);
            const groups = r.groups.filter((g) => groupFilter == null || g.kpi_group_id === groupFilter);
            return [
              <tr
                key={r.user_id}
                className={cn("border-b border-border/60 transition-colors hover:bg-[var(--pr-row-hover)]", (open || selected.has(r.user_id)) && "bg-[var(--pr-row-hover)]")}
              >
                <td className={TD}>
                  <input type="checkbox" className="size-4 accent-primary" checked={selected.has(r.user_id)} onChange={() => onToggle(r.user_id)} aria-label={r.fio} />
                </td>
                <td className={TD}>
                  <button
                    type="button"
                    disabled={!groups.length}
                    onClick={() => onExpand(r.user_id)}
                    aria-expanded={open}
                    className="flex w-full items-start gap-2 text-left disabled:cursor-default"
                  >
                    <ChevronDown
                      className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180", !groups.length && "opacity-0")}
                    />
                    <span className="min-w-0">
                      <span className={cn("block text-[13px] font-medium text-foreground", !r.is_active && "text-muted-foreground line-through")}>{r.fio}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        {roleLabel(r.role)}
                        {r.code ? ` · ${r.code}` : ""}
                        {r.record_status ? <StatusBadge map={RECORD_STATUS} status={r.record_status} /> : null}
                      </span>
                    </span>
                  </button>
                </td>
                {METRICS.map((m) => <MetricBox key={m.key} fact={r.fact[m.key]} plan={r.plan[m.key]} />)}
                {formulas(r.assignments_all, r.user_id, 0)}
              </tr>,
              ...(open
                ? groups.map((g) => (
                    <tr key={`${r.user_id}-${g.kpi_group_id}`} className="border-b border-border/40">
                      <td className={TD} />
                      <td className={cn(TD, "pl-9 text-[12.5px] text-muted-foreground")}>
                        {g.name}
                        {g.bonus_formula ? (
                          <span className="block text-[10.5px] text-muted-foreground/70 font-mono break-all" title={g.bonus_formula}>
                            {g.bonus_formula.length <= 60 ? g.bonus_formula : g.bonus_formula.slice(0, 57) + "…"}
                          </span>
                        ) : null}
                      </td>
                      {METRICS.map((m, i) => (
                        <MetricBox
                          key={m.key}
                          fact={g.fact[m.key]}
                          plan={g.plan[m.key]}
                          fx={{ active: i === 0 && g.assignments.length > 0, onClick: editable ? () => onAssign([r.user_id], g.kpi_group_id) : undefined }}
                        />
                      ))}
                      {formulas(g.assignments, r.user_id, g.kpi_group_id)}
                    </tr>
                  ))
                : [])
              ];
          })}
        </tbody>
      </table>
    </div>
  );
}
