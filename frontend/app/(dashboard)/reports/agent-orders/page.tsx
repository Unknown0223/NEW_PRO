"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { FilterSelect } from "@/components/ui/filter-select";
import { SearchableMultiSelectPanel } from "@/components/ui/searchable-multi-select-panel";
import { Button } from "@/components/ui/button";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import { orderTypeLabel } from "@/lib/order-types";

type FilterOptions = {
  date_types: Array<{ id: string; label: string }>;
  statuses: Array<{ id: string; label: string }>;
  order_types: Array<{ id: string; label: string }>;
  agents: Array<{ id: number; name: string; code: string }>;
  categories: Array<{ id: number; name: string }>;
  products: Array<{ id: number; name: string; sku: string }>;
  groups: Array<{ id: number; name: string }>;
  segments: Array<{ id: number; name: string }>;
  trade_directions: Array<{ id: string; name: string }>;
  client_categories: string[];
  price_types: string[];
  payment_methods: Array<{ id: string; label: string }>;
  territory_1: string[];
  territory_2: string[];
  territory_3: string[];
  territory_2_by_1?: Record<string, string[]>;
  territory_3_by_2?: Record<string, string[]>;
};

type AgentOrdersReport = {
  status_cards: Array<{ status: string; amount: string; qty: number; akb: number }>;
  agent_rows: Array<{
    agent_id: number | null;
    agent_name: string;
    agent_code: string;
    amount_total: string;
    amount_new: string;
    amount_confirmed: string;
    amount_delivering: string;
    amount_delivered: string;
    amount_cancelled: string;
    amount_returned: string;
    amount_return_processing: string;
    qty_total: number;
    qty_new: number;
    qty_confirmed: number;
    qty_delivering: number;
    qty_delivered: number;
    qty_cancelled: number;
    qty_returned: number;
    qty_return_processing: number;
    volume_total: string;
    volume_new: string;
    volume_confirmed: string;
    volume_delivering: string;
    volume_delivered: string;
    volume_cancelled: string;
    volume_returned: string;
    volume_return_processing: string;
    akb_total: number;
    akb_new: number;
    akb_confirmed: number;
    akb_delivering: number;
    akb_delivered: number;
    akb_cancelled: number;
    akb_returned: number;
    akb_return_processing: number;
  }>;
  category_matrix: {
    buckets: string[];
    rows: Array<{
      agent_id: number | null;
      agent_name: string;
      agent_code: string;
      values: Record<string, { amount: string; qty: number; volume: string; akb: number }>;
    }>;
  };
  segment_matrix: {
    buckets: string[];
    rows: Array<{
      agent_id: number | null;
      agent_name: string;
      agent_code: string;
      values: Record<string, { amount: string; qty: number; volume: string; akb: number }>;
    }>;
  };
};

function money(v: string | number) {
  return formatNumberGrouped(v, { maxFractionDigits: 0 });
}

type MetricMode = "akb" | "volume" | "amount" | "qty";

function metricLabels(mode: MetricMode): string {
  if (mode === "akb") return "АКБ";
  if (mode === "volume") return "Объем";
  if (mode === "qty") return "Количество";
  return "Сумма";
}

function kpiCardTone(status: string): { head: string; body: string } {
  switch (status) {
    case "all":
      return { head: "bg-rose-100/80 text-rose-800", body: "bg-rose-50/50" };
    case "new":
      return { head: "bg-sky-100/90 text-sky-800", body: "bg-sky-50/50" };
    case "cancelled":
      return { head: "bg-slate-100/90 text-slate-700", body: "bg-slate-50/50" };
    case "confirmed":
      return { head: "bg-lime-100/90 text-lime-800", body: "bg-lime-50/50" };
    case "delivering":
      return { head: "bg-amber-100/90 text-amber-800", body: "bg-amber-50/50" };
    case "delivered":
      return { head: "bg-emerald-100/90 text-emerald-800", body: "bg-emerald-50/50" };
    case "return_processing":
      return { head: "bg-fuchsia-100/90 text-fuchsia-800", body: "bg-fuchsia-50/50" };
    case "returned":
      return { head: "bg-violet-100/90 text-violet-800", body: "bg-violet-50/50" };
    default:
      return { head: "bg-muted text-foreground", body: "bg-card" };
  }
}

