"use client";

import { useDeferredValue, useMemo, useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, FileSpreadsheet, Filter, ListOrdered, RotateCcw, Search } from "lucide-react";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { FilterSelect } from "@/components/ui/filter-select";
import { SearchableMultiSelectPanel } from "@/components/ui/searchable-multi-select-panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { cn } from "@/lib/utils";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { TableColumnSettingsDialog, type ColumnDefItem } from "@/components/data-table/table-column-settings-dialog";
import { orderTypeLabel } from "@/lib/order-types";
import { filterSelectClassName } from "@/components/ui/filter-select";

type FilterOptions = {
  date_types: Array<{ id: string; label: string }>;
  statuses: Array<{ id: string; label: string }>;
  order_types: Array<{ id: string; label: string }>;
  agents: Array<{ id: number; name: string; code: string }>;
  supervisors: Array<{ id: number; name: string; code: string }>;
  categories: Array<{ id: number; name: string }>;
  product_groups: Array<{ id: number; name: string }>;
  segments: Array<{ id: number; name: string }>;
  brands: Array<{ id: number; name: string; code: string }>;
  products: Array<{ id: number; name: string; sku: string }>;
  warehouses: Array<{ id: number; name: string; code: string }>;
  trade_directions: Array<{ id: number; name: string; code: string }>;
  price_types: string[];
  price_type_options?: Array<{ id: string; label: string }>;
  payment_methods: Array<{ id: string; label: string }>;
  payment_type_columns: Array<{ key: string; label: string }>;
  territory_1: string[];
  territory_2: string[];
  territory_3: string[];
  territory_2_by_1?: Record<string, string[]>;
  territory_3_by_2?: Record<string, string[]>;
  territory_tree?: Array<{ zone: string; region: string; city: string }>;
  regions_by_zone?: Record<string, string[]>;
  cities_by_zone_region?: Record<string, string[]>;
};

type ReportRow = {
  row_number: number;
  product_id: number;
  name: string;
  sku: string;
  sell_code: string;
  category_name: string;
  block: string;
  qty: string;
  qty_bonus: string;
  volume_m3: string;
  total: string;
  bonus_total: string;
  akb: number;
  order_count: number;
  payments: Record<string, string>;
};

type ReportData = {
  period_from: string;
  period_to: string;
  date_type: string;
  page: number;
  limit: number;
  total: number;
  totals: {
    qty: string;
    qty_bonus: string;
    volume_m3: string;
    total: string;
    bonus_total: string;
    akb: number;
    order_count: number;
    payments: Record<string, string>;
  };
  rows: ReportRow[];
};

function money(v: string | number) {
  return formatNumberGrouped(v, { maxFractionDigits: 0 });
}

function num3(v: string | number) {
  return formatNumberGrouped(v, { maxFractionDigits: 3 });
}

const ORDER_TYPE_FALLBACK_IDS = ["order", "return", "exchange", "return_by_order", "partial_return"] as const;

/** Ixcham filtr tugmalari / select (2 qator pano) */
const FILTER_TRIGGER =
  "h-8 min-h-8 w-full min-w-0 max-w-none px-2 text-xs font-normal shadow-sm";

function buildFilterState(bounds: { from: string; to: string }) {
  return {
    date_type: "order_date" as "order_date" | "shipped_date" | "delivered_date",
    ...bounds,
    statuses: [] as string[],
    order_types: [] as string[],
    agent_ids: [] as string[],
    supervisor_ids: [] as string[],
    category_ids: [] as string[],
    product_group_ids: [] as string[],
    segment_ids: [] as string[],
    product_ids: [] as string[],
    brand_ids: [] as string[],
    trade_direction_ids: [] as string[],
    price_types: [] as string[],
    payment_methods: [] as string[],
    warehouse_id: "" as string,
    active_only: false,
    paid_orders_only: false,
    territory_1_list: [] as string[],
    territory_2_list: [] as string[],
    territory_3_list: [] as string[],
    sort_by: "name" as "name" | "total" | "qty",
    page: 1,
    limit: 50
  };
}

