"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, FileSpreadsheet, ListOrdered, RotateCcw, Search } from "lucide-react";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { SearchableMultiSelectPanel } from "@/components/ui/searchable-multi-select-panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { cn } from "@/lib/utils";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TableColumnSettingsDialog, type ColumnDefItem } from "@/components/data-table/table-column-settings-dialog";
import { filterSelectClassName } from "@/components/ui/filter-select";

type FilterOptions = {
  date_types: Array<{ id: string; label: string }>;
  application_types: Array<{ id: string; label: string }>;
  unit_modes: Array<{ id: string; label: string }>;
  statuses: Array<{ id: string; label: string }>;
  agents: Array<{ id: number; name: string; code: string }>;
  expeditors: Array<{ id: number; name: string; code: string }>;
  categories: Array<{ id: number; name: string }>;
  payment_methods: Array<{ id: string; label: string }>;
  territory_1: string[];
  territory_2: string[];
  territory_3: string[];
  territory_2_by_1?: Record<string, string[]>;
  territory_3_by_2?: Record<string, string[]>;
  territory_tree?: Array<{ zone: string; region: string; city: string }>;
  regions_by_zone?: Record<string, string[]>;
  cities_by_zone_region?: Record<string, string[]>;
};

type OrderRow = {
  row_number: number;
  order_id: number;
  order_number: string;
  order_type_label: string;
  status_label: string;
  order_date: string;
  shipped_at: string | null;
  delivered_at: string | null;
  client_name: string;
  agent_label: string;
  expeditor_label: string;
  qty_ordered: string;
  qty_returned: string;
  qty_bonus_ordered: string;
  qty_bonus_returned: string;
  qty_delivered: string;
  sum_before: string;
  sum_after: string;
  sum_return: string;
  updated_at: string;
  reason_agent: string;
  reason_expeditor: string;
};

type OrdersPayload = {
  period_from: string;
  period_to: string;
  date_type: string;
  application_type: string;
  page: number;
  limit: number;
  total: number;
  totals: {
    sum_before: string;
    sum_return: string;
    sum_after: string;
    qty_ordered: string;
    qty_returned: string;
  };
  rows: OrderRow[];
};

type AggRow = {
  row_number: number;
  client_id?: number;
  client_name?: string;
  product_id: number;
  category_name: string;
  product_name: string;
  sku: string;
  qty_ordered: string;
  qty_returned: string;
  qty_bonus_ordered: string;
  qty_bonus_returned: string;
  qty_delivered: string;
  qty_return_warehouse: string;
};

type AggPayload = { unit_mode: string; rows: AggRow[] };

const ORDERS_COLUMNS: ColumnDefItem[] = [
  { id: "row_number", label: "№" },
  { id: "order_id", label: "Заказ ID" },
  { id: "order_number", label: "Номер" },
  { id: "order_type_label", label: "Тип" },
  { id: "order_date", label: "Дата заказа" },
  { id: "shipped_at", label: "Дата отгрузки" },
  { id: "delivered_at", label: "Дата доставки" },
  { id: "client_name", label: "Клиент" },
  { id: "agent_label", label: "Агент" },
  { id: "expeditor_label", label: "Экспедитор" },
  { id: "status_label", label: "Статус" },
  { id: "qty_ordered", label: "Заказ (шт)" },
  { id: "qty_returned", label: "Возврат" },
  { id: "qty_bonus_ordered", label: "Бонус заказа" },
  { id: "qty_bonus_returned", label: "Бонус возврата" },
  { id: "qty_delivered", label: "Доставка" },
  { id: "sum_before", label: "Сумма до" },
  { id: "sum_return", label: "Сумма возврат" },
  { id: "sum_after", label: "Сумма после" },
  { id: "updated_at", label: "Обновлено" },
  { id: "reason_agent", label: "Причина (агент)" },
  { id: "reason_expeditor", label: "Причина (эксп.)" }
];

const PRODUCTS_COLUMNS: ColumnDefItem[] = [
  { id: "row_number", label: "№" },
  { id: "category_name", label: "Категория" },
  { id: "product_name", label: "Продукт" },
  { id: "sku", label: "Код" },
  { id: "qty_ordered", label: "Заказ" },
  { id: "qty_returned", label: "Возврат" },
  { id: "qty_bonus_ordered", label: "Бонус заказа" },
  { id: "qty_bonus_returned", label: "Бонус возврата" },
  { id: "qty_delivered", label: "Доставка" },
  { id: "qty_return_warehouse", label: "На склад" }
];

