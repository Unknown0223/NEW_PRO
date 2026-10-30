"use client";

import { money, roleLabel } from "@/lib/payroll/payroll-api";
import { cn } from "@/lib/utils";
import { PayrollEmptyRow } from "@/components/payroll/kit/payroll-kit-table";

export type Metrics = { cost: number; count: number; volume: number; acb: number; order_count: number };
export type Assign = { id: number; kpi_group_id: number; formula_id: number; formula_name: string | null; formula_text: string; target_item_name: string | null; value: number | null };
export type GroupCell = { kpi_group_id: number; name: string; bonus_formula: string | null; fact: Metrics; plan: Metrics; assignments: Assign[] };
export type BonusRow = { user_id: number; fio: string; code: string | null; role: string; is_active: boolean; record_status: string | null; fact: Metrics; plan: Metrics; assignments_all: Assign[]; groups: GroupCell[] };

const emptyMetrics = (): Metrics => ({ cost: 0, count: 0, volume: 0, acb: 0, order_count: 0 });

const METRIC_ORDER: Array<{ key: keyof Metrics; label: string }> = [
  { key: "cost", label: "Сумма" },
  { key: "count", label: "Количество" },
  { key: "volume", label: "Объем" },
  { key: "acb", label: "АКБ" },
  { key: "order_count", label: "Заказы" }
];

const TH = "whitespace-nowrap border-b border-border px-3 py-2 text-left text-[12px] font-semibold text-muted-foreground";
const TD = "whitespace-nowrap px-2 py-2 align-middle";

function FxButton({ active, onClick, title }: { active: boolean; onClick?: () => void; title?: string }) {
  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      title={title ?? (active ? "Формула назначена — изменить" : "Назначить формулу")}
      aria-label="Назначить формулу"
      className={cn(
        "flex size-[22px] shrink-0 items-center justify-center rounded-[7px] border leading-none text-white transition-all duration-150 disabled:cursor-default",
        active
          ? "border-[#198b89] bg-gradient-to-br from-[#39b9b5] to-[#218f8e] shadow-[0_0_0_3px_rgba(45,156,155,0.13),0_4px_9px_rgba(28,131,129,0.28)]"
          : "border-[#c5ced9] bg-[#d2d8e1] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] dark:border-border dark:bg-muted-foreground/40"
      )}
    >
      <span className="relative -mt-px font-serif text-[13px] font-bold italic">
        f<span className="absolute -bottom-[3px] -right-[5px] font-sans text-[7px] font-semibold not-italic">x</span>
      </span>
    </button>
  );
}

type Props = {
  rows: BonusRow[];
  /** Ustunlar shu ro‘yxatdagi reja bo‘yicha: faqat qo‘yilgan shart chiqadi. */
  planRows?: BonusRow[];
  groupFilter: number | null;
  loading: boolean;
  editable: boolean;
  selected: Set<number>;
  onToggle: (id: number) => void;
  onToggleAll: (on: boolean) => void;
  onAssign: (userIds: number[], groupId: number) => void;
  onRemove: (a: Assign) => void;
};

function metricsFor(groupId: number, basis: BonusRow[]) {
  const used = new Set<keyof Metrics>();
  for (const r of basis) {
    const g = r.groups.find((x) => x.kpi_group_id === groupId);
    if (!g) continue;
    for (const m of METRIC_ORDER) if (g.plan[m.key] > 0) used.add(m.key);
  }
  const list = METRIC_ORDER.filter((m) => used.has(m.key));
  return list.length ? list : [METRIC_ORDER[0]!];
}

