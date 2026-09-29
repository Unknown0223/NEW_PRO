"use client";

import { ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { money, RECORD_STATUS, roleLabel } from "@/lib/payroll/payroll-api";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/payroll/payroll-ui";
import { PayrollEmptyRow } from "@/components/payroll/kit/payroll-kit-table";

export type Metrics = { cost: number; count: number; volume: number; acb: number; order_count: number };
export type Assign = { id: number; kpi_group_id: number; formula_id: number; formula_name: string | null; formula_text: string; target_item_name: string | null; value: number | null };
export type GroupCell = { kpi_group_id: number; name: string; fact: Metrics; plan: Metrics; assignments: Assign[] };
export type BonusRow = { user_id: number; fio: string; code: string | null; role: string; is_active: boolean; record_status: string | null; fact: Metrics; plan: Metrics; assignments_all: Assign[]; groups: GroupCell[] };

const METRICS: Array<{ key: keyof Metrics; label: string }> = [
  { key: "cost", label: "Сумма" },
  { key: "count", label: "Количество" },
  { key: "volume", label: "Обьем" },
  { key: "acb", label: "АКБ" },
  { key: "order_count", label: "Кол-во заказов" }
];

const TH = "whitespace-nowrap px-3 py-2.5 text-left font-medium";
const TD = "px-3 py-2.5 align-top";

function MetricCell({ fact, plan }: { fact: number; plan: number }) {
  return (
    <td className={cn(TD, "text-right tabular-nums")}>
      <div className="font-medium">{money(fact)}</div>
      {plan > 0 ? (
        <div className="text-[11px] text-muted-foreground">
          план {money(plan)} · <span className={fact >= plan ? "text-emerald-700" : ""}>{Math.round((fact / plan) * 100)}%</span>
        </div>
      ) : null}
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
  const colCount = 3 + METRICS.length + 1;
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
            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
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
      <table className="w-full text-sm">
        <thead className="app-table-thead">
          <tr>
            <th className={cn(TH, "w-10")}>
              <input type="checkbox" className="accent-primary" checked={allOn} onChange={(e) => onToggleAll(e.target.checked)} aria-label="Выбрать все" />
            </th>
            <th className={cn(TH, "w-8")} />
            <th className={cn(TH, "min-w-[240px]")}>Пользователь</th>
            {METRICS.map((m) => <th key={m.key} className={cn(TH, "text-right")}>{m.label}</th>)}
            <th className={cn(TH, "min-w-[260px]")}>Формулы</th>
          </tr>
        </thead>
        <tbody>
          {loading || rows.length === 0 ? <PayrollEmptyRow colSpan={colCount} loading={loading} /> : null}
          {rows.map((r) => {
            const open = expanded.has(r.user_id);
            const groups = r.groups.filter((g) => groupFilter == null || g.kpi_group_id === groupFilter);
            return [
              <tr key={r.user_id} className={cn("border-b border-border/60 hover:bg-muted/40", open && "bg-primary/5", selected.has(r.user_id) && "bg-primary/5")}>
                <td className={TD}>
                  <input type="checkbox" className="accent-primary" checked={selected.has(r.user_id)} onChange={() => onToggle(r.user_id)} aria-label={r.fio} />
                </td>
                <td className={TD}>
                  {groups.length ? (
                    <button
                      type="button"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() => onExpand(r.user_id)}
                      aria-label={open ? "Свернуть" : "Развернуть"}
                    >
                      {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </button>
                  ) : null}
                </td>
                <td className={TD}>
                  <div className={cn("font-medium text-foreground", !r.is_active && "text-muted-foreground line-through")}>{r.fio}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    {roleLabel(r.role)}
                    {r.code ? ` · ${r.code}` : ""}
                    {r.record_status ? <StatusBadge map={RECORD_STATUS} status={r.record_status} /> : null}
                  </div>
                </td>
                {METRICS.map((m) => <MetricCell key={m.key} fact={r.fact[m.key]} plan={r.plan[m.key]} />)}
                {formulas(r.assignments_all, r.user_id, 0)}
              </tr>,
              ...(open
                ? groups.map((g) => (
                    <tr key={`${r.user_id}-${g.kpi_group_id}`} className="border-b border-border/40 bg-muted/20">
                      <td className={TD} />
                      <td className={TD} />
                      <td className={cn(TD, "pl-6")}>
                        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                          {g.name}
                        </span>
                      </td>
                      {METRICS.map((m) => <MetricCell key={m.key} fact={g.fact[m.key]} plan={g.plan[m.key]} />)}
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
