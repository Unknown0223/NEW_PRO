"use client";

import { useDeferredValue, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { CalendarDays, FileSpreadsheet, Map, RotateCcw, Search } from "lucide-react";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { SearchableMultiSelectPanel } from "@/components/ui/searchable-multi-select-panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getUserFacingError } from "@/lib/error-utils";
import { isAxiosError } from "axios";

type FilterOptions = {
  branches: Array<{ id: string; label: string }>;
  expeditors: Array<{
    id: number;
    name: string;
    code: string;
    branch: string | null;
    app_access: boolean;
    label: string;
  }>;
};

type ReportRow = {
  row_number: number;
  expeditor_id: number;
  expeditor_name: string;
  expeditor_code: string;
  branch: string | null;
  app_access: boolean;
  actual_time_sec: number;
  calculated_time_sec: number;
  calculated_route_m: number;
  expected_route_m: number;
  expected_time_sec: number;
  visits_count: number;
  at_point: number;
  outside_point: number;
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
  const from = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
  return { from, to };
}

function buildFilterState(bounds: { from: string; to: string }) {
  return {
    ...bounds,
    branch_names: [] as string[],
    expeditor_ids: [] as string[],
    app_users_only: false,
    page: 1,
    limit: 10
  };
}

/** Jadvalda telefon prefiksini ko‘rsatmaymiz (DB ismida bo‘lsa ham). */
function displayExpeditorName(name: string): string {
  const cleaned = name.replace(/^\+?\d{9,15}[\s\u00a0\u202f]+/, "").replace(/\s+/g, " ").trim();
  return cleaned || name;
}

function formatDurationRu(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  if (sec <= 0) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} час${h === 1 ? "" : h < 5 ? "а" : "ов"}`);
  if (m > 0) {
    const mm =
      m % 10 === 1 && m % 100 !== 11
        ? "минута"
        : m % 10 >= 2 && m % 10 <= 4 && (m % 100 < 10 || m % 100 >= 20)
          ? "минуты"
          : "минут";
    parts.push(`${m} ${mm}`);
  }
  if (s > 0 || parts.length === 0) {
    const ss =
      s % 10 === 1 && s % 100 !== 11
        ? "секунда"
        : s % 10 >= 2 && s % 10 <= 4 && (s % 100 < 10 || s % 100 >= 20)
          ? "секунды"
          : "секунд";
    parts.push(`${s} ${ss}`);
  }
  return parts.join(" ");
}

function formatDistanceRu(meters: number): string {
  const m = Math.max(0, Math.round(meters));
  if (m <= 0) return "—";
  if (m < 1000) return `${m} м`;
  const km = Math.floor(m / 1000);
  const rest = m % 1000;
  return rest > 0 ? `${km} км, ${rest} м` : `${km} км`;
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
      triggerClassName={FILTER_TRIGGER}
      items={items}
      selected={new Set(selectedValues)}
      onSelectedChange={(next) => {
        const resolved = typeof next === "function" ? next(new Set(selectedValues)) : next;
        onChange(Array.from(resolved));
      }}
      searchable
      searchPlaceholder={searchPlaceholder}
      minPopoverWidth={220}
      maxListHeightClass="max-h-36"
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
  if (a.branch_names.length) p.set("branch_names", a.branch_names.join(","));
  if (a.expeditor_ids.length) p.set("expeditor_ids", a.expeditor_ids.join(","));
  if (a.app_users_only) p.set("app_users_only", "1");
  if (search?.trim()) p.set("search", search.trim());
}

export default function ReportGpsPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const bounds = useMemo(() => defaultRange(), []);
  const [draft, setDraft] = useState(() => buildFilterState(bounds));
  const [applied, setApplied] = useState(() => buildFilterState(bounds));
  const [tableSearch, setTableSearch] = useState("");
  const deferredSearch = useDeferredValue(tableSearch);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const dateAnchorRef = useRef<HTMLButtonElement>(null);

  const optsQ = useQuery({
    queryKey: ["gps-delivery-routes-filter-options", tenantSlug],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: FilterOptions }>(
        `/api/${tenantSlug}/reports/gps-delivery-routes/filter-options`
      );
      return data.data;
    }
  });

  const reportQ = useQuery({
    queryKey: ["gps-delivery-routes", tenantSlug, applied, deferredSearch],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.report,
    queryFn: async () => {
      const p = new URLSearchParams();
      appendParams(p, applied, deferredSearch);
      const { data } = await api.get<{ data: ReportPayload }>(
        `/api/${tenantSlug}/reports/gps-delivery-routes?${p.toString()}`
      );
      return data.data;
    }
  });

  const branchItems = useMemo(
    () => (optsQ.data?.branches ?? []).map((b) => ({ id: b.id, title: b.label })),
    [optsQ.data]
  );
  const expeditorItems = useMemo(() => {
    let list = optsQ.data?.expeditors ?? [];
    if (draft.branch_names.length) {
      const set = new Set(draft.branch_names);
      list = list.filter((e) => e.branch && set.has(e.branch));
    }
    if (draft.app_users_only) list = list.filter((e) => e.app_access);
    return list.map((e) => ({ id: String(e.id), title: e.label }));
  }, [optsQ.data, draft.branch_names, draft.app_users_only]);

  const totalPages = Math.max(1, Math.ceil((reportQ.data?.total ?? 0) / applied.limit));

  async function exportExcel() {
    if (!tenantSlug) return;
    setExporting(true);
    setExportError(null);
    try {
      const p = new URLSearchParams();
      appendParams(p, { ...applied, page: 1, limit: 5000 }, deferredSearch);
      const res = await api.get<Blob>(
        `/api/${tenantSlug}/reports/gps-delivery-routes/export?${p.toString()}`,
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "otchet-po-marshrutam-dostavshchikov.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(
        isAxiosError(e) ? getUserFacingError(e) : e instanceof Error ? e.message : "Export xato"
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Отчёт по GPS</h1>
          <p className="mt-1 text-sm text-muted-foreground">Отчёт по маршрутам доставщиков</p>
        </div>
        <Link
          href="/reports/gps/map"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
        >
          <Map className="size-3.5" />
          GPS мониторинг (карта)
        </Link>
      </div>

      <Card className="shadow-sm">
        <CardContent className="flex flex-wrap items-end gap-2 pt-4">
          <div className="w-[180px] min-w-[160px]">
            <MultiFilter
              placeholder="Филиалы"
              items={branchItems}
              selectedValues={draft.branch_names}
              onChange={(branch_names) => setDraft((d) => ({ ...d, branch_names }))}
              searchPlaceholder="Филиал…"
            />
          </div>
          <div className="w-[220px] min-w-[180px]">
            <MultiFilter
              placeholder="Доставщик"
              items={expeditorItems}
              selectedValues={draft.expeditor_ids}
              onChange={(expeditor_ids) => setDraft((d) => ({ ...d, expeditor_ids }))}
              searchPlaceholder="Доставщик…"
            />
          </div>
          <label className="flex h-8 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-2.5 text-xs font-medium shadow-sm">
            <input
              type="checkbox"
              className="accent-primary"
              checked={draft.app_users_only}
              onChange={(e) => setDraft((d) => ({ ...d, app_users_only: e.target.checked }))}
            />
            Ilova foydalanuvchilari
          </label>
          <button
            ref={dateAnchorRef}
            type="button"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-8 gap-1.5 text-xs font-normal",
              dateOpen && "border-primary/60 bg-primary/5"
            )}
            onClick={() => setDateOpen((o) => !o)}
          >
            <CalendarDays className="size-3.5" />
            {formatDateRangeButton(draft.from, draft.to)}
          </button>
          <DateRangePopover
            open={dateOpen}
            onOpenChange={setDateOpen}
            anchorRef={dateAnchorRef}
            dateFrom={draft.from}
            dateTo={draft.to}
            onApply={({ dateFrom, dateTo }) =>
              setDraft((d) => ({ ...d, from: dateFrom, to: dateTo }))
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8"
            title="Сброс"
            onClick={() => {
              const next = buildFilterState(defaultRange());
              setDraft(next);
              setApplied(next);
              setTableSearch("");
            }}
          >
            <RotateCcw className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 bg-teal-700 px-4 text-xs font-semibold hover:bg-teal-800"
            onClick={() => setApplied({ ...draft, page: 1 })}
          >
            Применить
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
          <CardTitle className="text-base font-semibold">Отчёт по маршрутам доставщиков</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm"
              value={applied.limit}
              onChange={(e) => {
                const limit = Number(e.target.value) || 10;
                setDraft((d) => ({ ...d, limit }));
                setApplied((a) => ({ ...a, limit, page: 1 }));
              }}
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={tableSearch}
                onChange={(e) => {
                  setTableSearch(e.target.value);
                  setApplied((a) => ({ ...a, page: 1 }));
                }}
                placeholder="Поиск"
                className="h-8 w-[160px] pl-7 text-xs"
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5 bg-emerald-600 text-xs font-semibold hover:bg-emerald-700"
              disabled={exporting || reportQ.isFetching}
              onClick={() => void exportExcel()}
            >
              <FileSpreadsheet className="size-3.5" />
              Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {exportError ? <p className="mb-2 text-xs text-destructive">{exportError}</p> : null}
          {reportQ.isError ? (
            <p className="text-sm text-destructive">
              {isAxiosError(reportQ.error)
                ? getUserFacingError(reportQ.error)
                : "Hisobot yuklanmadi"}
            </p>
          ) : null}
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[1100px] text-left text-xs">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="px-2 py-2 font-semibold">Имя экспедитора</th>
                  <th className="px-2 py-2 font-semibold">Код экспедитора</th>
                  <th className="px-2 py-2 font-semibold">Фактическое время</th>
                  <th className="px-2 py-2 font-semibold">Расчётное время</th>
                  <th className="px-2 py-2 font-semibold">Расчётная длина маршрута</th>
                  <th className="px-2 py-2 font-semibold">Ожидаемая длина маршрута</th>
                  <th className="px-2 py-2 font-semibold">Ожидаемое время</th>
                  <th className="px-2 py-2 font-semibold">Количество визитов</th>
                  <th className="px-2 py-2 font-semibold">Был в точке</th>
                  <th className="px-2 py-2 font-semibold">Вне точки</th>
                </tr>
              </thead>
              <tbody>
                {(reportQ.data?.rows ?? []).length === 0 && !reportQ.isLoading ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                      Маълумот топилмади
                    </td>
                  </tr>
                ) : null}
                {(reportQ.data?.rows ?? []).map((r) => (
                  <tr key={r.expeditor_id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-2 py-2 font-medium">{displayExpeditorName(r.expeditor_name)}</td>
                    <td className="px-2 py-2 tabular-nums text-muted-foreground">{r.expeditor_code}</td>
                    <td className="px-2 py-2">{formatDurationRu(r.actual_time_sec)}</td>
                    <td className="px-2 py-2">{formatDurationRu(r.calculated_time_sec)}</td>
                    <td className="px-2 py-2">{formatDistanceRu(r.calculated_route_m)}</td>
                    <td className="px-2 py-2">{formatDistanceRu(r.expected_route_m)}</td>
                    <td className="px-2 py-2">{formatDurationRu(r.expected_time_sec)}</td>
                    <td className="px-2 py-2 tabular-nums">{r.visits_count}</td>
                    <td className="px-2 py-2 tabular-nums">{r.at_point}</td>
                    <td className="px-2 py-2 tabular-nums">{r.outside_point}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Показано{" "}
              {reportQ.data?.total
                ? `${(applied.page - 1) * applied.limit + 1} - ${Math.min(applied.page * applied.limit, reportQ.data.total)} / ${reportQ.data.total}`
                : "0"}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={applied.page <= 1}
                onClick={() => setApplied((a) => ({ ...a, page: a.page - 1 }))}
              >
                ‹
              </Button>
              <span className="px-2 tabular-nums">
                {applied.page} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={applied.page >= totalPages}
                onClick={() => setApplied((a) => ({ ...a, page: a.page + 1 }))}
              >
                ›
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
