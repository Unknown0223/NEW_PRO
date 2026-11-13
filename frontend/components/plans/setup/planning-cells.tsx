"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Link2,
  Pencil,
  Sigma
} from "lucide-react";
import { formatNumber } from "./planning-utils";

export type MetricField = "cost" | "count" | "volume" | "acb" | "order_count";

export const metricOptions = ["Сумма", "Количество", "Объем", "АКБ", "Кол-во-заказов"] as const;

export const metricFields: Record<string, MetricField> = {
  Сумма: "cost",
  Количество: "count",
  Объем: "volume",
  АКБ: "acb",
  "Кол-во-заказов": "order_count"
};

export function numericValue(value: string | number | null | undefined) {
  if (typeof value === "number") return value;
  const normalized = String(value ?? "0").replace(/\s/g, "").replace(/,/g, ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function KpiCell({
  value,
  onChange,
  disabled = false,
  hasMismatch = false,
  isTarget = false
}: {
  value: string;
  onChange?: (val: string) => void;
  disabled?: boolean;
  hasMismatch?: boolean;
  isTarget?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);

  useEffect(() => {
    if (!editing) setLocal(value);
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    if (local !== value && onChange) onChange(local);
  };

  const displayValue = numericValue(value) === 0 ? "" : formatNumber(value);

  if (editing && !disabled) {
    return (
      <input
        type="text"
        value={local}
        onChange={(event) => setLocal(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => event.key === "Enter" && commit()}
        className={cn(
          "h-6 w-full rounded border bg-white px-1 text-[11px] text-slate-700 outline-none ring-1",
          hasMismatch ? "border-red-400 ring-red-200" : "border-teal-400 ring-teal-200"
        )}
        autoFocus
      />
    );
  }

  const borderColor = hasMismatch
    ? "border-red-400 bg-red-50/50 text-red-700"
    : isTarget
      ? "border-teal-400 bg-teal-50/50 text-teal-800"
      : "border-slate-200 bg-[#f8fafb] text-slate-600";

  return (
    <button
      type="button"
      onClick={() => !disabled && setEditing(true)}
      disabled={disabled}
      className={cn(
        "flex h-6 w-full items-center gap-0.5 rounded border px-1 text-[11px] transition-colors",
        borderColor,
        !disabled && "cursor-pointer hover:bg-white"
      )}
    >
      {!isTarget && !hasMismatch && <Link2 className="h-2.5 w-2.5 shrink-0 text-teal-500" />}
      {hasMismatch && <AlertCircle className="h-2.5 w-2.5 shrink-0 text-red-500" />}
      {isTarget && !hasMismatch && <Sigma className="h-2.5 w-2.5 shrink-0 text-teal-600" />}
      <span className="whitespace-nowrap text-[11px] font-medium">{displayValue}</span>
    </button>
  );
}

export function CommentCell({
  value,
  onChange,
  disabled
}: {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const commit = () => {
    setEditing(false);
    if (local !== value) onChange(local);
  };

  if (editing && !disabled) {
    return (
      <input
        type="text"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        className="h-7 w-full rounded border border-slate-300 px-1.5 text-xs outline-none focus:border-teal-500"
        autoFocus
        placeholder="Комментарий..."
      />
    );
  }

  return (
    <div className="group flex items-center gap-1">
      <span
        className={cn(
          "truncate text-[11px] text-slate-400",
          !disabled && "cursor-pointer hover:text-slate-600"
        )}
        onClick={() => !disabled && setEditing(true)}
      >
        {value || "Комментарий..."}
      </span>
      {!disabled && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-slate-100 group-hover:opacity-100"
        >
          <Pencil className="h-2.5 w-2.5 text-slate-400" />
        </button>
      )}
    </div>
  );
}

export function StatusButton({
  status,
  onChange,
  disabled,
  isLastRow = false
}: {
  status: string;
  onChange: (status: string) => void;
  disabled?: boolean;
  isLastRow?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const options = [
    { value: "in_progress", label: "В процессе", bg: "bg-orange-50 border-orange-200 text-orange-600" },
    {
      value: "rejected",
      label: "Возвращено для редактирования",
      bg: "bg-orange-50 border-orange-200 text-orange-600"
    },
    { value: "approved", label: "Одобрено", bg: "bg-emerald-50 border-emerald-200 text-emerald-700" },
    { value: "pending_approval", label: "На согласовании", bg: "bg-amber-50 border-amber-200 text-amber-700" },
    { value: "draft", label: "Черновик", bg: "bg-slate-50 border-slate-200 text-slate-600" }
  ];

  const current = options.find((option) => option.value === status) ?? options[0];
  const isUp = status === "in_progress";

  if (disabled) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap",
          current.bg
        )}
      >
        {current.label}
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap transition-colors",
          current.bg
        )}
      >
        {isUp ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
        {current.label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} aria-hidden />
          <div
            className={cn(
              "absolute z-[70] w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-xl",
              isLastRow ? "bottom-full mb-1" : "top-full mt-1"
            )}
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-2.5 py-1.5 text-xs transition-colors hover:bg-slate-50",
                  status === option.value && "bg-slate-50"
                )}
              >
                {status === option.value && <Check className="h-3 w-3 text-teal-600" />}
                <span className={cn(status !== option.value && "ml-5")}>{option.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
