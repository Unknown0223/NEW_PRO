"use client";

import { BulkToolbarDropdownPortal } from "@/components/orders/orders-list/bulk-toolbar-dropdown-portal";
import { formatGroupedInteger } from "@/lib/format-numbers";
import { PRODUCT_UNIT_OPTIONS } from "@/lib/product-units";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  Layers,
  Package,
  Power,
  Ruler,
  Shapes,
  Tag,
  Target,
  X
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const toolbarBtn =
  "flex shrink-0 items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-muted disabled:opacity-50 sm:px-3 sm:text-sm dark:border-input dark:bg-background dark:text-foreground dark:hover:bg-muted/50";

type RefOpt = { id: number; name: string };

type Props = {
  selectedCount: number;
  settingsAsidePx?: number;
  categories: RefOpt[];
  groups: RefOpt[];
  brands: RefOpt[];
  segments: RefOpt[];
  kpiGroups: RefOpt[];
  onApply: (patch: Record<string, unknown>) => void;
  onApplyKpiGroup: (kpiGroupId: number | null) => void;
  onClear: () => void;
  busy: boolean;
  feedback?: string | null;
};

function StatusDropdownButton({
  busy,
  onActivate,
  onDeactivate
}: {
  busy: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative shrink-0" ref={anchorRef}>
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        className="flex shrink-0 items-center gap-1 rounded-lg bg-[#22c55e] px-2.5 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-green-600 disabled:opacity-60 sm:px-3 sm:text-sm"
      >
        <Power className="size-3.5 sm:size-4" aria-hidden />
        Статус
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      <BulkToolbarDropdownPortal open={open} anchorRef={anchorRef} onClose={() => setOpen(false)}>
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-emerald-700 hover:bg-muted"
          onClick={() => {
            setOpen(false);
            onActivate();
          }}
        >
          Активировать
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-700 hover:bg-muted"
          onClick={() => {
            setOpen(false);
            onDeactivate();
          }}
        >
          Деактивировать
        </button>
      </BulkToolbarDropdownPortal>
    </div>
  );
}

function RefDropdownButton({
  label,
  icon,
  options,
  busy,
  nullable,
  onPick
}: {
  label: string;
  icon: ReactNode;
  options: RefOpt[];
  busy: boolean;
  nullable?: boolean;
  onPick: (value: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative shrink-0" ref={anchorRef}>
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        className={toolbarBtn}
      >
        {icon}
        {label}
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      <BulkToolbarDropdownPortal
        open={open}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        minWidth={220}
      >
        {nullable ? (
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
            onClick={() => {
              setOpen(false);
              onPick(null);
            }}
          >
            Очистить
          </button>
        ) : null}
        {nullable && options.length ? <div className="my-1 border-t border-border" /> : null}
        {options.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">Список пуст</p>
        ) : (
          options.map((o) => (
            <button
              key={o.id}
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => {
                setOpen(false);
                onPick(o.id);
              }}
            >
              {o.name}
            </button>
          ))
        )}
      </BulkToolbarDropdownPortal>
    </div>
  );
}

function UnitDropdownButton({
  busy,
  onPick
}: {
  busy: boolean;
  onPick: (unit: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative shrink-0" ref={anchorRef}>
      <button type="button" disabled={busy} onClick={() => setOpen((v) => !v)} className={toolbarBtn}>
        <Ruler className="size-3.5 shrink-0 text-gray-500 sm:size-4" aria-hidden />
        Ед. изм.
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      <BulkToolbarDropdownPortal open={open} anchorRef={anchorRef} onClose={() => setOpen(false)} minWidth={200}>
        {PRODUCT_UNIT_OPTIONS.filter((o) => o.value !== "__custom__").map((o) => (
          <button
            key={o.value}
            type="button"
            className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={() => {
              setOpen(false);
              onPick(o.value);
            }}
          >
            {o.label}
          </button>
        ))}
      </BulkToolbarDropdownPortal>
    </div>
  );
}

/** Pastki panel — zayavka / bonus qoidalari shablonida (faqat ro‘yxatdan tanlash) */
export function ProductsItemsBulkToolbar({
  selectedCount,
  settingsAsidePx = 0,
  categories,
  groups,
  brands,
  segments,
  kpiGroups,
  onApply,
  onApplyKpiGroup,
  onClear,
  busy,
  feedback
}: Props) {
  if (selectedCount <= 0) return null;

  const bar = (
    <div className="animate-expand inline-flex max-w-full flex-nowrap items-center gap-1.5 overflow-x-auto overflow-y-visible rounded-xl border border-border bg-card px-2.5 py-2 shadow-2xl scrollbar-thin sm:gap-2 sm:px-3 dark:border-border dark:bg-card">
      <div className="shrink-0 border-r border-border px-2 py-1 text-xs font-medium text-gray-700 sm:px-3 sm:text-sm dark:border-border dark:text-foreground">
        Выбрано:{" "}
        <span className="font-bold text-teal-700 tabular-nums dark:text-teal-400">
          {formatGroupedInteger(selectedCount)}
        </span>
      </div>

      <StatusDropdownButton
        busy={busy}
        onActivate={() => onApply({ is_active: true })}
        onDeactivate={() => onApply({ is_active: false })}
      />

      <UnitDropdownButton busy={busy} onPick={(unit) => onApply({ unit })} />

      <RefDropdownButton
        label="Категория"
        icon={<Package className="size-3.5 shrink-0 text-gray-500 sm:size-4" aria-hidden />}
        options={categories}
        busy={busy}
        onPick={(id) => onApply({ category_id: id })}
      />

      <RefDropdownButton
        label="Группа"
        icon={<Layers className="size-3.5 shrink-0 text-gray-500 sm:size-4" aria-hidden />}
        options={groups}
        busy={busy}
        nullable
        onPick={(id) => onApply({ product_group_id: id })}
      />

      <RefDropdownButton
        label="Бренд"
        icon={<Tag className="size-3.5 shrink-0 text-gray-500 sm:size-4" aria-hidden />}
        options={brands}
        busy={busy}
        nullable
        onPick={(id) => onApply({ brand_id: id })}
      />

      <RefDropdownButton
        label="Сегмент"
        icon={<Shapes className="size-3.5 shrink-0 text-gray-500 sm:size-4" aria-hidden />}
        options={segments}
        busy={busy}
        nullable
        onPick={(id) => onApply({ segment_id: id })}
      />

      <RefDropdownButton
        label="Группа KPI"
        icon={<Target className="size-3.5 shrink-0 text-gray-500 sm:size-4" aria-hidden />}
        options={kpiGroups}
        busy={busy}
        nullable
        onPick={(id) => onApplyKpiGroup(id)}
      />

      <button
        type="button"
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-muted hover:text-gray-700 sm:size-9 dark:hover:bg-muted"
        title="Закрыть"
        onClick={onClear}
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );

  const floatingBar = (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex justify-center px-2 sm:bottom-5 sm:px-3 md:pl-[var(--settings-aside-offset,0px)] md:pr-3"
      style={{ ["--settings-aside-offset" as string]: `${settingsAsidePx}px` }}
    >
      <div className="pointer-events-auto flex w-full max-w-[min(calc(100vw-1.5rem-var(--settings-aside-offset,0px)),90rem)] flex-col items-center gap-2">
        {feedback ? (
          <p className="rounded-lg border border-border bg-card px-3 py-1.5 text-center text-xs text-muted-foreground shadow-lg">
            {feedback}
          </p>
        ) : null}
        {bar}
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(floatingBar, document.body) : null;
}