const CLIENTS_COLUMNS: ColumnDefItem[] = [
  { id: "row_number", label: "№" },
  { id: "client_name", label: "Клиент" },
  { id: "category_name", label: "Категория" },
  { id: "product_name", label: "Продукт" },
  { id: "sku", label: "Код" },
  { id: "qty_ordered", label: "Заказ" },
  { id: "qty_returned", label: "Возврат" },
  { id: "qty_bonus_ordered", label: "Бонус заказа" },
  { id: "qty_bonus_returned", label: "Бонус возврата" },
  { id: "qty_delivered", label: "Доставка" },
  { id: "qty_return_warehouse", label: "На склад" }
];

const FILTER_TRIGGER =
  "h-8 min-h-8 w-full min-w-0 max-w-none px-2 text-xs font-normal shadow-sm";

function fmtShort(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function money(v: string) {
  return formatNumberGrouped(v, { maxFractionDigits: 0 });
}

function num(v: string) {
  return formatNumberGrouped(v, { maxFractionDigits: 3 });
}

function buildFilterState(bounds: { from: string; to: string }) {
  return {
    date_type: "order_date" as "order_date" | "created_date" | "shipped_date",
    application_type: "returns_only" as "all" | "returns_only",
    unit_mode: "qty" as "qty" | "pack" | "volume" | "weight",
    ...bounds,
    statuses: [] as string[],
    agent_ids: [] as string[],
    expeditor_ids: [] as string[],
    category_ids: [] as string[],
    payment_methods: [] as string[],
    consignment: "all" as "all" | "yes" | "no",
    territory_1_list: [] as string[],
    territory_2_list: [] as string[],
    territory_3_list: [] as string[],
    sort_by: "order_id" as "order_id" | "order_date" | "client_name" | "return_qty",
    page: 1,
    limit: 50
  };
}

function appendExpeditorParams(
  p: URLSearchParams,
  a: ReturnType<typeof buildFilterState>,
  extra?: { search?: string; search_products?: string; search_clients?: string }
) {
  p.set("from", a.from);
  p.set("to", a.to);
  p.set("date_type", a.date_type);
  p.set("application_type", a.application_type);
  p.set("consignment", a.consignment);
  p.set("unit_mode", a.unit_mode);
  p.set("sort_by", a.sort_by);
  p.set("page", String(a.page));
  p.set("limit", String(a.limit));
  if (extra?.search) p.set("search", extra.search);
  if (extra?.search_products) p.set("search_products", extra.search_products);
  if (extra?.search_clients) p.set("search_clients", extra.search_clients);
  if (a.statuses.length) p.set("statuses", a.statuses.join(","));
  if (a.agent_ids.length) p.set("agent_ids", a.agent_ids.join(","));
  if (a.expeditor_ids.length) p.set("expeditor_ids", a.expeditor_ids.join(","));
  if (a.category_ids.length) p.set("category_ids", a.category_ids.join(","));
  if (a.payment_methods.length) p.set("payment_methods", a.payment_methods.join(","));
  if (a.territory_1_list.length) p.set("territory_1_list", a.territory_1_list.join(","));
  if (a.territory_2_list.length) p.set("territory_2_list", a.territory_2_list.join(","));
  if (a.territory_3_list.length) p.set("territory_3_list", a.territory_3_list.join(","));
}

function MultiFilter({
  placeholder,
  items,
  selectedValues,
  onChange,
  searchPlaceholder,
  compact
}: {
  placeholder: string;
  items: Array<{ id: string; title: string }>;
  selectedValues: string[];
  onChange: (next: string[]) => void;
  searchPlaceholder: string;
  compact?: boolean;
}) {
  return (
    <SearchableMultiSelectPanel
      label={placeholder}
      hideOuterLabel
      hidePopoverHeader
      triggerPlaceholder={placeholder}
      triggerClassName={compact ? FILTER_TRIGGER : undefined}
      items={items}
      selected={new Set(selectedValues)}
      onSelectedChange={(next) => {
        const resolved = typeof next === "function" ? next(new Set(selectedValues)) : next;
        onChange(Array.from(resolved));
      }}
      searchable
      searchPlaceholder={searchPlaceholder}
      minPopoverWidth={compact ? 220 : 260}
      maxListHeightClass={compact ? "max-h-36" : "max-h-44"}
    />
  );
}

export default function ReportExpeditorReturnsPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const today = new Date();
  const from0 = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const to0 = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  const dateAnchorRef = useRef<HTMLButtonElement>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const deferredSearch = useDeferredValue(tableSearch.trim());
  const [searchProducts, setSearchProducts] = useState("");
  const deferredSearchProducts = useDeferredValue(searchProducts.trim());
  const [searchClients, setSearchClients] = useState("");
  const deferredSearchClients = useDeferredValue(searchClients.trim());

  const [draft, setDraft] = useState(() => buildFilterState({ from: from0, to: to0 }));
  const [applied, setApplied] = useState(() => buildFilterState({ from: from0, to: to0 }));

  const [ordersColOpen, setOrdersColOpen] = useState(false);
  const [productsColOpen, setProductsColOpen] = useState(false);
  const [clientsColOpen, setClientsColOpen] = useState(false);
  const [ordersColOrder, setOrdersColOrder] = useState(ORDERS_COLUMNS.map((c) => c.id));
  const [ordersHidden, setOrdersHidden] = useState<Set<string>>(new Set());
  const [productsColOrder, setProductsColOrder] = useState(PRODUCTS_COLUMNS.map((c) => c.id));
  const [productsHidden, setProductsHidden] = useState<Set<string>>(new Set());
  const [clientsColOrder, setClientsColOrder] = useState(CLIENTS_COLUMNS.map((c) => c.id));
  const [clientsHidden, setClientsHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    setApplied((a) => (a.page === 1 ? a : { ...a, page: 1 }));
  }, [deferredSearch]);

  const filtersQ = useQuery({
    queryKey: ["report-expeditor-returns-filters", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: FilterOptions }>(
        `/api/${tenantSlug}/reports/expeditor-returns/filter-options`
      );
      return data.data;
    }
  });

  const ordersQ = useQuery({
    queryKey: ["report-expeditor-returns-orders", tenantSlug, applied, deferredSearch],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.report,
    queryFn: async () => {
      const p = new URLSearchParams();
      appendExpeditorParams(p, applied, { search: deferredSearch || undefined });
      const { data } = await api.get<{ data: OrdersPayload }>(
        `/api/${tenantSlug}/reports/expeditor-returns/orders?${p.toString()}`
      );
      return data.data;
    }
  });

  const productsQ = useQuery({
    queryKey: ["report-expeditor-returns-products", tenantSlug, applied, applied.unit_mode, deferredSearchProducts],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.report,
    queryFn: async () => {
      const p = new URLSearchParams();
      appendExpeditorParams(p, applied, {
        search_products: deferredSearchProducts || undefined
      });
      const { data } = await api.get<{ data: AggPayload }>(
        `/api/${tenantSlug}/reports/expeditor-returns/by-products?${p.toString()}`
      );
      return data.data;
    }
  });

  const clientsQ = useQuery({
    queryKey: ["report-expeditor-returns-clients", tenantSlug, applied, applied.unit_mode, deferredSearchClients],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.report,
    queryFn: async () => {
      const p = new URLSearchParams();
      appendExpeditorParams(p, applied, {
        search_clients: deferredSearchClients || undefined
      });
      const { data } = await api.get<{ data: AggPayload }>(
        `/api/${tenantSlug}/reports/expeditor-returns/by-clients?${p.toString()}`
      );
      return data.data;
    }
  });

  const opts = filtersQ.data;

  const territory1Items = (opts?.territory_1 ?? []).map((x) => ({ id: x, title: x }));
  const territory2Items = useMemo(() => {
    const zone = draft.territory_1_list[0] ?? "";
    if (!zone) return (opts?.territory_2 ?? []).map((x) => ({ id: x, title: x }));
    const byZone = opts?.regions_by_zone?.[zone] ?? opts?.territory_2_by_1?.[zone] ?? [];
    return byZone.map((x) => ({ id: x, title: x }));
  }, [draft.territory_1_list, opts?.regions_by_zone, opts?.territory_2_by_1, opts?.territory_2]);

  const territory3Items = useMemo(() => {
    const zone = draft.territory_1_list[0] ?? "";
    const region = draft.territory_2_list[0] ?? "";
    if (!region) return (opts?.territory_3 ?? []).map((x) => ({ id: x, title: x }));
    const key = `${zone}|||${region}`;
    let cities = opts?.cities_by_zone_region?.[key] ?? [];
    if (cities.length === 0 && opts?.territory_tree?.length) {
      cities = opts.territory_tree
        .filter((x) => {
          const zoneOk = !zone || (x.zone ?? "") === zone;
          const regionOk = (x.region ?? "") === region;
          return zoneOk && regionOk;
        })
        .map((x) => x.city)
        .filter(Boolean);
    }
    if (cities.length === 0) cities = [...(opts?.territory_3 ?? [])];
    cities = Array.from(new Set(cities)).sort((a, b) => a.localeCompare(b, "ru"));
    return cities.map((x) => ({ id: x, title: x }));
  }, [draft.territory_1_list, draft.territory_2_list, opts?.cities_by_zone_region, opts?.territory_tree, opts?.territory_3]);

  const statusItems = (opts?.statuses ?? []).map((x) => ({ id: x.id, title: x.label }));
  const agentItems = (opts?.agents ?? []).map((x) => ({
    id: String(x.id),
    title: `${x.name}${x.code ? ` (${x.code})` : ""}`
  }));
  const expeditorItems = (opts?.expeditors ?? []).map((x) => ({
    id: String(x.id),
    title: `${x.name}${x.code ? ` (${x.code})` : ""}`
  }));
  const categoryItems = (opts?.categories ?? []).map((x) => ({ id: String(x.id), title: x.name }));
  const paymentItems = (opts?.payment_methods ?? []).map((x) => ({ id: x.id, title: x.label }));

  const applyDraft = (page = 1) => {
    setApplied({ ...draft, page });
  };

  const exportParams = () => {
    const p = new URLSearchParams();
    appendExpeditorParams(p, applied, {
      search: tableSearch.trim() || undefined,
      search_products: searchProducts.trim() || undefined,
      search_clients: searchClients.trim() || undefined
    });
    return p;
  };

  const downloadExcel = async () => {
    if (!tenantSlug) return;
    setExporting(true);
    try {
      const res = await api.get<Blob>(`/api/${tenantSlug}/reports/expeditor-returns/export?${exportParams().toString()}`, {
        responseType: "blob"
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "vozvrat-ekspeditora.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const ordersData = ordersQ.data;
  const totalPages = ordersData ? Math.max(1, Math.ceil(ordersData.total / ordersData.limit)) : 1;
  const ordersDisplayRows = ordersQ.data?.rows ?? [];
  const productsDisplayRows = productsQ.data?.rows ?? [];
  const clientsDisplayRows = clientsQ.data?.rows ?? [];

  if (!hydrated || !tenantSlug) return <p className="text-sm text-muted-foreground">Загрузка...</p>;

  const periodBtn = formatDateRangeButton(draft.from, draft.to);
  const unitLabel =
    applied.unit_mode === "pack"
      ? "уп."
      : applied.unit_mode === "volume"
        ? "м³"
        : applied.unit_mode === "weight"
          ? "кг"
          : "шт";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-lg font-semibold">Возврат экспедитора</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            ref={dateAnchorRef}
            type="button"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-9 shrink-0 gap-2 font-normal",
              dateOpen && "border-primary/60 bg-primary/5"
            )}
            aria-expanded={dateOpen}
            aria-haspopup="dialog"
            onClick={() => setDateOpen((o) => !o)}
          >
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-sm font-medium tabular-nums">{periodBtn}</span>
          </button>
        </div>
      </div>

      <DateRangePopover
        open={dateOpen}
        onOpenChange={setDateOpen}
        anchorRef={dateAnchorRef}
        dateFrom={draft.from}
        dateTo={draft.to}
        onApply={({ dateFrom, dateTo }) => setDraft((d) => ({ ...d, from: dateFrom, to: dateTo, page: 1 }))}
      />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 py-3">
          <CardTitle className="text-base">Фильтр</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
        <div className="grid gap-2 border-b border-border/50 pb-2 sm:grid-cols-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="shrink-0 font-medium text-muted-foreground">Тип заявки</span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
              {(opts?.application_types ?? [
                { id: "all", label: "Все заказы" },
                { id: "returns_only", label: "Заказы с возвратами" }
              ]).map((x) => (
                <label key={x.id} className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap">
                  <input
                    type="radio"
                    className="accent-primary"
                    name="er-app-type"
                    checked={draft.application_type === x.id}
                    onChange={() => setDraft((d) => ({ ...d, application_type: x.id as typeof d.application_type, page: 1 }))}
                  />
                  <span>{x.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="shrink-0 font-medium text-muted-foreground">Дата применяется по</span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
              {(opts?.date_types ?? []).map((dt) => (
                <label key={dt.id} className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap">
                  <input
                    type="radio"
                    className="accent-primary"
                    name="er-date-type"
                    checked={draft.date_type === dt.id}
                    onChange={() => setDraft((d) => ({ ...d, date_type: dt.id as typeof d.date_type, page: 1 }))}
                  />
                  <span>{dt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-2 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
          <MultiFilter
            compact
            placeholder="Статус"
            items={statusItems}
            selectedValues={draft.statuses}
            onChange={(v) => setDraft((d) => ({ ...d, statuses: v, page: 1 }))}
            searchPlaceholder="Статус"
          />
          <MultiFilter
            compact
            placeholder="Агент"
            items={agentItems}
            selectedValues={draft.agent_ids}
            onChange={(v) => setDraft((d) => ({ ...d, agent_ids: v, page: 1 }))}
            searchPlaceholder="Агент"
          />
          <MultiFilter
            compact
            placeholder="Экспедитор"
            items={expeditorItems}
            selectedValues={draft.expeditor_ids}
            onChange={(v) => setDraft((d) => ({ ...d, expeditor_ids: v, page: 1 }))}
            searchPlaceholder="Экспедитор"
          />
          <MultiFilter
            compact
            placeholder="Категория"
            items={categoryItems}
            selectedValues={draft.category_ids}
            onChange={(v) => setDraft((d) => ({ ...d, category_ids: v, page: 1 }))}
            searchPlaceholder="Категория"
          />
          <MultiFilter
            compact
            placeholder="Способ оплаты"
            items={paymentItems}
            selectedValues={draft.payment_methods}
            onChange={(v) => setDraft((d) => ({ ...d, payment_methods: v, page: 1 }))}
            searchPlaceholder="Оплата"
          />
        </div>

        <div className="grid grid-cols-2 gap-x-2 gap-y-2 sm:grid-cols-2 md:grid-cols-4">
          <div className="flex min-w-0 flex-col justify-end gap-0.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Консигнация</span>
            <select
              className={cn(FILTER_TRIGGER, "rounded-md border border-input bg-background")}
              value={draft.consignment}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  consignment: e.target.value as typeof d.consignment,
                  page: 1
                }))
              }
            >
              <option value="all">Обе</option>
              <option value="yes">Да</option>
              <option value="no">Нет</option>
            </select>
          </div>
          <MultiFilter
            compact
            placeholder="Зона"
            items={territory1Items}
            selectedValues={draft.territory_1_list}
            onChange={(v) =>
              setDraft((d) => ({
                ...d,
                territory_1_list: v,
                territory_2_list: [],
                territory_3_list: [],
                page: 1
              }))
            }
            searchPlaceholder="Зона"
          />
          <MultiFilter
            compact
            placeholder="Область"
            items={territory2Items}
            selectedValues={draft.territory_2_list}
            onChange={(v) => setDraft((d) => ({ ...d, territory_2_list: v, territory_3_list: [], page: 1 }))}
            searchPlaceholder="Область"
          />
          <MultiFilter
            compact
            placeholder="Город"
            items={territory3Items}
            selectedValues={draft.territory_3_list}
            onChange={(v) => setDraft((d) => ({ ...d, territory_3_list: v, page: 1 }))}
            searchPlaceholder="Город"
          />
        </div>

        <div className="flex flex-wrap items-end justify-between gap-2 border-t border-border/60 pt-2">
          <div className="relative min-w-[200px] max-w-md flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 pl-8 text-xs"
              placeholder="Поиск по заказам: №, клиент"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
            />
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                const reset = buildFilterState({ from: from0, to: to0 });
                setDraft(reset);
                setApplied(reset);
                setTableSearch("");
                setSearchProducts("");
                setSearchClients("");
              }}
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Сброс
            </Button>
            <Button type="button" size="sm" className="h-8 min-w-[120px] text-xs" onClick={() => applyDraft(1)}>
              Применить
            </Button>
          </div>
        </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 py-3">
          <CardTitle className="text-base">По заказам</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 overflow-x-auto pt-0">
          <div className="flex flex-wrap items-end justify-between gap-2 border-b pb-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" type="button" className="h-8 text-xs" onClick={() => setOrdersColOpen(true)}>
                <ListOrdered className="mr-1 h-3.5 w-3.5" />
                Колонки
              </Button>
              <Button variant="outline" size="icon" type="button" className="h-8 w-8" onClick={() => void ordersQ.refetch()}>
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
              <select
                title="Строк на странице"
                className={cn(filterSelectClassName, "h-8 w-[4.5rem] text-xs")}
                value={String(applied.limit)}
                onChange={(e) => {
                  const limit = Number.parseInt(e.target.value, 10) || 50;
                  setDraft((d) => ({ ...d, limit, page: 1 }));
                  setApplied((a) => ({ ...a, limit, page: 1 }));
                }}
              >
                {[10, 20, 50, 100, 200].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <select
                title="Сортировка"
                className={cn(filterSelectClassName, "h-8 min-w-[10rem] max-w-[14rem] text-xs")}
                value={applied.sort_by}
                onChange={(e) => {
                  const sort_by = e.target.value as typeof applied.sort_by;
                  setDraft((d) => ({ ...d, sort_by, page: 1 }));
                  setApplied((a) => ({ ...a, sort_by, page: 1 }));
                }}
              >
                <option value="order_id">По ID заказа</option>
                <option value="order_date">По дате заказа</option>
                <option value="client_name">По клиенту</option>
                <option value="return_qty">По кол-ву возврата</option>
              </select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 gap-1.5 text-xs"
              disabled={exporting}
              title="Скачать Excel (все листы отчёта)"
              onClick={() => void downloadExcel()}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Excel
            </Button>
          </div>
          {ordersQ.isError ? (
            <p className="text-sm text-destructive">Ошибка загрузки</p>
          ) : ordersQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка…</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  Показано {(applied.page - 1) * applied.limit + 1}–
                  {Math.min(applied.page * applied.limit, ordersData?.total ?? 0)} / {ordersData?.total ?? 0}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    disabled={applied.page <= 1}
                    onClick={() => setApplied((a) => ({ ...a, page: Math.max(1, a.page - 1) }))}
                  >
                    Назад
                  </Button>
                  <span className="tabular-nums">
                    {applied.page} / {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    disabled={applied.page >= totalPages}
                    onClick={() => setApplied((a) => ({ ...a, page: Math.min(totalPages, a.page + 1) }))}
                  >
                    Вперёд
                  </Button>
                </div>
              </div>
              <div className="overflow-auto rounded border">
                <table className="w-full min-w-[960px] border-collapse text-xs">
                  <thead className="app-table-thead">
                    <tr>
                      {ordersColOrder
                        .filter((id) => !ordersHidden.has(id))
                        .map((colId) => (
                          <th
                            key={colId}
                            className={cn(
                              "whitespace-nowrap px-2 py-2 text-left font-medium",
                              ["qty_ordered", "qty_returned", "qty_bonus_ordered", "qty_bonus_returned", "qty_delivered", "sum_before", "sum_return", "sum_after"].includes(colId) && "text-right"
                            )}
                          >
                            {ORDERS_COLUMNS.find((c) => c.id === colId)?.label ?? colId}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ordersDisplayRows.map((r) => (
                      <tr key={r.order_id} className="border-t border-border/60 hover:bg-muted/20">
                        {ordersColOrder
                          .filter((id) => !ordersHidden.has(id))
                          .map((colId) => (
                            <td
                              key={`${r.order_id}-${colId}`}
                              className={cn(
                                "px-2 py-2",
                                ["qty_ordered", "qty_returned", "qty_bonus_ordered", "qty_bonus_returned", "qty_delivered", "sum_before", "sum_return", "sum_after"].includes(colId) &&
                                  "text-right tabular-nums"
                              )}
                            >
                              {colId === "order_id" ? (
                                <Link className="text-primary underline-offset-2 hover:underline" href={`/orders/${r.order_id}`}>
                                  {r.order_id}
                                </Link>
                              ) : colId === "status_label" ? (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{r.status_label}</span>
                              ) : colId === "order_date" || colId === "shipped_at" || colId === "delivered_at" || colId === "updated_at" ? (
                                (r as unknown as Record<string, string | null>)[colId]
                                  ? fmtShort(String((r as unknown as Record<string, string>)[colId]))
                                  : "—"
                              ) : ["qty_ordered", "qty_returned", "qty_bonus_ordered", "qty_bonus_returned", "qty_delivered"].includes(colId) ? (
                                num(String((r as unknown as Record<string, string>)[colId] ?? "0"))
                              ) : ["sum_before", "sum_return", "sum_after"].includes(colId) ? (
                                money(String((r as unknown as Record<string, string>)[colId] ?? "0"))
                              ) : (
                                String((r as unknown as Record<string, string | undefined>)[colId] ?? "") || "—"
                              )}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <TableColumnSettingsDialog
        open={ordersColOpen}
        onOpenChange={setOrdersColOpen}
        title="Колонки: По заказам"
        description="Видимость и порядок столбцов."
        columns={ORDERS_COLUMNS}
        columnOrder={ordersColOrder}
        hiddenColumnIds={ordersHidden}
        onSave={(next) => {
          setOrdersColOrder(next.columnOrder);
          setOrdersHidden(new Set(next.hiddenColumnIds));
        }}
        onReset={() => {
          setOrdersColOrder(ORDERS_COLUMNS.map((c) => c.id));
          setOrdersHidden(new Set());
        }}
      />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 py-3">
          <CardTitle className="text-base">По товарам</CardTitle>
          <div className="flex flex-wrap gap-1">
            {(opts?.unit_modes ?? []).map((u) => (
              <Button
                key={u.id}
                type="button"
                size="sm"
                variant={draft.unit_mode === u.id ? "default" : "outline"}
                className="h-7 px-2 text-xs"
                onClick={() => {
                  const um = u.id as (typeof draft)["unit_mode"];
                  setDraft((d) => ({ ...d, unit_mode: um }));
                  setApplied((a) => ({ ...a, unit_mode: um }));
                }}
              >
                {u.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto pt-0">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2 border-b pb-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <p className="shrink-0 text-[11px] text-muted-foreground">Единицы: {unitLabel}</p>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" type="button" className="h-8 text-xs" onClick={() => setProductsColOpen(true)}>
                  <ListOrdered className="mr-1 h-3.5 w-3.5" />
                  Колонки
                </Button>
                <Button variant="outline" size="icon" type="button" className="h-8 w-8" onClick={() => void productsQ.refetch()}>
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
                <div className="relative min-w-[140px] max-w-md flex-1">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-8 pl-8 text-xs"
                    placeholder="Поиск: продукт, SKU, категория"
                    value={searchProducts}
                    onChange={(e) => setSearchProducts(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 gap-1.5 text-xs"
              disabled={exporting}
              title="Скачать Excel (все листы отчёта)"
              onClick={() => void downloadExcel()}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Excel
            </Button>
          </div>
          {productsQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка…</p>
          ) : (
            <div className="overflow-auto rounded border">
              <table className="w-full min-w-[720px] border-collapse text-xs">
                <thead className="app-table-thead">
                  <tr>
                    {productsColOrder
                      .filter((id) => !productsHidden.has(id))
                      .map((colId) => {
                        const def = PRODUCTS_COLUMNS.find((c) => c.id === colId);
                        const isMetric = [
                          "qty_ordered",
                          "qty_returned",
                          "qty_bonus_ordered",
                          "qty_bonus_returned",
                          "qty_delivered",
                          "qty_return_warehouse"
                        ].includes(colId);
                        const label = isMetric && def ? `${def.label} (${unitLabel})` : (def?.label ?? colId);
                        return (
                          <th
                            key={colId}
                            className={cn(
                              "whitespace-nowrap px-2 py-2 text-left font-medium",
                              isMetric && "text-right"
                            )}
                          >
                            {label}
                          </th>
                        );
                      })}
                  </tr>
                </thead>
                <tbody>
                  {productsDisplayRows.map((r) => (
                    <tr key={`${r.product_id}-${r.row_number}`} className="border-t border-border/60">
                      {productsColOrder
                        .filter((id) => !productsHidden.has(id))
                        .map((colId) => (
                          <td
                            key={`${r.product_id}-${colId}`}
                            className={cn(
                              "px-2 py-2",
                              ["qty_ordered", "qty_returned", "qty_bonus_ordered", "qty_bonus_returned", "qty_delivered", "qty_return_warehouse"].includes(
                                colId
                              ) && "text-right tabular-nums"
                            )}
                          >
                            {colId === "row_number"
                              ? String(r.row_number)
                              : ["qty_ordered", "qty_returned", "qty_bonus_ordered", "qty_bonus_returned", "qty_delivered", "qty_return_warehouse"].includes(
                                    colId
                                  )
                                ? num(String((r as unknown as Record<string, string>)[colId]))
                                : String((r as unknown as Record<string, string>)[colId] ?? "")}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <TableColumnSettingsDialog
        open={productsColOpen}
        onOpenChange={setProductsColOpen}
        title="Колонки: По товарам"
        columns={PRODUCTS_COLUMNS}
        columnOrder={productsColOrder}
        hiddenColumnIds={productsHidden}
        onSave={(next) => {
          setProductsColOrder(next.columnOrder);
          setProductsHidden(new Set(next.hiddenColumnIds));
        }}
        onReset={() => {
          setProductsColOrder(PRODUCTS_COLUMNS.map((c) => c.id));
          setProductsHidden(new Set());
        }}
      />

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">По клиентам</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto pt-0">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2 border-b pb-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" type="button" className="h-8 text-xs" onClick={() => setClientsColOpen(true)}>
                <ListOrdered className="mr-1 h-3.5 w-3.5" />
                Колонки
              </Button>
              <Button variant="outline" size="icon" type="button" className="h-8 w-8" onClick={() => void clientsQ.refetch()}>
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
              <div className="relative min-w-[140px] max-w-md flex-1">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-8 pl-8 text-xs"
                  placeholder="Поиск: клиент, продукт, SKU"
                  value={searchClients}
                  onChange={(e) => setSearchClients(e.target.value)}
                />
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 gap-1.5 text-xs"
              disabled={exporting}
              title="Скачать Excel (все листы отчёта)"
              onClick={() => void downloadExcel()}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Excel
            </Button>
          </div>
          {clientsQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка…</p>
          ) : (
            <div className="overflow-auto rounded border">
              <table className="w-full min-w-[800px] border-collapse text-xs">
                <thead className="app-table-thead">
                  <tr>
                    {clientsColOrder
                      .filter((id) => !clientsHidden.has(id))
                      .map((colId) => {
                        const base = CLIENTS_COLUMNS.find((c) => c.id === colId)?.label ?? colId;
                        const label = ["qty_ordered", "qty_returned", "qty_bonus_ordered", "qty_bonus_returned", "qty_delivered", "qty_return_warehouse"].includes(
                          colId
                        )
                          ? `${base} (${unitLabel})`
                          : base;
                        return (
                          <th
                            key={colId}
                            className={cn(
                              "whitespace-nowrap px-2 py-2 text-left font-medium",
                              ["qty_ordered", "qty_returned", "qty_bonus_ordered", "qty_bonus_returned", "qty_delivered", "qty_return_warehouse"].includes(colId) &&
                                "text-right"
                            )}
                          >
                            {label}
                          </th>
                        );
                      })}
                  </tr>
                </thead>
                <tbody>
                  {clientsDisplayRows.map((r) => (
                    <tr key={`${r.client_id ?? "x"}-${r.product_id}-${r.row_number}`} className="border-t border-border/60">
                      {clientsColOrder
                        .filter((id) => !clientsHidden.has(id))
                        .map((colId) => (
                          <td
                            key={`${r.client_id}-${r.product_id}-${colId}`}
                            className={cn(
                              "px-2 py-2",
                              ["qty_ordered", "qty_returned", "qty_bonus_ordered", "qty_bonus_returned", "qty_delivered", "qty_return_warehouse"].includes(colId) &&
                                "text-right tabular-nums",
                              colId === "client_name" && "max-w-[160px] truncate"
                            )}
                            title={colId === "client_name" ? r.client_name : undefined}
                          >
                            {colId === "row_number"
                              ? String(r.row_number)
                              : ["qty_ordered", "qty_returned", "qty_bonus_ordered", "qty_bonus_returned", "qty_delivered", "qty_return_warehouse"].includes(
                                    colId
                                  )
                                ? num(String((r as unknown as Record<string, string>)[colId]))
                                : String((r as unknown as Record<string, string | undefined>)[colId] ?? "")}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <TableColumnSettingsDialog
        open={clientsColOpen}
        onOpenChange={setClientsColOpen}
        title="Колонки: По клиентам"
        columns={CLIENTS_COLUMNS}
        columnOrder={clientsColOrder}
        hiddenColumnIds={clientsHidden}
        onSave={(next) => {
          setClientsColOrder(next.columnOrder);
          setClientsHidden(new Set(next.hiddenColumnIds));
        }}
        onReset={() => {
          setClientsColOrder(CLIENTS_COLUMNS.map((c) => c.id));
          setClientsHidden(new Set());
        }}
      />
    </div>
  );
}
