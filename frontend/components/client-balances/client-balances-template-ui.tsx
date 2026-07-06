"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Coins,
  CreditCard,
  Globe2,
  Landmark,
  TrendingDown,
  type LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo, type ReactNode } from "react";

const SUMMARY_ICONS: LucideIcon[] = [
  TrendingDown,
  Banknote,
  Coins,
  Globe2,
  CreditCard,
  Landmark,
  ArrowDownLeft
];

export function fmtCompactAmount(v: number): { value: string; suffix: string; sign: string } {
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  const compactDigits = { minimumFractionDigits: 3, maximumFractionDigits: 3 };
  if (abs >= 1_000_000_000) {
    const n = abs / 1_000_000_000;
    return { value: n.toLocaleString("ru-RU", compactDigits), suffix: "млрд", sign };
  }
  if (abs >= 1_000_000) {
    const n = abs / 1_000_000;
    return { value: n.toLocaleString("ru-RU", compactDigits), suffix: "млн", sign };
  }
  if (abs >= 1_000) {
    const n = abs / 1_000;
    return { value: n.toLocaleString("ru-RU", compactDigits), suffix: "тыс", sign };
  }
  return { value: abs.toLocaleString("ru-RU", { maximumFractionDigits: 0 }), suffix: "", sign };
}

export function overdueBadgeClass(days?: number | null): string {
  if (days == null) return "bg-muted text-slate-500 ring-slate-200";
  if (days <= 7) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (days <= 30) return "bg-amber-50 text-amber-700 ring-amber-200";
  if (days <= 90) return "bg-red-50 text-red-700 ring-red-200";
  return "bg-red-600 text-white ring-red-700";
}

export function cbPageWindow(page: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: number[] = [1];
  if (page > 3) out.push(-1);
  for (let n = Math.max(2, page - 1); n <= Math.min(total - 1, page + 1); n++) out.push(n);
  if (page < total - 2) out.push(-1);
  out.push(total);
  return out;
}

export function CbFilterSelect({
  label,
  value,
  onChange,
  children,
  emptyLabel
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  emptyLabel?: string;
}) {
  return (
    <div className="relative">
      <span className="absolute -top-2 left-3 z-10 bg-card px-1 text-[11px] font-medium text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full appearance-none rounded-lg border border-border bg-card px-3.5 pr-9 text-[13.5px] text-slate-700 outline-none hover:border-border focus:border-[#0e9180]"
      >
        {emptyLabel !== undefined ? <option value="">{emptyLabel}</option> : null}
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

export function CbDateBox({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex h-11 min-w-[11rem] cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 transition-colors hover:border-border">
      <CalendarDays size={15} className="shrink-0 text-slate-400" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[10.5px] font-medium leading-tight text-slate-400">{label}</span>
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-full min-w-0 bg-transparent text-[12.5px] leading-tight outline-none",
            value ? "text-slate-700" : "text-slate-400"
          )}
        />
      </span>
    </label>
  );
}

export function CbBalanceFilterSelect({
  value,
  onChange
}: {
  value: "" | "debt" | "credit";
  onChange: (v: "" | "debt" | "credit") => void;
}) {
  return (
    <div className="relative">
      <span className="absolute -top-2 left-3 z-10 bg-card px-1 text-[11px] font-medium text-slate-500">
        Общий баланс
      </span>
      <div className="flex h-11 items-center rounded-lg border border-border bg-card px-3.5 hover:border-border">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as "" | "debt" | "credit")}
          className="w-full appearance-none bg-transparent text-[13.5px] text-slate-700 outline-none focus:border-[#0e9180]"
        >
          <option value="">Все</option>
          <option value="debt">Долг</option>
          <option value="credit">Предоплата</option>
        </select>
        {value !== "" ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="ml-1 shrink-0 text-sm text-slate-400 hover:text-slate-600"
            title="Сбросить"
          >
            ✕
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function CbTabButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-t-xl px-6 py-3 text-[14px] font-medium transition-colors",
        active
          ? "bg-card text-[#0e9180] shadow-[0_-1px_4px_rgba(15,40,60,0.06)]"
          : "text-slate-500 hover:text-slate-700"
      )}
    >
      {children}
    </button>
  );
}

