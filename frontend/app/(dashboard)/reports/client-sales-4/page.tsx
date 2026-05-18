"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
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
import { MonthYearPickerPopover, formatReportPeriodButtonRu } from "@/components/ui/month-year-picker-popover";
import { TableColumnSettingsDialog, type ColumnDefItem } from "@/components/data-table/table-column-settings-dialog";

type FilterOptions = {
  statuses: Array<{ id: string; label: string }>;
  order_types: Array<{ id: string; label: string }>;
  agents: Array<{ id: number; name: string; code: string }>;
  categories: Array<{ id: number; name: string }>;
  brands: Array<{ id: number; name: string; code: string }>;
  trade_directions: Array<{ id: number; name: string; code: string }>;
  client_categories: string[];
  territory_1: string[];
  territory_2: string[];
  territory_3: string[];
  territory_tree?: Array<{ zone: string; region: string; city: string }>;
  regions_by_zone?: Record<string, string[]>;
  cities_by_zone_region?: Record<string, string[]>;
};

type ClientRefs = {
  zones?: string[];
  regions?: string[];
  cities?: string[];
  region_options?: Array<{ value?: string; label?: string }>;
  city_options?: Array<{ value?: string; label?: string }>;
};

type ReportRow = {
  client_id: number;
  client_name: string;
  agent_name: string;
  agent_code: string;
  territory: string;
  amount: string;
};

type ReportData = {
  period_from: string;
  period_to: string;
  akb: number;
  total_amount: string;
  clients: ReportRow[];
  page: number;
  limit: number;
  total: number;
};

function money(v: string | number) {
  return formatNumberGrouped(v, { maxFractionDigits: 0 });
}

function monthBounds(ym: string): { from: string; to: string } {
  const [ys, ms] = ym.split("-");
  const y = Number.parseInt(ys ?? "", 10);
  const m = Number.parseInt(ms ?? "", 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    const t = new Date();
    const from = new Date(t.getFullYear(), t.getMonth(), 1).toISOString().slice(0, 10);
    const to = new Date(t.getFullYear(), t.getMonth() + 1, 0).toISOString().slice(0, 10);
    return { from, to };
  }
  const from = new Date(y, m - 1, 1).toISOString().slice(0, 10);
  const to = new Date(y, m, 0).toISOString().slice(0, 10);
  return { from, to };
}

function defaultYearMonth(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
}

