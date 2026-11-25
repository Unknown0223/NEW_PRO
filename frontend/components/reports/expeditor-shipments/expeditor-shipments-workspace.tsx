"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import { usePermissions } from "@/lib/use-permissions";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { filterSelectClassName } from "@/components/ui/filter-select";
import { monthToDateRange } from "@/components/dashboard/shared/date-ranges";
import { cn } from "@/lib/utils";
import { DateRangeFieldControl } from "@/components/reports/flat-report/date-range-field";
import { MultiFilter } from "@/components/reports/flat-report/multi-filter";
import { ExpeditorShipmentsTable } from "./expeditor-shipments-table";
import {
  colKey,
  emptyCell,
  filterEmptyExpeditorColumns,
  resolveExpeditorColumns,
  type ShipCell,
  type ShipCol,
  type ShipProductRow
} from "./expeditor-shipments-matrix";

type FilterOptions = {
  date_types: Array<{ id: string; label: string }>;
  statuses: Array<{ id: string; label: string }>;
  expeditors: Array<{ id: number; name: string; code: string }>;
  categories: Array<{ id: number; name: string }>;
  products: Array<{ id: number; name: string; sku: string }>;
};

type ReportData = {
  rows: ShipProductRow[];
  columns: ShipCol[];
  column_totals: Record<string, ShipCell & { invoice_count: number }>;
  page: number;
  limit: number;
  total: number;
};

type Draft = {
  date_type: string;
  from: string;
  to: string;
  statuses: string[];
  expeditor_ids: string[];
  category_ids: string[];
  product_ids: string[];
  page: number;
  limit: number;
};

const PAGE_SIZES = [50, 100, 200, 500] as const;

function emptyDraft(from: string, to: string, limit = 200): Draft {
  return {
    date_type: "shipped_date",
    from,
    to,
    statuses: [],
    expeditor_ids: [],
    category_ids: [],
    product_ids: [],
    page: 1,
    limit
  };
}

function appendParams(p: URLSearchParams, applied: Draft) {
  Object.entries(applied).forEach(([k, v]) => {
    if (Array.isArray(v)) {
      if (v.length > 0) p.set(k, v.join(","));
      return;
    }
    if (v === "" || v === "all") return;
    p.set(k, String(v));
  });
}