export function PayrollBonusTable({ rows, planRows, groupFilter, loading, editable, selected, onToggle, onToggleAll, onAssign }: Props) {
  const basis = planRows ?? rows;
  const groups: Array<{ id: number; name: string }> = [];
  const seen = new Set<number>();
  for (const r of rows) {
    for (const g of r.groups) {
      if (groupFilter != null && g.kpi_group_id !== groupFilter) continue;
      if (seen.has(g.kpi_group_id)) continue;
      seen.add(g.kpi_group_id);
      groups.push({ id: g.kpi_group_id, name: g.name });
    }
  }
  const cols = new Map(groups.map((g) => [g.id, metricsFor(g.id, basis)]));
  const allOn = rows.length > 0 && rows.every((r) => selected.has(r.user_id));
  const span = 2 + [...cols.values()].reduce((n, list) => n + list.length, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-[var(--pr-head)]">
          <tr>
            <th className={cn(TH, "w-10")} rowSpan={2}>
              <input type="checkbox" className="size-4 accent-primary" checked={allOn} onChange={(e) => onToggleAll(e.target.checked)} aria-label="Выбрать все" />
            </th>
            <th className={cn(TH, "min-w-[240px]")} rowSpan={2}>Пользователь</th>
            {groups.map((g) => {
              const picked = [...selected];
              return (
                <th key={g.id} className={cn(TH, "border-l border-border text-center")} colSpan={cols.get(g.id)?.length ?? 1}>
                  <span className="inline-flex items-center justify-center gap-2">
                    <FxButton
                      active={basis.some((r) => r.groups.some((x) => x.kpi_group_id === g.id && x.assignments.length > 0))}
                      onClick={editable && picked.length ? () => onAssign(picked, g.id) : undefined}
                      title={picked.length ? `Формула для отмеченных (${picked.length})` : "Сначала отметьте сотрудников"}
                    />
                    {g.name}
                  </span>
                </th>
              );
            })}
          </tr>
          <tr>
            {groups.map((g) =>
              (cols.get(g.id) ?? [METRIC_ORDER[0]!]).map((m, i) => (
                <th key={`${g.id}-${m.key}`} className={cn(TH, i === 0 && "border-l border-border", "text-right font-medium")}>{m.label}</th>
              ))
            )}
          </tr>
        </thead>
        <tbody>
          {loading || rows.length === 0 ? <PayrollEmptyRow colSpan={span} loading={loading} /> : null}
          {rows.map((r) => {
            const byId = new Map(r.groups.map((g) => [g.kpi_group_id, g]));
            return (
              <tr key={r.user_id} className={cn("border-b border-border/60", selected.has(r.user_id) && "bg-[var(--pr-row-hover)]")}>
                <td className={TD}>
                  <input type="checkbox" className="size-4 accent-primary" checked={selected.has(r.user_id)} onChange={() => onToggle(r.user_id)} aria-label={r.fio} />
                </td>
                <td className={TD}>
                  <div className={cn("flex items-baseline gap-2", !r.is_active && "text-muted-foreground line-through")}>
                    <span className="text-[13px] font-medium">{r.code ? `${r.code} ${r.fio}` : r.fio}</span>
                    <span className="text-[11px] text-muted-foreground">{roleLabel(r.role)}</span>
                  </div>
                </td>
                {groups.map((col) => {
                  const g = byId.get(col.id);
                  const metrics = cols.get(col.id) ?? [METRIC_ORDER[0]!];
                  if (!g) {
                    return (
                      <GroupCells
                        key={col.id}
                        g={{ kpi_group_id: col.id, name: col.name, bonus_formula: null, fact: emptyMetrics(), plan: emptyMetrics(), assignments: [] }}
                        metrics={metrics}
                        editable={editable}
                        onAssign={() => onAssign([r.user_id], col.id)}
                      />
                    );
                  }
                  return (
                    <GroupCells
                      key={col.id}
                      g={g}
                      metrics={metrics}
                      editable={editable}
                      onAssign={() => onAssign([r.user_id], g.kpi_group_id)}
                    />
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GroupCells({
  g,
  metrics,
  editable,
  onAssign
}: {
  g: GroupCell;
  metrics: Array<{ key: keyof Metrics; label: string }>;
  editable: boolean;
  onAssign: () => void;
}) {
  return (
    <>
      {metrics.map((m, i) => (
        <td key={m.key} className={cn(TD, i === 0 && "border-l border-border/50")}>
          <div className="flex h-[36px] min-w-[118px] items-center gap-2 rounded-[9px] border border-[#d7e0de] bg-[#f6f8f7] px-2 dark:border-border dark:bg-muted/40">
            {i === 0 ? <FxButton active={g.assignments.length > 0} onClick={editable ? onAssign : undefined} /> : null}
            <span className={cn("flex-1 text-right text-[12.5px] tabular-nums", g.plan[m.key] ? "font-medium text-foreground/80" : "text-muted-foreground")}>{money(g.plan[m.key])}</span>
          </div>
        </td>
      ))}
    </>
  );
}
