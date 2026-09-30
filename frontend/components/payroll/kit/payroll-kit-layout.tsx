"use client";

import { useQuery } from "@tanstack/react-query";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { MonthYearPickerPopover } from "@/components/ui/month-year-picker-popover";
import { useTenant } from "@/lib/api-client";
import { payrollApi, type Ym } from "@/lib/payroll/payroll-api";
import { cn } from "@/lib/utils";

export type PayrollSection = "salary" | "role-salaries" | "formulas" | "bonus" | "items";

const RELATED: { id: PayrollSection; label: string; href: string }[] = [
  { id: "salary", label: "Зарплата", href: "/users/salary" },
  { id: "role-salaries", label: "Базовые оклады", href: "/users/salary/role-salaries" },
  { id: "formulas", label: "Формулы", href: "/users/salary/formulas" },
  { id: "bonus", label: "Настройки бонусов и зарплат", href: "/users/bonus-and-salary-settings" },
  { id: "items", label: "Надбавки и вычеты", href: "/settings/payroll/adjustments" }
];

type ItemLite = { type: string; is_active: boolean };
type FormulaLite = { is_active: boolean };
type RoleLite = { base_amount: string | number | null };

export function PayrollRelatedBar({ current }: { current: PayrollSection }) {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const enabled = Boolean(tenant);
  const itemsQ = useQuery({ queryKey: ["payroll-items", tenant], enabled, queryFn: () => api.get<ItemLite[]>("/items") });
  const formulasQ = useQuery({ queryKey: ["payroll-formulas", tenant], enabled, queryFn: () => api.get<FormulaLite[]>("/formulas") });
  const rolesQ = useQuery({ queryKey: ["payroll-role-configs", tenant], enabled, queryFn: () => api.get<RoleLite[]>("/role-configs") });

  const items = (itemsQ.data ?? []).filter((i) => i.is_active);
  const stats = [
    { label: "Надбавки", value: items.filter((i) => i.type === "allowance").length },
    { label: "Удержания", value: items.filter((i) => i.type === "deduction").length },
    { label: "Формулы", value: (formulasQ.data ?? []).filter((f) => f.is_active).length },
    { label: "Оклады", value: (rolesQ.data ?? []).filter((r) => Number(r.base_amount ?? 0) > 0).length }
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[12.5px] shadow-sm">
      <span className="font-medium text-muted-foreground">Связанные разделы:</span>
      {RELATED.map((l) => (
        <Link
          key={l.id}
          href={l.href}
          className={cn(
            "rounded-md px-2 py-1 font-medium transition-colors",
            l.id === current
              ? "bg-primary/10 font-semibold text-primary"
              : "text-foreground/80 hover:bg-muted hover:text-primary"
          )}
        >
          {l.label}
        </Link>
      ))}
      <span className="ml-auto flex flex-wrap items-center gap-3 text-muted-foreground">
        {stats.map((s) => (
          <span key={s.label}>
            {s.label}: <b className="text-foreground">{s.value}</b>
          </span>
        ))}
      </span>
    </div>
  );
}