export default function ReportAgentOrdersPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const today = new Date();
  const from0 = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const to0 = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [draft, setDraft] = useState({
    date_type: "order_date",
    from: from0,
    to: to0,
    category_id: "",
    category_ids: [] as string[],
    product_id: "",
    product_ids: [] as string[],
    trade_direction: "",
    trade_directions: [] as string[],
    status: "",
    statuses: [] as string[],
    agent_id: "",
    agent_ids: [] as string[],
    client_category: "",
    client_categories: [] as string[],
    price_type: "",
    price_types: [] as string[],
    payment_method: "",
    payment_methods: [] as string[],
    order_type: "",
    order_types: [] as string[],
    product_group_id: "",
    product_group_ids: [] as string[],
    segment_id: "",
    segment_ids: [] as string[],
    consignment: "all",
    territory_1: "",
    territory_1_list: [] as string[],
    territory_2: "",
    territory_2_list: [] as string[],
    territory_3: "",
    territory_3_list: [] as string[]
  });
  const [applied, setApplied] = useState(draft);
  const [dateOpen, setDateOpen] = useState(false);
  const dateAnchorRef = useRef<HTMLButtonElement>(null);
  const [agentMetricMode, setAgentMetricMode] = useState<MetricMode>("amount");
  const [categoryMetricMode, setCategoryMetricMode] = useState<MetricMode>("amount");
  const [segmentMetricMode, setSegmentMetricMode] = useState<MetricMode>("amount");

  const filtersQ = useQuery({
    queryKey: ["report-agent-orders-filters", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: FilterOptions }>(`/api/${tenantSlug}/reports/agent-orders/filter-options`);
      return data.data;
    }
  });

  const reportQ = useQuery({
    queryKey: ["report-agent-orders", tenantSlug, applied],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.report,
    queryFn: async () => {
      const p = new URLSearchParams();
      Object.entries(applied).forEach(([k, v]) => {
        if (Array.isArray(v)) {
          if (v.length > 0) p.set(k, v.join(","));
          return;
        }
        if (v && v !== "all") p.set(k, String(v));
      });
      const { data } = await api.get<{ data: AgentOrdersReport }>(`/api/${tenantSlug}/reports/agent-orders?${p.toString()}`);
      return data.data;
    }
  });

  const cards = useMemo(() => {
    const map: Record<string, string> = {
      all: "Общий",
      new: "Новый",
      cancelled: "Отменен",
      confirmed: "Подтвержден к отгрузке",
      delivering: "Отгружен",
      delivered: "Доставлен",
      return_processing: "В процессе возврата",
      returned: "Возврат"
    };
    return (reportQ.data?.status_cards ?? []).map((c) => ({ ...c, label: map[c.status] ?? c.status }));
  }, [reportQ.data?.status_cards]);

  if (!hydrated || !tenantSlug) return <p className="text-sm text-muted-foreground">Загрузка...</p>;

  const opts = filtersQ.data;
  const productItems = (opts?.products ?? []).map((x) => ({ id: String(x.id), title: `${x.name}${x.sku ? ` (${x.sku})` : ""}` }));
  const agentItems = (opts?.agents ?? []).map((x) => ({ id: String(x.id), title: `${x.name}${x.code ? ` (${x.code})` : ""}` }));
  const territory1Items = (opts?.territory_1 ?? []).map((x) => ({ id: x, title: x }));
  const territory2Allowed = (() => {
    const selectedZones = draft.territory_1_list;
    const byZone = opts?.territory_2_by_1 ?? {};
    if (!selectedZones.length || Object.keys(byZone).length === 0) return opts?.territory_2 ?? [];
    const set = new Set<string>();
    for (const zone of selectedZones) for (const region of byZone[zone] ?? []) set.add(region);
    return [...set].sort((a, b) => a.localeCompare(b, "ru"));
  })();
  const territory2Items = territory2Allowed.map((x) => ({ id: x, title: x }));
  const territory3Allowed = (() => {
    const selectedRegions = draft.territory_2_list;
    const byRegion = opts?.territory_3_by_2 ?? {};
    if (!selectedRegions.length || Object.keys(byRegion).length === 0) return opts?.territory_3 ?? [];
    const set = new Set<string>();
    for (const region of selectedRegions) for (const city of byRegion[region] ?? []) set.add(city);
    return [...set].sort((a, b) => a.localeCompare(b, "ru"));
  })();
  const territory3Items = territory3Allowed.map((x) => ({ id: x, title: x }));
  const tradeDirectionItems = (opts?.trade_directions ?? []).map((x) => ({ id: x.id, title: x.name }));
  const categoryItems = (opts?.categories ?? []).map((x) => ({ id: String(x.id), title: x.name }));
  const statusItems = (opts?.statuses ?? []).map((x) => ({ id: x.id, title: ORDER_STATUS_LABELS[x.id] ?? x.label ?? x.id }));
  const clientCategoryItems = (opts?.client_categories ?? []).map((x) => ({ id: x, title: x }));
  const priceTypeItems = (opts?.price_types ?? []).map((x) => ({ id: x, title: x }));
  const paymentMethodItems = (opts?.payment_methods ?? []).map((x) => ({ id: x.id, title: x.label }));
  const orderTypeItems = (opts?.order_types ?? []).map((x) => ({ id: x.id, title: orderTypeLabel(x.id) }));
  const groupItems = (opts?.groups ?? []).map((x) => ({ id: String(x.id), title: x.name }));
  const segmentItems = (opts?.segments ?? []).map((x) => ({ id: String(x.id), title: x.name }));

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Заказы по агентам</h1>

      <div className="space-y-2 rounded border bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Дата применяется по</span>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                className="accent-primary"
                checked={draft.date_type === "order_date"}
                onChange={() => setDraft((d) => ({ ...d, date_type: "order_date" }))}
              />
              По дате заказа
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                className="accent-primary"
                checked={draft.date_type === "shipped_date"}
                onChange={() => setDraft((d) => ({ ...d, date_type: "shipped_date" }))}
              />
              По дате отправки
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                className="accent-primary"
                checked={draft.date_type === "delivered_date"}
                onChange={() => setDraft((d) => ({ ...d, date_type: "delivered_date" }))}
              />
              По дате доставки
            </label>
          </div>
          <button
            ref={dateAnchorRef}
            type="button"
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-xs",
              dateOpen && "border-primary/60 bg-primary/5"
            )}
            onClick={() => setDateOpen((o) => !o)}
          >
            <CalendarDays className="h-4 w-4" />
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
        </div>

        <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-6">
          <MultiFilter
            placeholder="Категория продукта"
            items={categoryItems}
            selectedValues={draft.category_ids}
            onChange={(vals) => setDraft((d) => ({ ...d, category_ids: vals, category_id: "" }))}
            searchPlaceholder="Поиск категории"
          />
          <MultiFilter
            placeholder="Продукт"
            items={productItems}
            selectedValues={draft.product_ids}
            onChange={(vals) => setDraft((d) => ({ ...d, product_ids: vals, product_id: "" }))}
            searchPlaceholder="Поиск продукта"
          />
          <MultiFilter
            placeholder="Направление торговли"
            items={tradeDirectionItems}
            selectedValues={draft.trade_directions}
            onChange={(vals) => setDraft((d) => ({ ...d, trade_directions: vals, trade_direction: "" }))}
            searchPlaceholder="Поиск направления"
          />
          <MultiFilter
            placeholder="Статус заказа"
            items={statusItems}
            selectedValues={draft.statuses}
            onChange={(vals) => setDraft((d) => ({ ...d, statuses: vals, status: "" }))}
            searchPlaceholder="Поиск статуса"
          />
          <MultiFilter
            placeholder="Агент"
            items={agentItems}
            selectedValues={draft.agent_ids}
            onChange={(vals) => setDraft((d) => ({ ...d, agent_ids: vals, agent_id: "" }))}
            searchPlaceholder="Поиск агента"
          />
          <MultiFilter
            placeholder="Категория клиента"
            items={clientCategoryItems}
            selectedValues={draft.client_categories}
            onChange={(vals) => setDraft((d) => ({ ...d, client_categories: vals, client_category: "" }))}
            searchPlaceholder="Поиск категории клиента"
          />
          <MultiFilter
            placeholder="Тип цены"
            items={priceTypeItems}
            selectedValues={draft.price_types}
            onChange={(vals) => setDraft((d) => ({ ...d, price_types: vals, price_type: "" }))}
            searchPlaceholder="Поиск типа цены"
          />
          <MultiFilter
            placeholder="Способ оплаты"
            items={paymentMethodItems}
            selectedValues={draft.payment_methods}
            onChange={(vals) => setDraft((d) => ({ ...d, payment_methods: vals, payment_method: "" }))}
            searchPlaceholder="Поиск оплаты"
          />
          <MultiFilter
            placeholder="Тип заказ"
            items={orderTypeItems}
            selectedValues={draft.order_types}
            onChange={(vals) => setDraft((d) => ({ ...d, order_types: vals, order_type: "" }))}
            searchPlaceholder="Поиск типа заказа"
          />
          <MultiFilter
            placeholder="Группа товаров"
            items={groupItems}
            selectedValues={draft.product_group_ids}
            onChange={(vals) => setDraft((d) => ({ ...d, product_group_ids: vals, product_group_id: "" }))}
            searchPlaceholder="Поиск группы"
          />
          <MultiFilter
            placeholder="Сегменты"
            items={segmentItems}
            selectedValues={draft.segment_ids}
            onChange={(vals) => setDraft((d) => ({ ...d, segment_ids: vals, segment_id: "" }))}
            searchPlaceholder="Поиск сегмента"
          />
          <FilterSelect emptyLabel="Консигнация" value={draft.consignment} onChange={(e) => setDraft((d) => ({ ...d, consignment: e.target.value }))}>
            <option value="all">Обе</option>
            <option value="yes">Да</option>
            <option value="no">Нет</option>
          </FilterSelect>
          <MultiFilter
            placeholder="Зона"
            items={territory1Items}
            selectedValues={draft.territory_1_list}
            onChange={(vals) =>
              setDraft((d) => ({
                ...d,
                territory_1_list: vals,
                territory_1: "",
                territory_2_list: [],
                territory_3_list: [],
                territory_2: "",
                territory_3: ""
              }))
            }
            searchPlaceholder="Поиск зоны"
          />
          <MultiFilter
            placeholder="Область"
            items={territory2Items}
            selectedValues={draft.territory_2_list}
            onChange={(vals) => setDraft((d) => ({ ...d, territory_2_list: vals, territory_2: "", territory_3_list: [], territory_3: "" }))}
            searchPlaceholder="Поиск области"
          />
          <MultiFilter
            placeholder="Город"
            items={territory3Items}
            selectedValues={draft.territory_3_list}
            onChange={(vals) => setDraft((d) => ({ ...d, territory_3_list: vals, territory_3: "" }))}
            searchPlaceholder="Поиск города"
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={() => setApplied(draft)} className="h-9">Применить</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {cards.map((c) => (
          <div key={c.status} className="overflow-hidden rounded-md border border-border/70 shadow-sm">
            <div className={cn("px-2.5 py-1.5 text-[11px] font-medium", kpiCardTone(c.status).head)}>{c.label}</div>
            <div className={cn("space-y-0.5 px-2.5 py-1.5", kpiCardTone(c.status).body)}>
              <p className="text-[22px] font-semibold leading-tight tabular-nums">{money(c.amount)}</p>
              <p className="text-[11px] text-muted-foreground">Кол-во: {c.qty}</p>
              <p className="text-[11px] text-muted-foreground">Объем: 0</p>
              <p className="text-[11px] text-muted-foreground">АКБ: {c.akb}</p>
            </div>
          </div>
        ))}
      </div>

      <ReportTable
        title="Торговые агенты"
        loading={reportQ.isLoading}
        metricMode={agentMetricMode}
        onMetricModeChange={setAgentMetricMode}
        headers={["Агент", "Код агента", "Общие заказы", "Новый", "Ожидаемая дата отгрузки", "Отгружен", "Доставлен", "Отменен", "Возвращенные", "В процессе возврата"]}
        rows={(reportQ.data?.agent_rows ?? []).map((r) => [
          r.agent_name,
          r.agent_code || "—",
          agentMetricMode === "amount" ? money(r.amount_total) : agentMetricMode === "volume" ? money(r.volume_total) : String(agentMetricMode === "qty" ? r.qty_total : r.akb_total),
          agentMetricMode === "amount" ? money(r.amount_new) : agentMetricMode === "volume" ? money(r.volume_new) : String(agentMetricMode === "qty" ? r.qty_new : r.akb_new),
          agentMetricMode === "amount"
            ? money(r.amount_confirmed)
            : agentMetricMode === "volume"
              ? money(r.volume_confirmed)
              : String(agentMetricMode === "qty" ? r.qty_confirmed : r.akb_confirmed),
          agentMetricMode === "amount"
            ? money(r.amount_delivering)
            : agentMetricMode === "volume"
              ? money(r.volume_delivering)
              : String(agentMetricMode === "qty" ? r.qty_delivering : r.akb_delivering),
          agentMetricMode === "amount"
            ? money(r.amount_delivered)
            : agentMetricMode === "volume"
              ? money(r.volume_delivered)
              : String(agentMetricMode === "qty" ? r.qty_delivered : r.akb_delivered),
          agentMetricMode === "amount"
            ? money(r.amount_cancelled)
            : agentMetricMode === "volume"
              ? money(r.volume_cancelled)
              : String(agentMetricMode === "qty" ? r.qty_cancelled : r.akb_cancelled),
          agentMetricMode === "amount"
            ? money(r.amount_returned)
            : agentMetricMode === "volume"
              ? money(r.volume_returned)
              : String(agentMetricMode === "qty" ? r.qty_returned : r.akb_returned),
          agentMetricMode === "amount"
            ? money(r.amount_return_processing)
            : agentMetricMode === "volume"
              ? money(r.volume_return_processing)
              : String(agentMetricMode === "qty" ? r.qty_return_processing : r.akb_return_processing)
        ])}
      />

      <MatrixTable
        title="По категории продуктов"
        loading={reportQ.isLoading}
        metricMode={categoryMetricMode}
        onMetricModeChange={setCategoryMetricMode}
        buckets={reportQ.data?.category_matrix.buckets ?? []}
        rows={reportQ.data?.category_matrix.rows ?? []}
      />
      <MatrixTable
        title="По сегмент продуктов"
        loading={reportQ.isLoading}
        metricMode={segmentMetricMode}
        onMetricModeChange={setSegmentMetricMode}
        buckets={reportQ.data?.segment_matrix.buckets ?? []}
        rows={reportQ.data?.segment_matrix.rows ?? []}
      />
    </div>
  );
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
      items={items}
      selected={new Set(selectedValues)}
      onSelectedChange={(next) => {
        const resolved = typeof next === "function" ? next(new Set(selectedValues)) : next;
        onChange(Array.from(resolved));
      }}
      searchable
      searchPlaceholder={searchPlaceholder}
      minPopoverWidth={260}
      maxListHeightClass="max-h-44"
    />
  );
}

