"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, Filter, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import { usePermissions } from "@/lib/use-permissions";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { SearchableMultiSelectPanel } from "@/components/ui/searchable-multi-select-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { filterSelectClassName } from "@/components/ui/filter-select";
import { getUserFacingError } from "@/lib/error-utils";
import { P1ReportTable, type P1MonthCol, type P1Row } from "@/components/reports/p1-report-table";

type DateType = "order_date" | "shipped_date" | "delivered_date";

type FilterOptions = {
  date_types: Array<{ id: DateType; label: string }>;
  default_date_type: DateType;
  default_trade_direction_id: number | null;
  trade_directions: Array<{ id: number; name: string; code: string }>;
  brands: Array<{ id: number; name: string; code: string }>;
  products: Array<{ id: number; name: string; sku: string }>;
  territory_1: string[];
  territory_2: string[];
  territory_2_by_1?: Record<string, string[]>;
};

type P1Payload = {
  year: number;
  date_type: DateType;
  months: P1MonthCol[];
  rows: P1Row[];
  totals_note: string;
};

type Draft = {
  year: string;
  compare_year: string;
  date_type: DateType;
  trade_direction_ids: string[];
  brand_ids: string[];
  product_ids: string[];
  territory_1: string[];
  territory_2: string[];
};

const FILTER_TRIGGER =
  "h-8 min-h-8 w-full min-w-0 max-w-none px-2 text-xs font-normal shadow-sm";

function years() {
  const y = new Date().getFullYear();
  return [y, y - 1, y - 2, y - 3];
}

function Multi({
  placeholder,
  items,
  selectedValues,
  onChange
}: {
  placeholder: string;
  items: Array<{ id: string; title: string; searchText?: string }>;
  selectedValues: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <SearchableMultiSelectPanel
      label={placeholder}
      hideOuterLabel
      hidePopoverHeader
      triggerPlaceholder={placeholder}
      triggerClassName={FILTER_TRIGGER}
      items={items}
      selected={new Set(selectedValues)}
      onSelectedChange={(next) => {
        const resolved = typeof next === "function" ? next(new Set(selectedValues)) : next;
        onChange(Array.from(resolved));
      }}
      searchable
      searchPlaceholder={placeholder}
      minPopoverWidth={220}
      maxListHeightClass="max-h-36"
    />
  );
}

function buildQs(a: Draft) {
  const p = new URLSearchParams();
  p.set("year", a.year);
  p.set("compare_year", a.compare_year);
  p.set("date_type", a.date_type);
  if (a.trade_direction_ids.length) p.set("trade_direction_ids", a.trade_direction_ids.join(","));
  if (a.brand_ids.length) p.set("brand_ids", a.brand_ids.join(","));
  if (a.product_ids.length) p.set("product_ids", a.product_ids.join(","));
  if (a.territory_1.length) p.set("territory_1", a.territory_1.join(","));
  if (a.territory_2.length) p.set("territory_2", a.territory_2.join(","));
  return p;
}

