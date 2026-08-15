"use client";

import { useDeferredValue, useEffect, useId, useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

import { BonusRuleProductCategoryTree } from "@/components/bonus-rules/bonus-rule-product-category-tree";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatGroupedInteger } from "@/lib/format-numbers";

type Props = {
  tenantSlug: string;
  label?: string;
  selected: Set<number>;
  onSelectedChange: React.Dispatch<React.SetStateAction<Set<number>>>;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  /** Controlled ochilish (accordion: bir vaqtda bitta panel) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/**
 * KPI forma: yopiq holda oddiy select tugmasi; bosilganda pastga ochiladi (portal yo‘q).
 */
export function KpiProductCategoryTreeSelect({
  tenantSlug,
  label = "Продукт",
  selected,
  onSelectedChange,
  searchPlaceholder = "Поиск SKU / название",
  disabled = false,
  className,
  open: openProp,
  onOpenChange
}: Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const listId = useId();
  const productIds = useMemo(() => Array.from(selected).sort((a, b) => a - b), [selected]);

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const triggerSummary =
    selected.size === 0
      ? "Нажмите, чтобы выбрать"
      : `Выбрано: ${formatGroupedInteger(selected.size)}`;

  return (
    <div className={cn("w-full", className)}>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <button
        type="button"
        disabled={disabled}
        className={cn(
          "flex min-h-8 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-background px-2 py-1.5 text-left text-xs shadow-sm outline-none transition-colors",
          "hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          open && "ring-2 ring-ring ring-offset-2",
          disabled && "opacity-60"
        )}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        onClick={() => {
          if (!disabled) setOpen(!open);
        }}
      >
        <span className={cn("min-w-0 flex-1 truncate", selected.size === 0 && "text-muted-foreground")}>
          {triggerSummary}
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open && !disabled ? (
        <div
          id={listId}
          role="listbox"
          aria-multiselectable
          className="mt-1.5 flex max-h-[min(50vh,420px)] flex-col overflow-hidden rounded-lg border border-input bg-background shadow-sm"
        >
          <div className="relative shrink-0 border-b border-border/60 px-3 py-2">
            <Search
              className="pointer-events-none absolute left-5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              className="h-9 border-input bg-background pl-9 text-sm shadow-none"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
              aria-label={searchPlaceholder}
              autoFocus
            />
          </div>

          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-muted/15 px-3 py-2">
            <p className="text-[10px] text-muted-foreground">
              Kategoriya yoki alohida mahsulotni belgilang
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              disabled={selected.size === 0}
              onClick={() => onSelectedChange(new Set())}
            >
              Снять выбор
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-2 py-2">
            <BonusRuleProductCategoryTree
              tenantSlug={tenantSlug}
              value={productIds}
              onChange={(ids) => onSelectedChange(new Set(ids))}
              search={deferredSearch}
              querySuffix="kpi-pick"
              categoryCheckSelectsProducts
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