function anchorYmFromFromIso(fromIso: string): string {
  const s = (fromIso ?? "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0, 7);
  return defaultYearMonth();
}

function buildFilterState(bounds: { from: string; to: string }) {
  return {
    ...bounds,
    statuses: [] as string[],
    order_types: [] as string[],
    agent_ids: [] as string[],
    category_ids: [] as string[],
    client_categories: [] as string[],
    trade_direction_ids: [] as string[],
    brand_ids: [] as string[],
    consignment: "all" as "all" | "yes" | "no",
    territory_1_list: [] as string[],
    territory_2_list: [] as string[],
    territory_3_list: [] as string[],
    only_with_value: false,
    page: 1,
    limit: 10
  };
}

const ORDER_TYPE_FALLBACK_IDS = ["order", "return", "exchange", "return_by_order", "partial_return"] as const;

function orderTypeLabelRu(id: string) {
  if (id === "order") return "Заказ";
  if (id === "return") return "Возврат с полки";
  if (id === "exchange") return "Обмен";
  if (id === "return_by_order") return "Возврат по заказу";
  if (id === "partial_return") return "Частичный возврат";
  return id;
}

const CLIENT_COLUMNS: ColumnDefItem[] = [
  { id: "client_name", label: "Клиенты" },
  { id: "client_id", label: "Ид клиента" },
  { id: "agent_name", label: "Агенты" },
  { id: "agent_code", label: "Код агента" },
  { id: "territory", label: "Территория" },
  { id: "amount", label: "Сумма" }
];

export default function ReportClientSales4Page() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const ym0 = defaultYearMonth();
  const b0 = monthBounds(ym0);

  const monthAnchorRef = useRef<HTMLButtonElement>(null);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const deferredSearch = useDeferredValue(tableSearch.trim());
  const [clientColumnDialogOpen, setClientColumnDialogOpen] = useState(false);
  const [clientColumnOrder, setClientColumnOrder] = useState(CLIENT_COLUMNS.map((c) => c.id));
  const [clientHiddenColumnIds, setClientHiddenColumnIds] = useState<Set<string>>(new Set());

  const [draft, setDraft] = useState(() => buildFilterState(b0));
  const [applied, setApplied] = useState(() => buildFilterState(b0));

  useEffect(() => {
    setApplied((a) => (a.page === 1 ? a : { ...a, page: 1 }));
  }, [deferredSearch]);

  const filtersQ = useQuery({
    queryKey: ["report-client-sales-4-filters", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: FilterOptions }>(`/api/${tenantSlug}/reports/client-sales-4/filter-options`);
      return data.data;
    }
  });

  const clientRefsQ = useQuery({
    queryKey: ["clients-references", tenantSlug, "report-client-sales-4"],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<ClientRefs>(`/api/${tenantSlug}/clients/references`);
      return data;
    }
  });

  const reportQ = useQuery({
    queryKey: ["report-client-sales-4", tenantSlug, applied, deferredSearch],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.report,
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set("from", applied.from);
      p.set("to", applied.to);
      p.set("page", String(applied.page));
      p.set("limit", String(applied.limit));
      if (deferredSearch) p.set("search", deferredSearch);
      if (applied.statuses.length) p.set("statuses", applied.statuses.join(","));
      if (applied.order_types.length) p.set("order_types", applied.order_types.join(","));
      if (applied.agent_ids.length) p.set("agent_ids", applied.agent_ids.join(","));
      if (applied.category_ids.length) p.set("category_ids", applied.category_ids.join(","));
      if (applied.client_categories.length) p.set("client_categories", applied.client_categories.join(","));
      if (applied.trade_direction_ids.length) p.set("trade_direction_ids", applied.trade_direction_ids.join(","));
      if (applied.brand_ids.length) p.set("brand_ids", applied.brand_ids.join(","));
      if (applied.consignment !== "all") p.set("consignment", applied.consignment);
      if (applied.territory_1_list.length) p.set("territory_1_list", applied.territory_1_list.join(","));
      if (applied.territory_2_list.length) p.set("territory_2_list", applied.territory_2_list.join(","));
      if (applied.territory_3_list.length) p.set("territory_3_list", applied.territory_3_list.join(","));
      if (applied.only_with_value) p.set("only_with_value", "true");
      const { data } = await api.get<{ data: ReportData }>(`/api/${tenantSlug}/reports/client-sales-4?${p.toString()}`);
      return data.data;
    }
  });

  const opts = filtersQ.data;
  const refRegions = (clientRefsQ.data?.region_options ?? [])
    .map((x) => String(x?.label ?? x?.value ?? "").trim())
    .filter(Boolean);
  const refCities = (clientRefsQ.data?.city_options ?? [])
    .map((x) => String(x?.label ?? x?.value ?? "").trim())
    .filter(Boolean);

  const territory1Source = (clientRefsQ.data?.zones?.length ? clientRefsQ.data?.zones : opts?.territory_1) ?? [];
  const territory1Items = territory1Source.map((x) => ({ id: x, title: x }));

  const territory2Items = useMemo(() => {
    const zone = draft.territory_1_list[0] ?? "";
    if (!zone) {
      const source = (clientRefsQ.data?.regions?.length ? clientRefsQ.data?.regions : refRegions.length ? refRegions : opts?.territory_2) ?? [];
      return source.map((x) => ({ id: x, title: x }));
    }
    const regions = opts?.regions_by_zone?.[zone] ?? [];
    return regions.map((x) => ({ id: x, title: x }));
  }, [draft.territory_1_list, clientRefsQ.data?.regions, opts?.regions_by_zone, opts?.territory_2, refRegions]);

  const territory3Items = useMemo(() => {
    const zone = draft.territory_1_list[0] ?? "";
    const region = draft.territory_2_list[0] ?? "";
    if (!region) {
      const source = (clientRefsQ.data?.cities?.length ? clientRefsQ.data?.cities : refCities.length ? refCities : opts?.territory_3) ?? [];
      return source.map((x) => ({ id: x, title: x }));
    }
    let cities = opts?.cities_by_zone_region?.[`${zone}|||${region}`] ?? [];
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
      const fromRefs = clientRefsQ.data?.cities ?? [];
      const fromRefOptions = refCities;
      const fromOpts = opts?.territory_3 ?? [];
      cities = [...fromRefs, ...fromRefOptions, ...fromOpts];
    }
    cities = Array.from(new Set(cities)).sort((a, b) => a.localeCompare(b, "ru"));
    return cities.map((x) => ({ id: x, title: x }));
  }, [
    draft.territory_1_list,
    draft.territory_2_list,
    clientRefsQ.data?.cities,
    opts?.cities_by_zone_region,
    opts?.territory_tree,
    opts?.territory_3,
    refCities
  ]);

  const statusItems = (opts?.statuses ?? []).map((x) => ({ id: x.id, title: x.label }));
  const orderTypeItems = useMemo(() => {
    const fromApi = opts?.order_types ?? [];
    const ids = Array.from(
      new Set([...ORDER_TYPE_FALLBACK_IDS, ...fromApi.map((x) => String(x.id).trim()).filter(Boolean)])
    ).sort((a, b) => a.localeCompare(b, "ru"));
    return ids.map((id) => ({
      id,
      title: fromApi.find((o) => String(o.id) === id)?.label ?? orderTypeLabelRu(id)
    }));
  }, [opts?.order_types]);
  const agentItems = (opts?.agents ?? []).map((x) => ({ id: String(x.id), title: `${x.name}${x.code ? ` (${x.code})` : ""}` }));
  const categoryItems = (opts?.categories ?? []).map((x) => ({ id: String(x.id), title: x.name }));
  const brandItems = (opts?.brands ?? []).map((x) => ({ id: String(x.id), title: `${x.name}${x.code ? ` (${x.code})` : ""}` }));
  const tradeDirItems = (opts?.trade_directions ?? []).map((x) => ({
    id: String(x.id),
    title: x.code ? `${x.name} (${x.code})` : x.name
  }));
  const clientCategoryItems = (opts?.client_categories ?? []).map((x) => ({ id: x, title: x }));

  const listRows = reportQ.data?.clients ?? [];
  const totalPages = reportQ.data ? Math.max(1, Math.ceil(reportQ.data.total / reportQ.data.limit)) : 1;
  const visibleClientCols = clientColumnOrder.filter((id) => !clientHiddenColumnIds.has(id));

  const applyDraft = (page = 1) => {
    setApplied({ ...draft, page });
  };

  const downloadExcel = async () => {
    if (!tenantSlug) return;
    setExporting(true);
    try {
      const p = new URLSearchParams();
      p.set("from", applied.from);
      p.set("to", applied.to);
      if (applied.statuses.length) p.set("statuses", applied.statuses.join(","));
      if (applied.order_types.length) p.set("order_types", applied.order_types.join(","));
      if (applied.agent_ids.length) p.set("agent_ids", applied.agent_ids.join(","));
      if (applied.category_ids.length) p.set("category_ids", applied.category_ids.join(","));
      if (applied.client_categories.length) p.set("client_categories", applied.client_categories.join(","));
      if (applied.trade_direction_ids.length) p.set("trade_direction_ids", applied.trade_direction_ids.join(","));
      if (applied.brand_ids.length) p.set("brand_ids", applied.brand_ids.join(","));
      if (applied.consignment !== "all") p.set("consignment", applied.consignment);
      if (applied.territory_1_list.length) p.set("territory_1_list", applied.territory_1_list.join(","));
      if (applied.territory_2_list.length) p.set("territory_2_list", applied.territory_2_list.join(","));
      if (applied.territory_3_list.length) p.set("territory_3_list", applied.territory_3_list.join(","));
      if (applied.only_with_value) p.set("only_with_value", "true");
      const s = tableSearch.trim();
      if (s) p.set("search", s);
      p.set("export_limit", "5000");
      const res = await api.get<Blob>(`/api/${tenantSlug}/reports/client-sales-4/export?${p.toString()}`, {
        responseType: "blob"
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "prodazhi-po-klientam-4.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  if (!hydrated || !tenantSlug) return <p className="text-sm text-muted-foreground">Загрузка...</p>;

  const periodLabel = formatReportPeriodButtonRu(applied.from, applied.to);
  const akb = reportQ.data?.akb ?? 0;
  const totalAmt = reportQ.data?.total_amount ?? "0";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-lg font-semibold">Продажи по клиентам 4</h1>
        <button
          ref={monthAnchorRef}
          type="button"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "h-9 shrink-0 gap-2 font-normal",
            monthPickerOpen && "border-primary/60 bg-primary/5"
          )}
          aria-expanded={monthPickerOpen}
          aria-haspopup="dialog"
          onClick={() => setMonthPickerOpen((o) => !o)}
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium tabular-nums">{formatReportPeriodButtonRu(draft.from, draft.to)}</span>
        </button>
      </div>
      <MonthYearPickerPopover
        open={monthPickerOpen}
        onOpenChange={setMonthPickerOpen}
        anchorRef={monthAnchorRef}
        value={anchorYmFromFromIso(draft.from)}
        layout="salesdoc"
        onSaveDateRange={({ from, to }) => {
          setDraft((d) => ({ ...d, from, to, page: 1 }));
        }}
      />

      {showFilters ? (
      <div className="space-y-2 rounded border bg-card p-3">
        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
          <MultiFilter placeholder="Статус" items={statusItems} selectedValues={draft.statuses} onChange={(v) => setDraft((d) => ({ ...d, statuses: v }))} searchPlaceholder="Поиск статуса" />
          <MultiFilter placeholder="Тип" items={orderTypeItems} selectedValues={draft.order_types} onChange={(v) => setDraft((d) => ({ ...d, order_types: v }))} searchPlaceholder="Поиск типа" />
          <MultiFilter placeholder="Агент" items={agentItems} selectedValues={draft.agent_ids} onChange={(v) => setDraft((d) => ({ ...d, agent_ids: v }))} searchPlaceholder="Поиск агента" />
          <MultiFilter placeholder="Категория продукта" items={categoryItems} selectedValues={draft.category_ids} onChange={(v) => setDraft((d) => ({ ...d, category_ids: v }))} searchPlaceholder="Поиск категории" />
          <MultiFilter placeholder="Категория клиента" items={clientCategoryItems} selectedValues={draft.client_categories} onChange={(v) => setDraft((d) => ({ ...d, client_categories: v }))} searchPlaceholder="Поиск" />
          <MultiFilter placeholder="Направление торговли" items={tradeDirItems} selectedValues={draft.trade_direction_ids} onChange={(v) => setDraft((d) => ({ ...d, trade_direction_ids: v }))} searchPlaceholder="Поиск" />
          <MultiFilter placeholder="Бренд" items={brandItems} selectedValues={draft.brand_ids} onChange={(v) => setDraft((d) => ({ ...d, brand_ids: v }))} searchPlaceholder="Поиск бренда" />
          <FilterSelect emptyLabel="Консигнация" value={draft.consignment} onChange={(e) => setDraft((d) => ({ ...d, consignment: e.target.value as "all" | "yes" | "no" }))}>
            <option value="all">Все</option>
            <option value="yes">Да</option>
            <option value="no">Нет</option>
          </FilterSelect>
          <MultiFilter placeholder="Территория 1" items={territory1Items} selectedValues={draft.territory_1_list} onChange={(v) => setDraft((d) => ({ ...d, territory_1_list: v.slice(0, 1), territory_2_list: [], territory_3_list: [] }))} searchPlaceholder="Поиск зоны" />
          <MultiFilter placeholder="Территория 2" items={territory2Items} selectedValues={draft.territory_2_list} onChange={(v) => setDraft((d) => ({ ...d, territory_2_list: v.slice(0, 1), territory_3_list: [] }))} searchPlaceholder="Поиск области" />
          <MultiFilter placeholder="Территория 3" items={territory3Items} selectedValues={draft.territory_3_list} onChange={(v) => setDraft((d) => ({ ...d, territory_3_list: v.slice(0, 1) }))} searchPlaceholder="Поиск города" />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-2">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              size="icon"
              type="button"
              onClick={() => {
                const b = monthBounds(defaultYearMonth());
                const reset = buildFilterState(b);
                setTableSearch("");
                setShowFilters(true);
                setClientColumnOrder(CLIENT_COLUMNS.map((c) => c.id));
                setClientHiddenColumnIds(new Set());
                setDraft(reset);
                setApplied(reset);
              }}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              onClick={() => {
                applyDraft(1);
              }}
              className="h-9"
            >
              Применить
            </Button>
          </div>
        </div>
      </div>
      ) : null}

      <div className="rounded border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-start gap-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setClientColumnDialogOpen(true)}>
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
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={String(applied.limit)}
              onChange={(e) => {
                const limit = Number.parseInt(e.target.value, 10) || 10;
                const next = { ...applied, limit, page: 1 };
                setDraft((d) => ({ ...d, limit, page: 1 }));
                setApplied(next);
              }}
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <div className="relative min-w-[160px] flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 pl-8 text-sm"
                placeholder="Поиск"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
              />
            </div>
            <label className="inline-flex shrink-0 items-center gap-2 text-xs sm:text-sm">
              <input
                type="checkbox"
                className="accent-primary"
                checked={applied.only_with_value}
                onChange={(e) => {
                  const v = e.target.checked;
                  setDraft((d) => ({ ...d, only_with_value: v }));
                  setApplied((d) => ({ ...d, only_with_value: v, page: 1 }));
                }}
              />
              Только с значением
            </label>
          </div>
          <div className="flex shrink-0 items-center">
            <Button variant="outline" size="sm" onClick={() => void downloadExcel()} disabled={exporting}>
              <FileSpreadsheet className="mr-1 h-4 w-4" />
              Excel
            </Button>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[860px] text-xs">
            <thead className="app-table-thead">
              <tr>
                {visibleClientCols.map((colId) => {
                  if (colId === "amount") {
                    return (
                      <th key={colId} className="px-2 py-2 text-right">
                        <div className="font-semibold leading-tight">
                          {periodLabel} АКБ: {akb}
                        </div>
                        <div className="whitespace-nowrap text-[11px] font-normal text-muted-foreground">{money(totalAmt)}</div>
                      </th>
                    );
                  }
                  return (
                    <th key={colId} className="px-2 py-2 text-left">
                      {CLIENT_COLUMNS.find((c) => c.id === colId)?.label ?? colId}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {listRows.map((r) => (
                <tr key={r.client_id} className="border-t">
                  {visibleClientCols.map((colId) => {
                    const text =
                      colId === "client_name" ? r.client_name :
                      colId === "client_id" ? String(r.client_id) :
                      colId === "agent_name" ? r.agent_name :
                      colId === "agent_code" ? (r.agent_code || "—") :
                      colId === "territory" ? r.territory :
                      money(r.amount);
                    const align =
                      colId === "amount" ? "text-right tabular-nums" :
                      colId === "client_id" ? "tabular-nums" : "";
                    return (
                      <td key={`${r.client_id}-${colId}`} className={cn("px-2 py-2", align)}>
                        {text}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {!reportQ.isLoading && listRows.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(1, visibleClientCols.length)} className="px-3 py-4 text-muted-foreground">
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
        open={clientColumnDialogOpen}
        onOpenChange={setClientColumnDialogOpen}
        title="Колонки: Продажи по клиентам 4"
        description="Настройка видимых столбцов и порядка."
        columns={CLIENT_COLUMNS}
        columnOrder={clientColumnOrder}
        hiddenColumnIds={clientHiddenColumnIds}
        onSave={(next) => {
          setClientColumnOrder(next.columnOrder);
          setClientHiddenColumnIds(new Set(next.hiddenColumnIds));
        }}
        onReset={() => {
          setClientColumnOrder(CLIENT_COLUMNS.map((c) => c.id));
          setClientHiddenColumnIds(new Set());
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
  searchPlaceholder
}: {
  placeholder: string;
  items: Array<{ id: string; title: string }>;
  selectedValues: string[];
  onChange: (next: string[]) => void;
  searchPlaceholder: string;
}) {
  return (
    <SearchableMultiSelectPanel
      label={placeholder}
      hideOuterLabel
      hidePopoverHeader
      triggerPlaceholder={placeholder}
      items={items}
      selected={new Set(selectedValues)}
      onSelectedChange={(next) => {
        const resolved = typeof next === "function" ? next(new Set(selectedValues)) : next;
        onChange(Array.from(resolved));
      }}
      searchable
      searchPlaceholder={searchPlaceholder}
      minPopoverWidth={260}
      maxListHeightClass="max-h-44"
    />
  );
}
