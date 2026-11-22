"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import { usePermissions } from "@/lib/use-permissions";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { monthToDateRange } from "@/components/dashboard/shared/date-ranges";
import { cn } from "@/lib/utils";
import type { FlatReportConfig } from "./types";
import {
  appendParams,
  applyOptionsDefaults,
  buildEmptyDraft,
  filterRowsByClientSearch,
  formatCell,
  mapMultiOptions,
  mapSelectOptions,
  money,
  readReportTotal,
  resolveCellValue,
  resolveColumns,
  resolveReportRows,
  type MultiItem
} from "./flat-report-helpers";
import { DateRangeFieldControl } from "./date-range-field";
import { MultiFilter } from "./multi-filter";

type FilterOptions = Record<string, unknown>;
type ReportData = {
  rows: Array<Record<string, unknown>>;
  totals: Record<string, unknown>;
  page: number;
  limit: number;
  total: number;
} & Record<string, unknown>;

/** Deep FE module: one declarative FlatReport config drives chrome. */
export function FlatReportPage(config: FlatReportConfig) {
  const limit = config.defaultLimit ?? 50;
  const exportLimit = config.exportLimit ?? 5000;
  const canExport = usePermissions().has(config.exportPermission);
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const { from: from0, to: to0 } = monthToDateRange();
  const [exporting, setExporting] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const [draft, setDraft] = useState(() => buildEmptyDraft(config.filterFields, from0, to0, limit));
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
    // bands (and similar) defaults from filter-options must hit applied too,
    // else first reportQ runs with empty bands until the user clicks Apply.
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

  const multiItemsByKey = useMemo(() => {
    const opts = filtersQ.data;
    const map: Record<string, MultiItem[]> = {};
    for (const field of config.filterFields) {
      if (field.kind !== "multiSelect") continue;
      map[field.paramKey] = mapMultiOptions(opts?.[field.optionsFrom]);
    }
    return map;
  }, [config.filterFields, filtersQ.data]);

  const columns = useMemo(
    () => resolveColumns(config.columns, { applied, filterOptions: filtersQ.data }),
    [config.columns, applied, filtersQ.data]
  );

  if (!hydrated || !tenantSlug) {
    return <p className="p-6 text-sm text-muted-foreground">Загрузка...</p>;
  }

  const totalPages = reportQ.data ? Math.max(1, Math.ceil(reportQ.data.total / reportQ.data.limit)) : 1;
  const rawRows = resolveReportRows(reportQ.data, config.rowsKey);
  const rows = config.clientTableSearch
    ? filterRowsByClientSearch(rawRows, tableSearch, config.clientTableSearch.rowKeys)
    : rawRows;
  const colCount = columns.length;
  const footerLead = config.footerLeadColSpan ?? Math.max(1, colCount - config.totalsKeys.length);

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
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">{config.title}</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const next = applyOptionsDefaults(
                buildEmptyDraft(config.filterFields, from0, to0, limit),
                config.filterFields,
                filtersQ.data
              );
              setDraft(next);
              setApplied(next);
              setTableSearch("");
            }}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          {canExport ? (
            <Button disabled={exporting || reportQ.isFetching} onClick={() => void exportXlsx()}>
              <FileSpreadsheet className="mr-1 h-4 w-4" />
              Excel
            </Button>
          ) : null}
          <Button
            onClick={() => {
              setApplied({ ...draft, page: 1 });
              setDraft((s) => ({ ...s, page: 1 }));
            }}
          >
            Применить
          </Button>
        </div>
      </div>

      {/* Primary chrome: date / select / search / bands — compact wrap row */}
      <div className="flex flex-wrap items-center gap-2">
        {config.filterFields.map((field) => {
          if (field.kind === "dateRange") {
            const fromKey = field.fromKey ?? "from";
            const toKey = field.toKey ?? "to";
            return (
              <DateRangeFieldControl
                key={`${fromKey}-${toKey}`}
                field={field}
                from={String(draft[fromKey] ?? "")}
                to={String(draft[toKey] ?? "")}
                onApply={(dateFrom, dateTo) =>
                  setDraft((d) => ({ ...d, [fromKey]: dateFrom, [toKey]: dateTo }))
                }
              />
            );
          }
          if (field.kind === "search") {
            const key = field.paramKey ?? "search";
            return (
              <Input
                key={key}
                className="h-9 max-w-xs"
                value={String(draft[key] ?? "")}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                placeholder={field.placeholder}
              />
            );
          }
          if (field.kind === "select") {
            const options =
              field.staticOptions ??
              mapSelectOptions(
                field.optionsFrom ? filtersQ.data?.[field.optionsFrom] : undefined
              );
            return (
              <select
                key={field.paramKey}
                className="h-9 min-w-[9rem] rounded-md border border-input bg-background px-2 text-xs"
                value={String(draft[field.paramKey] ?? field.defaultValue)}
                onChange={(e) => setDraft((d) => ({ ...d, [field.paramKey]: e.target.value }))}
              >
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            );
          }
          if (field.kind === "bands") {
            const bandsKey = field.paramKey ?? "bands";
            return (
              <Input
                key={bandsKey}
                className="h-9 max-w-xs font-mono text-xs"
                value={String(draft[bandsKey] ?? "")}
                onChange={(e) => setDraft((d) => ({ ...d, [bandsKey]: e.target.value }))}
                placeholder={field.placeholder ?? "bands"}
              />
            );
          }
          return null;
        })}
      </div>

      {/* MultiSelect grid — same layout as pre-FlatReport monoliths (not full-width stack) */}
      {config.filterFields.some((f) => f.kind === "multiSelect") ? (
        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
          {config.filterFields.map((field) => {
            if (field.kind !== "multiSelect") return null;
            const selected = Array.isArray(draft[field.paramKey])
              ? (draft[field.paramKey] as string[])
              : [];
            return (
              <MultiFilter
                key={field.paramKey}
                placeholder={field.placeholder}
                items={multiItemsByKey[field.paramKey] ?? []}
                selectedValues={selected}
                onChange={(v) => setDraft((d) => ({ ...d, [field.paramKey]: v }))}
              />
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span>
          {config.countLabel ?? "Строк"}: {reportQ.data?.total ?? 0}
        </span>
        {config.totalsKeys.map((key) => {
          const label = config.totalsLabels?.[key] ?? key;
          const raw = readReportTotal(reportQ.data, key);
          const col = columns.find((c) => c.key === key);
          const formatted = col?.format === "money" || !col ? money(raw as string | number) : String(raw);
          return (
            <span key={key}>
              {label}: {formatted}
            </span>
          );
        })}
        {config.clientTableSearch ? (
          <Input
            className="ml-auto h-8 max-w-xs"
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            placeholder={config.clientTableSearch.placeholder ?? "Поиск в таблице"}
          />
        ) : null}
      </div>

      <div className="overflow-auto rounded-lg border">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={cn("p-2", col.align === "right" && "text-right")}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reportQ.isLoading || rows.length === 0 ? (
              <tr>
                <td className="p-4 text-muted-foreground" colSpan={Math.max(1, colCount)}>
                  {reportQ.isLoading ? "Загрузка…" : "Нет данных"}
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => {
                const keyVal = r[config.rowKey];
                const rowReactKey = keyVal != null ? String(keyVal) : String(idx);
                return (
                  <tr key={rowReactKey} className="border-t">
                    {columns.map((col) => {
                      const cellVal = resolveCellValue(col, r);
                      return (
                        <td
                          key={col.key}
                          className={cn("p-2", col.align === "right" && "text-right", col.cellClassName)}
                        >
                          {config.formatters?.[col.key]
                            ? config.formatters[col.key](cellVal, r)
                            : formatCell(cellVal, col.format)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
          {reportQ.data &&
          rows.length > 0 &&
          config.totalsKeys.length > 0 &&
          config.showTableFooter !== false ? (
            <tfoot className="border-t bg-muted/30 font-medium">
              <tr>
                <td className="p-2" colSpan={footerLead}>
                  Итого
                </td>
                {columns.slice(footerLead).map((col) => {
                  if (!config.totalsKeys.includes(col.key)) {
                    return <td key={col.key} className="p-2" />;
                  }
                  const raw = readReportTotal(reportQ.data, col.key);
                  return (
                    <td key={col.key} className={cn("p-2", col.align === "right" && "text-right")}>
                      {formatCell(raw, col.format ?? "money")}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          disabled={Number(applied.page) <= 1 || reportQ.isFetching}
          onClick={() => {
            const page = Math.max(1, Number(applied.page) - 1);
            setDraft((s) => ({ ...s, page }));
            setApplied((s) => ({ ...s, page }));
          }}
        >
          Назад
        </Button>
        <span className="text-sm">
          {String(applied.page)} / {totalPages}
        </span>
        <Button
          variant="outline"
          disabled={Number(applied.page) >= totalPages || reportQ.isFetching}
          onClick={() => {
            const page = Number(applied.page) + 1;
            setDraft((s) => ({ ...s, page }));
            setApplied((s) => ({ ...s, page }));
          }}
        >
          Далее
        </Button>
      </div>
    </div>
  );
}
