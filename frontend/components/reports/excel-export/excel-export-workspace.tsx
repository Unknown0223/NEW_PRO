"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ListOrdered, Search } from "lucide-react";
import { api } from "@/lib/api";
import { usePermissions } from "@/lib/use-permissions";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { filterSelectClassName } from "@/components/ui/filter-select";
import { TableColumnSettingsDialog, type ColumnDefItem } from "@/components/data-table/table-column-settings-dialog";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { monthToDateRange } from "@/components/dashboard/shared/date-ranges";
import { cn } from "@/lib/utils";
import { FlatReportFilters } from "@/components/reports/flat-report/flat-report-filters";
import { FlatReportTable } from "@/components/reports/flat-report/flat-report-table";
import type { FlatReportColumn, FlatReportSelectField } from "@/components/reports/flat-report/types";
import {
  appendParams,
  applyOptionsDefaults,
  buildEmptyDraft,
  filterRowsByClientSearch,
  mapMultiOptions,
  mapSelectOptions,
  resolveReportRows,
  type MultiItem
} from "@/components/reports/flat-report/flat-report-helpers";
import { ExcelExportStatusCards, type StatusCard } from "./excel-export-cards";
import {
  EXCEL_EXPORT_COLUMNS,
  EXCEL_EXPORT_DEFAULT_VISIBLE,
  EXCEL_EXPORT_FILTER_CONFIG
} from "./excel-export-columns";

function fmtDt(iso: unknown, withTime = false) {
  if (iso == null || iso === "") return "—";
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return "—";
  return withTime ? d.toLocaleString("ru-RU") : d.toLocaleDateString("ru-RU");
}

const PAGE_SIZES = [20, 50, 100, 200] as const;
const ALL_COL_IDS = EXCEL_EXPORT_COLUMNS.map((c) => c.key);
const DEFAULT_HIDDEN = ALL_COL_IDS.filter(
  (id) => !(EXCEL_EXPORT_DEFAULT_VISIBLE as readonly string[]).includes(id)
);