export default function P1ReportPage() {
  const hydrated = useAuthStoreHydrated();
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const { hasAny } = usePermissions();
  const canView = hasAny("reports.p1.view", "reports.view");
  const canExport = hasAny("reports.p1.export", "reports.export");
  const nowY = new Date().getFullYear();

  const empty = useMemo<Draft>(
    () => ({
      year: String(nowY),
      compare_year: String(nowY - 1),
      date_type: "order_date",
      trade_direction_ids: [],
      brand_ids: [],
      product_ids: [],
      territory_1: [],
      territory_2: []
    }),
    [nowY]
  );

  const [draft, setDraft] = useState<Draft>(empty);
  const [applied, setApplied] = useState<Draft>(empty);
  const [defaultsReady, setDefaultsReady] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [showYoy, setShowYoy] = useState(true);
  const [showQuarters, setShowQuarters] = useState(true);

  const optsQ = useQuery({
    queryKey: ["report-p1-filters", tenantSlug],
    enabled: hydrated && !!tenantSlug && canView,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: FilterOptions }>(`/api/${tenantSlug}/reports/p1/filter-options`);
      return data.data;
    }
  });

  useEffect(() => {
    if (!optsQ.data || defaultsReady) return;
    // Yo‘nalishni majburiy tanlamaymiz — bo‘sh filtrda barcha savdo ko‘rinadi;
    // DIELUX ni foydalanuvchi o‘zi tanlaydi (aks holda agent bog‘lanmagan bo‘lsa jadval bo‘sh).
    const next: Draft = {
      ...empty,
      date_type: optsQ.data.default_date_type ?? "order_date",
      trade_direction_ids: []
    };
    setDraft(next);
    setApplied(next);
    setDefaultsReady(true);
  }, [optsQ.data, defaultsReady, empty]);

  const reportQ = useQuery({
    queryKey: ["report-p1", tenantSlug, applied],
    enabled: hydrated && !!tenantSlug && canView && defaultsReady,
    staleTime: STALE.report,
    queryFn: async () => {
      const { data } = await api.get<{ data: P1Payload }>(
        `/api/${tenantSlug}/reports/p1?${buildQs(applied).toString()}`
      );
      return data.data;
    }
  });

  const visibleMonths = useMemo(
    () => (reportQ.data?.months ?? []).filter((c) => showQuarters || c.kind !== "quarter"),
    [reportQ.data?.months, showQuarters]
  );

  const tradeItems = (optsQ.data?.trade_directions ?? []).map((x) => ({
    id: String(x.id),
    title: x.name,
    searchText: [x.name, x.code].filter(Boolean).join(" ")
  }));
  const brandItems = (optsQ.data?.brands ?? []).map((x) => ({
    id: String(x.id),
    title: x.name,
    searchText: [x.name, x.code].filter(Boolean).join(" ")
  }));
  const productItems = (optsQ.data?.products ?? []).map((x) => ({
    id: String(x.id),
    title: x.name,
    searchText: [x.name, x.sku].filter(Boolean).join(" ")
  }));
  const t1Items = (optsQ.data?.territory_1 ?? []).map((x) => ({ id: x, title: x }));
  const t2Items = useMemo(() => {
    const by1 = optsQ.data?.territory_2_by_1;
    if (draft.territory_1.length && by1) {
      const set = new Set<string>();
      for (const z of draft.territory_1) for (const r of by1[z] ?? []) set.add(r);
      return [...set].sort((a, b) => a.localeCompare(b, "ru")).map((x) => ({ id: x, title: x }));
    }
    return (optsQ.data?.territory_2 ?? []).map((x) => ({ id: x, title: x }));
  }, [optsQ.data, draft.territory_1]);

  const dateTypes = optsQ.data?.date_types ?? [
    { id: "order_date" as const, label: "Дата заказа" },
    { id: "shipped_date" as const, label: "Дата отправки" },
    { id: "delivered_date" as const, label: "Дата доставки" }
  ];

  async function onExport() {
    if (!tenantSlug || !canExport) return;
    const res = await api.get<Blob>(`/api/${tenantSlug}/reports/p1/export?${buildQs(applied)}`, {
      responseType: "blob"
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "p1-otchet.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  function resetFilters() {
    const next: Draft = {
      ...empty,
      date_type: optsQ.data?.default_date_type ?? "order_date",
      trade_direction_ids: []
    };
    setDraft(next);
    setApplied(next);
  }

  if (!hydrated) return null;
  if (!canView) return <p className="p-6 text-sm text-muted-foreground">Нет доступа к отчёту P1.</p>;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">P1 отчёт</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Область × товар × месяц · продажи − возвраты · АКБ = уникальные клиенты
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter className="mr-1 h-3.5 w-3.5" />
            {showFilters ? "Скрыть фильтры" : "Фильтры"}
          </Button>
          {canExport ? (
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => void onExport()}>
              <FileSpreadsheet className="mr-1 h-3.5 w-3.5" />
              Excel
            </Button>
          ) : null}
        </div>
      </div>

      {showFilters ? (
        <div className="space-y-2 rounded border bg-card p-2.5 shadow-sm">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="shrink-0 font-medium text-muted-foreground">Дата применяется по</span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
              {dateTypes.map((dt) => (
                <label key={dt.id} className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap">
                  <input
                    type="radio"
                    className="accent-primary"
                    name="p1-date-type"
                    checked={draft.date_type === dt.id}
                    onChange={() => setDraft((d) => ({ ...d, date_type: dt.id }))}
                  />
                  <span>{dt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            <label className="text-[11px] text-muted-foreground">
              Год
              <select
                className={cn(filterSelectClassName, FILTER_TRIGGER, "mt-0.5")}
                value={draft.year}
                onChange={(e) => setDraft((d) => ({ ...d, year: e.target.value }))}
              >
                {years().map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] text-muted-foreground">
              Сравнить с
              <select
                className={cn(filterSelectClassName, FILTER_TRIGGER, "mt-0.5")}
                value={draft.compare_year}
                onChange={(e) => setDraft((d) => ({ ...d, compare_year: e.target.value }))}
              >
                {years().map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <Multi
              placeholder="Направление"
              items={tradeItems}
              selectedValues={draft.trade_direction_ids}
              onChange={(next) => setDraft((d) => ({ ...d, trade_direction_ids: next }))}
            />
            <Multi
              placeholder="Бренд"
              items={brandItems}
              selectedValues={draft.brand_ids}
              onChange={(next) => setDraft((d) => ({ ...d, brand_ids: next }))}
            />
            <Multi
              placeholder="Товар"
              items={productItems}
              selectedValues={draft.product_ids}
              onChange={(next) => setDraft((d) => ({ ...d, product_ids: next }))}
            />
            <Multi
              placeholder="Зона"
              items={t1Items}
              selectedValues={draft.territory_1}
              onChange={(next) => setDraft((d) => ({ ...d, territory_1: next, territory_2: [] }))}
            />
            <Multi
              placeholder="Область"
              items={t2Items}
              selectedValues={draft.territory_2}
              onChange={(next) => setDraft((d) => ({ ...d, territory_2: next }))}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-1.5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <label className="inline-flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={showYoy}
                  onChange={(e) => setShowYoy(e.target.checked)}
                />
                YoY %
              </label>
              <label className="inline-flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={showQuarters}
                  onChange={(e) => setShowQuarters(e.target.checked)}
                />
                Кварталы
              </label>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
              <Button variant="outline" size="sm" className="h-8 text-xs" type="button" onClick={resetFilters}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                Сброс
              </Button>
              <Button size="sm" className="h-8 text-xs" type="button" onClick={() => setApplied({ ...draft })}>
                Применить
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {reportQ.isError ? <p className="text-sm text-destructive">{getUserFacingError(reportQ.error)}</p> : null}
      {reportQ.data?.totals_note ? (
        <p className="text-[11px] text-muted-foreground">{reportQ.data.totals_note}</p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden rounded border bg-card">
        <P1ReportTable
          rows={reportQ.data?.rows ?? []}
          months={visibleMonths}
          year={Number(applied.year)}
          showYoy={showYoy}
          loading={reportQ.isLoading}
          emptyHint={
            applied.date_type === "delivered_date"
              ? "Нет доставок за период. Переключите дату на «Дата заказа» и нажмите «Применить»."
              : "Нет данных за период. Ослабьте фильтры (направление / бренд) или смените год."
          }
        />
      </div>
    </div>
  );
}
