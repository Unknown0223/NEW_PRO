"use client";

import { OrdersListSingleMultiFilter } from "@/components/orders/orders-list/orders-list-single-multi-filter";
import {
  ORDERS_FILTER_GRID_CLASS,
  ordersFilterRowSelect
} from "@/components/orders/orders-list/orders-list-filter-ui";
import { ORDER_STATUS_FILTER_OPTIONS } from "@/lib/order-status";
import { ORDER_TYPE_FILTER_OPTIONS } from "@/lib/order-types";
import { staffDashboardMultiItem } from "@/lib/order-picker-labels";
import type { RefSelectOption } from "@/lib/ref-select-options";
import { useMemo, type ReactNode } from "react";
import { useOrdersListFilterCascade } from "./use-orders-list-filter-cascade";
import type { OrdersFilterVisibility, OrdersUrlFilters } from "./types";
import type { UseOrdersListPageResult } from "./use-orders-list-page";

const VISIT_WEEKDAY_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "1", label: "Понедельник" },
  { value: "2", label: "Вторник" },
  { value: "3", label: "Среда" },
  { value: "4", label: "Четверг" },
  { value: "5", label: "Пятница" },
  { value: "6", label: "Суббота" },
  { value: "7", label: "Воскресенье" }
];

const CONSIGNMENT_FILTER_ITEMS = [
  { id: "true", title: "Да" },
  { id: "false", title: "Нет" }
];

function territoryItems(opts: RefSelectOption[]) {
  return opts.map((o) => ({
    id: o.value,
    title: o.label,
    searchText: [o.value, o.label].filter(Boolean).join(" ")
  }));
}

type Props = Pick<
  UseOrdersListPageResult,
  | "filterDraft"
  | "setFilterDraft"
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
  | "canBulkCatalog"
> & {
  filterVisibility: OrdersFilterVisibility;
};

