"use client";

import { useMemo } from "react";
import { Filter, Loader2, CalendarDays } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchableMultiSelectPanel } from "@/components/ui/searchable-multi-select-panel";
import { cn } from "@/lib/utils";
import { formatDateRangeButton } from "@/components/ui/date-range-popover";
import type { FilterState, DateMode } from "./wdr-report-builder.utils";
import { defaultFilters, reportBuilderDatasetFailureMessage } from "./wdr-report-builder.utils";

export type WdrFiltersPanelProps = {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  filtersCollapsed: boolean;
  setFiltersCollapsed: (v: boolean | ((p: boolean) => boolean)) => void;
  dateAnchorRef: React.RefObject<HTMLButtonElement | null>;
  dateOpen: boolean;
  setDateOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onResetFilters: () => void;
  dateModeItems: Array<{ id: string; label: string }>;
  periodBtn: string;
  loadData: () => void | Promise<void>;
  datasetMutPending: boolean;
  agentItems: Array<{ id: string; title: string }>;
  productCategoryItems: Array<{ id: string; title: string }>;
  productGroupItems: Array<{ id: string; title: string }>;
  productItems: Array<{ id: string; title: string }>;
  branchItems: Array<{ id: string; title: string }>;
  filtersQ: { data?: {
    statuses?: Array<{ id: string; label: string }>;
    order_types?: Array<{ id: string; label: string }>;
  } };
  warehouseItems: Array<{ id: string; title: string }>;
  expeditorItems: Array<{ id: string; title: string }>;
  brandItems: Array<{ id: string; title: string }>;
  clientCategoryItems: Array<{ id: string; title: string }>;
  priceTypeItems: Array<{ id: string; title: string }>;
  paymentMethodItems: Array<{ id: string; title: string }>;
  supervisorItems: Array<{ id: string; title: string }>;
  tradeDirectionItems: Array<{ id: string; title: string }>;
  kpiGroupItems: Array<{ id: string; title: string }>;
  clientItems: Array<{ id: string; title: string }>;
  territory1Items: Array<{ id: string; title: string }>;
  territory2Items: Array<{ id: string; title: string }>;
  territory3Items: Array<{ id: string; title: string }>;
};