export function PayrollPageTitle({
  title,
  description,
  actions,
  crumb = "Зарплата"
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  crumb?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <nav className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>{crumb}</span>
          <span>/</span>
          <span className="font-medium text-primary">{title}</span>
        </nav>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-foreground">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

const MONTH_SHORT = ["Янв.", "Февр.", "Март", "Апр.", "Май", "Июнь", "Июль", "Авг.", "Сент.", "Окт.", "Нояб.", "Дек."];

function shiftYm(ym: Ym, delta: number): Ym {
  const idx = ym.year * 12 + (ym.month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

export function PayrollMonthNav({ value, onChange, variant = "header" }: { value: Ym; onChange: (v: Ym) => void; variant?: "header" | "filter" }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const ymStr = `${value.year}-${String(value.month).padStart(2, "0")}`;
  const filter = variant === "filter";
  const h = filter ? "h-10" : "h-9";
  return (
    <div className={cn("flex flex-col gap-1", filter ? "items-start" : "items-start sm:items-end")}>
      <span className={filter ? "orders-filter-field-label" : "text-[11px] font-medium text-muted-foreground"}>{filter ? "Месяц" : "Месяц и год"}</span>
      <div className="flex items-center gap-1.5">
        <Button type="button" variant="outline" size="icon" className={cn(h, filter ? "w-10" : "w-9")} aria-label="Предыдущий месяц" onClick={() => onChange(shiftYm(value, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          ref={anchorRef}
          type="button"
          variant="outline"
          className={cn(h, "min-w-[150px] justify-between gap-2 px-3 font-medium")}
          onClick={() => setOpen((o) => !o)}
        >
          <Calendar className="h-4 w-4 text-primary" />
          <span className="flex-1 text-left">
            {MONTH_SHORT[value.month - 1]} {value.year}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
        <Button type="button" variant="outline" size="icon" className={cn(h, filter ? "w-10" : "w-9")} aria-label="Следующий месяц" onClick={() => onChange(shiftYm(value, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <MonthYearPickerPopover
        open={open}
        onOpenChange={setOpen}
        anchorRef={anchorRef}
        value={ymStr}
        onChange={(next) => {
          const [y, m] = next.split("-").map(Number);
          if (y && m) onChange({ year: y, month: m });
        }}
      />
    </div>
  );
}

export type FloatOption = { value: string; label: string };

/** Select with a label that floats onto the border once a value is chosen. */
export function PayrollFloatSelect({
  label,
  value,
  onChange,
  options,
  className
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: FloatOption[];
  className?: string;
}) {
  return (
    <div className={cn("relative min-w-[180px]", className)}>
      {value ? (
        <span className="pointer-events-none absolute -top-[7px] left-2.5 z-[1] bg-card px-1 text-[11px] font-medium leading-none text-muted-foreground">
          {label}
        </span>
      ) : null}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-10 w-full appearance-none rounded-lg border border-input bg-background pl-3 pr-8 text-sm outline-none transition-colors",
          "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20",
          value ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export const PAYROLL_FILTER_TRIGGER =
  "h-10 min-w-[200px] rounded-lg border border-input bg-background px-3 text-sm";

export type SegmentTab<T extends string> = { id: T; label: string; count?: number; dot?: "success" | "muted" };

export function PayrollSegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  className
}: {
  tabs: SegmentTab<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1 shadow-sm", className)}>
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {t.dot ? (
              <span className={cn("h-1.5 w-1.5 rounded-full", t.dot === "success" ? "bg-emerald-500" : "bg-muted-foreground/60", active && "bg-current")} />
            ) : null}
            {t.label}
            {t.count != null ? (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                  active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                {t.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Top filter card: breadcrumb + title, month picker, filter row, fx and «Применить». */
export function PayrollFilterCard({
  title,
  description,
  actions,
  month,
  children,
  onApply,
  applyDisabled,
  fxHref,
  extra
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  month?: { value: Ym; onChange: (v: Ym) => void };
  children?: ReactNode;
  onApply?: () => void;
  applyDisabled?: boolean;
  fxHref?: string;
  extra?: ReactNode;
}) {
  const showFx = Boolean(fxHref);
  return (
    <div className="orders-hub-section orders-hub-section--filters orders-hub-section--stack-tight">
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PayrollPageTitle title={title} description={description} actions={actions} />
          {month ? <PayrollMonthNav value={month.value} onChange={month.onChange} /> : null}
        </div>
        {children || onApply ? (
          <div className="mt-5 flex flex-wrap items-end gap-3">
            {children}
            <div className="flex items-center gap-2 sm:ml-auto">
              {extra}
              {showFx ? (
                <Link
                  href={fxHref!}
                  title="Формулы"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 font-serif text-[15px] italic font-bold text-primary transition-colors hover:bg-primary/15"
                >
                  fx
                </Link>
              ) : null}
              {onApply ? (
                <Button type="button" className="h-10 min-w-[132px]" disabled={applyDisabled} onClick={onApply}>
                  Применить
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
