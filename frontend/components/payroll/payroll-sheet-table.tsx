"use client";

import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, Loader2, PencilLine } from "lucide-react";
import type { ReactNode } from "react";
import { fmtDateTime, money, RECORD_STATUS, roleLabel } from "@/lib/payroll/payroll-api";
import { StatusBadge } from "@/components/payroll/payroll-ui";
import { PayrollEmptyRow, type SortState } from "@/components/payroll/kit/payroll-kit-table";
import { cn } from "@/lib/utils";

export type SheetColumn = { id: number; name: string; type: "allowance" | "deduction"; system_key: string | null; color: string | null };

export type SheetRow = {
  id: number;
  user_id: number;
  fio: string;
  code: string | null;
  role: string | null;
  branch: string | null;
  position: string | null;
  trade_direction: string | null;
  currency: string;
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

export type SheetSortKey = "fio" | "code" | "branch" | "base" | "plan_days" | "worked_days" | "allowances" | "deductions" | "gross" | "payments" | "balance";

export const SHEET_COLUMNS = [
  { id: "direction", label: "Направление торговли" },
  { id: "code", label: "Код" },
  { id: "branch", label: "Филиал" },
  { id: "role", label: "Роль" },
  { id: "position", label: "Должность" },
  { id: "base", label: "Базовый оклад" },
  { id: "currency", label: "Валюта" },
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

export function sheetSortValue(r: SheetRow, k: SheetSortKey): string | number {
  switch (k) {
    case "fio":
      return r.fio;
    case "code":
      return r.code ?? "";
    case "branch":
      return r.branch ?? "";
    case "base":
      return r.base_salary;
    case "plan_days":
      return r.plan_days;
    case "worked_days":
      return r.worked_days;
    case "allowances":
      return r.allowances_total;
    case "deductions":
      return r.deductions_total;
    case "gross":
      return r.gross;
    case "payments":
      return r.paid_total;
    case "balance":
      return r.balance;
  }
}

type Props = {
  columns: SheetColumn[];
  rows: SheetRow[];
  allRows: SheetRow[];
  totals: SheetTotals | null;
  loading: boolean;
  hidden: Set<string>;
  expanded: Set<SheetGroup>;
  onToggleGroup: (g: SheetGroup) => void;
  sort: SortState<SheetSortKey>;
  onSort: (k: SheetSortKey) => void;
  selected: Set<number>;
  onToggle: (id: number) => void;
  onToggleAll: (on: boolean) => void;
  onOpen: (row: SheetRow) => void;
};

const TH = "whitespace-nowrap border-b border-border px-3 py-2 text-left text-[12px] font-semibold text-muted-foreground";
const SUB_TH = "text-muted-foreground/70";
const GROUP_TH = "border-b border-border px-3 py-2 text-left text-[12.5px] font-semibold text-muted-foreground";
const TD = "whitespace-nowrap border-b border-border/50 px-3 py-2.5 text-[12.5px]";
const NUM = "text-right tabular-nums";
const DASH = <span className="text-muted-foreground/40">—</span>;

const sumLine = (rows: SheetRow[], id: number) => rows.reduce((s, r) => s + (r.lines[String(id)] ?? 0), 0);
const sumOf = (rows: SheetRow[], get: (r: SheetRow) => number) => rows.reduce((s, r) => s + get(r), 0);
const corrOf = (r: SheetRow) => r.corrections.reduce((s, c) => s + c.amount, 0);

function SortLabel({ label, k, sort, onSort }: { label: ReactNode; k: SheetSortKey; sort: SortState<SheetSortKey>; onSort: (k: SheetSortKey) => void }) {
  const active = sort?.key === k;
  return (
    <button type="button" onClick={() => onSort(k)} className="group inline-flex items-center gap-1 transition-colors hover:text-foreground">
      <span className={cn(active && "text-foreground")}>{label}</span>
      {active ? (
        <ChevronDown className={cn("size-3.5 text-primary", sort?.dir === "asc" && "rotate-180")} aria-hidden />
      ) : (
        <ChevronsUpDown className="size-3.5 text-muted-foreground/40 group-hover:text-muted-foreground" aria-hidden />
      )}
    </button>
  );
}

function GroupTh({ label, span, open, onToggle, first }: { label: string; span: number; open?: boolean; onToggle?: () => void; first?: boolean }) {
  if (span <= 0) return null;
  return (
    <th colSpan={span} className={cn(GROUP_TH, !first && "border-l")}>
      {onToggle ? (
        <button type="button" onClick={onToggle} aria-expanded={open} className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
          <ChevronDown className={cn("size-3.5 text-muted-foreground/50 transition-transform", open && "rotate-180")} aria-hidden />
          {label}
        </button>
      ) : (
        label
      )}
    </th>
  );
}

function ItogoTh({ label, k, open, onToggle, sort, onSort }: { label: string; k: SheetSortKey; open: boolean; onToggle: () => void; sort: SortState<SheetSortKey>; onSort: (k: SheetSortKey) => void }) {
  return (
    <th className={cn(TH, "border-l px-2")}>
      <div className="flex items-center justify-end gap-1">
        <SortLabel label={label} k={k} sort={sort} onSort={onSort} />
        <button
          type="button"
          onClick={onToggle}
          title={open ? "Свернуть" : "Раскрыть"}
          aria-label={open ? "Свернуть группу" : "Раскрыть группу"}
          className="flex size-5 items-center justify-center rounded text-muted-foreground/50 hover:bg-muted hover:text-foreground"
        >
          {open ? <ChevronLeft className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
      </div>
    </th>
  );
}

export function PayrollSheetTable(p: Props) {
  const { columns, rows, allRows, hidden, expanded, sort, onSort, selected } = p;
  const show = (id: string) => !hidden.has(id);
  const allowCols = columns.filter((c) => c.type === "allowance" && c.system_key !== "correction");
  const dedCols = columns.filter((c) => c.type === "deduction" && c.system_key !== "advance");
  const hasCorr = allRows.some((r) => r.corrections.length);
  const openAllow = expanded.has("allowances");
  const openDed = expanded.has("deductions");
  const openPay = expanded.has("payments");
  const infoIds = ["direction", "code", "branch", "role", "position"].filter(show);
  const salaryIds = ["base", "currency"].filter(show);
  const dayIds = ["plan_days", "worked_days"].filter(show);
  const statusIds = ["status", "updated"].filter(show);
  const allowSpan = show("allowances") ? 1 + (openAllow ? allowCols.length + (hasCorr ? 1 : 0) : 0) : 0;
  const dedSpan = show("deductions") ? 1 + (openDed ? dedCols.length : 0) : 0;
  const paySpan = show("payments") ? 1 + (openPay ? 2 : 0) : 0;
  const colCount =
    2 + infoIds.length + salaryIds.length + dayIds.length + allowSpan + dedSpan + (show("gross") ? 1 : 0) + paySpan + (show("balance") ? 1 : 0) + statusIds.length;
  const allOn = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const sp = { sort, onSort };

  const lineCell = (r: SheetRow, c: SheetColumn) => {
    const v = r.lines[String(c.id)];
    const manual = r.overrides.includes(c.id);
    return (
      <td key={c.id} className={cn(TD, NUM, manual && "bg-amber-50 dark:bg-amber-950/30")} title={manual ? "Изменено вручную" : undefined}>
        {v ? money(v) : DASH}
        {manual ? <PencilLine className="ml-1 inline size-3 text-amber-600" /> : null}
      </td>
    );
  };

  return (
    <div className="max-h-[68vh] overflow-auto">
      <table className="w-full min-w-max border-separate border-spacing-0">
        <thead className="sticky top-0 z-20 bg-[var(--pr-head)]">
          <tr>
            <th rowSpan={2} className="sticky left-0 z-30 w-10 border-b border-border bg-[var(--pr-head)] px-3 text-center align-middle">
              <input type="checkbox" className="size-4 accent-primary" checked={allOn} onChange={(e) => p.onToggleAll(e.target.checked)} aria-label="Выбрать все" />
            </th>
            <GroupTh label="Основная информация" span={1 + infoIds.length} first />
            <GroupTh label="Заработная плата" span={salaryIds.length} />
            <GroupTh label="Рабочие дни" span={dayIds.length} />
            <GroupTh label="Надбавки" span={allowSpan} open={openAllow} onToggle={() => p.onToggleGroup("allowances")} />
            <GroupTh label="Удержания" span={dedSpan} open={openDed} onToggle={() => p.onToggleGroup("deductions")} />
            <GroupTh label="Итог" span={show("gross") ? 1 : 0} />
            <GroupTh label="Выплаты" span={paySpan} open={openPay} onToggle={() => p.onToggleGroup("payments")} />
            <GroupTh label="Итог" span={show("balance") ? 1 : 0} />
            <GroupTh label="Статус" span={statusIds.length} />
          </tr>
          <tr>
            <th className={cn(TH, "sticky left-10 z-30 min-w-[240px] bg-[var(--pr-head)]")}>
              <SortLabel label="ФИО" k="fio" {...sp} />
            </th>
            {show("direction") ? <th className={TH}>Направление торговли</th> : null}
            {show("code") ? <th className={TH}><SortLabel label="Код" k="code" {...sp} /></th> : null}
            {show("branch") ? <th className={TH}><SortLabel label="Филиал" k="branch" {...sp} /></th> : null}
            {show("role") ? <th className={TH}>Роль</th> : null}
            {show("position") ? <th className={TH}>Должность</th> : null}
            {show("base") ? <th className={cn(TH, NUM, "border-l")}><SortLabel label="Базовый оклад" k="base" {...sp} /></th> : null}
            {show("currency") ? <th className={cn(TH, !show("base") && "border-l")}>Валюта</th> : null}
            {show("plan_days") ? <th className={cn(TH, "border-l text-center")}><SortLabel label="По плану" k="plan_days" {...sp} /></th> : null}
            {show("worked_days") ? <th className={cn(TH, "text-center", !show("plan_days") && "border-l")}><SortLabel label="Отработанные" k="worked_days" {...sp} /></th> : null}
            {show("allowances") ? (
              <>
                <ItogoTh label={`Итого (${allowCols.length + (hasCorr ? 1 : 0)})`} k="allowances" open={openAllow} onToggle={() => p.onToggleGroup("allowances")} {...sp} />
                {openAllow ? allowCols.map((c) => <th key={c.id} className={cn(TH, NUM, SUB_TH, "min-w-[130px]")}>{c.name}</th>) : null}
                {openAllow && hasCorr ? <th className={cn(TH, NUM, SUB_TH)}>Корректировка</th> : null}
              </>
            ) : null}
            {show("deductions") ? (
              <>
                <ItogoTh label={`Итого (${dedCols.length})`} k="deductions" open={openDed} onToggle={() => p.onToggleGroup("deductions")} {...sp} />
                {openDed ? dedCols.map((c) => <th key={c.id} className={cn(TH, NUM, SUB_TH, "min-w-[130px]")}>{c.name}</th>) : null}
              </>
            ) : null}
            {show("gross") ? <th className={cn(TH, NUM, "border-l")}><SortLabel label="Заработная плата" k="gross" {...sp} /></th> : null}
            {show("payments") ? (
              <>
                <ItogoTh label="Итого (2)" k="payments" open={openPay} onToggle={() => p.onToggleGroup("payments")} {...sp} />
                {openPay ? <th className={cn(TH, NUM, SUB_TH)}>Аванс</th> : null}
                {openPay ? <th className={cn(TH, NUM, SUB_TH)}>Выплачено</th> : null}
              </>
            ) : null}
            {show("balance") ? <th className={cn(TH, NUM, "border-l")}><SortLabel label="Остаток" k="balance" {...sp} /></th> : null}
            {show("status") ? <th className={cn(TH, "border-l")}>Статус</th> : null}
            {show("updated") ? <th className={cn(TH, !show("status") && "border-l")}>Обновлено</th> : null}
          </tr>
        </thead>
        <tbody>
          {p.loading || rows.length === 0 ? <PayrollEmptyRow colSpan={colCount} loading={p.loading} text="Нет записей за месяц" /> : null}
          {rows.map((r) => {
            const corr = corrOf(r);
            const on = selected.has(r.id);
            return (
              <tr
                key={r.id}
                className={cn("group cursor-pointer transition-colors hover:bg-[var(--pr-row-hover)]", on && "bg-[var(--pr-row-hover)]", !r.is_active && "opacity-70")}
                onClick={() => p.onOpen(r)}
              >
                <td className={cn(TD, "sticky left-0 z-10 bg-card text-center group-hover:bg-muted")} onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" className="size-4 accent-primary" checked={on} onChange={() => p.onToggle(r.id)} aria-label={r.fio} />
                </td>
                <td className={cn(TD, "sticky left-10 z-10 max-w-[280px] truncate bg-card font-medium text-foreground group-hover:bg-muted")} title={r.fio}>
                  {r.fio}
                  {r.is_active ? null : <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">уволен</span>}
                </td>
                {show("direction") ? <td className={cn(TD, "text-muted-foreground")}>{r.trade_direction ?? DASH}</td> : null}
                {show("code") ? <td className={cn(TD, "text-muted-foreground")}>{r.code ?? DASH}</td> : null}
                {show("branch") ? <td className={cn(TD, "text-muted-foreground")}>{r.branch ?? DASH}</td> : null}
                {show("role") ? <td className={cn(TD, "text-muted-foreground")}>{roleLabel(r.role)}</td> : null}
                {show("position") ? <td className={cn(TD, "text-muted-foreground")}>{r.position ?? DASH}</td> : null}
                {show("base") ? <td className={cn(TD, NUM)}>{money(r.base_salary)}</td> : null}
                {show("currency") ? <td className={cn(TD, "text-muted-foreground")}>{r.currency === "UZS" ? "So'm" : r.currency}</td> : null}
                {show("plan_days") ? <td className={cn(TD, "text-center tabular-nums")}>{r.plan_days}</td> : null}
                {show("worked_days") ? <td className={cn(TD, "text-center tabular-nums")}>{r.worked_days}</td> : null}
                {show("allowances") ? (
                  <>
                    <td className={cn(TD, NUM, "font-medium text-emerald-700 dark:text-emerald-400")}>{money(r.allowances_total)}</td>
                    {openAllow ? allowCols.map((c) => lineCell(r, c)) : null}
                    {openAllow && hasCorr ? <td className={cn(TD, NUM, corr < 0 && "text-red-700")}>{corr ? money(corr) : DASH}</td> : null}
                  </>
                ) : null}
                {show("deductions") ? (
                  <>
                    <td className={cn(TD, NUM, "font-medium text-red-700 dark:text-red-400")}>{money(r.deductions_total)}</td>
                    {openDed ? dedCols.map((c) => lineCell(r, c)) : null}
                  </>
                ) : null}
                {show("gross") ? <td className={cn(TD, NUM, "font-semibold")}>{money(r.gross)}</td> : null}
                {show("payments") ? (
                  <>
                    <td className={cn(TD, NUM)}>{money(r.paid_total)}</td>
                    {openPay ? <td className={cn(TD, NUM)}>{money(r.advances_total)}</td> : null}
                    {openPay ? <td className={cn(TD, NUM)}>{money(r.salary_paid)}</td> : null}
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
        {p.totals && allRows.length ? (
          <tfoot className="sticky bottom-0 z-20">
            <tr className="bg-muted text-[12.5px] font-semibold">
              <td className={cn(TD, "sticky left-0 bg-muted")} />
              <td className={cn(TD, "sticky left-10 bg-muted")}>Итоги ({allRows.length})</td>
              {infoIds.map((k) => <td key={k} className={TD} />)}
              {show("base") ? <td className={cn(TD, NUM)}>{money(sumOf(allRows, (r) => r.base_salary))}</td> : null}
              {show("currency") ? <td className={TD} /> : null}
              {show("plan_days") ? <td className={cn(TD, "text-center tabular-nums")}>{sumOf(allRows, (r) => r.plan_days)}</td> : null}
              {show("worked_days") ? <td className={cn(TD, "text-center tabular-nums")}>{sumOf(allRows, (r) => r.worked_days)}</td> : null}
              {show("allowances") ? (
                <>
                  <td className={cn(TD, NUM)}>{money(sumOf(allRows, (r) => r.allowances_total))}</td>
                  {openAllow ? allowCols.map((c) => <td key={c.id} className={cn(TD, NUM)}>{money(sumLine(allRows, c.id))}</td>) : null}
                  {openAllow && hasCorr ? <td className={cn(TD, NUM)}>{money(sumOf(allRows, corrOf))}</td> : null}
                </>
              ) : null}
              {show("deductions") ? (
                <>
                  <td className={cn(TD, NUM)}>{money(sumOf(allRows, (r) => r.deductions_total))}</td>
                  {openDed ? dedCols.map((c) => <td key={c.id} className={cn(TD, NUM)}>{money(sumLine(allRows, c.id))}</td>) : null}
                </>
              ) : null}
              {show("gross") ? <td className={cn(TD, NUM)}>{money(sumOf(allRows, (r) => r.gross))}</td> : null}
              {show("payments") ? (
                <>
                  <td className={cn(TD, NUM)}>{money(sumOf(allRows, (r) => r.paid_total))}</td>
                  {openPay ? <td className={cn(TD, NUM)}>{money(sumOf(allRows, (r) => r.advances_total))}</td> : null}
                  {openPay ? <td className={cn(TD, NUM)}>{money(sumOf(allRows, (r) => r.salary_paid))}</td> : null}
                </>
              ) : null}
              {show("balance") ? <td className={cn(TD, NUM)}>{money(sumOf(allRows, (r) => r.balance))}</td> : null}
              {statusIds.map((k) => <td key={k} className={TD} />)}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
