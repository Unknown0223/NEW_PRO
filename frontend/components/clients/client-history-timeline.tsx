"use client";

import { useState } from "react";
import {
  ChevronDown,
  MapPin,
  Plus,
  ToggleLeft,
  Truck,
  User,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatClientAuditDate,
  historyEntryBadgeLabel,
  historyEntryBadgeStyle,
  type ClientFieldChange,
  type ClientHistoryEntry
} from "@/lib/client-audit-history";

function ActionIcon({ name, className }: { name: string; className?: string }) {
  const iconClass = cn("h-4 w-4", className);
  switch (name) {
    case "plus":
      return <Plus className={iconClass} />;
    case "users":
      return <Users className={iconClass} />;
    case "user":
      return <User className={iconClass} />;
    case "truck":
      return <Truck className={iconClass} />;
    case "map":
      return <MapPin className={iconClass} />;
    case "toggle":
      return <ToggleLeft className={iconClass} />;
    default:
      return <Plus className={iconClass} />;
  }
}

function ChangeRow({ fieldLabel, oldValue, newValue }: ClientFieldChange) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-slate-50 px-3 py-2 text-xs sm:flex-row sm:items-center sm:gap-2">
      <span className="min-w-[150px] shrink-0 font-medium text-slate-500">{fieldLabel}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {oldValue ? (
          <span className="rounded-md bg-rose-50 px-2 py-0.5 text-rose-600 line-through decoration-rose-300">
            {oldValue}
          </span>
        ) : (
          <span className="rounded-md bg-slate-100 px-2 py-0.5 italic text-slate-400">пусто</span>
        )}
        <svg
          className="h-3.5 w-3.5 shrink-0 text-slate-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
        {newValue ? (
          <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">{newValue}</span>
        ) : (
          <span className="rounded-md bg-slate-100 px-2 py-0.5 italic text-slate-400">пусто</span>
        )}
      </div>
    </div>
  );
}

function TimelineItem({ entry, isLast }: { entry: ClientHistoryEntry; isLast: boolean }) {
  const [open, setOpen] = useState(false);
  const badge = historyEntryBadgeStyle(entry);
  const hasChanges = entry.changes.length > 0;
  const iconName =
    entry.filter === "CREATE"
      ? "plus"
      : entry.filter === "TEAM"
        ? "users"
        : entry.filter === "AGENT"
          ? "user"
          : entry.filter === "EXPEDITOR"
            ? "truck"
            : entry.filter === "TERRITORY"
              ? "map"
              : entry.filter === "STATUS"
                ? "toggle"
                : "plus";

  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {!isLast ? (
        <span
          className="absolute left-[17px] top-10 h-[calc(100%-32px)] w-px bg-slate-200"
          aria-hidden
        />
      ) : null}

      <div
        className={cn(
          "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4 ring-white",
          badge.bg,
          badge.color
        )}
      >
        <ActionIcon name={iconName} />
      </div>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => hasChanges && setOpen((v) => !v)}
          className={cn(
            "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition",
            hasChanges ? "hover:border-slate-300 hover:shadow" : "cursor-default"
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="text-xs font-medium tabular-nums text-slate-400">
              {formatClientAuditDate(entry.date)}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1",
                badge.bg,
                badge.color,
                badge.ring
              )}
            >
              {historyEntryBadgeLabel(entry)}
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-800">{entry.title}</p>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[9px] font-bold uppercase text-slate-500">
                {entry.user.slice(0, 2)}
              </span>
              {entry.user}
            </span>
            {hasChanges ? (
              <span className="flex items-center gap-1 text-[11px] font-medium text-teal-600">
                {entry.changes.length} изм.
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
              </span>
            ) : null}
          </div>
        </button>

        {open && hasChanges ? (
          <div className="mt-2 space-y-1.5 rounded-xl border border-slate-100 bg-white p-2 shadow-sm">
            {entry.changes.map((c) => (
              <ChangeRow key={c.field} {...c} />
            ))}
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function ClientHistoryTimeline({ history }: { history: ClientHistoryEntry[] }) {
  return (
    <ol>
      {history.map((entry, i) => (
        <TimelineItem key={entry.id} entry={entry} isLast={i === history.length - 1} />
      ))}
    </ol>
  );
}
