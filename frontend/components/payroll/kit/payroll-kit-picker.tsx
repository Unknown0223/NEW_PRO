"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Calendar, Check, ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { currentYm, type Ym } from "@/lib/payroll/payroll-api";
import { cn } from "@/lib/utils";

export type PickOption = { value: string; label: string; hint?: string };
type Side = "top" | "bottom";

const PANEL =
  "absolute z-40 overflow-hidden rounded-xl border border-[var(--pr-border)] bg-card shadow-[0_4px_6px_-2px_rgb(16_42_38/0.06),0_16px_32px_-8px_rgb(16_42_38/0.22)] animate-in fade-in-0 zoom-in-95 duration-100";
const TRIGGER_SM =
  "flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-[var(--pr-input)] bg-card px-2.5 text-left text-[12.5px] shadow-sm transition-colors hover:border-[var(--pr-field-hover)] focus:border-primary focus:outline-none focus:ring-2 focus:ring-[var(--pr-brand-100)] disabled:cursor-not-allowed disabled:opacity-60";
const TRIGGER_FIELD =
  "relative flex h-[46px] w-full items-end justify-between gap-2 rounded-lg border border-[var(--pr-input)] bg-card pb-[7px] pl-3 pr-2.5 text-left text-[13px] font-medium shadow-sm transition-colors hover:border-[var(--pr-field-hover)] focus:border-primary focus:outline-none focus:ring-2 focus:ring-[var(--pr-brand-100)] disabled:cursor-not-allowed disabled:opacity-60";
const OPTION = "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-[7px] text-left text-[12.5px] text-foreground/80 transition-colors hover:bg-[var(--pr-row-hover)]";
const OPTION_ON = "bg-[var(--pr-brand-50)] font-semibold text-[var(--pr-brand-700)] hover:bg-[var(--pr-brand-50)]";

function usePopover() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      setOpen(false);
    }
  };
  return { open, setOpen, rootRef, onKeyDown };
}

function Trigger({
  label,
  text,
  muted,
  icon,
  open,
  disabled,
  size,
  onClick
}: {
  label?: string;
  text: string;
  muted: boolean;
  icon?: ReactNode;
  open: boolean;
  disabled?: boolean;
  size: "sm" | "field";
  onClick: () => void;
}) {
  return (
    <button type="button" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} onClick={onClick} className={size === "field" ? TRIGGER_FIELD : TRIGGER_SM}>
      {label ? <span className="pointer-events-none absolute left-3 top-[7px] text-[10.5px] font-medium leading-none text-muted-foreground">{label}</span> : null}
      <span className="flex min-w-0 items-center gap-1.5">
        {icon}
        <span className={cn("truncate", muted && "font-normal text-muted-foreground")}>{text}</span>
      </span>
      <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180", size === "field" && "mb-0.5")} />
    </button>
  );
}

