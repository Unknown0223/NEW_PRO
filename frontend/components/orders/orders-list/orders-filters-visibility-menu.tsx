"use client";

import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import {
  DEFAULT_ORDERS_FILTER_VISIBILITY,
  FILTER_VISIBILITY_ITEMS,
  type OrdersFilterVisibility
} from "./types";

export type OrdersFiltersVisibilityMenuProps = {
  filterPanelRef: React.RefObject<HTMLDivElement | null>;
  filterVisibilityOpen: boolean;
  setFilterVisibilityOpen: React.Dispatch<React.SetStateAction<boolean>>;
  filterVisibility: OrdersFilterVisibility;
  setFilterVisibility: React.Dispatch<React.SetStateAction<OrdersFilterVisibility>>;
};

export function OrdersFiltersVisibilityMenu({
  filterPanelRef,
  filterVisibilityOpen,
  setFilterVisibilityOpen,
  filterVisibility,
  setFilterVisibility
}: OrdersFiltersVisibilityMenuProps) {
  return (
    <div ref={filterPanelRef as React.Ref<HTMLDivElement>} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 gap-1"
        onClick={() => setFilterVisibilityOpen((v) => !v)}
      >
        <Settings className="h-4 w-4" />
        Фильтры
      </Button>
      {filterVisibilityOpen ? (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-md border border-border bg-popover p-2 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">Показать поля</span>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={() => setFilterVisibility(DEFAULT_ORDERS_FILTER_VISIBILITY)}
              >
                Все
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={() =>
                  setFilterVisibility((prev) =>
                    Object.fromEntries(Object.keys(prev).map((k) => [k, false])) as OrdersFilterVisibility
                  )
                }
              >
                Скрыть
              </Button>
            </div>
          </div>
          <div className="max-h-72 space-y-1 overflow-y-auto pr-1 text-xs">
            {FILTER_VISIBILITY_ITEMS.map((item) => (
              <label
                key={item.key}
                className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-muted/70"
              >
                <input
                  type="checkbox"
                  className="size-3.5"
                  checked={filterVisibility[item.key]}
                  onChange={(e) =>
                    setFilterVisibility((prev) => ({ ...prev, [item.key]: e.target.checked }))
                  }
                />
                <span className="text-foreground/90">{item.label}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
