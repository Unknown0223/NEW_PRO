"use client";

import { RefusalsFilters } from "@/components/refusals/refusals-filters";
import { useRefusalsReferenceData } from "@/components/refusals/use-refusals-reference-data";
import { RefusalsStatsBar } from "@/components/refusals/refusals-stats-bar";
import { RefusalsTable } from "@/components/refusals/refusals-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { buttonVariants } from "@/components/ui/button-variants";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { api } from "@/lib/api";
import { downloadStyledXlsxSheet } from "@/lib/download-xlsx-styled";
import {
  formatRefusalDate,
  todayYmd,
  type RefusalFiltersState,
  type RefusalsListResponse
} from "@/lib/refusals-types";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  RefreshCw,
  Search
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PER_PAGE_OPTIONS = [10, 20, 50, 100];

function defaultFilters(): RefusalFiltersState {
  const t = todayYmd();
  return {
    dateFrom: t,
    dateTo: t,
    agent: "",
    reason: "",
    clientCategory: "",
    zone: "",
    region: "",
    city: ""
  };
}

function buildListParams(
  applied: RefusalFiltersState,
  page: number,
  perPage: number,
  sortKey: string,
  sortDir: "asc" | "desc",
  search: string,
  opts?: { forExport?: boolean }
): URLSearchParams {
  const qs = new URLSearchParams({
    page: String(page),
    limit: opts?.forExport ? "5000" : String(perPage),
    sort_by: sortKey,
    sort_dir: sortDir
  });
  if (opts?.forExport) qs.set("export_limit", "5000");
  if (applied.dateFrom) qs.set("date_from", applied.dateFrom);
  if (applied.dateTo) qs.set("date_to", applied.dateTo);
  if (applied.agent) qs.set("agent_id", applied.agent);
  if (applied.reason) qs.set("refusal_reason_ref", applied.reason);
  if (applied.clientCategory) qs.set("client_category", applied.clientCategory);
  if (applied.zone) qs.set("zone", applied.zone);
  if (applied.region) qs.set("region", applied.region);
  if (applied.city) qs.set("city", applied.city);
  if (search.trim()) qs.set("search", search.trim());
  return qs;
}