/** Template-style dropdown rendered inside its container (safe within modals). */
export function PayrollPickSelect({
  value,
  onChange,
  options,
  placeholder,
  label,
  searchable,
  allowEmpty = true,
  emptyText = "Список пуст",
  side = "bottom",
  disabled,
  size = "sm",
  className,
  panelClassName
}: {
  value: string;
  onChange: (v: string) => void;
  options: PickOption[];
  placeholder: string;
  label?: string;
  searchable?: boolean;
  allowEmpty?: boolean;
  emptyText?: string;
  side?: Side;
  disabled?: boolean;
  size?: "sm" | "field";
  className?: string;
  panelClassName?: string;
}) {
  const { open, setOpen, rootRef, onKeyDown } = usePopover();
  const [q, setQ] = useState("");
  const current = options.find((o) => o.value === value);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter((o) => o.label.toLowerCase().includes(s)) : options;
  }, [options, q]);
  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };
  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)} onKeyDown={onKeyDown}>
      <Trigger label={label} text={current?.label ?? placeholder} muted={!current} open={open} disabled={disabled} size={size} onClick={() => setOpen((v) => !v)} />
      {open ? (
        <div role="listbox" className={cn(PANEL, "w-full min-w-[220px]", side === "top" ? "bottom-full mb-1.5 origin-bottom" : "top-full mt-1.5 origin-top", panelClassName)}>
          {searchable ? (
            <div className="relative border-b border-[var(--pr-line)] p-2">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Поиск"
                aria-label="Поиск"
                className="h-8 w-full rounded-lg border border-[var(--pr-input)] bg-card pl-8 pr-2 text-[12.5px] placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-[var(--pr-brand-100)]"
              />
            </div>
          ) : null}
          <ul className="max-h-[248px] overflow-y-auto p-1.5">
            {allowEmpty && !q ? (
              <li>
                <button type="button" onClick={() => pick("")} className={cn(OPTION, !value && OPTION_ON)}>
                  <span className="truncate">{placeholder}</span>
                  {!value ? <Check className="size-3.5 shrink-0" /> : null}
                </button>
              </li>
            ) : null}
            {list.map((o) => (
              <li key={o.value}>
                <button type="button" role="option" aria-selected={o.value === value} onClick={() => pick(o.value)} className={cn(OPTION, o.value === value && OPTION_ON)}>
                  <span className="min-w-0">
                    <span className="block truncate">{o.label}</span>
                    {o.hint ? <span className="block truncate text-[11px] font-normal text-muted-foreground">{o.hint}</span> : null}
                  </span>
                  {o.value === value ? <Check className="size-3.5 shrink-0" /> : null}
                </button>
              </li>
            ))}
            {list.length === 0 ? (
              <li className="px-2.5 py-3 text-center text-[12px] text-muted-foreground">{q ? "Ничего не найдено" : emptyText}</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

const MONTHS = ["Янв.", "Февр.", "Март", "Апр.", "Май", "Июнь", "Июль", "Авг.", "Сент.", "Окт.", "Нояб.", "Дек."];
/** Month + year picker in the same popover style as {@link PayrollPickSelect}. */
export function PayrollPickMonth({
  value,
  onChange,
  side = "bottom",
  size = "sm",
  label,
  className
}: {
  value: Ym;
  onChange: (v: Ym) => void;
  side?: Side;
  size?: "sm" | "field";
  label?: string;
  className?: string;
}) {
  const { open, setOpen, rootRef, onKeyDown } = usePopover();
  const [year, setYear] = useState(value.year);
  useEffect(() => {
    if (open) setYear(value.year);
  }, [open, value.year]);
  const pick = (v: Ym) => {
    onChange(v);
    setOpen(false);
  };
  const now = currentYm();

  return (
    <div ref={rootRef} className={cn("relative", className)} onKeyDown={onKeyDown}>
      <Trigger
        label={label}
        text={`${MONTHS[value.month - 1]} ${value.year}`}
        muted={false}
        icon={<Calendar className="size-3.5 shrink-0 text-muted-foreground" />}
        open={open}
        size={size}
        onClick={() => setOpen((v) => !v)}
      />
      {open ? (
        <div role="dialog" aria-label="Выбор месяца" className={cn(PANEL, "w-[236px] p-3", side === "top" ? "bottom-full mb-1.5 origin-bottom" : "top-full mt-1.5 origin-top")}>
          <div className="mb-2.5 flex items-center justify-between">
            <button type="button" aria-label="Предыдущий год" onClick={() => setYear((y) => y - 1)} className="rounded-lg border border-[var(--pr-input)] p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-[13px] font-bold tabular-nums text-foreground">{year}</span>
            <button type="button" aria-label="Следующий год" onClick={() => setYear((y) => y + 1)} className="rounded-lg border border-[var(--pr-input)] p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {MONTHS.map((m, i) => {
              const on = value.year === year && value.month === i + 1;
              const isNow = now.year === year && now.month === i + 1;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => pick({ year, month: i + 1 })}
                  className={cn(
                    "h-8 rounded-lg text-[12px] font-medium transition-colors",
                    on ? "bg-primary text-white shadow-sm" : "text-foreground/80 hover:bg-[var(--pr-brand-50)] hover:text-[var(--pr-brand-700)]",
                    !on && isNow && "ring-1 ring-inset ring-[var(--pr-brand-200)]"
                  )}
                >
                  {m}
                </button>
              );
            })}
          </div>
          <div className="mt-2.5 flex justify-between border-t border-[var(--pr-line)] pt-2">
            <button type="button" onClick={() => pick(now)} className="text-[12px] font-medium text-[var(--pr-brand-600)] hover:text-[var(--pr-brand-700)]">
              Текущий месяц
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-[12px] font-medium text-muted-foreground hover:text-foreground">
              Закрыть
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
