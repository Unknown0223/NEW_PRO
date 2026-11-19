"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, FileSpreadsheet, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import { usePermissions } from "@/lib/use-permissions";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { SearchableMultiSelectPanel } from "@/components/ui/searchable-multi-select-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { monthToDateRange, quickRangeToDates } from "@/components/dashboard/shared/date-ranges";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { cn } from "@/lib/utils";

type FilterOptions = {
  group_by: Array<{ id: string; label: string }>;
  agents: Array<{ id: number; name: string; code: string }>;
  categories: Array<{ id: number; name: string }>;
};

type ReportRow = {
  row_number: number;
  name: string;
  sum_a: string;
  sum_b: string;
  diff_sum: string;
  diff_pct: string | null;
  orders_a: number;
  orders_b: number;
  akb_a: number;
  akb_b: number;
  avg_a: string;
  avg_b: string;
};

type ReportTotals = Omit<ReportRow, "row_number" | "name">;

type ReportData = {
  rows: ReportRow[];
  totals: ReportTotals;
  page: number;
  limit: number;
  total: number;
  group_by: string;
  period_a: { from: string; to: string };
  period_b: { from: string; to: string };
};

type MultiItem = { id: string; title: string; searchText?: string };

function MultiFilter(props: {
  placeholder: string;
  items: MultiItem[];
  selectedValues: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <SearchableMultiSelectPanel
      label={props.placeholder}
      hideOuterLabel
      hidePopoverHeader
      triggerPlaceholder={props.placeholder}
      items={props.items}
      selected={new Set(props.selectedValues)}
      onSelectedChange={(next) => {
        const resolved = typeof next === "function" ? next(new Set(props.selectedValues)) : next;
        props.onChange(Array.from(resolved));
      }}
      searchable
      searchPlaceholder={props.placeholder}
      minPopoverWidth={260}
      maxListHeightClass="max-h-44"
    />
  );
}

function emptyDraft() {
  const { from: fromB, to: toB } = monthToDateRange();
  const prev = quickRangeToDates("prev_month")!;
  return {
    from_a: prev.from,
    to_a: prev.to,
    from_b: fromB,
    to_b: toB,
    group_by: "product",
    agent_ids: [] as string[],
    category_ids: [] as string[],
    search: "",
    page: 1,
    limit: 50
  };
}

function fmtNum(v: string | number, digits = 2) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return String(v);
  return formatNumberGrouped(n, { maxFractionDigits: digits });
}

function fmtPct(v: string | null) {
  if (v == null) return "—";
  return `${fmtNum(v, 2)}%`;
}

function reportQueryParams(
  applied: ReturnType<typeof emptyDraft>,
  extra?: Record<string, string>
) {
  const p = new URLSearchParams(extra);
  Object.entries(applied).forEach(([k, v]) => {
    if (Array.isArray(v)) {
      if (v.length > 0) p.set(k, v.join(","));
      return;
    }
    if (v !== "") p.set(k, String(v));
  });
  return p;
}

const TABLE_HEADERS = [
  "#",
  "Название",
  "Сумма A",
  "Сумма B",
  "Разница",
  "Δ %",
  "Заказов A",
  "Заказов B",
  "АКБ A",
  "АКБ B",
  "Средний A",
  "Средний B"
] as const;

function PeriodPicker(props: {
  label: string;
  from: string;
  to: string;
  onApply: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <span className="text-xs text-muted-foreground">{props.label}</span>
      <button
        ref={ref}
        type="button"
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs",
          open && "border-primary/60 bg-primary/5"
        )}
        onClick={() => setOpen((o) => !o)}
      >
        <CalendarDays className="h-3.5 w-3.5" />
        <span>{formatDateRangeButton(props.from, props.to)}</span>
      </button>
      <DateRangePopover
        open={open}
        onOpenChange={setOpen}
        anchorRef={ref}
        dateFrom={props.from}
        dateTo={props.to}
        onApply={({ dateFrom, dateTo }) => props.onApply(dateFrom, dateTo)}
      />
    </>
  );
}

