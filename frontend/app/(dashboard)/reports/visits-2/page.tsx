"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, FileSpreadsheet, ListOrdered, RotateCcw, Search } from "lucide-react";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { SearchableMultiSelectPanel } from "@/components/ui/searchable-multi-select-panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { filterSelectClassName } from "@/components/ui/filter-select";

type FilterOptions = {
  agents: Array<{ id: number; name: string; code: string }>;
  client_categories: string[];
  product_categories: string[];
  weekdays: Array<{ id: number; label: string }>;
  territory_1: string[];
  territory_2: string[];
  territory_3: string[];
  territory_tree?: Array<{ zone: string; region: string; city: string }>;
  regions_by_zone?: Record<string, string[]>;
  cities_by_zone_region?: Record<string, string[]>;
};

type VisitRow = {
  row_number: number;
  client_id: number;
  client_name: string;
  client_phone: string | null;
  agent_name: string;
  visit_day_label: string;
  last_visit_at: string | null;
  territory: string;
};

type ReportPayload = {
  period_from: string;
  period_to: string;
  page: number;
  limit: number;
  total: number;
  rows: VisitRow[];
};

const FILTER_TRIGGER =
  "h-8 min-h-8 w-full min-w-0 max-w-none px-2 text-xs font-normal shadow-sm";

