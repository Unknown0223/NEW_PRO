"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, FileSpreadsheet, RotateCcw, Search } from "lucide-react";
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
import { getUserFacingError } from "@/lib/error-utils";
import { isAxiosError } from "axios";

type FilterOptions = {
  agents: Array<{ id: number; name: string; code: string; is_active: boolean; label: string }>;
  order_statuses: Array<{ id: string; label: string }>;
};

type ReportRow = {
  row_number: number;
  work_date: string;
  agent_id: number;
  agent_label: string;
  first_activity_at: string | null;
  last_activity_at: string | null;
  planned: number;
  visited: number;
  not_visited: number;
  orders_count: number;
  sales_sum: string;
  visit_completion_pct: number;
  conversion_orders_per_visit: number;
  avg_order_value: string;
};

type ReportPayload = {
  from: string;
  to: string;
  page: number;
  limit: number;
  total: number;
  rows: ReportRow[];
};

const FILTER_TRIGGER =
  "h-8 min-h-8 w-full min-w-0 max-w-none px-2 text-xs font-normal shadow-sm";

function defaultRange() {
  const t = new Date();
  const y = t.getFullYear();
  const m = t.getMonth();
  const d = t.getDate();
  const from = new Date(Date.UTC(y, m, d, 0, 0, 0, 0)).toISOString().slice(0, 10);
  const to = from;
  return { from, to };
}

function buildFilterState(bounds: { from: string; to: string }) {
  return {
    ...bounds,
    agent_ids: [] as string[],
    /** Bo‘sh — backend: `cancelled`/`returned` zakazlar summaga kirmaydi (dashboard qoidasi). */
    order_status_ids: [] as string[],
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
  compact,
  selectAllLabel
}: {
  placeholder: string;
  items: Array<{ id: string; title: string }>;
  selectedValues: string[];
  onChange: (next: string[]) => void;
  searchPlaceholder: string;
  compact?: boolean;
  selectAllLabel?: string;
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
      selectAllLabel={selectAllLabel}
    />
  );
}

function appendParams(
  p: URLSearchParams,
  a: ReturnType<typeof buildFilterState>,
  search?: string
) {
  p.set("from", a.from);
  p.set("to", a.to);
  p.set("page", String(a.page));
  p.set("limit", String(a.limit));
  if (a.order_status_ids.length) p.set("order_statuses", a.order_status_ids.join(","));
  if (search) p.set("search", search);
  if (a.agent_ids.length) p.set("agent_ids", a.agent_ids.join(","));
}

