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
import type { FlatReportConfig, FlatReportSelectField } from "./types";
import {
  appendParams,
  applyOptionsDefaults,
  buildEmptyDraft,
  filterRowsByClientSearch,
  mapMultiOptions,
  mapSelectOptions,
  money,
  readReportTotal,
  resolveColumns,
  resolveReportRows,
  type MultiItem
} from "./flat-report-helpers";
import { FlatReportFilters } from "./flat-report-filters";
import { FlatReportTable } from "./flat-report-table";

type FilterOptions = Record<string, unknown>;
type ReportData = {
  rows: Array<Record<string, unknown>>;
  totals: Record<string, unknown>;
  page: number;
  limit: number;
  total: number;
} & Record<string, unknown>;

const PAGE_SIZES = [10, 20, 50, 100] as const;

/** Deep FE module: one declarative FlatReport config drives chrome (ADR-010). */
export function FlatReportPage(config: FlatReportConfig) {
  const defaultLimit = config.defaultLimit ?? 50;
  const exportLimit = config.exportLimit ?? 5000;
  const canExport = usePermissions().has(config.exportPermission);
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const { from: from0, to: to0 } = monthToDateRange();
  const [exporting, setExporting] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const deferredTableSearch = useDeferredValue(tableSearch);
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [draft, setDraft] = useState(() =>
    buildEmptyDraft(config.filterFields, from0, to0, defaultLimit)
  );
  const [applied, setApplied] = useState(draft);

  const filtersQ = useQuery({
    queryKey: [`report-${config.apiPath}-filters`, tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: FilterOptions }>(
        `/api/${tenantSlug}/reports/${config.apiPath}/filter-options`
      );
      return data.data;
    }
  });

  useEffect(() => {
    if (!filtersQ.data) return;
    setDraft((d) => applyOptionsDefaults(d, config.filterFields, filtersQ.data));
    setApplied((a) => applyOptionsDefaults(a, config.filterFields, filtersQ.data));
  }, [filtersQ.data, config.filterFields]);

  const reportQ = useQuery({
    queryKey: [`report-${config.apiPath}`, tenantSlug, applied],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.report,
    queryFn: async () => {
      const p = new URLSearchParams();
      appendParams(p, applied);
      const { data } = await api.get<{ data: ReportData }>(
        `/api/${tenantSlug}/reports/${config.apiPath}?${p.toString()}`
      );
      return data.data;
    }
  });

  const columnsAll = useMemo(
    () =>
      resolveColumns(config.columns, {
        applied,
        filterOptions: filtersQ.data,
        reportData: reportQ.data
      }),
    [config.columns, applied, filtersQ.data, reportQ.data]
  );

  const columnDefs: ColumnDefItem[] = useMemo(
    () => columnsAll.map((c) => ({ id: c.key, label: c.header })),
    [columnsAll]
  );
  const defaultColumnOrder = useMemo(() => columnDefs.map((c) => c.id), [columnDefs]);
  const tablePrefsId = config.tablePrefsId ?? `report.${config.apiPath}`;

  const columnPrefs = useUserTablePrefs({
    tenantSlug,
    tableId: tablePrefsId,
    defaultColumnOrder,
    defaultPageSize: defaultLimit,
    allowedPageSizes: PAGE_SIZES
  });

  useEffect(() => {
    if (columnPrefs.prefsLoading) return;
    const ps = columnPrefs.pageSize;
    setDraft((d) => (Number(d.limit) === ps ? d : { ...d, limit: ps, page: 1 }));
    setApplied((a) => (Number(a.limit) === ps ? a : { ...a, limit: ps, page: 1 }));
  }, [columnPrefs.prefsLoading, columnPrefs.pageSize]);

  const visibleColumns = useMemo(() => {
    const byKey = new Map(columnsAll.map((c) => [c.key, c]));
    return columnPrefs.visibleColumnOrder
      .map((id) => byKey.get(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
  }, [columnsAll, columnPrefs.visibleColumnOrder]);

  const invoiceCountSum = useMemo(() => {
    const ct = reportQ.data?.column_totals;
    if (!ct || typeof ct !== "object") return null;
    let sum = 0;
    let found = false;
    for (const v of Object.values(ct as Record<string, { invoice_count?: unknown }>)) {
      if (v && typeof v === "object" && "invoice_count" in v) {
        found = true;
        sum += Number(v.invoice_count) || 0;
      }
    }
    return found ? sum : null;
  }, [reportQ.data]);

  const multiItemsByKey = useMemo(() => {
    const opts = filtersQ.data;
    const map: Record<string, MultiItem[]> = {};
    for (const field of config.filterFields) {
      if (field.kind !== "multiSelect") continue;
      map[field.paramKey] = mapMultiOptions(opts?.[field.optionsFrom]);
    }
    return map;
  }, [config.filterFields, filtersQ.data]);

  const dateTypeField = config.filterFields.find(
    (f): f is FlatReportSelectField => f.kind === "select" && f.paramKey === "date_type"
  );
  const dateTypeAsRadio = config.dateTypeAsRadio ?? Boolean(dateTypeField);
  const dateTypeOptions = dateTypeField
    ? dateTypeField.staticOptions ??
      mapSelectOptions(dateTypeField.optionsFrom ? filtersQ.data?.[dateTypeField.optionsFrom] : undefined)
    : [];

  if (!hydrated || !tenantSlug) {
    return <p className="text-sm text-muted-foreground">Загрузка...</p>;
  }

  const totalPages = reportQ.data ? Math.max(1, Math.ceil(reportQ.data.total / reportQ.data.limit)) : 1;
  const rawRows = resolveReportRows(reportQ.data, config.rowsKey);
  const rows = config.clientTableSearch
    ? filterRowsByClientSearch(rawRows, deferredTableSearch, config.clientTableSearch.rowKeys)
    : rawRows;

  function applyFilters(page = 1) {
    setApplied({ ...draft, page });
    setDraft((s) => ({ ...s, page }));
  }

  function resetFilters() {
    const next = applyOptionsDefaults(
      buildEmptyDraft(config.filterFields, from0, to0, columnPrefs.pageSize || defaultLimit),
      config.filterFields,
      filtersQ.data
    );
    setDraft(next);
    setApplied(next);
    setTableSearch("");
  }

  async function exportXlsx() {
    if (!tenantSlug || !canExport) return;
    setExporting(true);
    try {
      const p = new URLSearchParams();
      appendParams(p, applied);
      p.set("export_limit", String(exportLimit));
      const res = await api.get<Blob>(`/api/${tenantSlug}/reports/${config.apiPath}/export?${p.toString()}`, {
        responseType: "blob"
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = config.exportFilename;
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
      <h1 className="text-lg font-semibold">{config.title}</h1>
      {config.description ? <p className="text-sm text-muted-foreground">{config.description}</p> : null}

      <FlatReportFilters
        config={config}
        draft={draft}
        setDraft={setDraft}
        filterOptions={filtersQ.data}
        multiItemsByKey={multiItemsByKey}
        dateTypeField={dateTypeField}
        dateTypeAsRadio={dateTypeAsRadio}
        dateTypeOptions={dateTypeOptions}
        canExport={canExport}
        exporting={exporting}
        fetching={reportQ.isFetching}
        onReset={resetFilters}
        onApply={() => applyFilters(1)}
        onExport={() => void exportXlsx()}
      />

      <div className="rounded border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setColumnDialogOpen(true)}>
              <ListOrdered className="mr-1 h-4 w-4" />
              Колонки
            </Button>
            <select
              className={cn(filterSelectClassName, "h-9 w-auto min-w-0 max-w-none")}
              value={String(applied.limit)}
              onChange={(e) => {
                const nextLimit = Number.parseInt(e.target.value, 10) || defaultLimit;
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
            {config.clientTableSearch ? (
              <div className="relative min-w-[180px] flex-1 sm:max-w-md">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-9 pl-8 text-sm"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder={config.clientTableSearch.placeholder ?? "Поиск в таблице"}
                />
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium">
              {config.countLabel ?? "Строк"}: {reportQ.data?.total ?? 0}
            </span>
            {config.totalsKeys.map((key) => {
              const label = config.totalsLabels?.[key] ?? key;
              const raw = readReportTotal(reportQ.data, key);
              const col = columnsAll.find((c) => c.key === key);
              const formatted =
                col?.format === "money" ? money(raw as string | number) : String(raw ?? 0);
              return (
                <span key={key} className="text-muted-foreground">
                  <span className="text-foreground/80">{label}:</span> {formatted}
                </span>
              );
            })}
            {invoiceCountSum != null ? (
              <span className="text-muted-foreground">
                <span className="text-foreground/80">Накладных:</span> {invoiceCountSum}
              </span>
            ) : null}
          </div>
        </div>

        {reportQ.data?.need_products === true ? (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Выберите один или несколько продуктов в фильтре и нажмите «Применить».
          </div>
        ) : null}

        <FlatReportTable
          config={config}
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