function defaultRange() {
  const t = new Date();
  const from = new Date(t.getFullYear(), t.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(t.getFullYear(), t.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

function buildFilterState(bounds: { from: string; to: string }) {
  return {
    ...bounds,
    agent_ids: [] as string[],
    client_categories: [] as string[],
    weekdays: [] as string[],
    product_categories: [] as string[],
    territory_1_list: [] as string[],
    territory_2_list: [] as string[],
    territory_3_list: [] as string[],
    sort_by: "client_name" as "client_name" | "client_id" | "last_visit" | "agent_name" | "territory",
    sort_dir: "asc" as "asc" | "desc",
    page: 1,
    limit: 10
  };
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

function appendParams(p: URLSearchParams, a: ReturnType<typeof buildFilterState>, search?: string) {
  p.set("from", a.from);
  p.set("to", a.to);
  p.set("page", String(a.page));
  p.set("limit", String(a.limit));
  p.set("sort_by", a.sort_by);
  p.set("sort_dir", a.sort_dir);
  if (search) p.set("search", search);
  if (a.agent_ids.length) p.set("agent_ids", a.agent_ids.join(","));
  if (a.client_categories.length) p.set("client_categories", a.client_categories.join(","));
  if (a.weekdays.length) p.set("weekdays", a.weekdays.join(","));
  if (a.product_categories.length) p.set("product_category_refs", a.product_categories.join(","));
  if (a.territory_1_list.length) p.set("territory_1_list", a.territory_1_list.join(","));
  if (a.territory_2_list.length) p.set("territory_2_list", a.territory_2_list.join(","));
  if (a.territory_3_list.length) p.set("territory_3_list", a.territory_3_list.join(","));
}

function fmtVisit(iso: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return iso;
  }
}

export default function ReportVisits2Page() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const b0 = defaultRange();

  const dateAnchorRef = useRef<HTMLButtonElement>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const deferredSearch = useDeferredValue(tableSearch.trim());

  const [draft, setDraft] = useState(() => buildFilterState(b0));
  const [applied, setApplied] = useState(() => buildFilterState(b0));

  useEffect(() => {
    setApplied((a) => (a.page === 1 ? a : { ...a, page: 1 }));
  }, [deferredSearch]);

  const filtersQ = useQuery({
    queryKey: ["report-visits-2-filters", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: FilterOptions }>(
        `/api/${tenantSlug}/reports/visits-2/filter-options`
      );
      return data.data;
    }
  });

  const reportQ = useQuery({
    queryKey: ["report-visits-2", tenantSlug, applied, deferredSearch],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.report,
    queryFn: async () => {
      const p = new URLSearchParams();
      appendParams(p, applied, deferredSearch || undefined);
      const { data } = await api.get<{ data: ReportPayload }>(
        `/api/${tenantSlug}/reports/visits-2?${p.toString()}`
      );
      return data.data;
    }
  });

  const opts = filtersQ.data;

  const territory2Items = useMemo(() => {
    const zone = draft.territory_1_list[0] ?? "";
    if (!zone) {
      return (opts?.territory_2 ?? []).map((x) => ({ id: x, title: x }));
    }
    const regions = opts?.regions_by_zone?.[zone] ?? [];
    return regions.map((x) => ({ id: x, title: x }));
  }, [draft.territory_1_list, opts?.regions_by_zone, opts?.territory_2]);

  const territory3Items = useMemo(() => {
    const zone = draft.territory_1_list[0] ?? "";
    const region = draft.territory_2_list[0] ?? "";
    if (!region) {
      return (opts?.territory_3 ?? []).map((x) => ({ id: x, title: x }));
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
    cities = Array.from(new Set(cities)).sort((a, b) => a.localeCompare(b, "ru"));
    return cities.map((x) => ({ id: x, title: x }));
  }, [draft.territory_1_list, draft.territory_2_list, opts?.cities_by_zone_region, opts?.territory_tree, opts?.territory_3]);

  const agentItems = (opts?.agents ?? []).map((x) => ({
    id: String(x.id),
    title: `${x.name}${x.code ? ` (${x.code})` : ""}`
  }));
  const clientCatItems = (opts?.client_categories ?? []).map((x) => ({ id: x, title: x }));
  const productCatItems = (opts?.product_categories ?? []).map((x) => ({ id: x, title: x }));
  const weekdayItems = (opts?.weekdays ?? []).map((x) => ({ id: String(x.id), title: x.label }));
  const territory1Items = (opts?.territory_1 ?? []).map((x) => ({ id: x, title: x }));

  const downloadExcel = async () => {
    if (!tenantSlug) return;
    setExporting(true);
    try {
      const p = new URLSearchParams();
      appendParams(p, applied, deferredSearch || undefined);
      const res = await api.get<Blob>(`/api/${tenantSlug}/reports/visits-2/export?${p.toString()}`, {
        responseType: "blob"
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "po-vizitam-2.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const rows = reportQ.data?.rows ?? [];
  const total = reportQ.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / (applied.limit || 10)));

  if (!hydrated || !tenantSlug) return <p className="text-sm text-muted-foreground">Загрузка...</p>;

  const periodBtn = formatDateRangeButton(draft.from, draft.to);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-lg font-semibold">По визитам 2.0</h1>
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
            <span className="text-xs font-medium text-muted-foreground">Дата</span>
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
          <div className="grid grid-cols-2 gap-x-2 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
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
              placeholder="Категория клиента"
              items={clientCatItems}
              selectedValues={draft.client_categories}
              onChange={(v) => setDraft((d) => ({ ...d, client_categories: v, page: 1 }))}
              searchPlaceholder="Категория"
            />
            <MultiFilter
              compact
              placeholder="День"
              items={weekdayItems}
              selectedValues={draft.weekdays}
              onChange={(v) => setDraft((d) => ({ ...d, weekdays: v, page: 1 }))}
              searchPlaceholder="День"
            />
            <MultiFilter
              compact
              placeholder="Категория продукта"
              items={productCatItems}
              selectedValues={draft.product_categories}
              onChange={(v) => setDraft((d) => ({ ...d, product_categories: v, page: 1 }))}
              searchPlaceholder="Категория продукта"
            />
            <MultiFilter
              compact
              placeholder="Территория 1"
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
              searchPlaceholder="Территория 1"
            />
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
            <MultiFilter
              compact
              placeholder="Территория 2"
              items={territory2Items}
              selectedValues={draft.territory_2_list}
              onChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  territory_2_list: v,
                  territory_3_list: [],
                  page: 1
                }))
              }
              searchPlaceholder="Территория 2"
            />
            <MultiFilter
              compact
              placeholder="Территория 3"
              items={territory3Items}
              selectedValues={draft.territory_3_list}
              onChange={(v) => setDraft((d) => ({ ...d, territory_3_list: v, page: 1 }))}
              searchPlaceholder="Территория 3"
            />
            <div className="flex min-w-0 flex-col justify-end gap-0.5 sm:col-span-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Сортировка</span>
              <select
                className={cn(filterSelectClassName, "h-8 text-xs")}
                value={`${draft.sort_by}:${draft.sort_dir}`}
                onChange={(e) => {
                  const [sort_by, sort_dir] = e.target.value.split(":") as [
                    typeof draft.sort_by,
                    typeof draft.sort_dir
                  ];
                  setDraft((d) => ({ ...d, sort_by, sort_dir, page: 1 }));
                }}
              >
                <option value="client_name:asc">Клиент А→Я</option>
                <option value="client_name:desc">Клиент Я→А</option>
                <option value="last_visit:desc">Пос. визит (новые)</option>
                <option value="last_visit:asc">Пос. визит (старые)</option>
                <option value="agent_name:asc">Агент А→Я</option>
                <option value="client_id:asc">Ид клиента ↑</option>
                <option value="client_id:desc">Ид клиента ↓</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/50 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              onClick={() => {
                const b = defaultRange();
                setDraft(buildFilterState(b));
                setApplied(buildFilterState(b));
                setTableSearch("");
              }}
              title="Сбросить фильтр"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8"
              onClick={() => setApplied({ ...draft, page: 1 })}
            >
              Применить
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <ListOrdered className="h-4 w-4 text-muted-foreground" />
            <select
              className={cn(filterSelectClassName, "h-8 w-[4.5rem] text-xs")}
              value={String(applied.limit)}
              onChange={(e) => {
                const limit = Number.parseInt(e.target.value, 10) || 10;
                setApplied((a) => ({ ...a, limit, page: 1 }));
                setDraft((d) => ({ ...d, limit, page: 1 }));
              }}
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <div className="relative min-w-[8rem] flex-1 sm:max-w-xs">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-8 pl-7 text-xs"
                placeholder="Поиск"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              disabled={exporting}
              onClick={() => void downloadExcel()}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Excel
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              title="Обновить"
              onClick={() => void reportQ.refetch()}
            >
              <RotateCcw className={cn("h-3.5 w-3.5", reportQ.isFetching && "animate-spin")} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[640px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="px-2 py-2 font-medium">Ид клиента</th>
                  <th className="px-2 py-2 font-medium">Клиент (название)</th>
                  <th className="px-2 py-2 font-medium">Телефон клиента</th>
                  <th className="px-2 py-2 font-medium">Агент</th>
                  <th className="px-2 py-2 font-medium">День</th>
                  <th className="px-2 py-2 font-medium">Пос. визит</th>
                  <th className="px-2 py-2 font-medium">Территория</th>
                </tr>
              </thead>
              <tbody>
                {reportQ.isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-2 py-8 text-center text-muted-foreground">
                      Загрузка…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-2 py-8 text-center text-muted-foreground">
                      Пусто
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.client_id} className="border-b border-border/60 hover:bg-muted/20">
                      <td className="px-2 py-1.5 tabular-nums">{r.client_id}</td>
                      <td className="px-2 py-1.5 font-medium">{r.client_name}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{r.client_phone ?? "—"}</td>
                      <td className="px-2 py-1.5">{r.agent_name || "—"}</td>
                      <td className="px-2 py-1.5">{r.visit_day_label || "—"}</td>
                      <td className="px-2 py-1.5 tabular-nums">{fmtVisit(r.last_visit_at)}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{r.territory || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {total > 0 && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                Стр. {applied.page} из {totalPages} · всего {total}
              </span>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={applied.page <= 1}
                  onClick={() => setApplied((a) => ({ ...a, page: Math.max(1, a.page - 1) }))}
                >
                  Назад
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={applied.page >= totalPages}
                  onClick={() => setApplied((a) => ({ ...a, page: a.page + 1 }))}
                >
                  Вперёд
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
