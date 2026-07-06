"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, MapPin, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CLIENT_HISTORY_FILTERS,
  filterClientHistory,
  formatClientAuditDate,
  type ClientAuditHistoryViewModel,
  type ClientHistoryFilter
} from "@/lib/client-audit-history";
import { ClientHistoryTimeline } from "@/components/clients/client-history-timeline";

type Props = {
  open: boolean;
  onClose: () => void;
  model: ClientAuditHistoryViewModel;
};

export function ClientHistoryModal({ open, onClose, model }: Props) {
  const [filter, setFilter] = useState<ClientHistoryFilter>("ALL");

  useEffect(() => {
    if (!open) {
      setFilter("ALL");
      return;
    }
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const filtered = useMemo(
    () => filterClientHistory(model.history, filter),
    [filter, model.history]
  );

  const lastChange = model.history[0];

  if (!open) return null;

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
        aria-label={`История клиента — ${model.clientName}`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                История клиента — {model.clientName}
              </h2>
              <p className="text-xs text-slate-400">
                Журнал аудита · {model.history.length} записей
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Название</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">{model.clientName}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Территория</p>
              <p className="mt-0.5 flex items-center gap-1 text-sm font-medium text-slate-700">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-teal-500" />
                <span className="line-clamp-2">{model.territory}</span>
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Статус</p>
              <span
                className={cn(
                  "mt-0.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1",
                  model.status === "ACTIVE"
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : "bg-slate-100 text-slate-600 ring-slate-200"
                )}
              >
                {model.status === "ACTIVE" ? (
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                ) : null}
                {model.status === "ACTIVE" ? "Активный" : "Неактивный"}
              </span>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Создан</p>
              <p className="mt-0.5 text-sm font-medium text-slate-700">
                {model.createdBy}
                <span className="block text-[11px] font-normal text-slate-400">
                  {formatClientAuditDate(model.createdAt)}
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-100 px-6 py-3">
          <span className="shrink-0 text-xs font-medium text-slate-400">Фильтр:</span>
          {CLIENT_HISTORY_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition",
                filter === f.value
                  ? "bg-teal-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Хронология</h3>
          {filtered.length > 0 ? (
            <ClientHistoryTimeline history={filtered} />
          ) : (
            <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
              <Clock className="h-10 w-10 opacity-40" />
              <p className="text-sm">Записи по выбранному фильтру не найдены</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-6 py-4">
          <p className="text-xs text-slate-400">
            {lastChange
              ? `Последнее изменение: ${formatClientAuditDate(lastChange.date)}`
              : "Изменений пока нет"}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700 active:scale-[0.98]"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
