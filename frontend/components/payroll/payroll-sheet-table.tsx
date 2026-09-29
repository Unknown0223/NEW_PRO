"use client";

import { AlertTriangle, Loader2, PencilLine } from "lucide-react";
import { fmtDateTime, money, RECORD_STATUS, roleLabel } from "@/lib/payroll/payroll-api";
import { EmptyRow, StatusBadge } from "@/components/payroll/payroll-ui";
import { cn } from "@/lib/utils";

export type SheetColumn = { id: number; name: string; type: "allowance" | "deduction"; system_key: string | null; color: string | null };

export type SheetRow = {
  id: number;
  user_id: number;
  fio: string;
  code: string | null;
  role: string | null;
  branch: string | null;
  is_active: boolean;
  status: string;
  base_salary: number;
  plan_days: number;
  worked_days: number;
  lines: Record<string, number>;
  overrides: number[];
  corrections: Array<{ item_id: number; corr_key: string; amount: number }>;
  allowances_total: number;
  deductions_total: number;
  advances_total: number;
  salary_paid: number;
  paid_total: number;
  gross: number;
  balance: number;
  dirty: boolean;
  calculated_at: string | null;
  calc_error: string | null;
  rejected_reason: string | null;
};

export type SheetTotals = Record<string, number>;

type Props = {
  columns: SheetColumn[];
  rows: SheetRow[];
  totals: SheetTotals | null;
  loading: boolean;
  selected: Set<number>;
  onToggle: (id: number) => void;
  onToggleAll: (on: boolean) => void;
  onOpen: (row: SheetRow) => void;
};

const TH = "sticky top-0 z-10 whitespace-nowrap border-b bg-muted px-2 py-2 text-left text-xs font-semibold";
const TD = "whitespace-nowrap border-b px-2 py-1.5 text-sm";
const NUM = "text-right tabular-nums";