function fmtCell(iso: string | null) {
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

function fmtDateRu(ymd: string) {
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `${d}.${m}.${y}`;
}

function isVisitTotalsBadRangeError(err: unknown): boolean {
  if (!isAxiosError(err)) return false;
  const payload = err.response?.data as { error?: string } | undefined;
  return String(payload?.error ?? "").includes("BAD_RANGE");
}

export default function ReportVisitTotalsPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const b0 = defaultRange();

  const dateAnchorRef = useRef<HTMLButtonElement>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState("");
  const deferredSearch = useDeferredValue(tableSearch.trim());

  const [draft, setDraft] = useState(() => buildFilterState(b0));
  const [applied, setApplied] = useState(() => buildFilterState(b0));

  useEffect(() => {
    setApplied((a) => (a.page === 1 ? a : { ...a, page: 1 }));
  }, [deferredSearch]);

  const filtersQ = useQuery({
    queryKey: ["report-visit-totals-filters", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: FilterOptions }>(
        `/api/${tenantSlug}/reports/visit-totals/filter-options`
      );
      return data.data;
    }
  });

  const reportQ = useQuery({
    queryKey: ["report-visit-totals", tenantSlug, applied, deferredSearch],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.report,
    queryFn: async () => {
      const p = new URLSearchParams();
      appendParams(p, applied, deferredSearch || undefined);
      const { data } = await api.get<{ data: ReportPayload }>(
        `/api/${tenantSlug}/reports/visit-totals?${p.toString()}`
      );
      return data.data;
    }
  });

  const agentItems = useMemo(
    () => (filtersQ.data?.agents ?? []).map((x) => ({ id: String(x.id), title: x.label })),
    [filtersQ.data?.agents]
  );

  const orderStatusItems = useMemo(() => {
    const src = filtersQ.data?.order_statuses;
    if (src?.length) return src.map((x) => ({ id: x.id, title: x.label }));
    return [
      { id: "new", title: "Новый" },
      { id: "cancelled", title: "Отменен" },
      { id: "confirmed", title: "Подтвержден к отгрузке" },
      { id: "picking", title: "Комплектация" },
      { id: "delivering", title: "Отгружен" },
      { id: "delivered", title: "Доставлен" },
      { id: "return_processing", title: "В процессе возврата" },
      { id: "returned", title: "Возврат" }
    ];
  }, [filtersQ.data?.order_statuses]);

  const downloadExcel = async () => {
    if (!tenantSlug) return;
    setExporting(true);
    setExportErr(null);
    try {
      const p = new URLSearchParams();
      appendParams(p, applied, deferredSearch || undefined);
      const res = await api.get<Blob>(`/api/${tenantSlug}/reports/visit-totals/export?${p.toString()}`, {
        responseType: "blob"
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "itogi-vizitov.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportErr(getUserFacingError(e, "Экспорт не удался."));
    } finally {
      setExporting(false);
    }
  };

  const rows = reportQ.data?.rows ?? [];
  const total = reportQ.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / (applied.limit || 10)));
  const showDateColumn = applied.from !== applied.to;
  const colCount = showDateColumn ? 9 : 8;
  const rangeErr = reportQ.isError && isVisitTotalsBadRangeError(reportQ.error);
  const filtersErr = filtersQ.isError
    ? getUserFacingError(filtersQ.error, "Не удалось загрузить параметры фильтра.")
    : null;
  const reportErr =
    reportQ.isError && !rangeErr ? getUserFacingError(reportQ.error, "Не удалось загрузить отчёт.") : null;

  if (!hydrated || !tenantSlug) return <p className="text-sm text-muted-foreground">Загрузка...</p>;

  const periodBtn = formatDateRangeButton(draft.from, draft.to);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Итоги визитов</h1>
          <p className="text-xs text-muted-foreground">Отчёт: Итоги визитов</p>
        </div>
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
          <div className="grid grid-cols-1 gap-x-2 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
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
              placeholder="Статус заказа"
              items={orderStatusItems}
              selectedValues={draft.order_status_ids}
              onChange={(v) => setDraft((d) => ({ ...d, order_status_ids: v, page: 1 }))}
              searchPlaceholder="Статус"
              selectAllLabel="Выбрать все"
            />
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
              title="Сбросить"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" size="sm" className="h-8" onClick={() => setApplied({ ...draft, page: 1 })}>
              Применить
            </Button>
          </div>
        </CardContent>
      </Card>

      {filtersErr ? <p className="text-sm text-destructive">{filtersErr}</p> : null}

      {rangeErr && (
        <p className="text-sm text-destructive">Период не более 93 дней. Сократите диапазон дат.</p>
      )}

      {reportErr ? <p className="text-sm text-destructive">{reportErr}</p> : null}

      {exportErr ? <p className="text-sm text-destructive">{exportErr}</p> : null}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 py-3">
          <div className="flex flex-wrap items-center gap-2">
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
            <table
              className={cn(
                "w-full border-collapse text-xs",
                showDateColumn ? "min-w-[960px]" : "min-w-[820px]"
              )}
            >
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="px-2 py-2 font-medium">Агент</th>
                  {showDateColumn ? (
                    <th className="px-2 py-2 font-medium">Дата</th>
                  ) : null}
                  <th className="px-2 py-2 font-medium">Первая активность</th>
                  <th className="px-2 py-2 font-medium">Последняя активность</th>
                  <th className="px-2 py-2 font-medium tabular-nums">План</th>
                  <th className="px-2 py-2 font-medium tabular-nums">Посещенные</th>
                  <th className="px-2 py-2 font-medium tabular-nums">Не посещенные</th>
                  <th className="px-2 py-2 font-medium tabular-nums">Общее кол.во заказов</th>
                  <th className="px-2 py-2 font-medium tabular-nums">Общая сумма заказов</th>
                </tr>
              </thead>
              <tbody>
                {reportQ.isLoading ? (
                  <tr>
                    <td colSpan={colCount} className="px-2 py-8 text-center text-muted-foreground">
                      Загрузка…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={colCount} className="px-2 py-8 text-center text-muted-foreground">
                      Пусто
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr
                      key={`${r.work_date}-${r.agent_id}-${r.row_number}`}
                      className="border-b border-border/60 hover:bg-muted/20"
                    >
                      <td className="px-2 py-1.5">{r.agent_label}</td>
                      {showDateColumn ? (
                        <td className="px-2 py-1.5 tabular-nums">{fmtDateRu(r.work_date)}</td>
                      ) : null}
                      <td className="px-2 py-1.5 text-muted-foreground">{fmtCell(r.first_activity_at)}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{fmtCell(r.last_activity_at)}</td>
                      <td className="px-2 py-1.5 tabular-nums">{r.planned}</td>
                      <td className="px-2 py-1.5 tabular-nums">{r.visited}</td>
                      <td className="px-2 py-1.5 tabular-nums">{r.not_visited}</td>
                      <td className="px-2 py-1.5 tabular-nums">{r.orders_count}</td>
                      <td className="px-2 py-1.5 tabular-nums">{r.sales_sum}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {total > 0 && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                Показано {total === 0 ? 0 : (applied.page - 1) * applied.limit + 1} —{" "}
                {Math.min(applied.page * applied.limit, total)} / {total}
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
