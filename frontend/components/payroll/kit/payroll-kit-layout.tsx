"use client";

import { Calendar, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { MonthYearPickerPopover } from "@/components/ui/month-year-picker-popover";
import { PAYROLL_CARD, PAYROLL_ICON_BTN } from "@/components/payroll/kit/payroll-kit-table";
import { currentYm, type Ym } from "@/lib/payroll/payroll-api";
import { cn } from "@/lib/utils";

export { PayrollRelatedBar, type PayrollSection } from "@/components/payroll/kit/payroll-kit-related";

const TITLE_ACTIONS =
  "flex flex-wrap items-center gap-2 [&>button]:h-9 [&>button]:gap-1.5 [&>button]:rounded-lg [&>button]:px-4 [&>button]:text-[13.5px] [&>button]:font-medium [&>button_svg]:mr-0";

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
        <nav aria-label="Навигация" className="mb-0.5 text-[12px] text-muted-foreground">
          {crumb}
          <span className="mx-1.5 opacity-50">/</span>
          <span className="font-medium text-[var(--pr-brand-600)]">{title}</span>
        </nav>
        <h1 className="truncate text-[20px] font-bold tracking-[-0.01em] text-foreground">{title}</h1>
        {description ? <p className="mt-1 max-w-[720px] text-[12.5px] text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className={TITLE_ACTIONS}>{actions}</div> : null}
    </div>
  );
}

const MONTH_SHORT = ["Янв.", "Февр.", "Март", "Апр.", "Май", "Июнь", "Июль", "Авг.", "Сент.", "Окт.", "Нояб.", "Дек."];

