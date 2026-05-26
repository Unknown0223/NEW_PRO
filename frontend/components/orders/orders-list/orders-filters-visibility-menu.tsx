"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Settings } from "lucide-react";
import {
  DEFAULT_ORDERS_FILTER_VISIBILITY,
  FILTER_VISIBILITY_GROUPS,
  FILTER_VISIBILITY_ITEMS,
  type OrdersFilterVisibility
} from "./types";

const labelByKey = Object.fromEntries(
  FILTER_VISIBILITY_ITEMS.map((i) => [i.key, i.label])
) as Record<keyof OrdersFilterVisibility, string>;

export type OrdersFiltersVisibilityMenuProps = {
  filterVisibilityOpen: boolean;
  setFilterVisibilityOpen: React.Dispatch<React.SetStateAction<boolean>>;
  filterVisibility: OrdersFilterVisibility;
  setFilterVisibility: React.Dispatch<React.SetStateAction<OrdersFilterVisibility>>;
};

export function OrdersFiltersVisibilityMenu({
  filterVisibilityOpen,
  setFilterVisibilityOpen,
  filterVisibility,
  setFilterVisibility
}: OrdersFiltersVisibilityMenuProps) {
  const hideAll = () =>
    setFilterVisibility(
      Object.fromEntries(Object.keys(filterVisibility).map((k) => [k, false])) as OrdersFilterVisibility
    );

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-9 shrink-0 rounded-lg shadow-sm"
        title="Настройка полей фильтра"
        aria-label="Настройка полей фильтра"
        onClick={() => setFilterVisibilityOpen(true)}
      >
        <Settings className="size-4" aria-hidden />
      </Button>

      <Dialog open={filterVisibilityOpen} onOpenChange={setFilterVisibilityOpen}>
        <DialogContent className="flex max-h-[min(88vh,640px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 gap-3 border-b border-border px-5 py-4 pr-12">
            <div className="space-y-1">
              <DialogTitle>Поля фильтра</DialogTitle>
              <DialogDescription className="text-xs">
                Отметьте поля, которые нужно показывать в панели фильтров
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 min-w-[5.25rem] flex-1 px-3 text-xs sm:flex-none"
                onClick={() => setFilterVisibility(DEFAULT_ORDERS_FILTER_VISIBILITY)}
              >
                Все
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 min-w-[5.25rem] flex-1 px-3 text-xs sm:flex-none"
                onClick={hideAll}
              >
                Скрыть
              </Button>
            </div>
          </DialogHeader>

          <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
            <div className="space-y-3">
              {FILTER_VISIBILITY_GROUPS.map((group) => (
                <section
                  key={group.title}
                  className="overflow-hidden rounded-lg border border-border/80 bg-muted/15 shadow-sm"
                >
                  <h3 className="border-b border-border/60 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.title}
                  </h3>
                  <div className="grid grid-cols-1 gap-px bg-border/40 p-2 sm:grid-cols-2">
                    {group.keys.map((key) => (
                      <label
                        key={key}
                        className={cn(
                          "flex cursor-pointer items-start gap-2.5 rounded-md bg-background px-2.5 py-2 text-sm leading-snug text-foreground",
                          "transition-colors hover:bg-muted/50",
                          filterVisibility[key] && "bg-teal-50/80 ring-1 ring-inset ring-teal-700/15 dark:bg-teal-950/25"
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 shrink-0 rounded border-border accent-teal-700"
                          checked={filterVisibility[key]}
                          onChange={(e) =>
                            setFilterVisibility((prev) => ({ ...prev, [key]: e.target.checked }))
                          }
                        />
                        <span>{labelByKey[key]}</span>
                      </label>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>

          <DialogFooter className="mx-0 mb-0 shrink-0 gap-3 rounded-b-xl border-t border-border bg-muted/25 px-5 py-4 sm:justify-end">
            <Button
              type="button"
              className="h-9 w-full min-w-[8.5rem] shrink-0 px-6 sm:w-auto"
              onClick={() => setFilterVisibilityOpen(false)}
            >
              Готово
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