export function RefusalsPageContent() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();

  const [filters, setFilters] = useState<RefusalFiltersState>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<RefusalFiltersState>(defaultFilters);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [sortKey, setSortKey] = useState("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [perPageOpen, setPerPageOpen] = useState(false);
  const dateRangeAnchorRef = useRef<HTMLButtonElement>(null);
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const refData = useRefusalsReferenceData(tenantSlug && hydrated ? tenantSlug : null);

  const listQ = useQuery({
    queryKey: [
      "refusals",
      tenantSlug,
      appliedFilters,
      page,
      perPage,
      sortKey,
      sortDir,
      search
    ],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.list,
    queryFn: async () => {
      const qs = buildListParams(appliedFilters, page, perPage, sortKey, sortDir, search);
      const { data } = await api.get<RefusalsListResponse>(`/api/${tenantSlug}/refusals?${qs}`);
      return data;
    }
  });

  useEffect(() => {
    setPage(1);
  }, [appliedFilters, search, sortKey, sortDir, perPage]);

  /** Sana oralig‘i — darhol qo‘llanadi; qolgan filtrlarga «Применить» kerak */
  useEffect(() => {
    setAppliedFilters((f) => ({
      ...f,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo
    }));
  }, [filters.dateFrom, filters.dateTo]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const dateRangeLabel = useMemo(
    () =>
      filters.dateFrom && filters.dateTo
        ? formatDateRangeButton(filters.dateFrom, filters.dateTo)
        : "Выберите период",
    [filters.dateFrom, filters.dateTo]
  );

  const applyDateRange = useCallback(({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) => {
    setFilters((f) => ({ ...f, dateFrom, dateTo }));
  }, []);

  const exportExcel = useCallback(async () => {
    if (!tenantSlug) return;
    setExporting(true);
    setExportError(null);
    try {
      const qs = buildListParams(appliedFilters, 1, perPage, sortKey, sortDir, search, {
        forExport: true
      });
      const { data } = await api.get<RefusalsListResponse>(`/api/${tenantSlug}/refusals?${qs}`);
      const truncated = data.total > data.data.length;
      const headers = ["Дата", "Клиент", "Причина отказа", "Агент", "Код агента", "Территория", "Комментарий"];
      const rows = data.data.map((r) => [
        formatRefusalDate(r.created_at.slice(0, 10)),
        r.client_name,
        r.refusal_reason_label ?? r.refusal_reason_ref,
        r.agent_name,
        r.agent_code ?? "",
        r.territory ?? "",
        r.comment ?? ""
      ]);
      await downloadStyledXlsxSheet(
        `otkazy_${appliedFilters.dateFrom}_${appliedFilters.dateTo}.xlsx`,
        truncated ? "Отказы (часть)" : "Отказы",
        headers,
        rows
      );
      if (truncated) {
        setExportError(`Экспортировано ${data.data.length} из ${data.total} записей (лимит 5000).`);
      }
    } catch {
      setExportError("Не удалось выгрузить Excel. Попробуйте снова.");
    } finally {
      setExporting(false);
    }
  }, [tenantSlug, appliedFilters, sortKey, sortDir, search, perPage]);

  const listLimit = listQ.data?.limit ?? perPage;
  const totalPages = Math.max(1, Math.ceil((listQ.data?.total ?? 0) / listLimit));
  const from = listQ.data?.total ? (page - 1) * listLimit + 1 : 0;
  const to = Math.min(page * listLimit, listQ.data?.total ?? 0);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [1];
    if (page > 3) pages.push("...");
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  }, [page, totalPages]);

  return (
    <PageShell className="flex min-h-0 flex-col gap-0 p-0 sm:p-0">
      <PageHeader
        className="border-b border-border/70 px-4 pb-3 pt-1 sm:px-5"
        title="Отказы"
        actions={
          <button
            type="button"
            ref={dateRangeAnchorRef}
            onClick={() => setDateRangeOpen(true)}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-8 gap-1.5 border-border bg-background px-3 text-xs font-normal"
            )}
          >
            <CalendarDays className="size-3.5" aria-hidden />
            {dateRangeLabel}
          </button>
        }
      />

      <RefusalsFilters
        filters={filters}
        setFilters={setFilters}
        refData={refData}
        onApply={() => setAppliedFilters({ ...filters })}
        onReset={() => {
          const cleared = {
            ...filters,
            agent: "",
            reason: "",
            clientCategory: "",
            zone: "",
            region: "",
            city: ""
          };
          setFilters(cleared);
          setAppliedFilters(cleared);
        }}
      />

      {listQ.isError ? (
        <div className="mx-4 mb-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          Не удалось загрузить отказы.{" "}
          <button type="button" className="underline" onClick={() => void listQ.refetch()}>
            Повторить
          </button>
        </div>
      ) : null}

      {exportError ? (
        <div className="mx-4 mb-2 rounded-lg border border-amber-300/50 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {exportError}
        </div>
      ) : null}

      <DateRangePopover
        open={dateRangeOpen}
        onOpenChange={setDateRangeOpen}
        anchorRef={dateRangeAnchorRef}
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        onApply={applyDateRange}
      />

      <div className="mx-4 mb-4 flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <div className="relative">
            <button
              type="button"
              onClick={() => setPerPageOpen((v) => !v)}
              onBlur={() => setTimeout(() => setPerPageOpen(false), 150)}
              className="flex min-w-[52px] items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              <span>{perPage}</span>
              <ChevronDown className="size-3" />
            </button>
            {perPageOpen ? (
              <div className="absolute left-0 top-full z-30 mt-1 min-w-[64px] rounded-lg border border-border bg-card py-1 shadow-xl">
                {PER_PAGE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      setPerPage(opt);
                      setPage(1);
                      setPerPageOpen(false);
                    }}
                    className={cn(
                      "w-full px-3 py-1.5 text-left text-xs hover:bg-teal-50 dark:hover:bg-teal-950/40",
                      perPage === opt && "font-semibold text-teal-700 dark:text-teal-400"
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3 size-3.5 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск"
              className="w-[180px] rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-xs focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          <button
            type="button"
            disabled={listQ.isFetching || exporting}
            onClick={() => void exportExcel()}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-card px-3 py-1.5 text-xs font-medium text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
          >
            <FileSpreadsheet className="size-3.5" />
            Excel
          </button>

          <button
            type="button"
            onClick={() => void listQ.refetch()}
            title="Обновить"
            className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted"
          >
            <RefreshCw
              className={cn("size-3.5", listQ.isFetching && "animate-spin text-teal-600")}
              aria-hidden
            />
          </button>
        </div>

        <RefusalsStatsBar total={listQ.data?.total ?? 0} statsByReason={listQ.data?.stats_by_reason ?? []} />

        <div className="min-h-0 flex-1 overflow-auto">
          <RefusalsTable
            rows={listQ.data?.data ?? []}
            loading={listQ.isLoading}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
          />
        </div>

        <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
          <span className="text-xs text-muted-foreground">
            Показано{" "}
            <span className="font-medium text-foreground">
              {from} – {to}
            </span>{" "}
            / <span className="font-medium text-foreground">{listQ.data?.total ?? 0}</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            {pageNumbers.map((p, i) =>
              p === "..." ? (
                <span key={`dots-${i}`} className="flex size-7 items-center justify-center text-xs text-muted-foreground">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-lg text-xs font-medium",
                    page === p
                      ? "bg-teal-600 text-white shadow-sm"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {p}
                </button>
              )
            )}
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
