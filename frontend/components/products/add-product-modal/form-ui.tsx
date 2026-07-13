"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string };

export function Field({
  label,
  required,
  hint,
  children,
  className
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 flex items-center gap-1 text-[13px] font-medium text-slate-600">
        {label}
        {required ? <span className="text-rose-500">*</span> : null}
        {hint ? <span className="ml-auto text-[11px] font-normal text-slate-400">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  suffix,
  error,
  maxLength
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  suffix?: ReactNode;
  error?: boolean;
  maxLength?: number;
}) {
  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-10 w-full rounded-xl border bg-white px-3.5 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400",
          "focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10",
          error ? "border-rose-400" : "border-slate-200 hover:border-slate-300",
          suffix && "pr-11"
        )}
      />
      {suffix ? <span className="absolute inset-y-0 right-2 flex items-center">{suffix}</span> : null}
    </div>
  );
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "Tanlang",
  error
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  error?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-xl border bg-white px-3.5 text-sm outline-none transition-all",
          "focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10",
          error ? "border-rose-400" : "border-slate-200 hover:border-slate-300",
          value ? "text-slate-800" : "text-slate-400"
        )}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="absolute z-30 mt-1.5 max-h-52 w-full overflow-auto rounded-xl border border-slate-100 bg-white p-1 shadow-xl shadow-slate-900/10">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50",
                value === opt.value ? "font-medium text-teal-600" : "text-slate-700"
              )}
            >
              {opt.label}
              {value === opt.value ? <Check className="h-4 w-4" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function MultiSelect({
  values,
  onChange,
  options,
  placeholder = "Tanlang",
  error
}: {
  values: string[];
  onChange: (v: string[]) => void;
  options: SelectOption[];
  placeholder?: string;
  error?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const toggle = (opt: string) =>
    onChange(values.includes(opt) ? values.filter((v) => v !== opt) : [...values, opt]);

  const labelFor = (v: string) => options.find((o) => o.value === v)?.label ?? v;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex min-h-10 w-full items-center justify-between gap-2 rounded-xl border bg-white px-2.5 py-1.5 text-sm outline-none transition-all",
          "focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10",
          error ? "border-rose-400" : "border-slate-200 hover:border-slate-300"
        )}
      >
        {values.length === 0 ? (
          <span className="px-1 text-slate-400">{placeholder}</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {values.map((v) => (
              <span
                key={v}
                className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700"
              >
                {labelFor(v)}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(v);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      toggle(v);
                    }
                  }}
                  className="cursor-pointer text-teal-500 hover:text-teal-800"
                >
                  <X className="h-3 w-3" />
                </span>
              </span>
            ))}
          </span>
        )}
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="absolute z-30 mt-1.5 max-h-52 w-full overflow-auto rounded-xl border border-slate-100 bg-white p-1 shadow-xl shadow-slate-900/10">
          {options.map((opt) => {
            const selected = values.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
              >
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                    selected ? "border-teal-500 bg-teal-500 text-white" : "border-slate-300 bg-white"
                  )}
                >
                  {selected ? <Check className="h-3 w-3" /> : null}
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="group flex items-center gap-3">
      <span
        className={cn(
          "relative h-6 w-11 rounded-full transition-colors duration-200",
          checked ? "bg-teal-500" : "bg-slate-300"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-200",
            checked ? "left-[22px]" : "left-0.5"
          )}
        />
      </span>
      {label ? (
        <span className={cn("text-sm font-medium", checked ? "text-slate-800" : "text-slate-500")}>{label}</span>
      ) : null}
    </button>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
      <span className="h-4 w-1 rounded-full bg-teal-500" />
      {children}
    </h3>
  );
}