export function CbToolButton({
  children,
  title,
  onClick,
  disabled
}: {
  children: ReactNode;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-slate-500 hover:bg-muted disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function CbCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={cn(
        "flex h-[18px] w-[18px] items-center justify-center rounded border transition-colors",
        checked ? "border-[#0e9180] bg-[#0e9180]" : "border-border bg-card hover:border-slate-400"
      )}
    >
      {checked ? (
        <svg viewBox="0 0 12 12" className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M2 6l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </button>
  );
}

export function CbPageButton({
  children,
  disabled,
  onClick
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

export function CbSummaryCard({ title, amount, iconIndex = 0 }: { title: string; amount: number; iconIndex?: number }) {
  const Icon = SUMMARY_ICONS[iconIndex % SUMMARY_ICONS.length] ?? TrendingDown;
  const negative = amount < 0;
  const positive = amount > 0;
  const formatted = useMemo(() => {
    if (!Number.isFinite(amount)) return "—";
    return amount.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
  }, [amount]);

  return (
    <div
      className={cn(
        "group relative flex min-h-[110px] flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 dark:border-border",
        "hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-6px_rgba(15,40,60,0.12),0_4px_8px_-2px_rgba(15,40,60,0.06)]",
        "shadow-[0_1px_3px_rgba(15,40,60,0.06),0_1px_2px_rgba(15,40,60,0.04)]"
      )}
    >
      <div
        className="h-[4px] w-full"
        style={{ background: "linear-gradient(90deg, #cbd5e1 0%, #94a3b8 100%)" }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white to-transparent opacity-60" aria-hidden />
      <div className="relative flex flex-1 flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
              <Icon size={14} className="stroke-[2.2] text-slate-500" />
            </div>
            <span className="truncate text-[12.5px] font-semibold leading-tight text-slate-600">{title}</span>
          </div>
          <div
            className={cn(
              "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full",
              negative ? "bg-red-50 text-red-500" : positive ? "bg-emerald-50 text-emerald-500" : "bg-muted text-slate-400"
            )}
          >
            {negative ? (
              <ArrowUpRight size={10} strokeWidth={2.8} />
            ) : positive ? (
              <ArrowDownLeft size={10} strokeWidth={2.8} />
            ) : (
              <span className="text-[8px] font-bold">—</span>
            )}
          </div>
        </div>
        <div className="mt-2 flex items-end justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="leading-none">
              <span
                className={cn(
                  "block truncate text-[18px] font-medium tabular-nums tracking-tight",
                  negative ? "text-red-600" : positive ? "text-emerald-600" : "text-slate-700"
                )}
              >
                {formatted}
              </span>
            </div>
          </div>
          <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-600">
            UZS
          </span>
        </div>
      </div>
    </div>
  );
}

export function CbPagination({
  page,
  totalPages,
  total,
  limit,
  selectedCount,
  onPage
}: {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  selectedCount: number;
  onPage: (p: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3.5">
      <div className="text-[13px] text-slate-500">
        {from} – {to} / <b className="text-slate-700">{total.toLocaleString("ru-RU")}</b>
        {selectedCount > 0 ? (
          <span className="ml-3 text-[#0e9180]">Выбрано: {selectedCount}</span>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        <CbPageButton disabled={page === 1} onClick={() => onPage(1)}>
          <ChevronsLeft size={15} />
        </CbPageButton>
        <CbPageButton disabled={page === 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft size={15} />
        </CbPageButton>
        {cbPageWindow(page, totalPages).map((n, i) =>
          n === -1 ? (
            <span key={`e${i}`} className="px-1.5 text-slate-400">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => onPage(n)}
              className={cn(
                "h-9 min-w-9 rounded-lg px-2 text-[13px] font-medium transition-colors",
                n === page ? "bg-[#0e9180] text-white" : "text-slate-600 hover:bg-muted"
              )}
            >
              {n.toLocaleString("ru-RU")}
            </button>
          )
        )}
        <CbPageButton disabled={page === totalPages} onClick={() => onPage(page + 1)}>
          <ChevronRight size={15} />
        </CbPageButton>
        <CbPageButton disabled={page === totalPages} onClick={() => onPage(totalPages)}>
          <ChevronsRight size={15} />
        </CbPageButton>
      </div>
    </div>
  );
}
