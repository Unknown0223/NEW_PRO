import { useEffect, useMemo, useState } from "react";
import {
  clientHistoryData,
  formatDate,
  type AuditAction,
} from "../data/clientHistory";
import HistoryTimeline from "./HistoryTimeline";

const FILTERS: { value: "ALL" | AuditAction; label: string }[] = [
  { value: "ALL", label: "Hammasi" },
  { value: "CREATE_CLIENT", label: "Yaratish" },
  { value: "UPDATE_TEAM", label: "Komanda" },
  { value: "UPDATE_AGENT", label: "Agent" },
  { value: "UPDATE_EXPEDITOR", label: "Ekspeditor" },
];

export default function ClientHistoryModal({ onClose }: { onClose: () => void }) {
  const data = clientHistoryData;
  const [filter, setFilter] = useState<"ALL" | AuditAction>("ALL");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const filtered = useMemo(
    () => (filter === "ALL" ? data.history : data.history.filter((h) => h.action === filter)),
    [filter, data.history]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Klient tarixi — ${data.clientName}`}
      >
        {/* ── Modal Header ─────────────────────────── */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 3" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Klient tarixi — {data.clientName}
              </h2>
              <p className="text-xs text-slate-400">
                Audit log · {data.history.length} ta yozuv
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Yopish"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Client Summary Card ──────────────────── */}
        <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Nomi</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">{data.clientName}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Hudud</p>
              <p className="mt-0.5 flex items-center gap-1 text-sm font-medium text-slate-700">
                <svg className="h-3.5 w-3.5 text-teal-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {data.territory}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Status</p>
              <span className="mt-0.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Aktiv
              </span>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Yaratilgan</p>
              <p className="mt-0.5 text-sm font-medium text-slate-700">
                {data.createdBy}
                <span className="block text-[11px] font-normal text-slate-400">
                  {formatDate(data.createdAt)}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* ── Filter chips ─────────────────────────── */}
        <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-100 px-6 py-3">
          <span className="shrink-0 text-xs font-medium text-slate-400">Filtr:</span>
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === f.value
                  ? "bg-teal-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* ── History Timeline ─────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Tarix
          </h3>
          {filtered.length > 0 ? (
            <HistoryTimeline history={filtered} />
          ) : (
            <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
              <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <p className="text-sm">Bu turdagi yozuvlar topilmadi</p>
            </div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-6 py-4">
          <p className="text-xs text-slate-400">
            Oxirgi o'zgarish: {formatDate(data.history[data.history.length - 1].date)}
          </p>
          <button
            onClick={onClose}
            className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700 active:scale-[0.98]"
          >
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
}
