"use client";

import { Fragment, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, FileSpreadsheet, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import { usePermissions } from "@/lib/use-permissions";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { FilterSelect } from "@/components/ui/filter-select";
import { SearchableMultiSelectPanel } from "@/components/ui/searchable-multi-select-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { monthToDateRange } from "@/components/dashboard/shared/date-ranges";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { cn } from "@/lib/utils";

type FilterOptions = {
  date_types: Array<{ id: string; label: string }>;
  statuses: Array<{ id: string; label: string }>;
  expeditors: Array<{ id: number; name: string; code: string }>;
  categories: Array<{ id: number; name: string }>;
  products: Array<{ id: number; name: string; sku: string }>;
};

type Cell = { block_count: number; volume: string; qty: string; amount: string };
type Col = { expeditor_id: number | null; expeditor_name: string };
type ReportRow = {
  row_number: number;
  product_id: number;
  product_name: string;
  category_name: string;
  cells: Record<string, Cell>;
};
type ReportData = {
  rows: ReportRow[];
  columns: Col[];
  column_totals: Record<string, Cell & { invoice_count: number }>;
  page: number;
  limit: number;
  total: number;
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

function money(v: string | number) {
  return formatNumberGrouped(v, { maxFractionDigits: 0 });
}

function colKey(id: number | null) {
  return id == null ? "none" : String(id);
}

const emptyDraft = (from: string, to: string) => ({
  date_type: "shipped_date",
  from,
  to,
  statuses: [] as string[],
  expeditor_ids: [] as string[],
  category_ids: [] as string[],
  product_ids: [] as string[],
  search: "",
  page: 1,
  limit: 50
});

export default function ReportExpeditorShipmentsPage() {
  const canExport = usePermissions().has("reports.otgruzki_ekspeditorov.export");
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const { from: from0, to: to0 } = monthToDateRange();
  const [dateOpen, setDateOpen] = useState(false);
  const dateAnchorRef = useRef<HTMLButtonElement>(null);
  const [exporting, setExporting] = useState(false);
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
      Object.entries(applied).forEach(([k, v]) => {
        if (Array.isArray(v)) {
          if (v.length > 0) p.set(k, v.join(","));
          return;
        }
        if (v === "" || v === "all") return;
        p.set(k, String(v));
      });
      const { data } = await api.get<{ data: ReportData }>(
        `/api/${tenantSlug}/reports/expeditor-shipments?${p.toString()}`
      );
      return data.data;
    }
  });

  if (!hydrated || !tenantSlug) return <p className="p-6 text-sm text-muted-foreground">Загрузка...</p>;

  const opts = filtersQ.data;
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
  const columns = reportQ.data?.columns ?? [];
  const rows = reportQ.data?.rows ?? [];
  const totals = reportQ.data?.column_totals ?? {};
  const totalPages = reportQ.data ? Math.max(1, Math.ceil(reportQ.data.total / reportQ.data.limit)) : 1;

  async function exportXlsx() {
    if (!tenantSlug || !canExport) return;
    setExporting(true);
    try {
      const p = new URLSearchParams();
      Object.entries(applied).forEach(([k, v]) => {
        if (Array.isArray(v)) {
          if (v.length > 0) p.set(k, v.join(","));
          return;
        }
        if (v === "" || v === "all") return;
        p.set(k, String(v));
      });
      p.set("export_limit", "2000");
      const res = await api.get<Blob>(`/api/${tenantSlug}/reports/expeditor-shipments/export?${p.toString()}`, {
        responseType: "blob"
      });
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
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Отгрузки по экспедиторам</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const next = emptyDraft(from0, to0);
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
        <FilterSelect
          emptyLabel="Тип даты"
          value={draft.date_type}
          onChange={(e) => setDraft((d) => ({ ...d, date_type: e.target.value || "shipped_date" }))}
        >
          {(opts?.date_types ?? [{ id: "shipped_date", label: "Дата отгрузки" }]).map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </FilterSelect>
        <button
          ref={dateAnchorRef}
          type="button"
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs",
            dateOpen && "border-primary/60 bg-primary/5"
          )}
          onClick={() => setDateOpen((o) => !o)}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          <span>{formatDateRangeButton(draft.from, draft.to)}</span>
        </button>
        <DateRangePopover
          open={dateOpen}
          onOpenChange={setDateOpen}
          anchorRef={dateAnchorRef}
          dateFrom={draft.from}
          dateTo={draft.to}
          onApply={({ dateFrom, dateTo }) => setDraft((d) => ({ ...d, from: dateFrom, to: dateTo }))}
        />
        <Input
          className="h-9 max-w-xs"
          value={draft.search}
          onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
          placeholder="Товар / категория"
        />
      </div>

      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
        <MultiFilter placeholder="Экспедитор" items={expeditorItems} selectedValues={draft.expeditor_ids} onChange={(v) => setDraft((d) => ({ ...d, expeditor_ids: v }))} />
        <MultiFilter placeholder="Статус" items={statusItems} selectedValues={draft.statuses} onChange={(v) => setDraft((d) => ({ ...d, statuses: v }))} />
        <MultiFilter placeholder="Категория товара" items={categoryItems} selectedValues={draft.category_ids} onChange={(v) => setDraft((d) => ({ ...d, category_ids: v }))} />
        <MultiFilter placeholder="Продукт" items={productItems} selectedValues={draft.product_ids} onChange={(v) => setDraft((d) => ({ ...d, product_ids: v }))} />
      </div>

      <div className="text-sm">Товаров: {reportQ.data?.total ?? 0}</div>

      <div className="overflow-auto rounded-lg border">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="sticky left-0 z-10 bg-muted/50 p-2" rowSpan={2}>
                Товар
              </th>
              {columns.map((c) => (
                <th key={colKey(c.expeditor_id)} className="p-2 text-center" colSpan={4}>
                  {c.expeditor_name}
                </th>
              ))}
            </tr>
            <tr>
              {columns.map((c) => (
                <Fragment key={`${colKey(c.expeditor_id)}-sub`}>
                  <th className="p-2 text-right">Блок</th>
                  <th className="p-2 text-right">Объём</th>
                  <th className="p-2 text-right">Кол-во</th>
                  <th className="p-2 text-right">Сумма</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {reportQ.isLoading || rows.length === 0 ? (
              <tr>
                <td className="p-4 text-muted-foreground" colSpan={Math.max(1, 1 + columns.length * 4)}>
                  {reportQ.isLoading ? "Загрузка…" : "Нет данных"}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.product_id} className="border-t">
                  <td className="sticky left-0 z-10 bg-background p-2">
                    <div className="font-medium">{r.product_name}</div>
                    {r.category_name ? <div className="text-xs text-muted-foreground">{r.category_name}</div> : null}
                  </td>
                  {columns.map((c) => {
                    const cell = r.cells[colKey(c.expeditor_id)];
                    const zero =
                      (cell?.block_count ?? 0) === 0 &&
                      Number.parseFloat(cell?.qty ?? "0") === 0 &&
                      Number.parseFloat(cell?.amount ?? "0") === 0;
                    return (
                      <Fragment key={`${r.product_id}-${colKey(c.expeditor_id)}`}>
                        <td className={cn("p-2 text-right", zero && "bg-red-50 text-muted-foreground")}>{cell?.block_count ?? 0}</td>
                        <td className={cn("p-2 text-right", zero && "bg-red-50 text-muted-foreground")}>{money(cell?.volume ?? 0)}</td>
                        <td className={cn("p-2 text-right", zero && "bg-red-50 text-muted-foreground")}>{money(cell?.qty ?? 0)}</td>
                        <td className={cn("p-2 text-right", zero && "bg-red-50 text-muted-foreground")}>{money(cell?.amount ?? 0)}</td>
                      </Fragment>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
          {columns.length > 0 && rows.length > 0 ? (
            <tfoot className="border-t bg-muted/30 font-medium">
              <tr>
                <td className="sticky left-0 z-10 bg-muted/30 p-2">Итого</td>
                {columns.map((c) => {
                  const t = totals[colKey(c.expeditor_id)];
                  return (
                    <Fragment key={`tot-${colKey(c.expeditor_id)}`}>
                      <td className="p-2 text-right">{t?.block_count ?? 0}</td>
                      <td className="p-2 text-right">{money(t?.volume ?? 0)}</td>
                      <td className="p-2 text-right">{money(t?.qty ?? 0)}</td>
                      <td className="p-2 text-right">{money(t?.amount ?? 0)}</td>
                    </Fragment>
                  );
                })}
              </tr>
              <tr>
                <td className="sticky left-0 z-10 bg-muted/30 p-2">Кол-во накладных</td>
                {columns.map((c) => (
                  <td key={`inv-${colKey(c.expeditor_id)}`} className="p-2 text-right" colSpan={4}>
                    {totals[colKey(c.expeditor_id)]?.invoice_count ?? 0}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          disabled={applied.page <= 1 || reportQ.isFetching}
          onClick={() => {
            const page = Math.max(1, applied.page - 1);
            setDraft((s) => ({ ...s, page }));
            setApplied((s) => ({ ...s, page }));
          }}
        >
          Назад
        </Button>
        <span className="text-sm">
          {applied.page} / {totalPages}
        </span>
        <Button
          variant="outline"
          disabled={applied.page >= totalPages || reportQ.isFetching}
          onClick={() => {
            const page = applied.page + 1;
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