const STATIC_COLUMNS: ColumnDefItem[] = [
  { id: "row_number", label: "№" },
  { id: "sell_code", label: "SAP" },
  { id: "sku", label: "SKU" },
  { id: "name", label: "Название" },
  { id: "category_name", label: "Категория" },
  { id: "block", label: "Блок" },
  { id: "qty", label: "Кол-во" },
  { id: "qty_bonus", label: "Бонус кол-во" },
  { id: "volume_m3", label: "Объём м³" },
  { id: "total", label: "Сумма" },
  { id: "bonus_total", label: "Бонус сумма" },
  { id: "akb", label: "АКБ" },
  { id: "order_count", label: "Заказов" }
];

function collectPaymentKeys(rows: ReportRow[], totals: ReportData["totals"], catalog: FilterOptions["payment_type_columns"]) {
  const s = new Set<string>();
  for (const c of catalog ?? []) {
    if (c.key) s.add(c.key);
  }
  for (const k of Object.keys(totals.payments ?? {})) s.add(k);
  for (const r of rows) {
    for (const k of Object.keys(r.payments ?? {})) {
      if (Number(r.payments[k]) !== 0) s.add(k);
    }
  }
  return Array.from(s).sort((a, b) => a.localeCompare(b, "ru"));
}

export default function ReportProductSalesPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const today = new Date();
  const from0 = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const to0 = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  const dateAnchorRef = useRef<HTMLButtonElement>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const deferredSearch = useDeferredValue(tableSearch.trim());
  const [colDialogOpen, setColDialogOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState(STATIC_COLUMNS.map((c) => c.id));
  const [hiddenColumnIds, setHiddenColumnIds] = useState<Set<string>>(new Set());

  const [draft, setDraft] = useState(() => buildFilterState({ from: from0, to: to0 }));
  const [applied, setApplied] = useState(() => buildFilterState({ from: from0, to: to0 }));

  useEffect(() => {
    setApplied((a) => (a.page === 1 ? a : { ...a, page: 1 }));
  }, [deferredSearch]);

  const filtersQ = useQuery({
    queryKey: ["report-product-sales-filters", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: FilterOptions }>(
        `/api/${tenantSlug}/reports/product-sales/filter-options`
      );
      return data.data;
    }
  });

  const reportQ = useQuery({
    queryKey: ["report-product-sales", tenantSlug, applied, deferredSearch],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.report,
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set("from", applied.from);
      p.set("to", applied.to);
      p.set("date_type", applied.date_type);
      p.set("page", String(applied.page));
      p.set("limit", String(applied.limit));
      p.set("sort_by", applied.sort_by);
      if (deferredSearch) p.set("search", deferredSearch);
      if (applied.statuses.length) p.set("statuses", applied.statuses.join(","));
      if (applied.order_types.length) p.set("order_types", applied.order_types.join(","));
      if (applied.agent_ids.length) p.set("agent_ids", applied.agent_ids.join(","));
      if (applied.supervisor_ids.length) p.set("supervisor_ids", applied.supervisor_ids.join(","));
      if (applied.category_ids.length) p.set("category_ids", applied.category_ids.join(","));
      if (applied.product_group_ids.length) p.set("product_group_ids", applied.product_group_ids.join(","));
      if (applied.segment_ids.length) p.set("segment_ids", applied.segment_ids.join(","));
      if (applied.product_ids.length) p.set("product_ids", applied.product_ids.join(","));
      if (applied.brand_ids.length) p.set("brand_ids", applied.brand_ids.join(","));
      if (applied.trade_direction_ids.length) p.set("trade_direction_ids", applied.trade_direction_ids.join(","));
      if (applied.price_types.length) p.set("price_types", applied.price_types.join(","));
      if (applied.payment_methods.length) p.set("payment_methods", applied.payment_methods.join(","));
      if (applied.warehouse_id) p.set("warehouse_id", applied.warehouse_id);
      if (applied.active_only) p.set("active_only", "true");
      if (applied.paid_orders_only) p.set("paid_orders_only", "true");
      if (applied.territory_1_list.length) p.set("territory_1_list", applied.territory_1_list.join(","));
      if (applied.territory_2_list.length) p.set("territory_2_list", applied.territory_2_list.join(","));
      if (applied.territory_3_list.length) p.set("territory_3_list", applied.territory_3_list.join(","));
      const { data } = await api.get<{ data: ReportData }>(`/api/${tenantSlug}/reports/product-sales?${p.toString()}`);
      return data.data;
    }
  });

  const opts = filtersQ.data;
  const payLabelByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const x of opts?.payment_type_columns ?? []) {
      m.set(x.key, x.label);
    }
    for (const x of opts?.payment_methods ?? []) {
      m.set(x.id, x.label);
    }
    return m;
  }, [opts?.payment_methods, opts?.payment_type_columns]);

  const paymentKeys = useMemo(() => {
    const rows = reportQ.data?.rows ?? [];
    const totals = reportQ.data?.totals;
    if (!totals) return collectPaymentKeys([], { qty: "0", qty_bonus: "0", volume_m3: "0", total: "0", bonus_total: "0", akb: 0, order_count: 0, payments: {} }, opts?.payment_type_columns ?? []);
    return collectPaymentKeys(rows, totals, opts?.payment_type_columns ?? []);
  }, [reportQ.data?.rows, reportQ.data?.totals, opts?.payment_type_columns]);

  const allColumns: ColumnDefItem[] = useMemo(() => {
    const payCols = paymentKeys.map((k) => ({ id: `pay:${k}`, label: payLabelByKey.get(k) ?? k }));
    return [...STATIC_COLUMNS, ...payCols];
  }, [paymentKeys, payLabelByKey]);

  useEffect(() => {
    const staticIds = new Set(STATIC_COLUMNS.map((c) => c.id));
    const payIds = new Set(paymentKeys.map((k) => `pay:${k}`));
    setColumnOrder((prev) => {
      const next = prev.filter((id) => staticIds.has(id) || payIds.has(id));
      for (const c of allColumns) {
        if (!next.includes(c.id)) next.push(c.id);
      }
      return next;
    });
    setHiddenColumnIds((prev) => {
      const n = new Set<string>();
      for (const id of Array.from(prev)) {
        if (staticIds.has(id) || payIds.has(id)) n.add(id);
      }
      return n;
    });
  }, [allColumns, paymentKeys]);

  const visibleCols = columnOrder.filter((id) => !hiddenColumnIds.has(id));

  /** Zona — tenant `territory_nodes` yoki mijozlar `zone` manbasi */
  const territory1Items = (opts?.territory_1 ?? []).map((x) => ({ id: x, title: x }));

  /** Oblast — tanlangan zonaga qarab `regions_by_zone` / `territory_2_by_1` */
  const territory2Items = useMemo(() => {
    const zone = draft.territory_1_list[0] ?? "";
    if (!zone) {
      return (opts?.territory_2 ?? []).map((x) => ({ id: x, title: x }));
    }
    const byZone =
      opts?.regions_by_zone?.[zone] ??
      opts?.territory_2_by_1?.[zone] ??
      [];
    return byZone.map((x) => ({ id: x, title: x }));
  }, [draft.territory_1_list, opts?.regions_by_zone, opts?.territory_2_by_1, opts?.territory_2]);

  /** Gorod — zona + viloyat bo‘yicha `cities_by_zone_region` */
  const territory3Items = useMemo(() => {
    const zone = draft.territory_1_list[0] ?? "";
    const region = draft.territory_2_list[0] ?? "";
    if (!region) {
      return (opts?.territory_3 ?? []).map((x) => ({ id: x, title: x }));
    }
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
    if (cities.length === 0) {
      cities = [...(opts?.territory_3 ?? [])];
    }
    cities = Array.from(new Set(cities)).sort((a, b) => a.localeCompare(b, "ru"));
    return cities.map((x) => ({ id: x, title: x }));
  }, [
    draft.territory_1_list,
    draft.territory_2_list,
    opts?.cities_by_zone_region,
    opts?.territory_tree,
    opts?.territory_3
  ]);

  const statusItems = (opts?.statuses ?? []).map((x) => ({ id: x.id, title: x.label }));
  const orderTypeItems = useMemo(() => {
    const fromApi = opts?.order_types ?? [];
    const ids = Array.from(
      new Set([...ORDER_TYPE_FALLBACK_IDS, ...fromApi.map((x) => String(x.id).trim()).filter(Boolean)])
    ).sort((a, b) => a.localeCompare(b, "ru"));
    return ids.map((id) => ({
      id,
      title: fromApi.find((o) => String(o.id) === id)?.label ?? orderTypeLabel(id)
    }));
  }, [opts?.order_types]);
  const agentItems = (opts?.agents ?? []).map((x) => ({
    id: String(x.id),
    title: `${x.name}${x.code ? ` (${x.code})` : ""}`
  }));
  const supervisorItems = (opts?.supervisors ?? []).map((x) => ({
    id: String(x.id),
    title: `${x.name}${x.code ? ` (${x.code})` : ""}`
  }));
  const categoryItems = (opts?.categories ?? []).map((x) => ({ id: String(x.id), title: x.name }));
  const groupItems = (opts?.product_groups ?? []).map((x) => ({ id: String(x.id), title: x.name }));
  const segmentItems = (opts?.segments ?? []).map((x) => ({ id: String(x.id), title: x.name }));
  const tradeDirItems = (opts?.trade_directions ?? []).map((x) => ({
    id: String(x.id),
    title: x.code ? `${x.name} (${x.code})` : x.name
  }));
  const priceTypeItems = opts?.price_type_options?.length
    ? opts.price_type_options.map((x) => ({ id: x.id, title: x.label }))
    : (opts?.price_types ?? []).map((x) => ({ id: x, title: x }));
  const paymentMethodItems = (opts?.payment_methods ?? []).map((x) => ({ id: x.id, title: x.label }));
  const brandItems = (opts?.brands ?? []).map((x) => ({
    id: String(x.id),
    title: `${x.name}${x.code ? ` (${x.code})` : ""}`
  }));
  const productItems = (opts?.products ?? []).map((x) => ({
    id: String(x.id),
    title: `${x.name} (${x.sku})`
  }));

  const listRows = reportQ.data?.rows ?? [];
  const totalPages = reportQ.data ? Math.max(1, Math.ceil(reportQ.data.total / reportQ.data.limit)) : 1;

  const applyDraft = (page = 1) => {
    setApplied({ ...draft, page });
  };

  const searchParamsForExport = () => {
    const p = new URLSearchParams();
    p.set("from", applied.from);
    p.set("to", applied.to);
    p.set("date_type", applied.date_type);
    p.set("sort_by", applied.sort_by);
    if (tableSearch.trim()) p.set("search", tableSearch.trim());
    if (applied.statuses.length) p.set("statuses", applied.statuses.join(","));
    if (applied.order_types.length) p.set("order_types", applied.order_types.join(","));
    if (applied.agent_ids.length) p.set("agent_ids", applied.agent_ids.join(","));
    if (applied.supervisor_ids.length) p.set("supervisor_ids", applied.supervisor_ids.join(","));
    if (applied.category_ids.length) p.set("category_ids", applied.category_ids.join(","));
    if (applied.product_group_ids.length) p.set("product_group_ids", applied.product_group_ids.join(","));
    if (applied.segment_ids.length) p.set("segment_ids", applied.segment_ids.join(","));
    if (applied.product_ids.length) p.set("product_ids", applied.product_ids.join(","));
    if (applied.brand_ids.length) p.set("brand_ids", applied.brand_ids.join(","));
    if (applied.trade_direction_ids.length) p.set("trade_direction_ids", applied.trade_direction_ids.join(","));
    if (applied.price_types.length) p.set("price_types", applied.price_types.join(","));
    if (applied.payment_methods.length) p.set("payment_methods", applied.payment_methods.join(","));
    if (applied.warehouse_id) p.set("warehouse_id", applied.warehouse_id);
    if (applied.active_only) p.set("active_only", "true");
    if (applied.paid_orders_only) p.set("paid_orders_only", "true");
    if (applied.territory_1_list.length) p.set("territory_1_list", applied.territory_1_list.join(","));
    if (applied.territory_2_list.length) p.set("territory_2_list", applied.territory_2_list.join(","));
    if (applied.territory_3_list.length) p.set("territory_3_list", applied.territory_3_list.join(","));
    return p;
  };

  const downloadExcel = async () => {
    if (!tenantSlug) return;
    setExporting(true);
    try {
      const p = searchParamsForExport();
      const res = await api.get<Blob>(`/api/${tenantSlug}/reports/product-sales/export?${p.toString()}`, {
        responseType: "blob"
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "prodazhi-po-tovaram.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const cellValue = (r: ReportRow | null, colId: string, totals: ReportData["totals"] | undefined): string => {
    if (colId.startsWith("pay:")) {
      const k = colId.slice(4);
      if (!r) return money(totals?.payments?.[k] ?? "0");
      return money(r.payments?.[k] ?? "0");
    }
    if (!r) {
      if (!totals) return "—";
      if (colId === "row_number") return "Итого";
      if (colId === "qty") return num3(totals.qty);
      if (colId === "qty_bonus") return num3(totals.qty_bonus);
      if (colId === "volume_m3") return num3(totals.volume_m3);
      if (colId === "total") return money(totals.total);
      if (colId === "bonus_total") return money(totals.bonus_total);
      if (colId === "akb") return String(totals.akb);
      if (colId === "order_count") return String(totals.order_count);
      return "";
    }
    switch (colId) {
      case "row_number":
        return String(r.row_number);
      case "sell_code":
        return r.sell_code || "—";
      case "sku":
        return r.sku;
      case "name":
        return r.name;
      case "category_name":
        return r.category_name || "—";
      case "block":
        return r.block || "—";
      case "qty":
        return num3(r.qty);
      case "qty_bonus":
        return num3(r.qty_bonus);
      case "volume_m3":
        return num3(r.volume_m3);
      case "total":
        return money(r.total);
      case "bonus_total":
        return money(r.bonus_total);
      case "akb":
        return String(r.akb);
      case "order_count":
        return String(r.order_count);
      default:
        return "—";
    }
  };

  const colAlign = (colId: string) => {
    if (
      colId === "qty" ||
      colId === "qty_bonus" ||
      colId === "volume_m3" ||
      colId === "total" ||
      colId === "bonus_total" ||
      colId === "akb" ||
      colId === "order_count" ||
      colId.startsWith("pay:")
    ) {
      return "text-right tabular-nums";
    }
    if (colId === "row_number") return "tabular-nums w-10";
    return "";
  };

  if (!hydrated || !tenantSlug) return <p className="text-sm text-muted-foreground">Загрузка...</p>;

  const totals = reportQ.data?.totals;
  const periodBtn = formatDateRangeButton(draft.from, draft.to);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-lg font-semibold">Продажи по товарам</h1>
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

      <DateRangePopover
        open={dateOpen}
        onOpenChange={setDateOpen}
        anchorRef={dateAnchorRef}
        dateFrom={draft.from}
        dateTo={draft.to}
        onApply={({ dateFrom, dateTo }) => setDraft((d) => ({ ...d, from: dateFrom, to: dateTo, page: 1 }))}
      />

      {showFilters ? (
        <div className="space-y-2 rounded border bg-card p-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="shrink-0 font-medium text-muted-foreground">Дата применяется по</span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
              {(opts?.date_types ?? [
                { id: "order_date", label: "Дата заказа" },
                { id: "shipped_date", label: "Дата отправки" },
                { id: "delivered_date", label: "Дата доставки" }
              ]).map((dt) => (
                <label key={dt.id} className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap">
                  <input
                    type="radio"
                    className="accent-primary"
                    name="ps-date-type"
                    checked={draft.date_type === dt.id}
                    onChange={() => setDraft((d) => ({ ...d, date_type: dt.id as typeof d.date_type, page: 1 }))}
                  />
                  <span>{dt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 16 filtr: 8 + 8 (xl ekranda 2 qator) */}
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            <MultiFilter
              compact
              placeholder="Статус"
              items={statusItems}
              selectedValues={draft.statuses}
              onChange={(v) => setDraft((d) => ({ ...d, statuses: v }))}
              searchPlaceholder="Статус"
            />
            <MultiFilter
              compact
              placeholder="Тип документа"
              items={orderTypeItems}
              selectedValues={draft.order_types}
              onChange={(v) => setDraft((d) => ({ ...d, order_types: v }))}
              searchPlaceholder="Тип"
            />
            <MultiFilter
              compact
              placeholder="Агент"
              items={agentItems}
              selectedValues={draft.agent_ids}
              onChange={(v) => setDraft((d) => ({ ...d, agent_ids: v }))}
              searchPlaceholder="Агент"
            />
            <MultiFilter
              compact
              placeholder="Супервайзер"
              items={supervisorItems}
              selectedValues={draft.supervisor_ids}
              onChange={(v) => setDraft((d) => ({ ...d, supervisor_ids: v }))}
              searchPlaceholder="Супервайзер"
            />
            <MultiFilter
              compact
              placeholder="Категория"
              items={categoryItems}
              selectedValues={draft.category_ids}
              onChange={(v) => setDraft((d) => ({ ...d, category_ids: v }))}
              searchPlaceholder="Категория"
            />
            <MultiFilter
              compact
              placeholder="Группа товаров"
              items={groupItems}
              selectedValues={draft.product_group_ids}
              onChange={(v) => setDraft((d) => ({ ...d, product_group_ids: v }))}
              searchPlaceholder="Группа"
            />
            <MultiFilter
              compact
              placeholder="Сегмент"
              items={segmentItems}
              selectedValues={draft.segment_ids}
              onChange={(v) => setDraft((d) => ({ ...d, segment_ids: v }))}
              searchPlaceholder="Сегмент"
            />
            <MultiFilter
              compact
              placeholder="Направление торговли"
              items={tradeDirItems}
              selectedValues={draft.trade_direction_ids}
              onChange={(v) => setDraft((d) => ({ ...d, trade_direction_ids: v }))}
              searchPlaceholder="Направление"
            />
            <MultiFilter
              compact
              placeholder="Тип цены (агент)"
              items={priceTypeItems}
              selectedValues={draft.price_types}
              onChange={(v) => setDraft((d) => ({ ...d, price_types: v }))}
              searchPlaceholder="Тип цены"
            />
            <MultiFilter
              compact
              placeholder="Способ оплаты (заказ)"
              items={paymentMethodItems}
              selectedValues={draft.payment_methods}
              onChange={(v) => setDraft((d) => ({ ...d, payment_methods: v }))}
              searchPlaceholder="Оплата"
            />
            <FilterSelect
              emptyLabel="Все склады"
              className={cn(filterSelectClassName, FILTER_TRIGGER)}
              value={draft.warehouse_id}
              onChange={(e) => setDraft((d) => ({ ...d, warehouse_id: e.target.value }))}
            >
              {(opts?.warehouses ?? []).map((w) => (
                <option key={w.id} value={String(w.id)}>
                  {w.name}
                </option>
              ))}
            </FilterSelect>
            <MultiFilter
              compact
              placeholder="Название"
              items={productItems}
              selectedValues={draft.product_ids}
              onChange={(v) => setDraft((d) => ({ ...d, product_ids: v }))}
              searchPlaceholder="Товар, SKU"
            />
            <MultiFilter
              compact
              placeholder="Бренд"
              items={brandItems}
              selectedValues={draft.brand_ids}
              onChange={(v) => setDraft((d) => ({ ...d, brand_ids: v }))}
              searchPlaceholder="Бренд"
            />
            <MultiFilter
              compact
              placeholder="Зона"
              items={territory1Items}
              selectedValues={draft.territory_1_list}
              onChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  territory_1_list: v.slice(0, 1),
                  territory_2_list: [],
                  territory_3_list: []
                }))
              }
              searchPlaceholder="Зона"
            />
            <MultiFilter
              compact
              placeholder="Область"
              items={territory2Items}
              selectedValues={draft.territory_2_list}
              onChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  territory_2_list: v.slice(0, 1),
                  territory_3_list: []
                }))
              }
              searchPlaceholder="Область"
            />
            <MultiFilter
              compact
              placeholder="Город"
              items={territory3Items}
              selectedValues={draft.territory_3_list}
              onChange={(v) => setDraft((d) => ({ ...d, territory_3_list: v.slice(0, 1) }))}
              searchPlaceholder="Город"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-1.5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <label className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={draft.paid_orders_only}
                  onChange={(e) => setDraft((d) => ({ ...d, paid_orders_only: e.target.checked }))}
                />
                Только оплаченные заказы
              </label>
              <label className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={draft.active_only}
                  onChange={(e) => setDraft((d) => ({ ...d, active_only: e.target.checked }))}
                />
                Только активные товары
              </label>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
              <Button variant="outline" size="sm" className="h-8 text-xs" type="button" onClick={() => {
                const reset = buildFilterState({ from: from0, to: to0 });
                setTableSearch("");
                setDraft(reset);
                setApplied(reset);
              }}>
                Сброс
              </Button>
              <Button size="sm" className="h-8 text-xs" type="button" onClick={() => applyDraft(1)}>
                Применить
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-start gap-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setColDialogOpen(true)}>
              <ListOrdered className="mr-1 h-4 w-4" />
              Колонки
            </Button>
            <Button
              variant="outline"
              size="icon"
              type="button"
              title={showFilters ? "Скрыть фильтры" : "Показать фильтры"}
              onClick={() => setShowFilters((v) => !v)}
            >
              <Filter className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" type="button" onClick={() => void reportQ.refetch()}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <select
              title="Сортировка"
              className={cn(filterSelectClassName, "h-8 min-w-[9rem] max-w-[11rem] text-xs")}
              value={applied.sort_by}
              onChange={(e) => {
                const sort_by = e.target.value as typeof applied.sort_by;
                const next = { ...applied, sort_by, page: 1 };
                setDraft((d) => ({ ...d, sort_by, page: 1 }));
                setApplied(next);
              }}
              aria-label="Сортировка"
            >
              <option value="name">По названию</option>
              <option value="total">По сумме</option>
              <option value="qty">По количеству</option>
            </select>
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              value={String(applied.limit)}
              onChange={(e) => {
                const limit = Number.parseInt(e.target.value, 10) || 50;
                const next = { ...applied, limit, page: 1 };
                setDraft((d) => ({ ...d, limit, page: 1 }));
                setApplied(next);
              }}
            >
              {[20, 50, 100, 200].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <div className="relative min-w-[160px] flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 pl-8 text-sm"
                placeholder="Поиск по названию, SKU, SAP"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
              />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void downloadExcel()} disabled={exporting}>
            <FileSpreadsheet className="mr-1 h-4 w-4" />
            Excel
          </Button>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[960px] text-xs">
            <thead className="app-table-thead">
              <tr>
                {visibleCols.map((colId) => (
                  <th key={colId} className={cn("whitespace-nowrap px-2 py-2 text-left", colAlign(colId) && "text-right")}>
                    {allColumns.find((c) => c.id === colId)?.label ?? colId}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listRows.map((r) => (
                <tr key={r.product_id} className="border-t">
                  {visibleCols.map((colId) => (
                    <td key={`${r.product_id}-${colId}`} className={cn("px-2 py-2", colAlign(colId))}>
                      {cellValue(r, colId, totals)}
                    </td>
                  ))}
                </tr>
              ))}
              {totals && visibleCols.length > 0 ? (
                <tr className="border-t bg-muted/40 font-medium">
                  {visibleCols.map((colId) => (
                    <td key={`tot-${colId}`} className={cn("px-2 py-2", colAlign(colId))}>
                      {cellValue(null, colId, totals)}
                    </td>
                  ))}
                </tr>
              ) : null}
              {!reportQ.isLoading && listRows.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(1, visibleCols.length)} className="px-3 py-4 text-muted-foreground">
                    Нет данных
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            {(() => {
              const total = reportQ.data?.total ?? 0;
              if (total === 0) return "Показано 0 / 0";
              const fromN = (applied.page - 1) * applied.limit + 1;
              const toN = Math.min(applied.page * applied.limit, total);
              return `Показано ${fromN} – ${toN} / ${total}`;
            })()}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={applied.page <= 1}
              onClick={() => {
                const n = Math.max(1, applied.page - 1);
                setDraft((d) => ({ ...d, page: n }));
                setApplied((d) => ({ ...d, page: n }));
              }}
            >
              Назад
            </Button>
            <span>
              {applied.page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={applied.page >= totalPages}
              onClick={() => {
                const n = Math.min(totalPages, applied.page + 1);
                setDraft((d) => ({ ...d, page: n }));
                setApplied((d) => ({ ...d, page: n }));
              }}
            >
              Вперёд
            </Button>
          </div>
        </div>
      </div>

      <TableColumnSettingsDialog
        open={colDialogOpen}
        onOpenChange={setColDialogOpen}
        title="Колонки: Продажи по товарам"
        description="Видимость и порядок столбцов (включая типы оплат)."
        columns={allColumns}
        columnOrder={columnOrder}
        hiddenColumnIds={hiddenColumnIds}
        onSave={(next) => {
          setColumnOrder(next.columnOrder);
          setHiddenColumnIds(new Set(next.hiddenColumnIds));
        }}
        onReset={() => {
          setColumnOrder(STATIC_COLUMNS.map((c) => c.id));
          setHiddenColumnIds(new Set());
        }}
      />
    </div>
  );
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
  /** Ixcham trigger (2 qator filtr pano) */
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
