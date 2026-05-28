"use client";

import { OrdersListSingleMultiFilter } from "@/components/orders/orders-list/orders-list-single-multi-filter";
import {
  ORDERS_FILTER_GRID_CLASS,
  ordersFilterRowSelect
} from "@/components/orders/orders-list/orders-list-filter-ui";
import { useRefusalsFilterCascade } from "@/components/refusals/use-refusals-filter-cascade";
import type { useRefusalsReferenceData } from "@/components/refusals/use-refusals-reference-data";
import { Card, CardContent } from "@/components/ui/card";
import type { RefusalFiltersState } from "@/lib/refusals-types";
import { staffDashboardMultiItem } from "@/lib/order-picker-labels";
import type { RefSelectOption } from "@/lib/ref-select-options";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useMemo, type Dispatch, type SetStateAction } from "react";

function territoryItems(opts: RefSelectOption[]) {
  return opts.map((o) => ({
    id: o.value,
    title: o.label,
    searchText: [o.value, o.label].filter(Boolean).join(" ")
  }));
}

type RefData = ReturnType<typeof useRefusalsReferenceData>;

export function RefusalsFilters({
  filters,
  setFilters,
  onApply,
  onReset,
  refData
}: {
  filters: RefusalFiltersState;
  setFilters: Dispatch<SetStateAction<RefusalFiltersState>>;
  onApply: () => void;
  onReset: () => void;
  refData: RefData;
}) {
  const {
    agentsQ,
    clientCategoryFilterOpts,
    refusalReasonFilterOpts,
    buildTerritoryCascade,
    isLoading,
    isError
  } = refData;

  const { territoryCascade, patchTerritoryZone, patchTerritoryRegion } = useRefusalsFilterCascade({
    filters,
    setFilters,
    buildTerritoryCascade
  });

  const zoneItems = useMemo(() => territoryItems(territoryCascade.zones), [territoryCascade.zones]);
  const regionItems = useMemo(
    () => territoryItems(territoryCascade.regions),
    [territoryCascade.regions]
  );
  const cityItems = useMemo(() => territoryItems(territoryCascade.cities), [territoryCascade.cities]);

  const hasActiveFilters =
    filters.agent ||
    filters.reason ||
    filters.clientCategory ||
    filters.zone ||
    filters.region ||
    filters.city;

  const patch = (p: Partial<RefusalFiltersState>) => {
    setFilters((d) => ({ ...d, ...p }));
  };

  return (
    <div className="orders-hub-section orders-hub-section--filters orders-hub-section--stack-tight mx-4 mt-2 border-b-0">
      <Card className="rounded-none border-0 bg-transparent shadow-none hover:shadow-none">
        <CardContent className="space-y-2.5 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-end gap-2 border-b border-border/60 pb-2.5">
            {isError ? (
              <span className="mr-auto text-xs text-destructive">Не удалось загрузить справочники</span>
            ) : isLoading ? (
              <span className="mr-auto text-xs text-muted-foreground">Загрузка фильтров…</span>
            ) : (
              <span className="mr-auto text-xs text-muted-foreground">
                Справочники:{" "}
                <Link href="/settings/reasons/refusal-reasons" className="text-teal-700 underline dark:text-teal-400">
                  причины отказа
                </Link>
                , профиль клиента, территория
              </span>
            )}
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-md border border-input px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
              disabled={!hasActiveFilters}
              onClick={onReset}
            >
              <RotateCcw className="mr-1 size-3.5" aria-hidden />
              Сброс
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground hover:opacity-95"
              onClick={onApply}
            >
              Применить
            </button>
          </div>

          <div className={ORDERS_FILTER_GRID_CLASS}>
            <div className="min-w-0">
              <OrdersListSingleMultiFilter
                placeholder="Агент"
                searchPlaceholder="Агент"
                triggerClassName={ordersFilterRowSelect}
                items={(agentsQ.data ?? []).map((a) =>
                  staffDashboardMultiItem({ id: a.id, fio: a.fio, code: a.code ?? null })
                )}
                value={filters.agent}
                onChange={(v) => patch({ agent: v })}
                disabled={agentsQ.isLoading}
              />
            </div>
            <div className="min-w-0">
              <OrdersListSingleMultiFilter
                placeholder="Причины отказа"
                searchPlaceholder="Причина"
                triggerClassName={ordersFilterRowSelect}
                items={refusalReasonFilterOpts.map((o) => ({ id: o.value, title: o.label }))}
                value={filters.reason}
                onChange={(v) => patch({ reason: v })}
                disabled={refusalReasonFilterOpts.length === 0}
              />
            </div>
            <div className="min-w-0">
              <OrdersListSingleMultiFilter
                placeholder="Категория клиента"
                searchPlaceholder="Категория"
                triggerClassName={ordersFilterRowSelect}
                items={clientCategoryFilterOpts.map((o) => ({ id: o.value, title: o.label }))}
                value={filters.clientCategory}
                onChange={(v) => patch({ clientCategory: v })}
                disabled={clientCategoryFilterOpts.length === 0}
              />
            </div>
            <div className="min-w-0">
              <OrdersListSingleMultiFilter
                placeholder="Зона"
                searchPlaceholder="Зона"
                triggerClassName={ordersFilterRowSelect}
                items={zoneItems}
                value={filters.zone}
                onChange={(v) => patchTerritoryZone(v)}
                disabled={zoneItems.length === 0}
                minPopoverWidth={260}
              />
            </div>
            <div className="min-w-0">
              <OrdersListSingleMultiFilter
                placeholder="Область"
                searchPlaceholder="Область"
                triggerClassName={ordersFilterRowSelect}
                items={regionItems}
                value={filters.region}
                onChange={(v) => patchTerritoryRegion(v)}
                disabled={regionItems.length === 0}
                minPopoverWidth={280}
              />
            </div>
            <div className="min-w-0">
              <OrdersListSingleMultiFilter
                placeholder="Город"
                searchPlaceholder="Город"
                triggerClassName={cn(ordersFilterRowSelect)}
                items={cityItems}
                value={filters.city}
                onChange={(v) => patch({ city: v })}
                disabled={cityItems.length === 0}
                minPopoverWidth={280}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
