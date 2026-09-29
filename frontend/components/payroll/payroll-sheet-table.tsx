"use client";

import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, PencilLine } from "lucide-react";
import type { ReactNode } from "react";
import { fmtDateTime, money, RECORD_STATUS, roleLabel } from "@/lib/payroll/payroll-api";
import { StatusBadge } from "@/components/payroll/payroll-ui";
import { PayrollEmptyRow } from "@/components/payroll/kit/payroll-kit-table";
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

export type SheetGroup = "allowances" | "deductions" | "payments";

export const SHEET_COLUMNS = [
  { id: "code", label: "Код" },
  { id: "branch", label: "Филиал" },
  { id: "role", label: "Роль" },
  { id: "base", label: "Базовый оклад" },
  { id: "plan_days", label: "Рабочие дни — по плану" },
  { id: "worked_days", label: "Рабочие дни — отработанные" },
  { id: "allowances", label: "Надбавки" },
  { id: "deductions", label: "Удержания" },
  { id: "gross", label: "Заработная плата" },
  { id: "payments", label: "Выплаты" },
  { id: "balance", label: "Остаток" },
  { id: "status", label: "Статус" },
  { id: "updated", label: "Обновлено" }
] as const;

type Props = {
  columns: SheetColumn[];
  rows: SheetRow[];
  allRows: SheetRow[];
  totals: SheetTotals | null;
  loading: boolean;
  hidden: Set<string>;
  expanded: Set<SheetGroup>;
  onToggleGroup: (g: SheetGroup) => void;
  selected: Set<number>;
  onToggle: (id: number) => void;
  onToggleAll: (on: boolean) => void;
  onOpen: (row: SheetRow) => void;
};

const TH = "whitespace-nowrap border-b border-r border-border/60 px-3 py-2 text-left";
const TD = "whitespace-nowrap border-b border-r border-border/40 px-3 py-2";
const NUM = "text-right tabular-nums";
const GROUP_TH = "border-b border-r border-border/60 px-3 py-1.5 text-center text-[11px] uppercase tracking-wide";

const sumLine = (rows: SheetRow[], id: number) => rows.reduce((s, r) => s + (r.lines[String(id)] ?? 0), 0);
const corrOf = (r: SheetRow) => r.corrections.reduce((s, c) => s + c.amount, 0);

