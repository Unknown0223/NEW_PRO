"use client";

import { useCallback, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { payrollErrorText, STATUS_TONE, type StatusStyle } from "@/lib/payroll/payroll-api";

export const FIELD_LABEL = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";
export const NATIVE_SELECT = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
export const selectCls = (extra: string) => cn(NATIVE_SELECT, extra);

export function StatusBadge({ map, status }: { map: Record<string, StatusStyle>; status: string }) {
  const m = map[status] ?? { label: status, ...STATUS_TONE.slate };
  return <TonePill cls={m.cls} dot={m.dot}>{m.label}</TonePill>;
}

export function TonePill({ cls, dot, children }: { cls: string; dot: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold", cls)}>
      <span className={cn("size-1.5 rounded-full", dot)} />
      {children}
    </span>
  );
}

type NoticeState = { kind: "ok" | "error"; text: string } | null;

/** Sahifa ichidagi xabar (toast o'rniga). */
export function useNotice() {
  const [notice, setNotice] = useState<NoticeState>(null);
  const ok = useCallback((text: string) => setNotice({ kind: "ok", text }), []);
  const fail = useCallback((e: unknown) => setNotice({ kind: "error", text: typeof e === "string" ? e : payrollErrorText(e) }), []);
  const clear = useCallback(() => setNotice(null), []);
  const element = notice ? (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
        notice.kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"
      )}
    >
      {notice.kind === "ok" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
      <span className="flex-1 whitespace-pre-line">{notice.text}</span>
      <button type="button" onClick={clear} className="opacity-60 hover:opacity-100" aria-label="Закрыть">
        <X className="size-4" />
      </button>
    </div>
  ) : null;
  return { ok, fail, clear, element };
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-end gap-2 rounded-lg border bg-card p-3", className)}>{children}</div>;
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("grid gap-1", className)}>
      <span className={FIELD_LABEL}>{label}</span>
      {children}
    </label>
  );
}

export function EmptyRow({ colSpan, text = "Нет данных" }: { colSpan: number; text?: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-8 text-center text-sm text-muted-foreground">
        {text}
      </td>
    </tr>
  );
}

/** Jadvalda tanlash (checkbox) holati. */
export function useSelection<T extends number>() {
  const [ids, setIds] = useState<Set<T>>(new Set());
  const toggle = useCallback((id: T) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const setAll = useCallback((all: T[], on: boolean) => setIds(on ? new Set(all) : new Set()), []);
  const clear = useCallback(() => setIds(new Set()), []);
  return { ids, toggle, setAll, clear, list: [...ids] };
}

export function parseAmount(raw: string): number {
  return Number(raw.replace(/\s/g, "").replace(",", "."));
}
