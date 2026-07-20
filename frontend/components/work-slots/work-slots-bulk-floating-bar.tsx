"use client";

import { cn } from "@/lib/utils";

export type WorkSlotsBulkFloatingBarProps = {
  count: number;
  isActiveTab: boolean;
  busy: boolean;
  onToggleActive: () => void;
  onBulkEdit: () => void;
  onUnassign: () => void;
  onClearSelection: () => void;
};

/** Agent `StaffBulkFloatingBar` uslubida — joylar uchun guruhli amallar. */
export function WorkSlotsBulkFloatingBar({
  count,
  isActiveTab,
  busy,
  onToggleActive,
  onBulkEdit,
  onUnassign,
  onClearSelection
}: WorkSlotsBulkFloatingBarProps) {
  if (count <= 0) return null;

  return (
    <div className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-full border border-teal-200/70 bg-white/95 py-2 pl-5 pr-3 shadow-[0_8px_30px_rgba(13,148,136,0.25)] backdrop-blur">
        <span className="mr-1 flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-slate-700">
          Выбрано
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-teal-600 px-1.5 text-xs font-bold text-white">
            {count}
          </span>
        </span>

        <span className="mx-1 h-6 w-px bg-slate-200" />

        <button
          type="button"
          onClick={onBulkEdit}
          disabled={busy}
          title="Групповая обработка — филиал, склад, территория…"
          className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
        >
          ✏ Групповая обработка
        </button>

        <button
          type="button"
          onClick={onUnassign}
          disabled={busy}
          title="Снять сотрудника с выбранных мест"
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          👤 Снять
        </button>

        <button
          type="button"
          onClick={onToggleActive}
          disabled={busy}
          title={isActiveTab ? "Деактивировать выбранные места" : "Активировать выбранные места"}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 disabled:opacity-50",
            isActiveTab ? "text-red-500 hover:bg-red-50" : "text-emerald-600 hover:bg-emerald-50"
          )}
        >
          {isActiveTab ? "🚫" : "✔"}
        </button>

        <span className="mx-1 h-6 w-px bg-slate-200" />

        <button
          type="button"
          onClick={onClearSelection}
          disabled={busy}
          title="Снять выделение"
          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