export function OrdersFiltersGrid({
  filterDraft,
  setFilterDraft,
  filterVisibility,
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
  canBulkCatalog
}: Props) {
  const productIdsInCategory = useMemo(
    () => new Set((productsFilterQ.data ?? []).map((p) => String(p.id))),
    [productsFilterQ.data]
  );

  const {
    territoryCascade,
    patchTerritoryZone,
    patchTerritoryRegion,
    patchProductCategory
  } = useOrdersListFilterCascade({
    filterDraft,
    setFilterDraft,
    buildTerritoryCascade,
    productIdsInCategory
  });

  const patchDraft = (patch: Partial<OrdersUrlFilters>) => {
    setFilterDraft((cur) => ({ ...cur, ...patch }));
  };

  const zoneItems = useMemo(() => territoryItems(territoryCascade.zones), [territoryCascade.zones]);
  const regionItems = useMemo(
    () => territoryItems(territoryCascade.regions),
    [territoryCascade.regions]
  );
  const cityItems = useMemo(() => territoryItems(territoryCascade.cities), [territoryCascade.cities]);

  const statusItems = useMemo(
    () => ORDER_STATUS_FILTER_OPTIONS.map((o) => ({ id: o.value, title: o.label })),
    []
  );
  const orderTypeItems = useMemo(
    () => ORDER_TYPE_FILTER_OPTIONS.map((o) => ({ id: o.value, title: o.label })),
    []
  );

  const cell = (key: keyof OrdersFilterVisibility, node: ReactNode) =>
    filterVisibility[key] ? <div className="min-w-0">{node}</div> : null;

  return (
    <div className={ORDERS_FILTER_GRID_CLASS}>
      {cell(
        "status",
        <div data-testid="orders-filter-status">
          <OrdersListSingleMultiFilter
            placeholder="Статус"
            searchPlaceholder="Статус"
            triggerClassName={ordersFilterRowSelect}
            items={statusItems}
            value={filterDraft.status}
            onChange={(v) => patchDraft({ status: v })}
          />
        </div>
      )}
      {cell(
        "orderType",
        <OrdersListSingleMultiFilter
          placeholder="Тип"
          searchPlaceholder="Тип"
          triggerClassName={ordersFilterRowSelect}
          items={orderTypeItems}
          value={filterDraft.order_type}
          onChange={(v) => patchDraft({ order_type: v })}
        />
      )}
      {cell(
        "nakladnoyType",
        <OrdersListSingleMultiFilter
          placeholder="Тип накладной"
          searchPlaceholder="Тип накладной"
          triggerClassName={ordersFilterRowSelect}
          items={nakladnoyTypeFilterOpts.map((o) => ({ id: o.value, title: o.label }))}
          value={filterDraft.request_type_ref}
          onChange={(v) => patchDraft({ request_type_ref: v })}
          disabled={nakladnoyTypeFilterOpts.length === 0}
        />
      )}
      {cell(
        "paymentMethod",
        <OrdersListSingleMultiFilter
          placeholder="Способ оплаты (заказ)"
          searchPlaceholder="Оплата"
          triggerClassName={ordersFilterRowSelect}
          items={paymentMethodFilterOpts.map((o) => ({ id: o.value, title: o.label }))}
          value={filterDraft.payment_method_ref}
          onChange={(v) => patchDraft({ payment_method_ref: v })}
          disabled={!canBulkCatalog && paymentMethodFilterOpts.length === 0}
        />
      )}
      {cell(
        "paymentLinkedType",
        <OrdersListSingleMultiFilter
          placeholder="Тип платежа (по заказу)"
          searchPlaceholder="Тип платежа"
          triggerClassName={ordersFilterRowSelect}
          items={paymentTypeFilterOpts.map((o) => ({ id: o.value, title: o.label }))}
          value={filterDraft.payment_type}
          onChange={(v) => patchDraft({ payment_type: v })}
          disabled={paymentTypeFilterOpts.length === 0}
        />
      )}
      {cell(
        "priceType",
        <OrdersListSingleMultiFilter
          placeholder="Тип цены"
          searchPlaceholder="Тип цены"
          triggerClassName={ordersFilterRowSelect}
          items={priceTypeFilterOpts.map((o) => ({ id: o.value, title: o.label }))}
          value={filterDraft.price_type}
          onChange={(v) => patchDraft({ price_type: v })}
          disabled={priceTypeFilterOpts.length === 0}
        />
      )}
      {cell(
        "day",
        <OrdersListSingleMultiFilter
          placeholder="День"
          searchPlaceholder="День"
          triggerClassName={ordersFilterRowSelect}
          items={VISIT_WEEKDAY_FILTER_OPTIONS.map((o) => ({ id: o.value, title: o.label }))}
          value={filterDraft.visit_weekday}
          onChange={(v) => patchDraft({ visit_weekday: v })}
          searchable={false}
        />
      )}
      {cell(
        "clientCategory",
        <OrdersListSingleMultiFilter
          placeholder="Категория клиента"
          searchPlaceholder="Категория"
          triggerClassName={ordersFilterRowSelect}
          items={clientCategoryFilterOpts.map((o) => ({ id: o.value, title: o.label }))}
          value={filterDraft.client_category}
          onChange={(v) => patchDraft({ client_category: v })}
          disabled={clientCategoryFilterOpts.length === 0}
        />
      )}
      {cell(
        "productCategory",
        <OrdersListSingleMultiFilter
          placeholder="Категория продукта"
          searchPlaceholder="Категория"
          triggerClassName={ordersFilterRowSelect}
          items={(productCategoriesQ.data ?? []).map((c) => ({
            id: String(c.id),
            title: c.name
          }))}
          value={filterDraft.product_category_id}
          onChange={(v) => patchProductCategory(v)}
          disabled={productCategoriesQ.isLoading}
        />
      )}
      {cell(
        "product",
        <OrdersListSingleMultiFilter
          placeholder="Продукт"
          searchPlaceholder="Продукт"
          triggerClassName={ordersFilterRowSelect}
          items={(productsFilterQ.data ?? []).map((p) => ({
            id: String(p.id),
            title: p.sku ? `${p.name} (${p.sku})` : p.name,
            searchText: p.sku ?? undefined
          }))}
          value={filterDraft.product_id}
          onChange={(v) => patchDraft({ product_id: v })}
          disabled={productsFilterQ.isLoading}
          minPopoverWidth={280}
        />
      )}
      {cell(
        "warehouse",
        <OrdersListSingleMultiFilter
          placeholder="Склад"
          searchPlaceholder="Склад"
          triggerClassName={ordersFilterRowSelect}
          items={(warehousesQ.data ?? []).map((w) => ({ id: String(w.id), title: w.name }))}
          value={filterDraft.warehouse_id}
          onChange={(v) => patchDraft({ warehouse_id: v })}
        />
      )}
      {cell(
        "agent",
        <OrdersListSingleMultiFilter
          placeholder="Агент"
          searchPlaceholder="Агент"
          triggerClassName={ordersFilterRowSelect}
          items={(agentsQ.data ?? []).map((a) =>
            staffDashboardMultiItem({ id: a.id, fio: a.fio, code: a.code ?? null })
          )}
          value={filterDraft.agent_id}
          onChange={(v) => patchDraft({ agent_id: v })}
        />
      )}
      {cell(
        "expeditor",
        <OrdersListSingleMultiFilter
          placeholder="Экспедиторы"
          searchPlaceholder="Экспедитор"
          triggerClassName={ordersFilterRowSelect}
          items={(expeditorsQ.data ?? []).map((ex) =>
            staffDashboardMultiItem({ id: ex.id, fio: ex.fio, code: ex.code ?? null })
          )}
          value={filterDraft.expeditor_id}
          onChange={(v) => patchDraft({ expeditor_id: v })}
        />
      )}
      {cell(
        "consignment",
        <OrdersListSingleMultiFilter
          placeholder="Консигнация"
          searchPlaceholder="Консигнация"
          triggerClassName={ordersFilterRowSelect}
          items={CONSIGNMENT_FILTER_ITEMS}
          value={filterDraft.is_consignment}
          onChange={(v) =>
            patchDraft({ is_consignment: (v === "true" || v === "false" ? v : "") as "" | "true" | "false" })
          }
          searchable={false}
        />
      )}
      {cell(
        "tradeDirection",
        <OrdersListSingleMultiFilter
          placeholder="Направление торговли"
          searchPlaceholder="Направление"
          triggerClassName={ordersFilterRowSelect}
          items={tradeDirectionFilterOpts.map((o) => ({ id: o.value, title: o.label }))}
          value={filterDraft.trade_direction}
          onChange={(v) => patchDraft({ trade_direction: v })}
          disabled={tradeDirectionFilterOpts.length === 0}
        />
      )}
      {cell(
        "territory1",
        <OrdersListSingleMultiFilter
          placeholder="Зона"
          searchPlaceholder="Зона"
          triggerClassName={ordersFilterRowSelect}
          items={zoneItems}
          value={filterDraft.client_zone}
          onChange={(v) => patchTerritoryZone(v)}
          disabled={zoneItems.length === 0}
          minPopoverWidth={260}
        />
      )}
      {cell(
        "territory2",
        <OrdersListSingleMultiFilter
          placeholder="Область"
          searchPlaceholder="Область"
          triggerClassName={ordersFilterRowSelect}
          items={regionItems}
          value={filterDraft.client_region}
          onChange={(v) => patchTerritoryRegion(v)}
          disabled={regionItems.length === 0}
          minPopoverWidth={280}
        />
      )}
      {cell(
        "territory3",
        <OrdersListSingleMultiFilter
          placeholder="Город"
          searchPlaceholder="Город"
          triggerClassName={ordersFilterRowSelect}
          items={cityItems}
          value={filterDraft.client_city}
          onChange={(v) => patchDraft({ client_city: v })}
          disabled={cityItems.length === 0}
          minPopoverWidth={280}
        />
      )}
    </div>
  );
}
