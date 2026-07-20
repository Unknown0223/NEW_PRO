"use client";

import { OrdersFiltersGrid } from "@/components/orders/orders-list/orders-filters-grid";
import { OrdersFiltersVisibilityMenu } from "@/components/orders/orders-list/orders-filters-visibility-menu";
import { Can } from "@/components/access/can";
import { NAV_PERM } from "@/components/dashboard/nav-permission-keys";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangePopover, formatDateRangeButton, localYmd } from "@/components/ui/date-range-popover";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { cn } from "@/lib/utils";
import { CalendarDays, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import Link from "next/link";
import { type RefObject } from "react";
import { isOrdersFiltersEmpty, type OrdersUrlFilters } from "./types";
import type { UseOrdersListPageResult } from "./use-orders-list-page";

function parseIsoDate(s: string): Date | null {
  const t = s?.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const [y, m, day] = t.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  if (d.getFullYear() !== y || d.getMonth() !== m - 1 || d.getDate() !== day) return null;
  return d;
}

function shiftDraftDateRange(
  from: string,
  to: string,
  deltaDays: number
): { date_from: string; date_to: string } {
  let a = parseIsoDate(from);
  let b = parseIsoDate(to);
  if (!a || !b) {
    const now = new Date();
    a = new Date(now.getFullYear(), now.getMonth(), now.getDate() + deltaDays);
    b = new Date(a);
  } else {
    a = new Date(a.getFullYear(), a.getMonth(), a.getDate() + deltaDays);
    b = new Date(b.getFullYear(), b.getMonth(), b.getDate() + deltaDays);
  }
  return { date_from: localYmd(a), date_to: localYmd(b) };
}

type OrdersFiltersPanelProps = Pick<
  UseOrdersListPageResult,
  | "tenantSlug"
  | "filters"
  | "filterDraft"
  | "setFilterDraft"
  | "filterVisibility"
  | "setFilterVisibility"
  | "filterVisibilityOpen"
  | "setFilterVisibilityOpen"
  | "canBulkCatalog"
  | "paymentMethodFilterOpts"
  | "paymentTypeFilterOpts"
  | "nakladnoyTypeFilterOpts"
  | "clientCategoryFilterOpts"
  | "tradeDirectionFilterOpts"
  | "priceTypeFilterOpts"
  | "buildTerritoryCascade"
  | "productCategoriesQ"
  | "productsFilterQ"
  | "warehousesQ"
  | "agentsQ"
  | "expeditorsQ"
  | "applyFilterDraft"
  | "resetFilterDraft"
  | "refetch"
  | "ordersDateRangeOpen"
  | "setOrdersDateRangeOpen"
> & {
  ordersTotal?: number;
  ordersTotalLoading?: boolean;
  ordersDateRangeAnchorRef: RefObject<HTMLButtonElement | null>;
};

export function OrdersFiltersPanel(props: OrdersFiltersPanelProps) {
  const {
    tenantSlug,
    filters,
    filterDraft,
    setFilterDraft,
    filterVisibility,
    setFilterVisibility,
    filterVisibilityOpen,
    setFilterVisibilityOpen,
    canBulkCatalog,
    paymentMethodFilterOpts,
    paymentTypeFilterOpts,
    nakladnoyTypeFilterOpts,
    clientCategoryFilterOpts,
    tradeDirectionFilterOpts,
    priceTypeFilterOpts,
    buildTerritoryCascade,
    productCategoriesQ,
    productsFilterQ,
    warehousesQ,
    agentsQ,
    expeditorsQ,
    applyFilterDraft,
    resetFilterDraft,
    ordersTotal,
    ordersTotalLoading,
    ordersDateRangeAnchorRef,
    ordersDateRangeOpen,
    setOrdersDateRangeOpen
  } = props;

  const patchDraft = (patch: Partial<OrdersUrlFilters>) => {
    setFilterDraft((cur) => ({ ...cur, ...patch }));
  };

  const dateRangeLabel =
    filterDraft.date_from && filterDraft.date_to
      ? formatDateRangeButton(filterDraft.date_from, filterDraft.date_to)
      : "Выберите период";

  if (!tenantSlug) return null;

  const filtersEmpty =
    isOrdersFiltersEmpty(filters) && isOrdersFiltersEmpty(filterDraft);

  return (
    <div
      className="orders-hub-section orders-hub-section--filters orders-hub-section--stack-tight"
    >
      <Card className="rounded-lg border border-border bg-card shadow-sm">
        <CardContent className="space-y-2.5 p-3 sm:p-4">
          {/* Шапка: заголовок + дата + действия */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/60 pb-3">
            <div className="flex min-w-0 shrink-0 items-baseline gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Заявки</h1>
              {ordersTotalLoading ? (
                <span className="text-xs text-muted-foreground sm:text-sm">Найдено: …</span>
              ) : ordersTotal != null ? (
                <span className="text-xs text-muted-foreground sm:text-sm">
                  Найдено:{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {formatNumberGrouped(ordersTotal)}
                  </span>
                </span>
              ) : null}
            </div>

            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-x-3 gap-y-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-xs text-muted-foreground whitespace-nowrap sm:text-sm">
                  Дата применяется по
                </span>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-foreground sm:text-sm">
                  <input
                    type="radio"
                    name="orders-filter-date-mode"
                    className="size-3.5 accent-teal-600 sm:size-4"
                    checked={filterDraft.date_mode === "order"}
                    onChange={() => patchDraft({ date_mode: "order" })}
                  />
                  Дата заказа
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-foreground sm:text-sm">
                  <input
                    type="radio"
                    name="orders-filter-date-mode"
                    className="size-3.5 accent-teal-600 sm:size-4"
                    checked={filterDraft.date_mode === "ship"}
                    onChange={() => patchDraft({ date_mode: "ship" })}
                  />
                  Дата отправки
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-foreground sm:text-sm">
                  <input
                    type="radio"
                    name="orders-filter-date-mode"
                    className="size-3.5 accent-teal-600 sm:size-4"
                    checked={filterDraft.date_mode === "created"}
                    onChange={() => patchDraft({ date_mode: "created" })}
                  />
                  Дата создания
                </label>
              </div>

              <div className="flex shrink-0 items-center overflow-hidden rounded-md border border-input bg-background">
                <button
                  type="button"
                  className="grid h-9 w-8 place-items-center border-r border-input hover:bg-muted/50"
                  aria-label="Предыдущий день"
                  onClick={() =>
                    patchDraft(shiftDraftDateRange(filterDraft.date_from, filterDraft.date_to, -1))
                  }
                >
                  <ChevronLeft className="size-4 text-muted-foreground" />
                </button>
                <button
                  ref={ordersDateRangeAnchorRef as React.RefObject<HTMLButtonElement>}
                  type="button"
                  className="flex h-9 min-w-[10.5rem] items-center justify-center gap-1.5 px-2.5 text-xs font-medium tabular-nums text-foreground hover:bg-muted/40 sm:min-w-[12rem] sm:text-sm"
                  onClick={() => setOrdersDateRangeOpen((v) => !v)}
                >
                  <CalendarDays className="size-3.5 shrink-0 text-teal-700" aria-hidden />
                  <span className="truncate">{dateRangeLabel}</span>
                </button>
                <button
                  type="button"
                  className="grid h-9 w-8 place-items-center border-l border-input hover:bg-muted/50"
                  aria-label="Следующий день"
                  onClick={() =>
                    patchDraft(shiftDraftDateRange(filterDraft.date_from, filterDraft.date_to, 1))
                  }
                >
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              </div>

              <OrdersFiltersVisibilityMenu
                filterVisibilityOpen={filterVisibilityOpen}
                setFilterVisibilityOpen={setFilterVisibilityOpen}
                filterVisibility={filterVisibility}
                setFilterVisibility={setFilterVisibility}
              />

              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-md border border-input px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
                disabled={filtersEmpty}
                onClick={() => resetFilterDraft()}
              >
                <RotateCcw className="mr-1 size-3.5" aria-hidden />
                Сброс
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground hover:opacity-95"
                onClick={() => applyFilterDraft()}
              >
                Применить
              </button>

              <Can anyOf={[...NAV_PERM.ordersCreate]}>
                <Link
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "h-9 shrink-0 border-0 bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"
                  )}
                  href="/orders/new"
                >
                  + Создать заказ
                </Link>
              </Can>
            </div>
          </div>

          <div className="border-b border-border pb-4 pt-1">
            <OrdersFiltersGrid
              filterDraft={filterDraft}
              setFilterDraft={setFilterDraft}
              filterVisibility={filterVisibility}
              paymentMethodFilterOpts={paymentMethodFilterOpts}
              paymentTypeFilterOpts={paymentTypeFilterOpts}
              nakladnoyTypeFilterOpts={nakladnoyTypeFilterOpts}
              clientCategoryFilterOpts={clientCategoryFilterOpts}
              tradeDirectionFilterOpts={tradeDirectionFilterOpts}
              priceTypeFilterOpts={priceTypeFilterOpts}
              buildTerritoryCascade={buildTerritoryCascade}
              productCategoriesQ={productCategoriesQ}
              productsFilterQ={productsFilterQ}
              warehousesQ={warehousesQ}
              agentsQ={agentsQ}
              expeditorsQ={expeditorsQ}
              canBulkCatalog={canBulkCatalog}
            />
          </div>
        </CardContent>
      </Card>

      <DateRangePopover
        open={ordersDateRangeOpen}
        onOpenChange={setOrdersDateRangeOpen}
        anchorRef={ordersDateRangeAnchorRef}
        dateFrom={filterDraft.date_from}
        dateTo={filterDraft.date_to}
        autoSave
        onApply={({ dateFrom, dateTo }) => {
          patchDraft({ date_from: dateFrom, date_to: dateTo });
        }}
      />
    </div>
  );
}