function Expander({ open, count, onClick }: { open: boolean; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={open ? "Свернуть" : "Развернуть"}
      className="ml-1 inline-flex h-5 items-center gap-0.5 rounded border border-primary/30 bg-primary/10 px-1 text-[10px] font-semibold text-primary hover:bg-primary/15"
    >
      {count}
      {open ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
    </button>
  );
}

export function PayrollSheetTable({ columns, rows, allRows, totals, loading, hidden, expanded, onToggleGroup, selected, onToggle, onToggleAll, onOpen }: Props) {
  const show = (id: string) => !hidden.has(id);
  const allowCols = columns.filter((c) => c.type === "allowance" && c.system_key !== "correction");
  const dedCols = columns.filter((c) => c.type === "deduction" && c.system_key !== "advance");
  const hasCorr = allRows.some((r) => r.corrections.length);
  const openAllow = expanded.has("allowances");
  const openDed = expanded.has("deductions");
  const openPay = expanded.has("payments");
  const allowSpan = openAllow ? allowCols.length + (hasCorr ? 1 : 0) + 1 : 1;
  const dedSpan = openDed ? dedCols.length + 1 : 1;
  const paySpan = openPay ? 3 : 1;
  const infoSpan = 1 + ["code", "branch", "role"].filter(show).length;
  const daysSpan = ["plan_days", "worked_days"].filter(show).length;
  const statusSpan = ["status", "updated"].filter(show).length;
  const colCount =
    1 + infoSpan + (show("base") ? 1 : 0) + daysSpan + (show("allowances") ? allowSpan : 0) + (show("deductions") ? dedSpan : 0) +
    (show("gross") ? 1 : 0) + (show("payments") ? paySpan : 0) + (show("balance") ? 1 : 0) + statusSpan;
  const allOn = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const lineCell = (r: SheetRow, c: SheetColumn) => {
    const v = r.lines[String(c.id)];
    const manual = r.overrides.includes(c.id);
    return (
      <td key={c.id} className={cn(TD, NUM, manual && "bg-amber-50 dark:bg-amber-950/30")} title={manual ? "Изменено вручную" : undefined}>
        {v ? money(v) : <span className="text-muted-foreground/50">—</span>}
        {manual ? <PencilLine className="ml-1 inline size-3 text-amber-600" /> : null}
      </td>
    );
  };

  const groupTh = (label: string, span: number, extra?: ReactNode) =>
    span > 0 ? (
      <th colSpan={span} className={GROUP_TH}>
        {label}
        {extra}
      </th>
    ) : null;

  return (
    <div className="max-h-[68vh] overflow-auto">
      <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
        <thead className="app-table-thead sticky top-0 z-20">
          <tr>
            <th rowSpan={2} className={cn(TH, "sticky left-0 z-30 w-10 bg-muted")}>
              <input type="checkbox" className="accent-primary" checked={allOn} onChange={(e) => onToggleAll(e.target.checked)} aria-label="Выбрать все" />
            </th>
            {groupTh("Основная информация", infoSpan)}
            {show("base") ? groupTh("Заработная плата", 1) : null}
            {groupTh("Рабочие дни", daysSpan)}
            {show("allowances") ? groupTh("Надбавки", allowSpan) : null}
            {show("deductions") ? groupTh("Удержания", dedSpan) : null}
            {show("gross") ? groupTh("Итог", 1) : null}
            {show("payments") ? groupTh("Выплаты", paySpan) : null}
            {show("balance") ? groupTh("Итог", 1) : null}
            {groupTh("Статус", statusSpan)}
          </tr>
          <tr>
            <th className={cn(TH, "sticky left-10 z-30 min-w-[220px] bg-muted")}>ФИО</th>
            {show("code") ? <th className={TH}>Код</th> : null}
            {show("branch") ? <th className={TH}>Филиал</th> : null}
            {show("role") ? <th className={TH}>Роль</th> : null}
            {show("base") ? <th className={cn(TH, NUM)}>Базовый оклад</th> : null}
            {show("plan_days") ? <th className={cn(TH, NUM)}>По плану</th> : null}
            {show("worked_days") ? <th className={cn(TH, NUM)}>Отработанные</th> : null}
            {show("allowances") ? (
              <>
                {openAllow ? allowCols.map((c) => <th key={c.id} className={cn(TH, NUM, "text-emerald-700 dark:text-emerald-400")}>{c.name}</th>) : null}
                {openAllow && hasCorr ? <th className={cn(TH, NUM, "text-emerald-700 dark:text-emerald-400")}>Корректировка</th> : null}
                <th className={cn(TH, NUM)}>
                  Итого
                  <Expander open={openAllow} count={allowCols.length + (hasCorr ? 1 : 0)} onClick={() => onToggleGroup("allowances")} />
                </th>
              </>
            ) : null}
            {show("deductions") ? (
              <>
                {openDed ? dedCols.map((c) => <th key={c.id} className={cn(TH, NUM, "text-red-700 dark:text-red-400")}>{c.name}</th>) : null}
                <th className={cn(TH, NUM)}>
                  Итого
                  <Expander open={openDed} count={dedCols.length} onClick={() => onToggleGroup("deductions")} />
                </th>
              </>
            ) : null}
            {show("gross") ? <th className={cn(TH, NUM)}>Заработная плата</th> : null}
            {show("payments") ? (
              <>
                {openPay ? <th className={cn(TH, NUM)}>Аванс</th> : null}
                {openPay ? <th className={cn(TH, NUM)}>Выплачено</th> : null}
                <th className={cn(TH, NUM)}>
                  Итого
                  <Expander open={openPay} count={2} onClick={() => onToggleGroup("payments")} />
                </th>
              </>
            ) : null}
            {show("balance") ? <th className={cn(TH, NUM)}>Остаток</th> : null}
            {show("status") ? <th className={TH}>Статус</th> : null}
            {show("updated") ? <th className={TH}>Обновлено</th> : null}
          </tr>
        </thead>
        <tbody>
          {loading || rows.length === 0 ? <PayrollEmptyRow colSpan={colCount} loading={loading} text="Нет записей за месяц" /> : null}
          {rows.map((r) => {
            const corr = corrOf(r);
            const on = selected.has(r.id);
            return (
              <tr
                key={r.id}
                className={cn("group cursor-pointer transition-colors hover:bg-muted/40", on && "bg-primary/5", !r.is_active && "opacity-70")}
                onClick={() => onOpen(r)}
              >
                <td className={cn(TD, "sticky left-0 z-10 bg-card group-hover:bg-muted")} onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" className="accent-primary" checked={on} onChange={() => onToggle(r.id)} aria-label={r.fio} />
                </td>
                <td className={cn(TD, "sticky left-10 z-10 bg-card font-medium text-foreground group-hover:bg-muted")}>
                  {r.fio}
                  {r.is_active ? null : <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">уволен</span>}
                </td>
                {show("code") ? <td className={cn(TD, "text-muted-foreground")}>{r.code ?? "—"}</td> : null}
                {show("branch") ? <td className={TD}>{r.branch ?? "—"}</td> : null}
                {show("role") ? <td className={TD}>{roleLabel(r.role)}</td> : null}
                {show("base") ? <td className={cn(TD, NUM)}>{money(r.base_salary)}</td> : null}
                {show("plan_days") ? <td className={cn(TD, NUM)}>{r.plan_days}</td> : null}
                {show("worked_days") ? <td className={cn(TD, NUM)}>{r.worked_days}</td> : null}
                {show("allowances") ? (
                  <>
                    {openAllow ? allowCols.map((c) => lineCell(r, c)) : null}
                    {openAllow && hasCorr ? <td className={cn(TD, NUM, corr < 0 && "text-red-700")}>{corr ? money(corr) : "—"}</td> : null}
                    <td className={cn(TD, NUM, "font-medium text-emerald-700 dark:text-emerald-400")}>{money(r.allowances_total)}</td>
                  </>
                ) : null}
                {show("deductions") ? (
                  <>
                    {openDed ? dedCols.map((c) => lineCell(r, c)) : null}
                    <td className={cn(TD, NUM, "font-medium text-red-700 dark:text-red-400")}>{money(r.deductions_total)}</td>
                  </>
                ) : null}
                {show("gross") ? <td className={cn(TD, NUM, "font-semibold")}>{money(r.gross)}</td> : null}
                {show("payments") ? (
                  <>
                    {openPay ? <td className={cn(TD, NUM)}>{money(r.advances_total)}</td> : null}
                    {openPay ? <td className={cn(TD, NUM)}>{money(r.salary_paid)}</td> : null}
                    <td className={cn(TD, NUM)}>{money(r.paid_total)}</td>
                  </>
                ) : null}
                {show("balance") ? (
                  <td className={cn(TD, NUM, "font-semibold", r.balance < 0 ? "text-red-700" : "text-emerald-700 dark:text-emerald-400")}>{money(r.balance)}</td>
                ) : null}
                {show("status") ? (
                  <td className={TD}>
                    <StatusBadge map={RECORD_STATUS} status={r.status} />
                    {r.status === "rejected" && r.rejected_reason ? (
                      <div className="max-w-40 truncate text-[11px] text-red-700" title={r.rejected_reason}>
                        {r.rejected_reason}
                      </div>
                    ) : null}
                  </td>
                ) : null}
                {show("updated") ? (
                  <td className={cn(TD, "text-xs text-muted-foreground")}>
                    {r.calc_error ? (
                      <span className="inline-flex items-center gap-1 text-red-700" title={r.calc_error}>
                        <AlertTriangle className="size-3.5" /> Ошибка
                      </span>
                    ) : r.dirty ? (
                      <span className="inline-flex items-center gap-1 text-sky-700">
                        <Loader2 className="size-3.5 animate-spin" /> Расчёт…
                      </span>
                    ) : (
                      fmtDateTime(r.calculated_at)
                    )}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
        {totals && allRows.length ? (
          <tfoot className="sticky bottom-0 z-20">
            <tr className="bg-muted font-semibold">
              <td className={cn(TD, "sticky left-0 bg-muted")} />
              <td className={cn(TD, "sticky left-10 bg-muted")}>Итоги ({allRows.length})</td>
              {["code", "branch", "role"].filter(show).map((k) => <td key={k} className={TD} />)}
              {show("base") ? <td className={cn(TD, NUM)}>{money(allRows.reduce((s, r) => s + r.base_salary, 0))}</td> : null}
              {show("plan_days") ? <td className={TD} /> : null}
              {show("worked_days") ? <td className={TD} /> : null}
              {show("allowances") ? (
                <>
                  {openAllow ? allowCols.map((c) => <td key={c.id} className={cn(TD, NUM)}>{money(sumLine(allRows, c.id))}</td>) : null}
                  {openAllow && hasCorr ? <td className={cn(TD, NUM)}>{money(allRows.reduce((s, r) => s + corrOf(r), 0))}</td> : null}
                  <td className={cn(TD, NUM)}>{money(allRows.reduce((s, r) => s + r.allowances_total, 0))}</td>
                </>
              ) : null}
              {show("deductions") ? (
                <>
                  {openDed ? dedCols.map((c) => <td key={c.id} className={cn(TD, NUM)}>{money(sumLine(allRows, c.id))}</td>) : null}
                  <td className={cn(TD, NUM)}>{money(allRows.reduce((s, r) => s + r.deductions_total, 0))}</td>
                </>
              ) : null}
              {show("gross") ? <td className={cn(TD, NUM)}>{money(allRows.reduce((s, r) => s + r.gross, 0))}</td> : null}
              {show("payments") ? (
                <>
                  {openPay ? <td className={cn(TD, NUM)}>{money(allRows.reduce((s, r) => s + r.advances_total, 0))}</td> : null}
                  {openPay ? <td className={cn(TD, NUM)}>{money(allRows.reduce((s, r) => s + r.salary_paid, 0))}</td> : null}
                  <td className={cn(TD, NUM)}>{money(allRows.reduce((s, r) => s + r.paid_total, 0))}</td>
                </>
              ) : null}
              {show("balance") ? <td className={cn(TD, NUM)}>{money(allRows.reduce((s, r) => s + r.balance, 0))}</td> : null}
              {Array.from({ length: statusSpan }, (_, i) => <td key={`st-${i}`} className={TD} />)}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
