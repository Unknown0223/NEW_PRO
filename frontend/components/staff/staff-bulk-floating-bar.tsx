"use client";

import { cn } from "@/lib/utils";

export type StaffBulkFloatingBarProps = {
  count: number;
  allAccessOn: boolean;
  isActiveTab: boolean;
  busy: boolean;
  onToggleAccess: () => void;
  onToggleActive: () => void;
  onClearSessions: () => void;
  onClearSelection: () => void;
  /** Agent bo‘limi: ommaviy cheklovlar */
  onRestrictions?: () => void;
  /** Agent bo‘limi: mobil konfiguratsiya (shu jumladan kechiktirilgan sinxron) */
  onConfigurations?: () => void;
  /** Agent bo‘limi: umumiy maydonlarni tahrirlash */
  onBulkEdit?: () => void;
  clearSessionsLabel?: string;
};

/** Agent shablonidagi pastki suzuvchi guruhli amallar paneli — barcha KOMANDA rollari uchun. */
export function StaffBulkFloatingBar({
  count,
  allAccessOn,
  isActiveTab,
  busy,
  onToggleAccess,
  onToggleActive,
  onClearSessions,
  onClearSelection,
  onRestrictions,
  onConfigurations,
  onBulkEdit,
  clearSessionsLabel = "Очистить сессии"
}: StaffBulkFloatingBarProps) {
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
          onClick={onToggleAccess}
          disabled={busy}
          title={
            allAccessOn
              ? "Выключить доступ к приложению у всех выбранных"
              : "Включить доступ к приложению у всех выбранных"
          }
          className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          Доступ
          <span
            className={cn(
              "relative inline-block h-5 w-9 rounded-full transition-colors",
              allAccessOn ? "bg-teal-500" : "bg-slate-300"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
                allAccessOn ? "left-[18px]" : "left-0.5"
              )}
            />
          </span>
        </button>

        {onRestrictions || onConfigurations || onBulkEdit ? (
          <>
            <span className="mx-1 h-6 w-px bg-slate-200" />

            {onRestrictions ? (
              <button
                type="button"
                onClick={onRestrictions}
                disabled={busy}
                title="Ограничения для всех выбранных"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                ⚙
              </button>
            ) : null}

            {onConfigurations ? (
              <button
                type="button"
                onClick={onConfigurations}
                disabled={busy}
                title="Конфигурация приложения (синхронизация, задержка заказа…)"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-teal-600 hover:bg-teal-50 disabled:opacity-50"
              >
                📱
              </button>
            ) : null}

            {onBulkEdit ? (
              <button
                type="button"
                onClick={onBulkEdit}
                disabled={busy}
                title="Редактировать общие поля всех выбранных"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-amber-500 hover:bg-amber-50 disabled:opacity-50"
              >
                ✏
              </button>
            ) : null}
          </>
        ) : null}

        <button
          type="button"
          onClick={onToggleActive}
          disabled={busy}
          title={isActiveTab ? "Деактивировать всех выбранных" : "Активировать всех выбранных"}
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
          onClick={onClearSessions}
          disabled={busy}
          title="Завершить все активные сессии у выбранных"
          className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
        >
          🧹 {clearSessionsLabel}
        </button>

        <span className="mx-1 h-6 w-px bg-slate-200" />

        <button
          type="button"
          onClick={onClearSelection}
          title="Снять выделение"
          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
