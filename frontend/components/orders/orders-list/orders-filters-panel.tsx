"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ORDER_STATUS_FILTER_OPTIONS } from "@/lib/order-status";
import { ORDER_TYPE_FILTER_OPTIONS } from "@/lib/order-types";
import {
  DEFAULT_ORDERS_FILTER_VISIBILITY,
  FILTER_VISIBILITY_ITEMS,
  isOrdersFiltersEmpty,
  type OrdersFilterVisibility,
  type OrdersUrlFilters
} from "./types";
import type { UseOrdersListPageResult } from "./use-orders-list-page";

function OrdersFilterStubSelect({ label }: { label: string }) {
  return (
    <label className="orders-filter-field-label min-w-0">
      <span className="truncate">{label}</span>
      <select
        disabled
        className="h-9 w-full cursor-not-allowed rounded-md border border-input bg-muted/30 px-2 text-sm opacity-80"
        title="API — позже"
      >
        <option>—</option>
      </select>
    </label>
  );
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
  | "filterPanelRef"
  | "canBulkCatalog"
  | "paymentMethodFilterOpts"
  | "paymentTypeFilterOpts"
  | "productCategoriesQ"
  | "productsFilterQ"
  | "warehousesQ"
  | "agentsQ"
  | "expeditorsQ"
  | "applyFilterDraft"
  | "resetFilterDraft"
  | "refetch"
>;

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
    filterPanelRef,
    canBulkCatalog,
    paymentMethodFilterOpts,
    paymentTypeFilterOpts,
    productCategoriesQ,
    productsFilterQ,
    warehousesQ,
    agentsQ,
    expeditorsQ,
    applyFilterDraft,
    resetFilterDraft,
    refetch
  } = props;

  const patchDraft = (patch: Partial<OrdersUrlFilters>) => {
    setFilterDraft((cur) => ({ ...cur, ...patch }));
  };

  if (!tenantSlug) return null;

  return (
    <div className="orders-hub-section orders-hub-section--filters orders-hub-section--stack-tight">
      <Card className="rounded-none border-0 bg-transparent shadow-none hover:shadow-none">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <p className="text-[11px] text-foreground/72">
            Интервал дат:{" "}
            {filterDraft.date_mode === "ship" ? (
              <>
                по первому переходу в статус <span className="font-medium text-foreground">«Отгружен»</span>{" "}
                (лог <span className="font-mono">delivering</span>)
              </>
            ) : filterDraft.date_mode === "order" ? (
              <>
                <span className="font-medium text-foreground">дата заказа</span> — как дата создания записи
              </>
            ) : (
              <>
                <span className="font-medium text-foreground">дата создания</span> записи в системе
              </>
            )}
            . «Долг» — только для доставленных продаж (<span className="font-mono">delivered</span>): сумма
            заказа минус распределённые оплаты.
          </p>

          <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-10">
            {filterVisibility.status ? (
              <label className="orders-filter-field-label">
                Статус
                <select
                  data-testid="orders-filter-status"
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                  value={filterDraft.status}
                  onChange={(e) => patchDraft({ status: e.target.value })}
                >
                  <option value="">Все статусы</option>
                  {ORDER_STATUS_FILTER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {filterVisibility.orderType ? (
              <label className="orders-filter-field-label">
                Тип
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                  value={filterDraft.order_type}
                  onChange={(e) => patchDraft({ order_type: e.target.value })}
                >
                  <option value="">Все типы</option>
                  {ORDER_TYPE_FILTER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {filterVisibility.nakladnoyType ? <OrdersFilterStubSelect label="Тип накладной" /> : null}
            {filterVisibility.paymentMethod ? (
              <label className="orders-filter-field-label">
                Способ оплаты (заказ)
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                  value={filterDraft.payment_method_ref}
                  onChange={(e) => patchDraft({ payment_method_ref: e.target.value })}
                  disabled={!canBulkCatalog && paymentMethodFilterOpts.length === 0}
                  title={
                    !canBulkCatalog ? "Каталог способов оплаты доступен оператору/админу" : undefined
                  }
                >
                  <option value="">Все</option>
                  {paymentMethodFilterOpts.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {filterVisibility.paymentLinkedType ? (
              <label className="orders-filter-field-label">
                Тип платежа (по заказу)
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                  value={filterDraft.payment_type}
                  onChange={(e) => patchDraft({ payment_type: e.target.value })}
                  disabled={!canBulkCatalog && paymentTypeFilterOpts.length === 0}
                  title={!canBulkCatalog ? "Список типов платежей доступен оператору/админу" : undefined}
                >
                  <option value="">Все</option>
                  {paymentTypeFilterOpts.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {filterVisibility.priceType ? <OrdersFilterStubSelect label="Тип цены" /> : null}
            {filterVisibility.day ? <OrdersFilterStubSelect label="День" /> : null}
            {filterVisibility.clientCategory ? (
              <OrdersFilterStubSelect label="Категория клиента" />
            ) : null}
            {filterVisibility.clientId ? <OrdersFilterStubSelect label="Клиенты (ID)" /> : null}
            {filterVisibility.productCategory ? (
              <label className="orders-filter-field-label">
                Категория продукта
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                  value={filterDraft.product_category_id}
                  onChange={(e) => patchDraft({ product_category_id: e.target.value })}
                  disabled={!canBulkCatalog || productCategoriesQ.isLoading}
                  title={!canBulkCatalog ? "Список категорий доступен оператору/админу" : undefined}
                >
                  <option value="">Все</option>
                  {(productCategoriesQ.data ?? []).map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {filterVisibility.product ? (
              <label className="orders-filter-field-label">
                Продукт
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                  value={filterDraft.product_id}
                  onChange={(e) => patchDraft({ product_id: e.target.value })}
                  disabled={productsFilterQ.isLoading}
                >
                  <option value="">Все</option>
                  {(productsFilterQ.data ?? []).map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.sku ? `${p.name} (${p.sku})` : p.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9 xl:items-end">
            <label className="orders-filter-field-label">
              Склад
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                value={filterDraft.warehouse_id}
                onChange={(e) => patchDraft({ warehouse_id: e.target.value })}
              >
                <option value="">Все</option>
                {(warehousesQ.data ?? []).map((w) => (
                  <option key={w.id} value={String(w.id)}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="orders-filter-field-label">
              Агент
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                value={filterDraft.agent_id}
                onChange={(e) => patchDraft({ agent_id: e.target.value })}
              >
                <option value="">Все</option>
                {(agentsQ.data ?? []).map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    {a.fio}
                  </option>
                ))}
              </select>
            </label>
            <label className="orders-filter-field-label">
              Экспедиторы
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                value={filterDraft.expeditor_id}
                onChange={(e) => patchDraft({ expeditor_id: e.target.value })}
              >
                <option value="">Все</option>
                {(expeditorsQ.data ?? []).map((ex) => (
                  <option key={ex.id} value={String(ex.id)}>
                    {ex.fio}
                  </option>
                ))}
              </select>
            </label>
            {filterVisibility.consignment ? (
              <label className="orders-filter-field-label">
                Консигнация
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                  value={filterDraft.is_consignment}
                  onChange={(e) =>
                    patchDraft({
                      is_consignment: e.target.value as "" | "true" | "false"
                    })
                  }
                >
                  <option value="">Все</option>
                  <option value="true">Да</option>
                  <option value="false">Нет</option>
                </select>
              </label>
            ) : null}
            <OrdersFilterStubSelect label="Направление торговли" />
            <OrdersFilterStubSelect label="Территория 1" />
            <OrdersFilterStubSelect label="Территория 2" />
            <OrdersFilterStubSelect label="Территория 3" />
            <div className="flex items-end xl:col-span-1">
              <Button
                type="button"
                size="sm"
                className="h-9 w-full bg-teal-700 text-white hover:bg-teal-800 sm:w-auto"
                onClick={() => {
                  applyFilterDraft();
                  void refetch();
                }}
              >
                Применить
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              disabled={isOrdersFiltersEmpty(filters) && isOrdersFiltersEmpty(filterDraft)}
              onClick={resetFilterDraft}
            >
              Сбросить фильтры
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function OrdersFiltersVisibilityMenu(
  props: Pick<
    OrdersFiltersPanelProps,
    "filterPanelRef" | "filterVisibilityOpen" | "setFilterVisibilityOpen" | "filterVisibility" | "setFilterVisibility"
  >
) {
  const { filterPanelRef, filterVisibilityOpen, setFilterVisibilityOpen, filterVisibility, setFilterVisibility } =
    props;

  return (
    <div ref={filterPanelRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 gap-1"
        onClick={() => setFilterVisibilityOpen((v) => !v)}
      >
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