function MetricSwitch({ metricMode, onMetricModeChange }: { metricMode: MetricMode; onMetricModeChange: (next: MetricMode) => void }) {
  const items: Array<{ id: MetricMode; label: string }> = [
    { id: "akb", label: "АКБ" },
    { id: "volume", label: "Объем" },
    { id: "amount", label: "Сумма" },
    { id: "qty", label: "Количество" }
  ];
  return (
    <div className="inline-flex items-center rounded-md border border-border/70 bg-background p-0.5">
      {items.map((i) => (
        <button
          key={i.id}
          type="button"
          onClick={() => onMetricModeChange(i.id)}
          className={cn(
            "rounded px-2 py-1 text-[11px] transition-colors",
            metricMode === i.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

function ReportTable({
  title,
  headers,
  rows,
  loading,
  metricMode,
  onMetricModeChange
}: {
  title: string;
  headers: string[];
  rows: string[][];
  loading: boolean;
  metricMode: MetricMode;
  onMetricModeChange: (next: MetricMode) => void;
}) {
  return (
    <div className="rounded border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="text-sm font-semibold">{title}</div>
        <MetricSwitch metricMode={metricMode} onMetricModeChange={onMetricModeChange} />
      </div>
      <div className="overflow-auto">
        <table className="w-full min-w-[980px] text-xs">
          <thead className="app-table-thead">
            <tr>{headers.map((h) => <th key={h} className="px-2 py-2 text-left">{h}</th>)}</tr>
          </thead>
          <tbody>
            {loading ? <tr><td className="px-3 py-4 text-muted-foreground" colSpan={headers.length}>Загрузка...</td></tr> : null}
            {!loading && rows.length === 0 ? <tr><td className="px-3 py-4 text-muted-foreground" colSpan={headers.length}>Нет данных</td></tr> : null}
            {rows.map((r, i) => <tr key={i} className="border-t">{r.map((c, j) => <td key={j} className="px-2 py-2 tabular-nums">{c}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MatrixTable({
  title,
  buckets,
  rows,
  loading,
  metricMode,
  onMetricModeChange
}: {
  title: string;
  buckets: string[];
  rows: Array<{ agent_name: string; agent_code: string; values: Record<string, { amount: string; qty: number; volume: string; akb: number }> }>;
  loading: boolean;
  metricMode: MetricMode;
  onMetricModeChange: (next: MetricMode) => void;
}) {
  const totals = useMemo(() => {
    const out: Record<string, number> = {};
    for (const b of buckets) out[b] = 0;
    for (const r of rows) {
      for (const b of buckets) {
        const v = r.values[b];
        if (!v) continue;
        if (metricMode === "amount") out[b] += Number.parseFloat(v.amount) || 0;
        if (metricMode === "volume") out[b] += Number.parseFloat(v.volume) || 0;
        if (metricMode === "qty") out[b] += v.qty || 0;
        if (metricMode === "akb") out[b] += v.akb || 0;
      }
    }
    return out;
  }, [buckets, rows, metricMode]);

  return (
    <div className="rounded border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="text-sm font-semibold">
          {title} <span className="ml-1 text-xs font-normal text-muted-foreground">({metricLabels(metricMode)})</span>
        </div>
        <MetricSwitch metricMode={metricMode} onMetricModeChange={onMetricModeChange} />
      </div>
      <div className="overflow-auto">
        <table className="w-full min-w-[1000px] text-xs">
          <thead className="app-table-thead">
            <tr>
              <th className="px-2 py-2 text-left">Агент</th>
              <th className="px-2 py-2 text-left">Код агента</th>
              {buckets.map((b) => <th key={b} className="px-2 py-2 text-right">{b}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td className="px-3 py-4 text-muted-foreground" colSpan={2 + buckets.length}>Загрузка...</td></tr> : null}
            {!loading && rows.length === 0 ? <tr><td className="px-3 py-4 text-muted-foreground" colSpan={2 + buckets.length}>Нет данных</td></tr> : null}
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="px-2 py-2">{r.agent_name}</td>
                <td className="px-2 py-2">{r.agent_code || "—"}</td>
                {buckets.map((b) => {
                  const v = r.values[b];
                  const text = !v
                    ? "0"
                    : metricMode === "amount"
                      ? money(v.amount)
                      : metricMode === "volume"
                        ? money(v.volume)
                        : String(metricMode === "qty" ? v.qty : v.akb);
                  return <td key={b} className="px-2 py-2 text-right tabular-nums">{text}</td>;
                })}
              </tr>
            ))}
            {!loading && rows.length > 0 ? (
              <tr className="border-t bg-muted/30 font-medium">
                <td className="px-2 py-2">Итого</td>
                <td className="px-2 py-2">—</td>
                {buckets.map((b) => (
                  <td key={b} className="px-2 py-2 text-right tabular-nums">
                    {metricMode === "amount" || metricMode === "volume" ? money(totals[b] ?? 0) : String(Math.round(totals[b] ?? 0))}
                  </td>
                ))}
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
