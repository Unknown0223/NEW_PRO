"use client";

import { ChevronDown } from "lucide-react";
import { parseStoredFio } from "@/lib/person-display";
import { cn } from "@/lib/utils";

export function parseAgentFio(fio: string) {
  const { first, last, middle } = parseStoredFio(fio);
  return { last, first, middle };
}

export function formatAgentDateTime(d?: string | null) {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function formatAgentCreatedDate(d?: string | null) {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

export const agentModalInputClass =
  "h-[42px] w-full rounded-lg border border-border bg-card px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

export function AgentFilterSelect({
  label,
  value,
  onChange,
  children,
  emptyLabel
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  emptyLabel?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-lg border border-border bg-card px-4 py-2 pr-9 text-sm text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
      >
        {emptyLabel ? <option value="">{emptyLabel}</option> : null}
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <span className="pointer-events-none absolute left-3 -top-2 bg-card px-1 text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </span>
    </div>
  );
}

export function AgentTabButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative px-4 py-2.5 text-sm font-medium transition",
        active ? "text-teal-700" : "text-slate-500 hover:text-slate-800"
      )}
    >
      {children}
      {active ? (
        <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-teal-600" />
      ) : null}
    </button>
  );
}

export function AgentIconButton({
  children,
  onClick,
  title,
  className
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-muted hover:text-slate-900",
        className
      )}
    >
      {children}
    </button>
  );
}

export function AgentFormSection({
  title,
  icon,
  children
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-muted/40 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-card text-teal-600 ring-1 ring-slate-200">
          {icon}
        </span>
        {title}
      </div>
      {children}
    </section>
  );
}

export function AgentFormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

export function AgentFormSelect({
  value,
  onChange,
  options,
  emptyLabel
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  emptyLabel?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(agentModalInputClass, "appearance-none pr-9")}
      >
        {emptyLabel ? <option value="">{emptyLabel}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

/** Oxirgi sinxronizatsiya: yashil / sariq / qizil nuqta (shablon). */
export function AgentCatalogBadge({
  children,
  accent
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px]",
        accent
          ? "border-teal-200 bg-teal-50 text-teal-700"
          : "border-slate-200 bg-slate-50 text-slate-600"
      )}
    >
      {children}
    </span>
  );
}

export const agentTemplateFilterSelectClass =
  "h-10 w-full rounded-lg border border-slate-200/90 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition hover:border-slate-300/90 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/15";

export const agentToolbarBtnClass =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200/90 bg-white px-3 text-sm text-slate-600 shadow-sm transition hover:border-slate-300/90 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/15";

export const agentToolbarIconBtnClass =
  "inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-500 shadow-sm transition hover:border-slate-300/90 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/15";

/** Oxirgi sinxronizatsiya: yashil / sariq / qizil nuqta (shablon). */
export function agentSyncStatusColor(lastSync: string | null | undefined): string {
  if (!lastSync) return "bg-slate-300";
  const hours = (Date.now() - new Date(lastSync).getTime()) / 3_600_000;
  if (hours <= 1) return "bg-emerald-500";
  if (hours <= 24) return "bg-amber-400";
  return "bg-red-500";
}

export function AgentAppAccessDot({ enabled }: { enabled: boolean }) {
  return (
    <span
      title={enabled ? "Доступ к приложению: включен" : "Доступ к приложению: выключен"}
      className="inline-flex items-center justify-center"
    >
      <span
        className={cn(
          "h-3 w-3 rounded-full ring-2",
          enabled ? "bg-emerald-500 ring-emerald-100" : "bg-red-500 ring-red-100"
        )}
      />
    </span>
  );
}

