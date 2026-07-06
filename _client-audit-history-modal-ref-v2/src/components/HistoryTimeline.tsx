import { useState, type ReactNode } from "react";
import { ACTION_META, formatDate, type HistoryEntry } from "../data/clientHistory";

function ActionIcon({ name, className }: { name: string; className?: string }) {
  const paths: Record<string, ReactNode> = {
    plus: <path d="M12 5v14M5 12h14" />,
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-1a8 8 0 0 1 16 0v1" />
      </>
    ),
    truck: (
      <>
        <path d="M1 3h15v13H1z" />
        <path d="M16 8h4l3 3v5h-7V8z" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </>
    ),
    map: (
      <>
        <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </>
    ),
    toggle: (
      <>
        <rect x="1" y="5" width="22" height="14" rx="7" />
        <circle cx="16" cy="12" r="3" />
      </>
    ),
  };
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name] ?? paths.plus}
    </svg>
  );
}

function ChangeRow({
  label,
  oldValue,
  newValue,
}: {
  label: string;
  oldValue: string | null;
  newValue: string | null;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-slate-50 px-3 py-2 text-xs sm:flex-row sm:items-center sm:gap-2">
      <span className="min-w-[150px] shrink-0 font-medium text-slate-500">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {oldValue ? (
          <span className="rounded-md bg-rose-50 px-2 py-0.5 text-rose-600 line-through decoration-rose-300">
            {oldValue}
          </span>
        ) : (
          <span className="rounded-md bg-slate-100 px-2 py-0.5 italic text-slate-400">bo'sh</span>
        )}
        <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
        {newValue ? (
          <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">{newValue}</span>
        ) : (
          <span className="rounded-md bg-slate-100 px-2 py-0.5 italic text-slate-400">bo'sh</span>
        )}
      </div>
    </div>
  );
}

function TimelineItem({ entry, isLast }: { entry: HistoryEntry; isLast: boolean }) {
  const [open, setOpen] = useState(false);
  const meta = ACTION_META[entry.action];
  const hasChanges = entry.changes.length > 0;

  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {/* connector line */}
      {!isLast && (
        <span className="absolute left-[17px] top-10 h-[calc(100%-32px)] w-px bg-slate-200" aria-hidden />
      )}

      {/* icon dot */}
      <div
        className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${meta.bg} ${meta.color}`}
      >
        <ActionIcon name={meta.icon} className="h-4 w-4" />
      </div>

      {/* card */}
      <div className="min-w-0 flex-1">
        <button
          onClick={() => hasChanges && setOpen((v) => !v)}
          className={`w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition ${
            hasChanges ? "hover:border-slate-300 hover:shadow" : "cursor-default"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="text-xs font-medium tabular-nums text-slate-400">{formatDate(entry.date)}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${meta.bg} ${meta.color} ${meta.ring}`}
            >
              {meta.label}
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
            {hasChanges && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-teal-600">
                {entry.changes.length} ta o'zgarish
                <svg
                  className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            )}
          </div>
        </button>

        {open && hasChanges && (
          <div className="mt-2 space-y-1.5 rounded-xl border border-slate-100 bg-white p-2 shadow-sm">
            {entry.changes.map((c) => (
              <ChangeRow key={c.field} label={c.fieldLabel} oldValue={c.oldValue} newValue={c.newValue} />
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

export default function HistoryTimeline({ history }: { history: HistoryEntry[] }) {
  return (
    <ol>
      {history.map((entry, i) => (
        <TimelineItem key={entry.id} entry={entry} isLast={i === history.length - 1} />
      ))}
    </ol>
  );
}