function shiftYm(ym: Ym, delta: number): Ym {
  const idx = ym.year * 12 + (ym.month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

type MonthNavProps = { value: Ym | null; onChange: (v: Ym) => void; onClear?: () => void; variant?: "header" | "filter" };

/** Prev / picker / next. With `onClear`, a null value means «Все месяцы». */
export function PayrollMonthNav({ value, onChange, onClear, variant = "header" }: MonthNavProps) {
  const nullable = Boolean(onClear);
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const base = value ?? currentYm();
  const ymStr = `${base.year}-${String(base.month).padStart(2, "0")}`;
  const filter = variant === "filter";
  return (
    <div className={cn("flex flex-col", filter ? "items-start" : "items-start sm:items-end")}>
      <span className="mb-1 text-[11px] font-medium text-muted-foreground">{filter ? "Месяц" : "Месяц и год"}</span>
      <div className="flex items-center gap-1">
        <button type="button" className={PAYROLL_ICON_BTN} aria-label="Предыдущий месяц" onClick={() => onChange(shiftYm(base, value ? -1 : 0))}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="relative">
          <button
            ref={anchorRef}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            className={cn(
              "flex h-9 min-w-[158px] items-center justify-between gap-2 rounded-lg border border-[var(--pr-input)] bg-card px-3 text-[13px] font-medium text-foreground shadow-sm transition-colors hover:bg-muted",
              nullable && value && "pr-8"
            )}
            onClick={() => setOpen((o) => !o)}
          >
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className={cn(!value && "text-muted-foreground")}>{value ? `${MONTH_SHORT[value.month - 1]} ${value.year}` : "Все месяцы"}</span>
            </span>
            {nullable && value ? null : <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />}
          </button>
          {nullable && value ? (
            <button
              type="button"
              aria-label="Все месяцы"
              title="Все месяцы"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={onClear}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        <button type="button" className={PAYROLL_ICON_BTN} aria-label="Следующий месяц" onClick={() => onChange(shiftYm(base, value ? 1 : 0))}>
          <ChevronRight className="h-4 w-4" />
        </button>
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

/** Filter-row control (template `LabeledSelect`: h-40, blue-gray border, medium text). */
const PAYROLL_FIELD =
  "h-10 w-full rounded-lg border border-[var(--pr-field)] bg-card text-[13.5px] font-medium shadow-sm outline-none transition-colors hover:border-[var(--pr-field-hover)] focus:border-primary focus:ring-2 focus:ring-[var(--pr-brand-100)]";
const FLOAT_LABEL = "pointer-events-none absolute -top-[7px] left-3 bg-card px-1 text-[11px] font-medium leading-none text-muted-foreground";

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
    <div className={cn("relative w-full min-w-[150px] max-w-[215px] flex-1", className)}>
      <select
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        className={cn(PAYROLL_FIELD, "cursor-pointer appearance-none pl-3 pr-8", value ? "text-foreground" : "text-foreground/70")}
      >
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {value ? <span className={FLOAT_LABEL}>{label}</span> : null}
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

/** Input with the same floating label as {@link PayrollFloatSelect}. */
export function PayrollFloatInput({
  label,
  value,
  onChange,
  type = "text",
  className,
  inputClassName,
  title
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "date" | "search";
  className?: string;
  inputClassName?: string;
  title?: string;
}) {
  const floating = Boolean(value) || type === "date";
  return (
    <div className={cn("relative min-w-[160px] max-w-[200px] flex-1", className)} title={title}>
      <input
        type={type}
        value={value}
        aria-label={label}
        placeholder={floating ? undefined : label}
        onChange={(e) => onChange(e.target.value)}
        className={cn(PAYROLL_FIELD, "px-3 placeholder:text-foreground/70", type === "date" && !value && "text-muted-foreground", inputClassName)}
      />
      {floating ? <span className={FLOAT_LABEL}>{label}</span> : null}
    </div>
  );
}

export const PAYROLL_FILTER_TRIGGER =
  "h-10 min-w-[200px] rounded-lg border border-[var(--pr-field)] bg-card px-3 text-[13.5px] font-medium shadow-sm transition-colors hover:border-[var(--pr-field-hover)]";

export type SegmentTab<T extends string> = { id: T; label: string; count?: number; dot?: "success" | "muted" };

/**
 * `solid` — template role/section tabs (white card, green active pill).
 * `status` — template «Активный / Не активный» switch (gray track, white active chip).
 */
export function PayrollSegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  variant = "solid",
  className
}: {
  tabs: SegmentTab<T>[];
  value: T;
  onChange: (v: T) => void;
  variant?: "solid" | "status";
  className?: string;
}) {
  const status = variant === "status";
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-1 p-1",
        status ? "rounded-lg border border-[var(--pr-border)] bg-muted/70" : "rounded-xl border border-[var(--pr-border)] bg-card shadow-[var(--pr-shadow)]",
        className
      )}
    >
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 px-4 py-1.5 text-[13px] transition-colors",
              status
                ? cn("rounded-md", active ? "bg-card font-semibold text-[var(--pr-brand-700)] shadow-sm ring-1 ring-black/[0.04]" : "font-medium text-muted-foreground hover:text-foreground")
                : cn("rounded-lg font-medium", active ? "bg-primary text-white shadow-sm" : "text-foreground/70 hover:bg-muted")
            )}
          >
            {status || t.dot ? (
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  status ? (active ? "bg-primary" : "bg-muted-foreground/40") : active ? "bg-current" : t.dot === "success" ? "bg-emerald-500" : "bg-muted-foreground/60"
                )}
              />
            ) : null}
            {t.label}
            {t.count != null ? (
              <span
                className={cn(
                  "inline-flex min-w-[20px] justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums",
                  status
                    ? active
                      ? "bg-[var(--pr-brand-50)] text-[var(--pr-brand-600)]"
                      : "bg-muted-foreground/15 text-muted-foreground"
                    : active
                      ? "bg-white/25 text-white"
                      : "bg-muted text-muted-foreground"
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
  crumb,
  month,
  children,
  onApply,
  applyDisabled,
  applyLabel = "Применить",
  onFx,
  extra
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  crumb?: string;
  month?: MonthNavProps;
  children?: ReactNode;
  onApply?: () => void;
  applyDisabled?: boolean;
  applyLabel?: string;
  /** «fx»: opens the formula builder modal in place. */
  onFx?: () => void;
  extra?: ReactNode;
}) {
  return (
    <section className={cn(PAYROLL_CARD, "p-4 sm:p-5")} aria-label="Фильтры">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-[320px]">
          <PayrollPageTitle title={title} description={description} crumb={crumb} />
        </div>
        {actions || month ? (
          <div className="flex shrink-0 flex-wrap items-end gap-2">
            {actions ? <div className={TITLE_ACTIONS}>{actions}</div> : null}
            {month ? <PayrollMonthNav {...month} /> : null}
          </div>
        ) : null}
      </div>
      {children || onApply ? (
        <div className="mt-5 flex flex-wrap items-end gap-4">
          {children}
          <div className="flex items-center gap-2 sm:ml-auto">
            {extra}
            {onFx ? (
              <button
                type="button"
                onClick={onFx}
                title="Установка формулу"
                aria-label="Установка формулу"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--pr-brand-200)] bg-[var(--pr-brand-50)] font-mono text-[13px] font-bold text-[var(--pr-brand-600)] opacity-80 transition-colors hover:bg-[var(--pr-brand-100)] hover:opacity-100"
              >
                fx
              </button>
            ) : null}
            {onApply ? (
              <Button type="button" className="h-10 min-w-[132px] rounded-lg text-[14px]" disabled={applyDisabled} onClick={onApply}>
                {applyLabel}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
