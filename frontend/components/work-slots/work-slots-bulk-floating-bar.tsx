"use client";

import {
  Ban,
  Check,
  LayoutGrid,
  Pencil,
  Shield,
  Smartphone,
  Tags,
  Truck,
  UserRoundX,
  Users,
  Warehouse,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SlotWorkplaceConfigTabId } from "./work-slots-utils";

export type WorkSlotsBulkFloatingBarProps = {
  count: number;
  isActiveTab: boolean;
  busy: boolean;
  onToggleActive: () => void;
  onBulkEdit: () => void;
  onUnassign: () => void;
  onClearSelection: () => void;
  /** ≥2 tanlanganda — rolga mos konfiguratsiya (slotWorkplaceConfigTabs) */
  configActions?: SlotWorkplaceConfigTabId[];
  onOpenConfig?: (section: SlotWorkplaceConfigTabId) => void;
};

const CONFIG_META: Record<
  SlotWorkplaceConfigTabId,
  { title: string; className: string; Icon: typeof LayoutGrid }
> = {
  main: {
    title: "Основное — для выбранных",
    className: "text-violet-600 hover:bg-violet-50",
    Icon: LayoutGrid
  },
  prices: {
    title: "Типы цен — для выбранных",
    className: "text-amber-600 hover:bg-amber-50",
    Icon: Tags
  },
  limits: {
    title: "Ограничения — для выбранных",
    className: "text-slate-600 hover:bg-slate-100",
    Icon: Shield
  },
  mobile: {
    title: "Мобильные настройки — для выбранных",
    className: "text-teal-600 hover:bg-teal-50",
    Icon: Smartphone
  },
  expeditor: {
    title: "Правила экспедитора — для выбранных",
    className: "text-sky-600 hover:bg-sky-50",
    Icon: Truck
  },
  skladchik: {
    title: "Права складчика — для выбранных",
    className: "text-orange-600 hover:bg-orange-50",
    Icon: Warehouse
  },
  team: {
    title: "Команда — для выбранных",
    className: "text-indigo-600 hover:bg-indigo-50",
    Icon: Users
  }
};

/** Guruhli amallar: 2+ tanlovda rolga mos konfiguratsiya ikonlari. */
export function WorkSlotsBulkFloatingBar({
  count,
  isActiveTab,
  busy,
  onToggleActive,
  onBulkEdit,
  onUnassign,
  onClearSelection,
  configActions = [],
  onOpenConfig
}: WorkSlotsBulkFloatingBarProps) {
  if (count <= 0) return null;

  const showConfigIcons = count >= 2 && configActions.length > 0 && onOpenConfig;
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

        {showConfigIcons ? (
          <>
            <span className="mx-1 h-6 w-px bg-slate-200" />
            {configActions.map((id) => {
              const meta = CONFIG_META[id];
              const Icon = meta.Icon;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onOpenConfig(id)}
                  disabled={busy}
                  title={meta.title}
                  className={cn(iconBtn, meta.className)}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
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