export function ExpeditorShipmentsWorkspace() {
  const canExport = usePermissions().has("reports.otgruzki_ekspeditorov.export");
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const { from: from0, to: to0 } = monthToDateRange();
  const [exporting, setExporting] = useState(false);
  const [showEmptyCols, setShowEmptyCols] = useState(false);
  const [expandSignal, setExpandSignal] = useState({ version: 0, open: true });
  const [draft, setDraft] = useState(() => emptyDraft(from0, to0));
  const [applied, setApplied] = useState(draft);

  const filtersQ = useQuery({
    queryKey: ["report-expeditor-shipments-filters", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: FilterOptions }>(
        `/api/${tenantSlug}/reports/expeditor-shipments/filter-options`
      );
      return data.data;
    }
  });

  const reportQ = useQuery({
    queryKey: ["report-expeditor-shipments", tenantSlug, applied],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.report,
    queryFn: async () => {
      const p = new URLSearchParams();
      appendParams(p, applied);
      const { data } = await api.get<{ data: ReportData }>(
        `/api/${tenantSlug}/reports/expeditor-shipments?${p.toString()}`
      );
      return data.data;
    }
  });

  const resolvedColumns = useMemo(
    () =>
      resolveExpeditorColumns({
        selectedIds: applied.expeditor_ids,
        reportColumns: reportQ.data?.columns ?? [],
        filterExpeditors: filtersQ.data?.expeditors ?? []
      }),
    [applied.expeditor_ids, reportQ.data?.columns, filtersQ.data?.expeditors]
  );

  const totalsBase = useMemo(() => {
    const base = { ...(reportQ.data?.column_totals ?? {}) };
    for (const c of resolvedColumns) {
      const k = colKey(c.expeditor_id);
      if (!base[k]) base[k] = { ...emptyCell(), invoice_count: 0 };
    }
    return base;
  }, [reportQ.data?.column_totals, resolvedColumns]);

  const columns = useMemo(
    () =>
      filterEmptyExpeditorColumns({
        columns: resolvedColumns,
        totals: totalsBase,
        showEmpty: showEmptyCols || applied.expeditor_ids.length > 0,
        forceKeepIds: applied.expeditor_ids
      }),
    [resolvedColumns, totalsBase, showEmptyCols, applied.expeditor_ids]
  );

  const rows = useMemo(() => {
    const raw = reportQ.data?.rows ?? [];
    if (columns.length === 0) return raw;
    return raw.map((r) => {
      const cells = { ...r.cells };
      for (const c of columns) {
        const k = colKey(c.expeditor_id);
        if (!cells[k]) cells[k] = emptyCell();
      }
      return { ...r, cells };
    });
  }, [reportQ.data?.rows, columns]);

  const totals = totalsBase;

  const totalPages = reportQ.data
    ? Math.max(1, Math.ceil(reportQ.data.total / reportQ.data.limit))
    : 1;

  if (!hydrated || !tenantSlug) {
    return <p className="text-sm text-muted-foreground">Загрузка...</p>;
  }

  const opts = filtersQ.data;
  const dateTypes = opts?.date_types ?? [{ id: "shipped_date", label: "Дата отгрузки" }];
  const expeditorItems = (opts?.expeditors ?? []).map((x) => ({
    id: String(x.id),
    title: x.name,
    searchText: [x.name, x.code].filter(Boolean).join(" ")
  }));
  const categoryItems = (opts?.categories ?? []).map((x) => ({ id: String(x.id), title: x.name }));
  const productItems = (opts?.products ?? []).map((x) => ({
    id: String(x.id),
    title: x.name,
    searchText: [x.name, x.sku].filter(Boolean).join(" ")
  }));
  const statusItems = (opts?.statuses ?? []).map((x) => ({ id: x.id, title: x.label }));

  function applyFilters(page = 1) {
    setApplied({ ...draft, page });
    setDraft((s) => ({ ...s, page }));
  }

  function resetFilters() {
    const next = emptyDraft(from0, to0, draft.limit);
    setDraft(next);
    setApplied(next);
  }

  async function exportXlsx() {
    if (!tenantSlug || !canExport) return;
    setExporting(true);
    try {
      const p = new URLSearchParams();
      appendParams(p, applied);
      p.set("export_limit", "2000");
      const res = await api.get<Blob>(
        `/api/${tenantSlug}/reports/expeditor-shipments/export?${p.toString()}`,
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "otgruzki-po-ekspeditoram.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Отгрузки по экспедиторам</h1>

      <div className="space-y-2 rounded border bg-card p-3">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-muted-foreground">Дата применяется по</span>
            {dateTypes.map((dt) => (
              <label key={dt.id} className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  className="accent-primary"
                  checked={draft.date_type === dt.id}
                  onChange={() => setDraft((d) => ({ ...d, date_type: dt.id }))}
                />
                {dt.label}
              </label>
            ))}
          </div>
          <DateRangeFieldControl
            field={{ kind: "dateRange" }}
            from={draft.from}
            to={draft.to}
            onApply={(dateFrom, dateTo) => setDraft((d) => ({ ...d, from: dateFrom, to: dateTo }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-9">
          <MultiFilter
            placeholder="Экспедитор"
            items={expeditorItems}
            selectedValues={draft.expeditor_ids}
            onChange={(v) => setDraft((d) => ({ ...d, expeditor_ids: v }))}
            compact
          />
          <MultiFilter
            placeholder="Категория"
            items={categoryItems}
            selectedValues={draft.category_ids}
            onChange={(v) => setDraft((d) => ({ ...d, category_ids: v }))}
            compact
          />
          <MultiFilter
            placeholder="Продукты"
            items={productItems}
            selectedValues={draft.product_ids}
            onChange={(v) => setDraft((d) => ({ ...d, product_ids: v }))}
            compact
          />
          <MultiFilter
            placeholder="Статус"
            items={statusItems}
            selectedValues={draft.statuses}
            onChange={(v) => setDraft((d) => ({ ...d, statuses: v }))}
            compact
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={resetFilters}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          {canExport ? (
            <Button
              variant="outline"
              className="h-8 text-xs"
              disabled={exporting || reportQ.isFetching}
              onClick={() => void exportXlsx()}
            >
              <FileSpreadsheet className="mr-1 h-3.5 w-3.5" />
              Excel
            </Button>
          ) : null}
          <Button className="h-8 text-xs" onClick={() => applyFilters(1)}>
            Применить
          </Button>
        </div>
      </div>

      <div className="rounded border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 text-xs">
          <select
            className={cn(filterSelectClassName, "h-8 w-auto min-w-0 max-w-none text-xs")}
            value={String(applied.limit)}
            onChange={(e) => {
              const nextLimit = Number.parseInt(e.target.value, 10) || 200;
              const next = { ...applied, limit: nextLimit, page: 1 };
              setDraft((d) => ({ ...d, limit: nextLimit, page: 1 }));
              setApplied(next);
            }}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setExpandSignal((s) => ({ version: s.version + 1, open: true }))}
          >
            Развернуть
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setExpandSignal((s) => ({ version: s.version + 1, open: false }))}
          >
            Свернуть
          </Button>
          <label className="inline-flex items-center gap-1.5 text-muted-foreground">
            <input
              type="checkbox"
              className="accent-primary"
              checked={showEmptyCols || applied.expeditor_ids.length > 0}
              disabled={applied.expeditor_ids.length > 0}
              onChange={(e) => setShowEmptyCols(e.target.checked)}
            />
            Пустые экспедиторы
          </label>
          <div className="ml-auto text-sm font-medium">
            Товаров: {reportQ.data?.total ?? 0}
            {resolvedColumns.length !== columns.length ? (
              <span className="ml-2 font-normal text-muted-foreground">
                · эксп. {columns.length}/{resolvedColumns.length}
              </span>
            ) : null}
          </div>
        </div>

        <ExpeditorShipmentsTable
          columns={columns}
          rows={rows}
          totals={totals}
          loading={reportQ.isLoading}
          fetching={reportQ.isFetching}
          page={applied.page}
          totalPages={totalPages}
          expandAllSignal={expandSignal}
          onPage={(page) => {
            setDraft((s) => ({ ...s, page }));
            setApplied((s) => ({ ...s, page }));
          }}
        />
      </div>
    </div>
  );
}