export function PayrollSheetTable({ columns, rows, totals, loading, selected, onToggle, onToggleAll, onOpen }: Props) {
  const allowCols = columns.filter((c) => c.type === "allowance" && c.system_key !== "correction");
  const dedCols = columns.filter((c) => c.type === "deduction" && c.system_key !== "advance");
  const hasCorr = rows.some((r) => r.corrections.length);
  const allOn = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const colCount = 11 + allowCols.length + dedCols.length + (hasCorr ? 1 : 0);

  const cell = (r: SheetRow, c: SheetColumn) => {
    const v = r.lines[String(c.id)];
    const manual = r.overrides.includes(c.id);
    return (
      <td key={c.id} className={cn(TD, NUM, manual && "bg-amber-50")} title={manual ? "Изменено вручную" : undefined}>
        {v ? money(v) : <span className="text-muted-foreground/50">—</span>}
        {manual ? <PencilLine className="ml-1 inline size-3 text-amber-600" /> : null}
      </td>
    );
  };

  return (
    <div className="max-h-[70vh] overflow-auto rounded-lg border bg-card">
      <table className="w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className={cn(TH, "w-8")}>
              <input type="checkbox" checked={allOn} onChange={(e) => onToggleAll(e.target.checked)} />
            </th>
            <th className={cn(TH, "sticky left-0 z-20 min-w-56")}>Сотрудник</th>
            <th className={TH}>Статус</th>
            <th className={cn(TH, NUM)}>Дни</th>
            <th className={cn(TH, NUM)}>Оклад</th>
            {allowCols.map((c) => <th key={c.id} className={cn(TH, NUM, "text-emerald-800")}>{c.name}</th>)}
            {hasCorr ? <th className={cn(TH, NUM, "text-emerald-800")}>Корректировка</th> : null}
            {dedCols.map((c) => <th key={c.id} className={cn(TH, NUM, "text-red-800")}>{c.name}</th>)}
            <th className={cn(TH, NUM)}>Начислено</th>
            <th className={cn(TH, NUM)}>Аванс</th>
            <th className={cn(TH, NUM)}>Выплачено</th>
            <th className={cn(TH, NUM)}>Итого выдано</th>
            <th className={cn(TH, NUM)}>Остаток</th>
            <th className={TH}>Обновлено</th>
          </tr>
        </thead>
        <tbody>
          {loading ? <EmptyRow colSpan={colCount} text="Загрузка…" /> : rows.length === 0 ? <EmptyRow colSpan={colCount} text="Нет записей за месяц" /> : null}
          {rows.map((r) => {
            const corr = r.corrections.reduce((s, c) => s + c.amount, 0);
            return (
              <tr key={r.id} className={cn("cursor-pointer hover:bg-muted/40", !r.is_active && "opacity-70")} onClick={() => onOpen(r)}>
                <td className={TD} onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => onToggle(r.id)} />
                </td>
                <td className={cn(TD, "sticky left-0 bg-card")}>
                  <div className="font-medium">{r.fio}</div>
                  <div className="text-xs text-muted-foreground">
                    {roleLabel(r.role)}{r.branch ? ` · ${r.branch}` : ""}{r.code ? ` · ${r.code}` : ""}{r.is_active ? "" : " · уволен"}
                  </div>
                </td>
                <td className={TD}>
                  <StatusBadge map={RECORD_STATUS} status={r.status} />
                  {r.status === "rejected" && r.rejected_reason ? <div className="max-w-40 truncate text-[11px] text-red-700" title={r.rejected_reason}>{r.rejected_reason}</div> : null}
                </td>
                <td className={cn(TD, NUM)}>{r.worked_days}/{r.plan_days}</td>
                <td className={cn(TD, NUM)}>{money(r.base_salary)}</td>
                {allowCols.map((c) => cell(r, c))}
                {hasCorr ? <td className={cn(TD, NUM, corr < 0 ? "text-red-700" : "")}>{corr ? money(corr) : "—"}</td> : null}
                {dedCols.map((c) => cell(r, c))}
                <td className={cn(TD, NUM, "font-semibold")}>{money(r.gross)}</td>
                <td className={cn(TD, NUM)}>{money(r.advances_total)}</td>
                <td className={cn(TD, NUM)}>{money(r.salary_paid)}</td>
                <td className={cn(TD, NUM)}>{money(r.paid_total)}</td>
                <td className={cn(TD, NUM, "font-semibold", r.balance < 0 ? "text-red-700" : "text-emerald-700")}>{money(r.balance)}</td>
                <td className={cn(TD, "text-xs text-muted-foreground")}>
                  {r.calc_error ? (
                    <span className="inline-flex items-center gap-1 text-red-700" title={r.calc_error}><AlertTriangle className="size-3.5" /> Ошибка</span>
                  ) : r.dirty ? (
                    <span className="inline-flex items-center gap-1 text-sky-700"><Loader2 className="size-3.5 animate-spin" /> Расчёт…</span>
                  ) : (
                    fmtDateTime(r.calculated_at)
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        {totals && rows.length ? (
          <tfoot>
            <tr className="bg-muted/60 font-semibold">
              <td className={TD} />
              <td className={cn(TD, "sticky left-0 bg-muted")}>Итого: {totals.count}</td>
              <td className={TD} />
              <td className={TD} />
              <td className={cn(TD, NUM)}>{money(totals.base_salary)}</td>
              {allowCols.map((c) => <td key={c.id} className={cn(TD, NUM)}>{money(rows.reduce((s, r) => s + (r.lines[String(c.id)] ?? 0), 0))}</td>)}
              {hasCorr ? <td className={cn(TD, NUM)}>{money(rows.reduce((s, r) => s + r.corrections.reduce((a, c) => a + c.amount, 0), 0))}</td> : null}
              {dedCols.map((c) => <td key={c.id} className={cn(TD, NUM)}>{money(rows.reduce((s, r) => s + (r.lines[String(c.id)] ?? 0), 0))}</td>)}
              <td className={cn(TD, NUM)}>{money(totals.gross)}</td>
              <td className={cn(TD, NUM)}>{money(totals.advances_total)}</td>
              <td className={cn(TD, NUM)}>{money(totals.salary_paid)}</td>
              <td className={cn(TD, NUM)}>{money((totals.advances_total ?? 0) + (totals.salary_paid ?? 0))}</td>
              <td className={cn(TD, NUM)}>{money(totals.balance)}</td>
              <td className={TD} />
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