export function ExcelExportWorkspace() {
  const cfg = EXCEL_EXPORT_FILTER_CONFIG;
  const canExport = usePermissions().has(cfg.exportPermission);
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const { from: from0, to: to0 } = monthToDateRange();
  const [exporting, setExporting] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const deferredSearch = useDeferredValue(tableSearch);
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [activeCard, setActiveCard] = useState("all");
  const [draft, setDraft] = useState(() => buildEmptyDraft(cfg.filterFields, from0, to0, 50));
  const [applied, setApplied] = useState(draft);

  const filtersQ = useQuery({
    queryKey: ["report-excel-export-filters", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: Record<string, unknown> }>(
        `/api/${tenantSlug}/reports/excel-export/filter-options`
      );
      return data.data;
    }
  });

  useEffect(() => {
    if (!filtersQ.data) return;
    setDraft((d) => applyOptionsDefaults(d, cfg.filterFields, filtersQ.data));
    setApplied((a) => applyOptionsDefaults(a, cfg.filterFields, filtersQ.data));
  }, [filtersQ.data, cfg.filterFields]);

  const reportQ = useQuery({
    queryKey: ["report-excel-export", tenantSlug, applied],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.report,
    queryFn: async () => {
      const p = new URLSearchParams();
      appendParams(p, applied);
      const { data } = await api.get<{
        data: {
          rows: Array<Record<string, unknown>>;
          total: number;
          page: number;
          limit: number;
          status_summaries?: StatusCard[];
        };
      }>(`/api/${tenantSlug}/reports/excel-export?${p.toString()}`);
      return data.data;
    }
  });

  const columnDefs: ColumnDefItem[] = useMemo(
    () => EXCEL_EXPORT_COLUMNS.map((c) => ({ id: c.key, label: c.header })),
    []
  );
  const columnPrefs = useUserTablePrefs({
    tenantSlug,
    tableId: "report.excel-export",
    defaultColumnOrder: ALL_COL_IDS,
    defaultHiddenColumnIds: DEFAULT_HIDDEN,
    defaultPageSize: 50,
    allowedPageSizes: PAGE_SIZES
  });

  useEffect(() => {
    if (columnPrefs.prefsLoading) return;
    const ps = columnPrefs.pageSize;
    setDraft((d) => (Number(d.limit) === ps ? d : { ...d, limit: ps, page: 1 }));
    setApplied((a) => (Number(a.limit) === ps ? a : { ...a, limit: ps, page: 1 }));
  }, [columnPrefs.prefsLoading, columnPrefs.pageSize]);

  const visibleColumns = useMemo(() => {
    const byKey = new Map(EXCEL_EXPORT_COLUMNS.map((c) => [c.key, c]));
    return columnPrefs.visibleColumnOrder
      .map((id) => byKey.get(id))
      .filter((c): c is FlatReportColumn => Boolean(c));
  }, [columnPrefs.visibleColumnOrder]);

  const multiItemsByKey = useMemo(() => {
    const opts = filtersQ.data;
    const map: Record<string, MultiItem[]> = {};
    for (const field of cfg.filterFields) {
      if (field.kind !== "multiSelect") continue;
      map[field.paramKey] = mapMultiOptions(opts?.[field.optionsFrom]);
    }
    return map;
  }, [cfg.filterFields, filtersQ.data]);

  const dateTypeField = cfg.filterFields.find(
    (f): f is FlatReportSelectField => f.kind === "select" && f.paramKey === "date_type"
  );
  const dateTypeOptions = dateTypeField
    ? dateTypeField.staticOptions ??
      mapSelectOptions(dateTypeField.optionsFrom ? filtersQ.data?.[dateTypeField.optionsFrom] : undefined)
    : [];

  if (!hydrated || !tenantSlug) {
    return <p className="text-sm text-muted-foreground">Загрузка...</p>;
  }

  const totalPages = reportQ.data
    ? Math.max(1, Math.ceil(reportQ.data.total / reportQ.data.limit))
    : 1;
  const rawRows = resolveReportRows(reportQ.data, "rows");
  const rows = filterRowsByClientSearch(rawRows, deferredSearch, [
    "order_number",
    "client_name",
    "product_name",
    "agent_name",
    "status_label"
  ]);
  const cards = reportQ.data?.status_summaries ?? [];

  function applyFilters(page = 1) {
    setApplied({ ...draft, page });
    setDraft((s) => ({ ...s, page }));
  }

  function resetFilters() {
    const next = applyOptionsDefaults(
      buildEmptyDraft(cfg.filterFields, from0, to0, columnPrefs.pageSize || 50),
      cfg.filterFields,
      filtersQ.data
    );
    setDraft(next);
    setApplied(next);
    setActiveCard("all");
    setTableSearch("");
  }

  function selectCard(card: StatusCard) {
    setActiveCard(card.id);
    const statuses = card.statuses ?? [];
    setDraft((d) => ({ ...d, statuses, page: 1 }));
    setApplied((a) => ({ ...a, statuses, page: 1 }));
  }

  async function exportXlsx() {
    if (!tenantSlug || !canExport) return;
    setExporting(true);
    try {
      const p = new URLSearchParams();
      appendParams(p, applied);
      p.set("export_limit", "10000");
      const res = await api.get<Blob>(`/api/${tenantSlug}/reports/excel-export/export?${p.toString()}`, {
        responseType: "blob"
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "excel-eksport-v1.xlsx";
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
      <h1 className="text-lg font-semibold">Excel экспорт</h1>
      <p className="text-sm text-muted-foreground">
        Детальный экспорт строк заказа (SalesDoc Export Version 1).
      </p>

      <FlatReportFilters
        config={cfg}
        draft={draft}
        setDraft={setDraft}
        filterOptions={filtersQ.data}
        multiItemsByKey={multiItemsByKey}
        dateTypeField={dateTypeField}
        dateTypeAsRadio
        dateTypeOptions={dateTypeOptions}
        canExport={false}
        exporting={exporting}
        fetching={reportQ.isFetching}
        onReset={resetFilters}
        onApply={() => applyFilters(1)}
        onExport={() => void exportXlsx()}
      />

      <ExcelExportStatusCards cards={cards} activeId={activeCard} onSelect={selectCard} />

      <div className="flex flex-wrap gap-2">
        {canExport ? (
          <Button
            className="h-8 bg-emerald-600 text-xs hover:bg-emerald-700"
            disabled={exporting || reportQ.isFetching}
            onClick={() => void exportXlsx()}
          >
            Экспорт в Excel (v1)
          </Button>
        ) : null}
        <Button variant="outline" className="h-8 text-xs" disabled title="Скоро">
          Экспорт в Excel (v2)
        </Button>
      </div>

      <div className="rounded border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
          <Button variant="outline" size="sm" onClick={() => setColumnDialogOpen(true)}>
            <ListOrdered className="mr-1 h-4 w-4" />
            Колонки
          </Button>
          <select
            className={cn(filterSelectClassName, "h-9 w-auto min-w-0 max-w-none")}
            value={String(applied.limit)}
            onChange={(e) => {
              const nextLimit = Number.parseInt(e.target.value, 10) || 50;
              columnPrefs.setPageSize(nextLimit);
              const next = { ...applied, limit: nextLimit, page: 1 };
              setDraft(next);
              setApplied(next);
            }}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <div className="relative min-w-[180px] flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 pl-8 text-sm"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Поиск в таблице"
            />
          </div>
          <div className="ml-auto text-sm font-medium">Строк: {reportQ.data?.total ?? 0}</div>
        </div>

        <FlatReportTable
          config={{
            ...cfg,
            formatters: {
              shipped_at: (v) => fmtDt(v, true),
              order_date: (v) => fmtDt(v, true),
              delivered_at: (v) => fmtDt(v, true)
            },
            showTableFooter: false
          }}
          columns={visibleColumns}
          rows={rows}
          applied={applied}
          reportData={reportQ.data}
          loading={reportQ.isLoading}
          fetching={reportQ.isFetching}
          totalPages={totalPages}
          onPage={(page) => {
            setDraft((s) => ({ ...s, page }));
            setApplied((s) => ({ ...s, page }));
          }}
        />
      </div>

      <TableColumnSettingsDialog
        open={columnDialogOpen}
        onOpenChange={setColumnDialogOpen}
        columns={columnDefs}
        columnOrder={columnPrefs.columnOrder}
        hiddenColumnIds={columnPrefs.hiddenColumnIds}
        saving={columnPrefs.saving}
        onSave={(next) => columnPrefs.saveColumnLayout(next)}
        onReset={() => columnPrefs.resetColumnLayout()}
      />
    </div>
  );
}