export function WdrReportBuilderFiltersPanel(props: WdrFiltersPanelProps) {
  const {
    filters,
    setFilters,
    filtersCollapsed,
    setFiltersCollapsed,
    dateAnchorRef,
    dateOpen,
    setDateOpen,
    onResetFilters,
    dateModeItems,
    periodBtn,
    loadData,
    datasetMutPending,
    agentItems,
    productCategoryItems,
    productGroupItems,
    productItems,
    branchItems,
    filtersQ,
    warehouseItems,
    expeditorItems,
    brandItems,
    clientCategoryItems,
    priceTypeItems,
    paymentMethodItems,
    supervisorItems,
    tradeDirectionItems,
    kpiGroupItems,
    clientItems,
    territory1Items,
    territory2Items,
    territory3Items
  } = props;

  return (
    <Card>
        <CardHeader className="flex-row items-center justify-between py-3">
          <CardTitle className="text-base">Фильтры</CardTitle>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs"
            onClick={() => setFiltersCollapsed((v) => !v)}
          >
            {filtersCollapsed ? "Развернуть фильтры" : "Свернуть фильтры"}
          </Button>
        </CardHeader>
        {!filtersCollapsed ? <CardContent className="space-y-3 pt-0">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
            <div className="min-w-0 flex-1">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Дата применяется по</span>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {dateModeItems.map((dm) => (
                  <label key={dm.id} className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="radio"
                      name="wdr-rb-date-mode"
                      checked={filters.dateMode === dm.id}
                      onChange={() => setFilters((f) => ({ ...f, dateMode: dm.id as DateMode }))}
                    />
                    {dm.label}
                  </label>
                ))}
              </div>
            </div>
            <button
              ref={dateAnchorRef as React.Ref<HTMLButtonElement>}
              type="button"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "h-9 shrink-0 gap-2 font-normal",
                dateOpen && "border-primary/60 bg-primary/5"
              )}
              onClick={() => setDateOpen((o) => !o)}
            >
              <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Период</span>
              <span className="text-sm font-medium tabular-nums">{periodBtn}</span>
            </button>
            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 w-9 shrink-0 p-0"
                title="Сбросить фильтры"
                onClick={onResetFilters}
              >
                <Filter className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-9 min-w-[8.5rem] gap-1 bg-[#2D948A] text-white hover:bg-[#268a7f]"
                disabled={datasetMutPending}
                onClick={() => {
                  void Promise.resolve(loadData()).catch((err: unknown) => {
                    window.alert(reportBuilderDatasetFailureMessage(err));
                  });
                }}
              >
                {datasetMutPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Применить
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Агент"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Агент"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={agentItems}
                selected={new Set(filters.agentIds.map(String))}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.agentIds.map(String))) : next;
                  setFilters((f) => ({
                    ...f,
                    agentIds: Array.from(s).map((x) => Number.parseInt(String(x), 10)).filter((n) => n > 0)
                  }));
                }}
                searchable
                searchPlaceholder="Агент"
                minPopoverWidth={220}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Категория продукта"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Категория"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={productCategoryItems}
                selected={new Set(filters.categoryIds.map(String))}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.categoryIds.map(String))) : next;
                  setFilters((f) => ({
                    ...f,
                    categoryIds: Array.from(s).map((x) => Number.parseInt(String(x), 10)).filter((n) => n > 0)
                  }));
                }}
                searchable
                searchPlaceholder="Категория"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Группа товаров"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Группа"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={productGroupItems}
                selected={new Set(filters.productGroupIds.map(String))}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.productGroupIds.map(String))) : next;
                  setFilters((f) => ({
                    ...f,
                    productGroupIds: Array.from(s).map((x) => Number.parseInt(String(x), 10)).filter((n) => n > 0)
                  }));
                }}
                searchable
                searchPlaceholder="Группа"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Продукт"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Продукт"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={productItems}
                selected={new Set(filters.productIds.map(String))}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.productIds.map(String))) : next;
                  setFilters((f) => ({
                    ...f,
                    productIds: Array.from(s).map((x) => Number.parseInt(String(x), 10)).filter((n) => n > 0)
                  }));
                }}
                searchable
                searchPlaceholder="Продукт"
                minPopoverWidth={240}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Филиалы"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Филиал"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={branchItems}
                selected={new Set(filters.branchValues)}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.branchValues)) : next;
                  setFilters((f) => ({ ...f, branchValues: Array.from(s) }));
                }}
                searchable
                searchPlaceholder="Филиал"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Статус заказа"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Статус"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={(filtersQ.data?.statuses ?? []).map((s) => ({ id: s.id, title: s.label }))}
                selected={new Set(filters.statuses)}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.statuses)) : next;
                  setFilters((f) => ({ ...f, statuses: Array.from(s) }));
                }}
                searchable
                searchPlaceholder="Статус"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Склад"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Склад"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={warehouseItems}
                selected={new Set(filters.warehouseIds.map(String))}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.warehouseIds.map(String))) : next;
                  setFilters((f) => ({
                    ...f,
                    warehouseIds: Array.from(s).map((x) => Number.parseInt(String(x), 10)).filter((n) => n > 0)
                  }));
                }}
                searchable
                searchPlaceholder="Склад"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>

            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Экспедитор"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Экспедитор"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={expeditorItems}
                selected={new Set(filters.expeditorUserIds.map(String))}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.expeditorUserIds.map(String))) : next;
                  setFilters((f) => ({
                    ...f,
                    expeditorUserIds: Array.from(s).map((x) => Number.parseInt(String(x), 10)).filter((n) => n > 0)
                  }));
                }}
                searchable
                searchPlaceholder="Экспедитор"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Бренд"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Бренд"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={brandItems}
                selected={new Set(filters.brandIds.map(String))}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.brandIds.map(String))) : next;
                  setFilters((f) => ({
                    ...f,
                    brandIds: Array.from(s).map((x) => Number.parseInt(String(x), 10)).filter((n) => n > 0)
                  }));
                }}
                searchable
                searchPlaceholder="Бренд"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Категория клиента"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Категория клиента"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={clientCategoryItems}
                selected={new Set(filters.clientCategoryValues)}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.clientCategoryValues)) : next;
                  setFilters((f) => ({ ...f, clientCategoryValues: Array.from(s) }));
                }}
                searchable
                searchPlaceholder="Категория клиента"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Тип цены"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Тип цены"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={priceTypeItems}
                selected={new Set(filters.priceTypeRefs)}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.priceTypeRefs)) : next;
                  setFilters((f) => ({ ...f, priceTypeRefs: Array.from(s) }));
                }}
                searchable
                searchPlaceholder="Тип цены"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Способ оплаты"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Оплата"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={paymentMethodItems}
                selected={new Set(filters.paymentMethodRefs)}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.paymentMethodRefs)) : next;
                  setFilters((f) => ({ ...f, paymentMethodRefs: Array.from(s) }));
                }}
                searchable
                searchPlaceholder="Оплата"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Тип заказа"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Тип заказа"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={(filtersQ.data?.order_types ?? []).map((s) => ({ id: s.id, title: s.label }))}
                selected={new Set(filters.orderTypes)}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.orderTypes)) : next;
                  setFilters((f) => ({ ...f, orderTypes: Array.from(s) }));
                }}
                searchable
                searchPlaceholder="Тип"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Супервайзер"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Супервайзер"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={supervisorItems}
                selected={new Set(filters.supervisorUserIds.map(String))}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.supervisorUserIds.map(String))) : next;
                  setFilters((f) => ({
                    ...f,
                    supervisorUserIds: Array.from(s).map((x) => Number.parseInt(String(x), 10)).filter((n) => n > 0)
                  }));
                }}
                searchable
                searchPlaceholder="Супервайзер"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>

            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Направление торговли"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Направление"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={tradeDirectionItems}
                selected={new Set(filters.tradeDirectionIds.map(String))}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.tradeDirectionIds.map(String))) : next;
                  setFilters((f) => ({
                    ...f,
                    tradeDirectionIds: Array.from(s).map((x) => Number.parseInt(String(x), 10)).filter((n) => n > 0)
                  }));
                }}
                searchable
                searchPlaceholder="Направление"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Группа KPI"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="KPI"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={kpiGroupItems}
                selected={new Set(filters.kpiGroupIds.map(String))}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.kpiGroupIds.map(String))) : next;
                  setFilters((f) => ({
                    ...f,
                    kpiGroupIds: Array.from(s).map((x) => Number.parseInt(String(x), 10)).filter((n) => n > 0)
                  }));
                }}
                searchable
                searchPlaceholder="KPI"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Клиенты"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Клиент"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={clientItems}
                selected={new Set(filters.clientIds.map(String))}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.clientIds.map(String))) : next;
                  setFilters((f) => ({
                    ...f,
                    clientIds: Array.from(s).map((x) => Number.parseInt(String(x), 10)).filter((n) => n > 0)
                  }));
                }}
                searchable
                searchPlaceholder="Клиент"
                minPopoverWidth={220}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Зона"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Зона"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={territory1Items}
                selected={new Set(filters.territoryLevel1Values)}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.territoryLevel1Values)) : next;
                  // Hierarchy: when zone changes, oblast/gorod selections must reset.
                  setFilters((f) => ({
                    ...f,
                    territoryLevel1Values: Array.from(s),
                    territoryLevel2Values: [],
                    territoryLevel3Values: []
                  }));
                }}
                searchable
                searchPlaceholder="Зона"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Область"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Область"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={territory2Items}
                selected={new Set(filters.territoryLevel2Values)}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.territoryLevel2Values)) : next;
                  // Hierarchy: when oblast changes, gorod selection must reset.
                  setFilters((f) => ({
                    ...f,
                    territoryLevel2Values: Array.from(s),
                    territoryLevel3Values: []
                  }));
                }}
                searchable
                searchPlaceholder="Область"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
            <div className="min-w-0">
              <SearchableMultiSelectPanel
                label="Город"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Город"
                triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                items={territory3Items}
                selected={new Set(filters.territoryLevel3Values)}
                onSelectedChange={(next) => {
                  const s = typeof next === "function" ? next(new Set(filters.territoryLevel3Values)) : next;
                  setFilters((f) => ({ ...f, territoryLevel3Values: Array.from(s) }));
                }}
                searchable
                searchPlaceholder="Город"
                minPopoverWidth={200}
                maxListHeightClass="max-h-36"
                selectAllLabel="Выбрать все"
              />
            </div>
          </div>
        </CardContent> : null}
      </Card>
  );
}
