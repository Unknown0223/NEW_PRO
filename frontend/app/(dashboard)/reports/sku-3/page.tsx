"use client";

import { Fragment, useRef, useState } from "react";
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
import { monthToDateRange } from "@/components/dashboard/shared/date-ranges";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { cn } from "@/lib/utils";

type FilterOptions = {
  agents: Array<{ id: number; name: string; code: string }>;
  expeditors: Array<{ id: number; name: string; code: string }>;
  products: Array<{ id: number; name: string; sku: string }>;
  price_types: Array<{ id: string; label: string }>;
  client_categories: string[];
  territory_1: string[];
  territory_2: string[];
  territory_3: string[];
};

type Cell = { amount: string; qty: string };
type ProductCol = { product_id: number; product_name: string; sku: string };
type ReportRow = { row_number: number; client_id: number; client_name: string; cells: Record<string, Cell> };
type ReportData = {
  rows: ReportRow[];
  products: ProductCol[];
  totals?: never;
  page: number;
  limit: number;
  total: number;
  okb: number;
  akb: number;
  need_products: boolean;
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

const emptyDraft = (from: string, to: string) => ({
  from,
  to,
  agent_ids: [] as string[],
  expeditor_ids: [] as string[],
  product_ids: [] as string[],
  price_types: [] as string[],
  client_categories: [] as string[],
  territory_1_list: [] as string[],
  territory_2_list: [] as string[],
  territory_3_list: [] as string[],
  search: "",
  page: 1,
  limit: 50
});

export default function ReportSku3Page() {
  const canExport = usePermissions().has("reports.po_sku_3.export");
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const { from: from0, to: to0 } = monthToDateRange();
  const [dateOpen, setDateOpen] = useState(false);
  const dateAnchorRef = useRef<HTMLButtonElement>(null);
  const [exporting, setExporting] = useState(false);
  const [draft, setDraft] = useState(() => emptyDraft(from0, to0));
  const [applied, setApplied] = useState(draft);

  const filtersQ = useQuery({
    queryKey: ["report-sku-3-filters", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: FilterOptions }>(`/api/${tenantSlug}/reports/sku-3/filter-options`);
      return data.data;
    }
  });

  const reportQ = useQuery({
    queryKey: ["report-sku-3", tenantSlug, applied],
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
      const { data } = await api.get<{ data: ReportData }>(`/api/${tenantSlug}/reports/sku-3?${p.toString()}`);
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
  const productItems = (opts?.products ?? []).map((x) => ({
    id: String(x.id),
    title: x.name,
    searchText: [x.name, x.sku].filter(Boolean).join(" ")
  }));
  const priceTypeItems = (opts?.price_types ?? []).map((x) => ({ id: x.id, title: x.label }));
  const clientCategoryItems = (opts?.client_categories ?? []).map((x) => ({ id: x, title: x }));
  const territory1Items = (opts?.territory_1 ?? []).map((x) => ({ id: x, title: x }));
  const territory2Items = (opts?.territory_2 ?? []).map((x) => ({ id: x, title: x }));
  const territory3Items = (opts?.territory_3 ?? []).map((x) => ({ id: x, title: x }));
  const products = reportQ.data?.products ?? [];
  const rows = reportQ.data?.rows ?? [];
  const totalPages = reportQ.data ? Math.max(1, Math.ceil(reportQ.data.total / reportQ.data.limit)) : 1;

  async function exportXlsx() {
    if (!tenantSlug || !canExport || applied.product_ids.length === 0) return;
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
      const res = await api.get<Blob>(`/api/${tenantSlug}/reports/sku-3/export?${p.toString()}`, {
        responseType: "blob"
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "po-sku-3.xlsx";
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
        <h1 className="text-lg font-semibold">По Sku 3.0</h1>
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
            <Button
              disabled={exporting || reportQ.isFetching || applied.product_ids.length === 0}
              onClick={() => void exportXlsx()}
            >
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
          placeholder="Клиент"
        />
      </div>

      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
        <MultiFilter placeholder="Продукты" items={productItems} selectedValues={draft.product_ids} onChange={(v) => setDraft((d) => ({ ...d, product_ids: v }))} />
        <MultiFilter placeholder="Агент" items={agentItems} selectedValues={draft.agent_ids} onChange={(v) => setDraft((d) => ({ ...d, agent_ids: v }))} />
        <MultiFilter placeholder="Экспедитор" items={expeditorItems} selectedValues={draft.expeditor_ids} onChange={(v) => setDraft((d) => ({ ...d, expeditor_ids: v }))} />
        <MultiFilter placeholder="Тип цены" items={priceTypeItems} selectedValues={draft.price_types} onChange={(v) => setDraft((d) => ({ ...d, price_types: v }))} />
        <MultiFilter placeholder="Категория клиента" items={clientCategoryItems} selectedValues={draft.client_categories} onChange={(v) => setDraft((d) => ({ ...d, client_categories: v }))} />
        <MultiFilter placeholder="Зона" items={territory1Items} selectedValues={draft.territory_1_list} onChange={(v) => setDraft((d) => ({ ...d, territory_1_list: v }))} />
        <MultiFilter placeholder="Область" items={territory2Items} selectedValues={draft.territory_2_list} onChange={(v) => setDraft((d) => ({ ...d, territory_2_list: v }))} />
        <MultiFilter placeholder="Город" items={territory3Items} selectedValues={draft.territory_3_list} onChange={(v) => setDraft((d) => ({ ...d, territory_3_list: v }))} />
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span>
          ОКБ: <b>{reportQ.data?.okb ?? 0}</b>
        </span>
        <span>
          АКБ: <b>{reportQ.data?.akb ?? 0}</b>
        </span>
        <span>Клиентов в таблице: {reportQ.data?.total ?? 0}</span>
      </div>

      {reportQ.data?.need_products ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Выберите продукты и нажмите «Применить»
        </p>
      ) : null}

      <div className="overflow-auto rounded-lg border">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="sticky left-0 z-10 bg-muted/50 p-2" rowSpan={2}>
                Торговая точка
              </th>
              {products.map((p) => (
                <th key={p.product_id} className="p-2 text-center" colSpan={2}>
                  {p.product_name}
                </th>
              ))}
            </tr>
            <tr>
              {products.map((p) => (
                <Fragment key={`${p.product_id}-sub`}>
                  <th className="p-2 text-right">Сумма</th>
                  <th className="p-2 text-right">Кол-во</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {reportQ.isLoading || (products.length > 0 && rows.length === 0 && !reportQ.data?.need_products) ? (
              <tr>
                <td className="p-4 text-muted-foreground" colSpan={Math.max(1, 1 + products.length * 2)}>
                  {reportQ.isLoading ? "Загрузка…" : "Нет данных"}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.client_id} className="border-t">
                  <td className="sticky left-0 z-10 bg-background p-2 font-medium">{r.client_name}</td>
                  {products.map((p) => {
                    const cell = r.cells[String(p.product_id)];
                    const amount = cell?.amount ?? "0";
                    const qty = cell?.qty ?? "0";
                    const zero = Number.parseFloat(amount) === 0 && Number.parseFloat(qty) === 0;
                    return (
                      <Fragment key={`${r.client_id}-${p.product_id}`}>
                        <td className={cn("p-2 text-right", zero && "bg-red-50 text-muted-foreground")}>{money(amount)}</td>
                        <td className={cn("p-2 text-right", zero && "bg-red-50 text-muted-foreground")}>{money(qty)}</td>
                      </Fragment>
                    );
                  })}
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