export default function ReportSalesComparePage() {
  const canExport = usePermissions().has("reports.sravnitelnyy_analiz.export");
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const [exporting, setExporting] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [applied, setApplied] = useState(draft);

  const filtersQ = useQuery({
    queryKey: ["report-sales-compare-filters", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: FilterOptions }>(
        `/api/${tenantSlug}/reports/sales-compare/filter-options`
      );
      return data.data;
    }
  });

  const reportQ = useQuery({
    queryKey: ["report-sales-compare", tenantSlug, applied],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.report,
    queryFn: async () => {
      const { data } = await api.get<{ data: ReportData }>(
        `/api/${tenantSlug}/reports/sales-compare?${reportQueryParams(applied).toString()}`
      );
      return data.data;
    }
  });

  if (!hydrated || !tenantSlug) return <p className="p-6 text-sm text-muted-foreground">Загрузка...</p>;

  const opts = filtersQ.data;
  const agentItems = (opts?.agents ?? []).map((x) => ({
    id: String(x.id),
    title: x.name,
    searchText: [x.name, x.code].filter(Boolean).join(" ")
  }));
  const categoryItems = (opts?.categories ?? []).map((x) => ({ id: String(x.id), title: x.name }));
  const totalPages = reportQ.data ? Math.max(1, Math.ceil(reportQ.data.total / reportQ.data.limit)) : 1;
  const rows = reportQ.data?.rows ?? [];
  const totals = reportQ.data?.totals;

  function goPage(page: number) {
    const next = Math.min(totalPages, Math.max(1, page));
    setApplied((a) => ({ ...a, page: next }));
    setDraft((d) => ({ ...d, page: next }));
  }

  async function exportXlsx() {
    if (!tenantSlug || !canExport) return;
    setExporting(true);
    try {
      const res = await api.get<Blob>(
        `/api/${tenantSlug}/reports/sales-compare/export?${reportQueryParams(applied, { export_limit: "5000" }).toString()}`,
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sravnitelnyy-analiz-prodazh.xlsx";
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
        <h1 className="text-lg font-semibold">Сравнительный анализ продаж</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const next = emptyDraft();
              setDraft(next);
              setApplied(next);
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

      <div className="flex flex-wrap items-center gap-2">
        <PeriodPicker
          label="Период A"
          from={draft.from_a}
          to={draft.to_a}
          onApply={(from_a, to_a) => setDraft((d) => ({ ...d, from_a, to_a }))}
        />
        <PeriodPicker
          label="Период B"
          from={draft.from_b}
          to={draft.to_b}
          onApply={(from_b, to_b) => setDraft((d) => ({ ...d, from_b, to_b }))}
        />
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          value={draft.group_by}
          onChange={(e) => setDraft((d) => ({ ...d, group_by: e.target.value }))}
        >
          {(opts?.group_by ?? [{ id: "product", label: "По товарам" }]).map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </select>
        <Input
          className="h-9 max-w-xs"
          value={draft.search}
          onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
          placeholder="Поиск"
        />
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <MultiFilter
          placeholder="Агент"
          items={agentItems}
          selectedValues={draft.agent_ids}
          onChange={(v) => setDraft((d) => ({ ...d, agent_ids: v }))}
        />
        <MultiFilter
          placeholder="Категория товара"
          items={categoryItems}
          selectedValues={draft.category_ids}
          onChange={(v) => setDraft((d) => ({ ...d, category_ids: v }))}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span>Всего: {reportQ.data?.total ?? 0}</span>
        {totals ? (
          <>
            <span>Сумма A: {fmtNum(totals.sum_a)}</span>
            <span>Сумма B: {fmtNum(totals.sum_b)}</span>
            <span>Δ: {fmtNum(totals.diff_sum)} ({fmtPct(totals.diff_pct ?? null)})</span>
          </>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[960px] text-left text-xs">
          <thead className="bg-muted/50">
            <tr>
              {TABLE_HEADERS.map((h) => (
                <th key={h} className="px-2 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reportQ.isLoading || rows.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-2 py-6 text-center text-muted-foreground">
                  {reportQ.isLoading ? "Загрузка..." : "Нет данных"}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.row_number} className="border-t">
                  <td className="px-2 py-1.5">{r.row_number}</td>
                  <td className="px-2 py-1.5">{r.name}</td>
                  <td className="px-2 py-1.5">{fmtNum(r.sum_a)}</td>
                  <td className="px-2 py-1.5">{fmtNum(r.sum_b)}</td>
                  <td className="px-2 py-1.5">{fmtNum(r.diff_sum)}</td>
                  <td className="px-2 py-1.5">{fmtPct(r.diff_pct)}</td>
                  <td className="px-2 py-1.5">{r.orders_a}</td>
                  <td className="px-2 py-1.5">{r.orders_b}</td>
                  <td className="px-2 py-1.5">{r.akb_a}</td>
                  <td className="px-2 py-1.5">{r.akb_b}</td>
                  <td className="px-2 py-1.5">{fmtNum(r.avg_a)}</td>
                  <td className="px-2 py-1.5">{fmtNum(r.avg_b)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <Button variant="outline" size="sm" disabled={applied.page <= 1} onClick={() => goPage(applied.page - 1)}>
          Назад
        </Button>
        <span>
          {applied.page} / {totalPages}
        </span>
        <Button variant="outline" size="sm" disabled={applied.page >= totalPages} onClick={() => goPage(applied.page + 1)}>
          Вперёд
        </Button>
      </div>
    </div>
  );
}