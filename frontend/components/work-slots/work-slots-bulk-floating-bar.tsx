"use client";

import {
  Ban,
  Check,
  LayoutGrid,
  Pencil,
  Shield,
  Smartphone,
  Tags,
  UserRoundX,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

export type WorkSlotsBulkFloatingBarProps = {
  count: number;
  isActiveTab: boolean;
  busy: boolean;
  onToggleActive: () => void;
  onBulkEdit: () => void;
  onUnassign: () => void;
  onClearSelection: () => void;
  /** ≥2 tanlanganda — alohida konfiguratsiya ikonlari */
  onMain?: () => void;
  onPrices?: () => void;
  onRestrictions?: () => void;
  onMobileConfig?: () => void;
};

/** Guruhli amallar: 2+ tanlovda konfiguratsiya ikonlari ko‘rinadi. */
export function WorkSlotsBulkFloatingBar({
  count,
  isActiveTab,
  busy,
  onToggleActive,
  onBulkEdit,
  onUnassign,
  onClearSelection,
  onMain,
  onPrices,
  onRestrictions,
  onMobileConfig
}: WorkSlotsBulkFloatingBarProps) {
  if (count <= 0) return null;

  const showConfigIcons = count >= 2;
  const iconBtn =
    "flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 disabled:opacity-50";

  return (
    <div className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-full border border-teal-200/70 bg-white/95 py-2 pl-5 pr-3 shadow-[0_8px_30px_rgba(13,148,136,0.25)] backdrop-blur">
        <span className="mr-1 flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-slate-700">
          Выбрано
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-teal-600 px-1.5 text-xs font-bold text-white">
            {count}
          </span>
        </span>

        {showConfigIcons && (onMain || onPrices || onRestrictions || onMobileConfig) ? (
          <>
            <span className="mx-1 h-6 w-px bg-slate-200" />
            {onMain ? (
              <button
                type="button"
                onClick={onMain}
                disabled={busy}
                title="Основное — для выбранных"
                className={cn(iconBtn, "text-violet-600 hover:bg-violet-50")}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            ) : null}
            {onPrices ? (
              <button
                type="button"
                onClick={onPrices}
                disabled={busy}
                title="Типы цен — для выбранных"
                className={cn(iconBtn, "text-amber-600 hover:bg-amber-50")}
              >
                <Tags className="h-4 w-4" />
              </button>
            ) : null}
            {onRestrictions ? (
              <button
                type="button"
                onClick={onRestrictions}
                disabled={busy}
                title="Ограничения — для выбранных"
                className={cn(iconBtn, "text-slate-600 hover:bg-slate-100")}
              >
                <Shield className="h-4 w-4" />
              </button>
            ) : null}
            {onMobileConfig ? (
              <button
                type="button"
                onClick={onMobileConfig}
                disabled={busy}
                title="Мобильные настройки — для выбранных (полный экран)"
                className={cn(iconBtn, "text-teal-600 hover:bg-teal-50")}
              >
                <Smartphone className="h-4 w-4" />
              </button>
            ) : null}
          </>
        ) : null}

        <span className="mx-1 h-6 w-px bg-slate-200" />

        <button
          type="button"
          onClick={onBulkEdit}
          disabled={busy}
          title="Групповая обработка — филиал, склад, территория…"
          className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
        >
          <Pencil className="h-3.5 w-3.5" />
          Групповая обработка
        </button>

        <button
          type="button"
          onClick={onUnassign}
          disabled={busy}
          title="Снять сотрудника с выбранных мест"
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          <UserRoundX className="h-3.5 w-3.5" />
          Снять
        </button>

        <button
          type="button"
          onClick={onToggleActive}
          disabled={busy}
          title={isActiveTab ? "Деактивировать выбранные места" : "Активировать выбранные места"}
          className={cn(
            iconBtn,
            isActiveTab ? "text-red-500 hover:bg-red-50" : "text-emerald-600 hover:bg-emerald-50"
          )}
        >
          {isActiveTab ? <Ban className="h-4 w-4" /> : <Check className="h-4 w-4" />}
        </button>

        <span className="mx-1 h-6 w-px bg-slate-200" />

        <button
          type="button"
          onClick={onClearSelection}
          disabled={busy}
          title="Снять выделение"
          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
