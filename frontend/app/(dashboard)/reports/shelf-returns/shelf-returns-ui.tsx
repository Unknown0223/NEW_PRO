"use client";

import { SearchableMultiSelectPanel } from "@/components/ui/searchable-multi-select-panel";

export type ShelfReturnsFilterOptions = {
  date_types: Array<{ id: string; label: string }>;
  statuses: Array<{ id: string; label: string }>;
  agents: Array<{ id: number; name: string; code: string }>;
  expeditors: Array<{ id: number; name: string; code: string }>;
  categories: Array<{ id: number; name: string }>;
  warehouses: Array<{ id: number; name: string; code: string }>;
  payment_methods: Array<{ id: string; label: string }>;
  price_types: Array<{ id: string; label: string }>;
  client_categories: string[];
  territory_1: string[];
  territory_2: string[];
  territory_3: string[];
};

export type ShelfReturnsReportRow = {
  row_number: number;
  client_id: number;
  client_name: string;
  client_code: string;
  client_legal_name: string;
  client_category: string;
  territory: string;
  qty: string;
  expeditor_name: string;
  order_id: number;
  order_number: string;
  payment_method: string;
  price_type: string;
  warehouse_name: string;
  order_date: string;
  shipped_at: string | null;
  status_label: string;
  trade_direction: string;
  volume: string;
  amount: string;
  agent_name: string;
  agent_code: string;
  supervisor_name: string;
  product_id: number;
  product_sku: string;
  product_name: string;
  product_group: string;
  product_category: string;
  pack_qty: string;
  product_volume: string;
  return_reason: string;
};

export type ShelfReturnsReportData = {
  rows: ShelfReturnsReportRow[];
  totals: { amount: string; qty: string; volume: string };
  page: number;
  limit: number;
  total: number;
};

type MultiItem = { id: string; title: string; searchText?: string };

export function ShelfMultiFilter(props: {
  placeholder: string;
  items: MultiItem[];
  selectedValues: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <SearchableMultiSelectPanel
      label={props.placeholder}
      hideOuterLabel
      hidePopoverHeader
      triggerPlaceholder={props.placeholder}
      items={props.items}
      selected={new Set(props.selectedValues)}
      onSelectedChange={(next) => {
        const resolved = typeof next === "function" ? next(new Set(props.selectedValues)) : next;
        props.onChange(Array.from(resolved));
      }}
      searchable
      searchPlaceholder={props.placeholder}
      minPopoverWidth={260}
      maxListHeightClass="max-h-44"
    />
  );
}

export const SHELF_RETURNS_COLS = [
  "Клиент",
  "Территория",
  "Товар",
  "Кол-во",
  "Сумма",
  "Объём",
  "Заказ",
  "Статус",
  "Агент",
  "Экспедитор",
  "Склад",
  "Дата заявки",
  "Отгрузка",
  "Оплата",
  "Тип цены",
  "Кат. товара",
  "Причина"
] as const;
