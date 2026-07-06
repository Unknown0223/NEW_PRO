"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function formatPaymentMoney(amount: number | string): string {
  const n = typeof amount === "string" ? Number.parseFloat(amount.replace(/\s/g, "").replace(/,/g, ".")) : amount;
  const val = Number.isFinite(n) ? n : 0;
  const abs = Math.abs(val);
  const formatted = new Intl.NumberFormat("ru-RU").format(abs);
  return val < 0 ? `-${formatted} UZS` : `${formatted} UZS`;
}

export function formatPaymentDt(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "—";
  }
}

export function formatPaymentDateRange(from: string, to: string): string {
  const fmt = (ymd: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
    if (!m) return ymd;
    return `${m[3]}.${m[2]}.${m[1]}`;
  };
  return `${fmt(from)} - ${fmt(to)}`;
}

export function Th({ children }: { children: ReactNode }) {
  return <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{children}</th>;
}

export function Td({
  children,
  className,
  title
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <td className={cn("whitespace-nowrap px-3 py-2.5 align-top text-slate-700", className)} title={title}>
      {children}
    </td>
  );
}

export function TemplateSelectField({
  value,
  onChange,
  options,
  placeholder,
  displayMap
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  displayMap?: Record<string, string>;
}) {
  const display = (v: string) => displayMap?.[v] ?? (v === "" ? placeholder ?? "" : v);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-border bg-card px-2.5 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none"
    >
      {options.map((o, i) => (
        <option key={`${i}:${o}`} value={o}>
          {display(o)}
        </option>
      ))}
    </select>
  );
}

export function PaymentMethodBadge({ label, isCash }: { label: string; isCash: boolean }) {
  return (
    <span
      className={cn(
        "inline-block rounded px-2 py-0.5 text-xs font-medium",
        isCash ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"
      )}
    >
      {label}
    </span>
  );
}

export function GrantAccessIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-4 w-4", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M9 14l2 2 4-4" />
    </svg>
  );
}
