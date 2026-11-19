"use client";

import { useRef, useState } from "react";
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
  client_active: Array<{ id: string; label: string }>;
  statuses: Array<{ id: string; label: string }>;
  agents: Array<{ id: number; name: string; code: string }>;
  supervisors: Array<{ id: number; name: string; code: string }>;
  categories: Array<{ id: number; name: string }>;
  inventory_types: string[];
  payment_methods: Array<{ id: string; label: string }>;
  client_categories: string[];
  territory_1: string[];
  territory_2: string[];
  territory_3: string[];
};

type ReportRow = {
  row_number: number;
  client_id: number;
  client_name: string;
  phone: string;
  address: string;
  city: string;
  agent_name: string;
  supervisor_name: string;
  inventory_types: string;
  equipment_count: number;
  order_count: number;
  qty: string;
  amount: string;
};

type ReportData = {
  rows: ReportRow[];
  totals: { equipment_count: number; order_count: number; qty: string; amount: string };
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

const emptyDraft = (from: string, to: string) => ({
  date_type: "order_date",
  from,
  to,
  client_active: "all",
  statuses: [] as string[],
  agent_ids: [] as string[],
  supervisor_ids: [] as string[],
  category_ids: [] as string[],
  inventory_types: [] as string[],
  payment_methods: [] as string[],
  client_categories: [] as string[],
  territory_1_list: [] as string[],
  territory_2_list: [] as string[],
  territory_3_list: [] as string[],
  search: "",
  page: 1,
  limit: 50
});

export default function ReportInventoryPage() {
  const canExport = usePermissions().has("reports.po_inventaryu.export");
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
    queryKey: ["report-inventory-filters", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: FilterOptions }>(`/api/${tenantSlug}/reports/inventory/filter-options`);
      return data.data;
    }
  });

  const reportQ = useQuery({
    queryKey: ["report-inventory", tenantSlug, applied],
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
      const { data } = await api.get<{ data: ReportData }>(`/api/${tenantSlug}/reports/inventory?${p.toString()}`);
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
  const supervisorItems = (opts?.supervisors ?? []).map((x) => ({
    id: String(x.id),
    title: x.name,
    searchText: [x.name, x.code].filter(Boolean).join(" ")
  }));
  const categoryItems = (opts?.categories ?? []).map((x) => ({ id: String(x.id), title: x.name }));
  const statusItems = (opts?.statuses ?? []).map((x) => ({ id: x.id, title: x.label }));
  const inventoryItems = (opts?.inventory_types ?? []).map((x) => ({ id: x, title: x }));
  const paymentItems = (opts?.payment_methods ?? []).map((x) => ({ id: x.id, title: x.label }));
  const clientCategoryItems = (opts?.client_categories ?? []).map((x) => ({ id: x, title: x }));
  const territory1Items = (opts?.territory_1 ?? []).map((x) => ({ id: x, title: x }));
  const territory2Items = (opts?.territory_2 ?? []).map((x) => ({ id: x, title: x }));
  const territory3Items = (opts?.territory_3 ?? []).map((x) => ({ id: x, title: x }));
  const totalPages = reportQ.data ? Math.max(1, Math.ceil(reportQ.data.total / reportQ.data.limit)) : 1;
  const rows = (reportQ.data?.rows ?? []).filter((r) => {
    const q = tableSearch.trim().toLowerCase();
    if (!q) return true;
    return [r.client_name, r.phone, r.agent_name, r.inventory_types, r.city].join(" ").toLowerCase().includes(q);
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
      const res = await api.get<Blob>(`/api/${tenantSlug}/reports/inventory/export?${p.toString()}`, {
        responseType: "blob"
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "po-inventaryu.xlsx";
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
        <h1 className="text-lg font-semibold">По инвентарю</h1>
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
        <FilterSelect
          emptyLabel="Тип даты"
          value={draft.date_type}
          onChange={(e) => setDraft((d) => ({ ...d, date_type: e.target.value || "order_date" }))}
        >
          {(opts?.date_types ?? [{ id: "order_date", label: "Дата заявки" }]).map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          emptyLabel="Активность"
          value={draft.client_active}
          onChange={(e) => setDraft((d) => ({ ...d, client_active: e.target.value || "all" }))}
        >
          {(opts?.client_active ?? [{ id: "all", label: "Все клиенты" }]).map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </FilterSelect>
        <Input
          className="h-9 max-w-xs"
          value={draft.search}
          onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
          placeholder="Клиент / телефон / агент"
        />
      </div>

      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
        <MultiFilter placeholder="Тип инвентаря" items={inventoryItems} selectedValues={draft.inventory_types} onChange={(v) => setDraft((d) => ({ ...d, inventory_types: v }))} />
        <MultiFilter placeholder="Тип оплаты" items={paymentItems} selectedValues={draft.payment_methods} onChange={(v) => setDraft((d) => ({ ...d, payment_methods: v }))} />
        <MultiFilter placeholder="Категория товара" items={categoryItems} selectedValues={draft.category_ids} onChange={(v) => setDraft((d) => ({ ...d, category_ids: v }))} />
        <MultiFilter placeholder="Статус" items={statusItems} selectedValues={draft.statuses} onChange={(v) => setDraft((d) => ({ ...d, statuses: v }))} />
        <MultiFilter placeholder="Супервайзер" items={supervisorItems} selectedValues={draft.supervisor_ids} onChange={(v) => setDraft((d) => ({ ...d, supervisor_ids: v }))} />
        <MultiFilter placeholder="Агент" items={agentItems} selectedValues={draft.agent_ids} onChange={(v) => setDraft((d) => ({ ...d, agent_ids: v }))} />
        <MultiFilter placeholder="Категория клиента" items={clientCategoryItems} selectedValues={draft.client_categories} onChange={(v) => setDraft((d) => ({ ...d, client_categories: v }))} />
        <MultiFilter placeholder="Зона" items={territory1Items} selectedValues={draft.territory_1_list} onChange={(v) => setDraft((d) => ({ ...d, territory_1_list: v }))} />
        <MultiFilter placeholder="Область" items={territory2Items} selectedValues={draft.territory_2_list} onChange={(v) => setDraft((d) => ({ ...d, territory_2_list: v }))} />
        <MultiFilter placeholder="Город" items={territory3Items} selectedValues={draft.territory_3_list} onChange={(v) => setDraft((d) => ({ ...d, territory_3_list: v }))} />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span>Клиентов: {reportQ.data?.total ?? 0}</span>
        <span>Инвентарь: {formatNumberGrouped(reportQ.data?.totals.equipment_count ?? 0, { maxFractionDigits: 0 })}</span>
        <span>Заказов: {formatNumberGrouped(reportQ.data?.totals.order_count ?? 0, { maxFractionDigits: 0 })}</span>
        <span>Сумма: {formatNumberGrouped(reportQ.data?.totals.amount ?? 0, { maxFractionDigits: 0 })}</span>
        <Input className="ml-auto h-8 max-w-xs" value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} placeholder="Фильтр в таблице…" />
      </div>

      <div className="overflow-auto rounded-lg border">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              {["#", "Клиент", "Телефон", "Город", "Агент", "Супервайзер", "Тип инвентаря", "Инв.", "Заказов", "Кол-во", "Сумма"].map((h) => (
                <th key={h} className="p-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reportQ.isLoading || rows.length === 0 ? (
              <tr>
                <td className="p-4 text-muted-foreground" colSpan={11}>
                  {reportQ.isLoading ? "Загрузка…" : "Нет данных"}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.client_id} className="border-t">
                  <td className="p-2">{r.row_number}</td>
                  <td className="p-2 font-medium">{r.client_name}</td>
                  <td className="p-2">{r.phone || "—"}</td>
                  <td className="p-2">{r.city || "—"}</td>
                  <td className="p-2">{r.agent_name || "—"}</td>
                  <td className="p-2">{r.supervisor_name || "—"}</td>
                  <td className="p-2">{r.inventory_types || "—"}</td>
                  <td className="p-2 text-right">{r.equipment_count}</td>
                  <td className="p-2 text-right">{r.order_count}</td>
                  <td className="p-2 text-right">{formatNumberGrouped(r.qty, { maxFractionDigits: 3 })}</td>
                  <td className="p-2 text-right">{formatNumberGrouped(r.amount, { maxFractionDigits: 0 })}</td>
                </tr>
              ))
            )}
          </tbody>
          {reportQ.data && rows.length > 0 ? (
            <tfoot className="border-t bg-muted/30 font-medium">
              <tr>
                <td className="p-2" colSpan={7}>
                  Общий итог
                </td>
                <td className="p-2 text-right">{reportQ.data.totals.equipment_count}</td>
                <td className="p-2 text-right">{reportQ.data.totals.order_count}</td>
                <td className="p-2 text-right">{formatNumberGrouped(reportQ.data.totals.qty, { maxFractionDigits: 3 })}</td>
                <td className="p-2 text-right">{formatNumberGrouped(reportQ.data.totals.amount, { maxFractionDigits: 0 })}</td>
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
