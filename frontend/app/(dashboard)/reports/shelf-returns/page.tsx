"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, FileSpreadsheet, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import { usePermissions } from "@/lib/use-permissions";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { FilterSelect } from "@/components/ui/filter-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { monthToDateRange } from "@/components/dashboard/shared/date-ranges";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { cn } from "@/lib/utils";
import {
  SHELF_RETURNS_COLS,
  ShelfMultiFilter,
  type ShelfReturnsFilterOptions,
  type ShelfReturnsReportData
} from "./shelf-returns-ui";

function money(v: string | number) {
  return formatNumberGrouped(v, { maxFractionDigits: 0 });
}

const emptyDraft = (from: string, to: string) => ({
  date_type: "shipped_date",
  from,
  to,
  statuses: [] as string[],
  agent_ids: [] as string[],
  expeditor_ids: [] as string[],
  category_ids: [] as string[],
  warehouse_ids: [] as string[],
  payment_methods: [] as string[],
  price_types: [] as string[],
  client_categories: [] as string[],
  territory_1_list: [] as string[],
  territory_2_list: [] as string[],
  territory_3_list: [] as string[],
  search: "",
  page: 1,
  limit: 50
});

export default function ReportShelfReturnsPage() {
  const canExport = usePermissions().has("reports.vozvrat_s_polki.export");
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const { from: from0, to: to0 } = monthToDateRange();
  const [dateOpen, setDateOpen] = useState(false);
  const dateAnchorRef = useRef<HTMLButtonElement>(null);
  const [exporting, setExporting] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const [draft, setDraft] = useState(() => emptyDraft(from0, to0));
  const [applied, setApplied] = useState(draft);

  const filtersQ = useQuery({
    queryKey: ["report-shelf-returns-filters", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: ShelfReturnsFilterOptions }>(
        `/api/${tenantSlug}/reports/shelf-returns/filter-options`
      );
      return data.data;
    }
  });

  const reportQ = useQuery({
    queryKey: ["report-shelf-returns", tenantSlug, applied],
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
      const { data } = await api.get<{ data: ShelfReturnsReportData }>(
        `/api/${tenantSlug}/reports/shelf-returns?${p.toString()}`
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
  const expeditorItems = (opts?.expeditors ?? []).map((x) => ({
    id: String(x.id),
    title: x.name,
    searchText: [x.name, x.code].filter(Boolean).join(" ")
  }));
  const categoryItems = (opts?.categories ?? []).map((x) => ({ id: String(x.id), title: x.name }));
  const warehouseItems = (opts?.warehouses ?? []).map((x) => ({
    id: String(x.id),
    title: x.name,
    searchText: [x.name, x.code].filter(Boolean).join(" ")
  }));
  const statusItems = (opts?.statuses ?? []).map((x) => ({ id: x.id, title: x.label }));
  const paymentItems = (opts?.payment_methods ?? []).map((x) => ({ id: x.id, title: x.label }));
  const priceTypeItems = (opts?.price_types ?? []).map((x) => ({ id: x.id, title: x.label }));
  const clientCategoryItems = (opts?.client_categories ?? []).map((x) => ({ id: x, title: x }));
  const territory1Items = (opts?.territory_1 ?? []).map((x) => ({ id: x, title: x }));
  const territory2Items = (opts?.territory_2 ?? []).map((x) => ({ id: x, title: x }));
  const territory3Items = (opts?.territory_3 ?? []).map((x) => ({ id: x, title: x }));
  const totalPages = reportQ.data ? Math.max(1, Math.ceil(reportQ.data.total / reportQ.data.limit)) : 1;
  const rows = (reportQ.data?.rows ?? []).filter((r) => {
    const q = tableSearch.trim().toLowerCase();
    if (!q) return true;
    return [r.client_name, r.product_name, r.order_number, r.agent_name, r.expeditor_name, r.territory]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

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
      p.set("export_limit", "5000");
      const res = await api.get<Blob>(`/api/${tenantSlug}/reports/shelf-returns/export?${p.toString()}`, {
        responseType: "blob"
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "vozvrat-s-polki.xlsx";
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
        <h1 className="text-lg font-semibold">Отчет по возвратам (возврат с полки)</h1>
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
          placeholder="Клиент / товар / № заказа"
        />
      </div>

      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
        <ShelfMultiFilter placeholder="Статус" items={statusItems} selectedValues={draft.statuses} onChange={(v) => setDraft((d) => ({ ...d, statuses: v }))} />
        <ShelfMultiFilter placeholder="Агент" items={agentItems} selectedValues={draft.agent_ids} onChange={(v) => setDraft((d) => ({ ...d, agent_ids: v }))} />
        <ShelfMultiFilter placeholder="Экспедитор" items={expeditorItems} selectedValues={draft.expeditor_ids} onChange={(v) => setDraft((d) => ({ ...d, expeditor_ids: v }))} />
        <ShelfMultiFilter placeholder="Категория товара" items={categoryItems} selectedValues={draft.category_ids} onChange={(v) => setDraft((d) => ({ ...d, category_ids: v }))} />
        <ShelfMultiFilter placeholder="Склад" items={warehouseItems} selectedValues={draft.warehouse_ids} onChange={(v) => setDraft((d) => ({ ...d, warehouse_ids: v }))} />
        <ShelfMultiFilter placeholder="Способ оплаты" items={paymentItems} selectedValues={draft.payment_methods} onChange={(v) => setDraft((d) => ({ ...d, payment_methods: v }))} />
        <ShelfMultiFilter placeholder="Тип цены" items={priceTypeItems} selectedValues={draft.price_types} onChange={(v) => setDraft((d) => ({ ...d, price_types: v }))} />
        <ShelfMultiFilter placeholder="Категория клиента" items={clientCategoryItems} selectedValues={draft.client_categories} onChange={(v) => setDraft((d) => ({ ...d, client_categories: v }))} />
        <ShelfMultiFilter placeholder="Зона" items={territory1Items} selectedValues={draft.territory_1_list} onChange={(v) => setDraft((d) => ({ ...d, territory_1_list: v }))} />
        <ShelfMultiFilter placeholder="Область" items={territory2Items} selectedValues={draft.territory_2_list} onChange={(v) => setDraft((d) => ({ ...d, territory_2_list: v }))} />
        <ShelfMultiFilter placeholder="Город" items={territory3Items} selectedValues={draft.territory_3_list} onChange={(v) => setDraft((d) => ({ ...d, territory_3_list: v }))} />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span>Всего: {reportQ.data?.total ?? 0}</span>
        <span>Сумма: {money(reportQ.data?.totals.amount ?? 0)}</span>
        <span>Кол-во: {money(reportQ.data?.totals.qty ?? 0)}</span>
        <span>Объём: {money(reportQ.data?.totals.volume ?? 0)}</span>
        <Input className="ml-auto h-8 max-w-xs" value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} placeholder="Фильтр в таблице…" />
      </div>

      <div className="overflow-auto rounded-lg border">
        <table className="w-full min-w-[1600px] text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              {SHELF_RETURNS_COLS.map((h) => (
                <th key={h} className="whitespace-nowrap p-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reportQ.isLoading || rows.length === 0 ? (
              <tr>
                <td className="p-4 text-muted-foreground" colSpan={SHELF_RETURNS_COLS.length}>
                  {reportQ.isLoading ? "Загрузка…" : "Нет данных"}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={`${r.order_id}-${r.product_id}-${r.row_number}`} className="border-t">
                  <td className="p-2 font-medium">{r.client_name}</td>
                  <td className="p-2">{r.territory || "—"}</td>
                  <td className="p-2">{r.product_name}</td>
                  <td className="p-2 text-right">{money(r.qty)}</td>
                  <td className="p-2 text-right">{money(r.amount)}</td>
                  <td className="p-2 text-right">{money(r.volume)}</td>
                  <td className="p-2">{r.order_number}</td>
                  <td className="p-2">{r.status_label}</td>
                  <td className="p-2">{r.agent_name || "—"}</td>
                  <td className="p-2">{r.expeditor_name || "—"}</td>
                  <td className="p-2">{r.warehouse_name || "—"}</td>
                  <td className="whitespace-nowrap p-2">{new Date(r.order_date).toLocaleString("ru-RU")}</td>
                  <td className="whitespace-nowrap p-2">{r.shipped_at ? new Date(r.shipped_at).toLocaleString("ru-RU") : "—"}</td>
                  <td className="p-2">{r.payment_method || "—"}</td>
                  <td className="p-2">{r.price_type || "—"}</td>
                  <td className="p-2">{r.product_category || "—"}</td>
                  <td className="p-2">{r.return_reason || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
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