export function AgentPriceTypeBadges({ items }: { items: string[] }) {
  if (!items.length) return <span className="text-slate-400">—</span>;
  return (
    <span className="flex items-center gap-1">
      {items.slice(0, 2).map((p) => (
        <span
          key={p}
          className="inline-block whitespace-nowrap rounded-md border border-teal-200 bg-teal-50 px-1.5 py-0.5 text-[11px] text-teal-700"
        >
          {p}
        </span>
      ))}
      {items.length > 2 ? (
        <span className="group relative">
          <span className="cursor-pointer whitespace-nowrap rounded-md border border-teal-100 bg-teal-50/60 px-1.5 py-0.5 text-[11px] text-teal-600 hover:bg-teal-100">
            ещё {items.length - 2}
          </span>
          <span className="invisible absolute left-1/2 top-full z-30 mt-1.5 w-52 -translate-x-1/2 rounded-xl border border-slate-200 bg-white opacity-0 shadow-xl shadow-slate-900/10 transition-all duration-150 group-hover:visible group-hover:opacity-100">
            <span className="block border-b border-slate-100 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Тип цены · {items.length}
            </span>
            {items.map((p) => (
              <span
                key={p}
                className="block border-b border-slate-50 px-3 py-2 text-left text-xs text-slate-700 last:border-0"
              >
                {p}
              </span>
            ))}
          </span>
        </span>
      ) : null}
    </span>
  );
}

/** Shablon: modal tugmalari (teal / qizil / outline). */
export const agentModalBtnCancel =
  "rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

export const agentModalBtnPrimary =
  "rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm shadow-teal-600/20 transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50";

export const agentModalBtnDanger =
  "rounded-lg bg-red-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50";

export const agentModalBtnSaveGradient =
  "rounded-lg bg-gradient-to-r from-teal-600 to-teal-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-600/25 transition hover:from-teal-700 hover:to-teal-600 disabled:cursor-not-allowed disabled:opacity-50";

export function AgentTemplateModalHeader({
  title,
  subtitle
}: {
  title: string;
  subtitle?: React.ReactNode;
}) {
  return (
    <div className="border-b border-slate-100 px-6 py-4">
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      {subtitle ? <div className="mt-1 text-sm text-slate-500">{subtitle}</div> : null}
    </div>
  );
}

export function AgentTemplateModalFooter({
  children,
  className,
  align = "end"
}: {
  children: React.ReactNode;
  className?: string;
  align?: "end" | "between";
}) {
  return (
    <div
      className={cn(
        "flex flex-row items-center gap-3 border-t border-slate-100 bg-white px-6 py-4",
        align === "between" ? "justify-between" : "justify-end",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Shablon: tasdiqlash modali (qizil «Да»). */
export function AgentTemplateConfirmDialog({
  open,
  message,
  cancelLabel = "Отмена",
  confirmLabel = "Да",
  destructive = true,
  busy = false,
  onCancel,
  onConfirm
}: {
  open: boolean;
  message: string;
  cancelLabel?: string;
  confirmLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <p className="mb-5 text-center text-base font-semibold text-slate-800">{message}</p>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className={cn("flex-1", agentModalBtnCancel)}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={cn("flex-1", destructive ? agentModalBtnDanger : agentModalBtnPrimary)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Shablon: agents-management Modal shell (ochilish/yopilish, fon, ✕). */
export function AgentTemplateModal({
  title,
  onClose,
  children,
  width = "max-w-lg"
}: {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn("w-full rounded-xl bg-white shadow-2xl", width)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-800">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export const agentModalBtnCancelTemplate =
  "rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

/** Shablon: cheklash paneli sarlavhasi (Тип цены / Продукт). */
export function AgentRestrictionsPanelShell({
  icon,
  title,
  countLabel,
  onToggleAll,
  allSelected,
  search,
  onSearchChange,
  searchPlaceholder = "Поиск...",
  children
}: {
  icon: string;
  title: string;
  countLabel: string;
  onToggleAll: () => void;
  allSelected: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
          <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-700">
            {countLabel}
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleAll}
          className="text-[11px] font-medium text-teal-600 hover:text-teal-800 hover:underline"
        >
          {allSelected ? "Снять все" : "Выбрать все"}
        </button>
      </div>
      <div className="shrink-0 border-b border-slate-100 p-2">
        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            🔍
          </span>
          <input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-1.5 pl-8 pr-2.5 text-sm outline-none transition focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-500/15"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1.5">{children}</div>
    </div>
  );
}
