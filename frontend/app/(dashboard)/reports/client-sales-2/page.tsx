"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, FileSpreadsheet, RotateCcw, Search } from "lucide-react";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { FilterSelect } from "@/components/ui/filter-select";
import { SearchableMultiSelectPanel } from "@/components/ui/searchable-multi-select-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { cn } from "@/lib/utils";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { TableColumnSettingsDialog, type ColumnDefItem } from "@/components/data-table/table-column-settings-dialog";
import { ArrowDown, ArrowUp, ArrowUpDown, ListOrdered } from "lucide-react";

type FilterOptions = {
  date_types: Array<{ id: string; label: string }>;
  statuses: Array<{ id: string; label: string }>;
  agents: Array<{ id: number; name: string; code: string }>;
  categories: Array<{ id: number; name: string }>;
  products: Array<{ id: number; name: string; sku: string }>;
  groups: Array<{ id: number; name: string }>;
  segments: Array<{ id: number; name: string }>;
  day_visit_options: Array<{ id: number; label: string }>;
  price_types: string[];
  price_type_options?: Array<{ id: string; label: string }>;
  order_types: string[];
  client_categories: string[];
  territory_1: string[];
  territory_2: string[];
  territory_3: string[];
  territory_tree?: Array<{ zone: string; region: string; city: string }>;
  regions_by_zone?: Record<string, string[]>;
  cities_by_zone_region?: Record<string, string[]>;
};
type ClientRefs = {
  zones?: string[];
  regions?: string[];
  cities?: string[];
  region_options?: Array<{ value?: string; label?: string }>;
  city_options?: Array<{ value?: string; label?: string }>;
};

type ClientSales2Report = {
  clients: Array<{
    client_id: number;
    client_name: string;
    created_at: string;
    category: string;
    amount: string;
    qty: string;
    volume: string;
    agent_name: string;
    agent_code: string;
    territory: string;
    phone: string;
  }>;
  agents_summary: Array<{
    agent_id: number | null;
    agent_name: string;
    agent_code: string;
    akb: number;
    okb: number;
    akb_percent: number;
    qty: string;
    volume: string;
    amount: string;
  }>;
  totals: { amount: string; quantity: string; volume: string };
  page: number;
  limit: number;
  total: number;
};
type ClientColId = "client_id" | "client_name" | "created_at" | "category" | "amount" | "qty" | "volume" | "agent" | "territory";
type AgentColId = "agent" | "akb" | "okb" | "akb_percent" | "qty" | "volume" | "amount";
const CLIENT_COLUMNS: ColumnDefItem[] = [
  { id: "client_id", label: "ID клиента" },
  { id: "client_name", label: "Названия" },
  { id: "created_at", label: "Дата создания" },
  { id: "category", label: "Категория" },
  { id: "amount", label: "Сумма" },
  { id: "qty", label: "Кол-во" },
  { id: "volume", label: "Объем" },
  { id: "agent", label: "Агент" },
  { id: "territory", label: "Территория" }
];
const AGENT_COLUMNS: ColumnDefItem[] = [
  { id: "agent", label: "Агент" },
  { id: "akb", label: "АКБ" },
  { id: "okb", label: "ОКБ" },
  { id: "akb_percent", label: "% от АКБ" },
  { id: "qty", label: "Кол-во" },
  { id: "volume", label: "Объем" },
  { id: "amount", label: "Сумма" }
];

function money(v: string | number) {
  return formatNumberGrouped(v, { maxFractionDigits: 0 });
}

function formatDate(v: string) {
  return new Date(v).toLocaleDateString("ru-RU");
}

export default function ReportClientSales2Page() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();

  const today = new Date();
  const from0 = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const to0 = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  const [dateOpen, setDateOpen] = useState(false);
  const dateAnchorRef = useRef<HTMLButtonElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportingClients, setExportingClients] = useState(false);
  const [exportingAgents, setExportingAgents] = useState(false);
  const [clientTableSearch, setClientTableSearch] = useState("");
  const [agentTableSearch, setAgentTableSearch] = useState("");
  const [agentPage, setAgentPage] = useState(1);
  const [agentLimit, setAgentLimit] = useState(10);
  const [clientColumnDialogOpen, setClientColumnDialogOpen] = useState(false);
  const [agentColumnDialogOpen, setAgentColumnDialogOpen] = useState(false);
  const [clientColumnOrder, setClientColumnOrder] = useState(CLIENT_COLUMNS.map((c) => c.id));
  const [clientHiddenColumnIds, setClientHiddenColumnIds] = useState<Set<string>>(new Set());
  const [agentColumnOrder, setAgentColumnOrder] = useState(AGENT_COLUMNS.map((c) => c.id));
  const [agentHiddenColumnIds, setAgentHiddenColumnIds] = useState<Set<string>>(new Set());
  const [clientSortBy, setClientSortBy] = useState<ClientColId>("amount");
  const [clientSortDir, setClientSortDir] = useState<"asc" | "desc">("desc");
  const [agentSortBy, setAgentSortBy] = useState<AgentColId>("amount");
  const [agentSortDir, setAgentSortDir] = useState<"asc" | "desc">("desc");

  const [draft, setDraft] = useState({
    date_type: "order_date",
    from: from0,
    to: to0,
    statuses: [] as string[],
    category_ids: [] as string[],
    product_ids: [] as string[],
    product_group_ids: [] as string[],
    segment_ids: [] as string[],
    day_visit_iso: [] as string[],
    agent_ids: [] as string[],
    price_types: [] as string[],
    order_type: "order",
    consignment_mode: "all",
    client_categories: [] as string[],
    territory_1_list: [] as string[],
    territory_2_list: [] as string[],
    territory_3_list: [] as string[],
    client_activity: "active",
    search: "",
    page: 1,
    limit: 50
  });
  const [applied, setApplied] = useState(draft);

  const filtersQ = useQuery({
    queryKey: ["report-client-sales-2-filters", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: FilterOptions }>(`/api/${tenantSlug}/reports/client-sales-2/filter-options`);
      return data.data;
    }
  });

  const reportQ = useQuery({
    queryKey: ["report-client-sales-2", tenantSlug, applied],
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
      const { data } = await api.get<{ data: ClientSales2Report }>(`/api/${tenantSlug}/reports/client-sales-2?${p.toString()}`);
      return data.data;
    }
  });
  const clientRefsQ = useQuery({
    queryKey: ["clients-references", tenantSlug, "report-client-sales-2"],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<ClientRefs>(`/api/${tenantSlug}/clients/references`);
      return data;
    }
  });

  const opts = filtersQ.data;
  const refRegions = (clientRefsQ.data?.region_options ?? [])
    .map((x) => String(x?.label ?? x?.value ?? "").trim())
    .filter(Boolean);
  const refCities = (clientRefsQ.data?.city_options ?? [])
    .map((x) => String(x?.label ?? x?.value ?? "").trim())
    .filter(Boolean);
  const orderTypeOptions = (() => {
    const fallback = ["order", "return", "exchange", "return_by_order"];
    const raw = Array.from(new Set([...(opts?.order_types ?? []), ...fallback]));
    const label = (id: string) => {
      if (id === "order") return "Заказ";
      if (id === "return") return "Возврат с полки";
      if (id === "exchange") return "Обмен";
      if (id === "return_by_order") return "Возврат по заказу";
      return id;
    };
    return raw.map((id) => ({ id, label: label(id) }));
  })();

  if (!hydrated || !tenantSlug) return <p className="text-sm text-muted-foreground">Загрузка...</p>;

  const productItems = (opts?.products ?? []).map((x) => ({ id: String(x.id), title: `${x.name}${x.sku ? ` (${x.sku})` : ""}` }));
  const agentItems = (opts?.agents ?? []).map((x) => ({ id: String(x.id), title: `${x.name}${x.code ? ` (${x.code})` : ""}` }));
  const categoryItems = (opts?.categories ?? []).map((x) => ({ id: String(x.id), title: x.name }));
  const groupItems = (opts?.groups ?? []).map((x) => ({ id: String(x.id), title: x.name }));
  const segmentItems = (opts?.segments ?? []).map((x) => ({ id: String(x.id), title: x.name }));
  const dayVisitItems = (opts?.day_visit_options ?? []).map((x) => ({ id: String(x.id), title: x.label }));
  const priceTypeItems =
    opts?.price_type_options?.length
      ? opts.price_type_options.map((x) => ({ id: x.id, title: x.label }))
      : (opts?.price_types ?? []).map((x) => ({ id: x, title: x }));
  const territory1Source = (clientRefsQ.data?.zones?.length ? clientRefsQ.data?.zones : opts?.territory_1) ?? [];
  const territory1Items = territory1Source.map((x) => ({ id: x, title: x }));
  const territory2Items = (() => {
    const zone = draft.territory_1_list[0] ?? "";
    if (!zone) {
      const source = (clientRefsQ.data?.regions?.length ? clientRefsQ.data?.regions : refRegions.length ? refRegions : opts?.territory_2) ?? [];
      return source.map((x) => ({ id: x, title: x }));
    }
    const regions = opts?.regions_by_zone?.[zone] ?? [];
    return regions.map((x) => ({ id: x, title: x }));
  })();
  const territory3Items = (() => {
    const zone = draft.territory_1_list[0] ?? "";
    const region = draft.territory_2_list[0] ?? "";
    if (!region) {
      const source = (clientRefsQ.data?.cities?.length ? clientRefsQ.data?.cities : refCities.length ? refCities : opts?.territory_3) ?? [];
      return source.map((x) => ({ id: x, title: x }));
    }
    let cities = opts?.cities_by_zone_region?.[`${zone}|||${region}`] ?? [];
    if (cities.length === 0 && opts?.territory_tree?.length) {
      cities = opts.territory_tree
        .filter((x) => {
          const zoneOk = !zone || (x.zone ?? "") === zone;
          const regionOk = (x.region ?? "") === region;
          return zoneOk && regionOk;
        })
        .map((x) => x.city)
        .filter(Boolean);
    }
    if (cities.length === 0) {
      const fromRefs = clientRefsQ.data?.cities ?? [];
      const fromRefOptions = refCities;
      const fromOpts = opts?.territory_3 ?? [];
      cities = [...fromRefs, ...fromRefOptions, ...fromOpts];
    }
    cities = [...new Set(cities)].sort((a, b) => a.localeCompare(b, "ru"));
    return cities.map((x) => ({ id: x, title: x }));
  })();
  const clientCategoryItems = (opts?.client_categories ?? []).map((x) => ({ id: x, title: x }));
  const statusItems = (opts?.statuses ?? []).map((x) => ({ id: x.id, title: x.label }));

  const totalPages = reportQ.data ? Math.max(1, Math.ceil(reportQ.data.total / reportQ.data.limit)) : 1;
  const filteredClients = (reportQ.data?.clients ?? []).filter((r) => {
    const q = clientTableSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      String(r.client_id).includes(q) ||
      r.client_name.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      r.agent_name.toLowerCase().includes(q) ||
      r.territory.toLowerCase().includes(q)
    );
  });
  filteredClients.sort((a, b) => {
    const av =
      clientSortBy === "client_id" ? a.client_id :
      clientSortBy === "client_name" ? a.client_name :
      clientSortBy === "created_at" ? new Date(a.created_at).getTime() :
      clientSortBy === "category" ? a.category :
      clientSortBy === "amount" ? Number.parseFloat(a.amount) :
      clientSortBy === "qty" ? Number.parseFloat(a.qty) :
      clientSortBy === "volume" ? Number.parseFloat(a.volume) :
      clientSortBy === "agent" ? `${a.agent_name} ${a.agent_code}` :
      a.territory;
    const bv =
      clientSortBy === "client_id" ? b.client_id :
      clientSortBy === "client_name" ? b.client_name :
      clientSortBy === "created_at" ? new Date(b.created_at).getTime() :
      clientSortBy === "category" ? b.category :
      clientSortBy === "amount" ? Number.parseFloat(b.amount) :
      clientSortBy === "qty" ? Number.parseFloat(b.qty) :
      clientSortBy === "volume" ? Number.parseFloat(b.volume) :
      clientSortBy === "agent" ? `${b.agent_name} ${b.agent_code}` :
      b.territory;
    if (typeof av === "number" && typeof bv === "number") return clientSortDir === "asc" ? av - bv : bv - av;
    return clientSortDir === "asc"
      ? String(av ?? "").localeCompare(String(bv ?? ""), "ru")
      : String(bv ?? "").localeCompare(String(av ?? ""), "ru");
  });
  const filteredAgents = (reportQ.data?.agents_summary ?? []).filter((r) => {
    const q = agentTableSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      r.agent_name.toLowerCase().includes(q) ||
      r.agent_code.toLowerCase().includes(q) ||
      String(r.akb).includes(q) ||
      String(r.okb).includes(q)
    );
  });
  filteredAgents.sort((a, b) => {
    const av =
      agentSortBy === "agent" ? `${a.agent_name} ${a.agent_code}` :
      agentSortBy === "akb" ? a.akb :
      agentSortBy === "okb" ? a.okb :
      agentSortBy === "akb_percent" ? a.akb_percent :
      agentSortBy === "qty" ? Number.parseFloat(a.qty) :
      agentSortBy === "volume" ? Number.parseFloat(a.volume) :
      Number.parseFloat(a.amount);
    const bv =
      agentSortBy === "agent" ? `${b.agent_name} ${b.agent_code}` :
      agentSortBy === "akb" ? b.akb :
      agentSortBy === "okb" ? b.okb :
      agentSortBy === "akb_percent" ? b.akb_percent :
      agentSortBy === "qty" ? Number.parseFloat(b.qty) :
      agentSortBy === "volume" ? Number.parseFloat(b.volume) :
      Number.parseFloat(b.amount);
    if (typeof av === "number" && typeof bv === "number") return agentSortDir === "asc" ? av - bv : bv - av;
    return agentSortDir === "asc"
      ? String(av ?? "").localeCompare(String(bv ?? ""), "ru")
      : String(bv ?? "").localeCompare(String(av ?? ""), "ru");
  });
  const agentTotalPages = Math.max(1, Math.ceil(filteredAgents.length / agentLimit));
  const agentRowsPaged = filteredAgents.slice((agentPage - 1) * agentLimit, agentPage * agentLimit);
  const visibleClientCols = clientColumnOrder.filter((id) => !clientHiddenColumnIds.has(id));
  const visibleAgentCols = agentColumnOrder.filter((id) => !agentHiddenColumnIds.has(id));

  const applyDraft = (page = 1) => setApplied({ ...draft, page, limit: draft.limit });

  const downloadExcel = async () => {
    if (!tenantSlug) return;
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
      const res = await api.get<Blob>(`/api/${tenantSlug}/reports/client-sales-2/export?${p.toString()}`, {
        responseType: "blob"
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "prodazhi-po-klientam-2.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const downloadClientsExcel = async () => {
    if (!reportQ.data) return;
    setExportingClients(true);
    try {
      await downloadXlsxSheet(
        "prodazhi-po-klientam-2-klienty.xlsx",
        "Клиенты",
        ["ID клиента", "Название", "Дата создания", "Категория", "Сумма", "Кол-во", "Объем", "Агент", "Территория"],
        reportQ.data.clients.map((r) => [
          r.client_id,
          r.client_name,
          formatDate(r.created_at),
          r.category || "",
          Number.parseFloat(r.amount) || 0,
          Number.parseFloat(r.qty) || 0,
          Number.parseFloat(r.volume) || 0,
          r.agent_code ? `${r.agent_name} (${r.agent_code})` : r.agent_name,
          r.territory
        ])
      );
    } finally {
      setExportingClients(false);
    }
  };

  const downloadAgentsExcel = async () => {
    if (!reportQ.data) return;
    setExportingAgents(true);
    try {
      await downloadXlsxSheet(
        "prodazhi-po-klientam-2-po-agentam.xlsx",
        "По агентам",
        ["Агент", "АКБ", "ОКБ", "% от АКБ", "Кол-во", "Объем", "Сумма"],
        reportQ.data.agents_summary.map((r) => [
          r.agent_code ? `${r.agent_name} (${r.agent_code})` : r.agent_name,
          r.akb,
          r.okb,
          r.akb_percent,
          Number.parseFloat(r.qty) || 0,
          Number.parseFloat(r.volume) || 0,
          Number.parseFloat(r.amount) || 0
        ])
      );
    } finally {
      setExportingAgents(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Продажи по клиентам 2</h1>

      <div className="space-y-2 rounded border bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-muted-foreground">Дата применяется по</span>
            {[
              { id: "order_date", label: "Дата заказа" },
              { id: "shipped_date", label: "Дата отправки" },
              { id: "delivered_date", label: "Дата доставки" },
              { id: "created_date", label: "Дата создания" }
            ].map((dt) => (
              <label key={dt.id} className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  className="accent-primary"
                  checked={draft.date_type === dt.id}
                  onChange={() => setDraft((d) => ({ ...d, date_type: dt.id }))}
                />
                {dt.label}
              </label>
            ))}
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
          <MultiFilter placeholder="Статус" items={statusItems} selectedValues={draft.statuses} onChange={(v) => setDraft((d) => ({ ...d, statuses: v }))} searchPlaceholder="Поиск статуса" />
          <MultiFilter placeholder="Категория продукта" items={categoryItems} selectedValues={draft.category_ids} onChange={(v) => setDraft((d) => ({ ...d, category_ids: v }))} searchPlaceholder="Поиск категории" />
          <MultiFilter placeholder="Продукт" items={productItems} selectedValues={draft.product_ids} onChange={(v) => setDraft((d) => ({ ...d, product_ids: v }))} searchPlaceholder="Поиск продукта" />
          <MultiFilter placeholder="Группа товаров" items={groupItems} selectedValues={draft.product_group_ids} onChange={(v) => setDraft((d) => ({ ...d, product_group_ids: v }))} searchPlaceholder="Поиск группы" />
          <MultiFilter placeholder="День визита" items={dayVisitItems} selectedValues={draft.day_visit_iso} onChange={(v) => setDraft((d) => ({ ...d, day_visit_iso: v }))} searchPlaceholder="Выберите дни" />
          <MultiFilter placeholder="Агент" items={agentItems} selectedValues={draft.agent_ids} onChange={(v) => setDraft((d) => ({ ...d, agent_ids: v }))} searchPlaceholder="Поиск агента" />
          <MultiFilter placeholder="Категория клиента" items={clientCategoryItems} selectedValues={draft.client_categories} onChange={(v) => setDraft((d) => ({ ...d, client_categories: v }))} searchPlaceholder="Поиск категории клиента" />
          <MultiFilter placeholder="Тип цен" items={priceTypeItems} selectedValues={draft.price_types} onChange={(v) => setDraft((d) => ({ ...d, price_types: v }))} searchPlaceholder="Поиск типа цен" />
          <FilterSelect emptyLabel="Тип заказ" value={draft.order_type} onChange={(e) => setDraft((d) => ({ ...d, order_type: e.target.value }))}>
            {orderTypeOptions.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </FilterSelect>
          <FilterSelect emptyLabel="Консигнация" value={draft.consignment_mode} onChange={(e) => setDraft((d) => ({ ...d, consignment_mode: e.target.value }))}>
            <option value="regular">Обычная</option>
            <option value="consignment">Для консигнации</option>
            <option value="all">Обе</option>
          </FilterSelect>
          <MultiFilter placeholder="Сегменты" items={segmentItems} selectedValues={draft.segment_ids} onChange={(v) => setDraft((d) => ({ ...d, segment_ids: v }))} searchPlaceholder="Поиск сегмента" />
          <MultiFilter placeholder="Зона" items={territory1Items} selectedValues={draft.territory_1_list} onChange={(v) => setDraft((d) => ({ ...d, territory_1_list: v.slice(0, 1), territory_2_list: [], territory_3_list: [] }))} searchPlaceholder="Поиск зоны" />
          <MultiFilter placeholder="Область" items={territory2Items} selectedValues={draft.territory_2_list} onChange={(v) => setDraft((d) => ({ ...d, territory_2_list: v.slice(0, 1), territory_3_list: [] }))} searchPlaceholder="Поиск области" />
          <MultiFilter placeholder="Город" items={territory3Items} selectedValues={draft.territory_3_list} onChange={(v) => setDraft((d) => ({ ...d, territory_3_list: v.slice(0, 1) }))} searchPlaceholder="Поиск города" />
          <FilterSelect emptyLabel="Активность клиента" value={draft.client_activity} onChange={(e) => setDraft((d) => ({ ...d, client_activity: e.target.value }))}>
            <option value="inactive">Только неактивный</option>
            <option value="active">Только активный</option>
            <option value="all">Все</option>
          </FilterSelect>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="icon" onClick={() => {
            const reset = {
              ...draft,
              statuses: [],
              category_ids: [],
              product_ids: [],
              product_group_ids: [],
              segment_ids: [],
              day_visit_iso: [],
              agent_ids: [],
              price_types: [],
              order_type: "order",
              consignment_mode: "all",
              client_categories: [],
              territory_1_list: [],
              territory_2_list: [],
              territory_3_list: [],
              client_activity: "active",
              search: "",
              page: 1
            };
            setDraft(reset);
            setApplied(reset);
          }}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button onClick={() => applyDraft(1)} className="h-9">Применить</Button>
        </div>
      </div>

      <div className="rounded border bg-card">
        <div className="border-b px-3 py-2 text-sm font-semibold">По клиентам</div>
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setClientColumnDialogOpen(true)}>
              <ListOrdered className="mr-1 h-4 w-4" />
              Колонки
            </Button>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={String(applied.limit)}
              onChange={(e) => {
                const limit = Number.parseInt(e.target.value, 10) || 50;
                const next = { ...applied, limit, page: 1 };
                setDraft(next);
                setApplied(next);
              }}
            >
              {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <div className="relative min-w-[180px] flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 pl-8 text-sm"
                placeholder="Поиск в таблице клиентов"
                value={clientTableSearch}
                onChange={(e) => setClientTableSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => void downloadExcel()} disabled={exporting}>
              <FileSpreadsheet className="mr-1 h-4 w-4" />
              Excel (оба)
            </Button>
            <Button variant="outline" size="sm" onClick={() => void downloadClientsExcel()} disabled={exportingClients || !reportQ.data}>
              <FileSpreadsheet className="mr-1 h-4 w-4" />
              Excel (клиенты)
            </Button>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[1050px] text-xs">
            <thead className="app-table-thead">
              <tr>
                {visibleClientCols.map((colId) => (
                  <th key={colId} className={cn("px-2 py-2", colId === "amount" || colId === "qty" || colId === "volume" ? "text-right" : "text-left")}>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-semibold"
                      onClick={() => {
                        const id = colId as ClientColId;
                        if (clientSortBy === id) setClientSortDir((d) => (d === "asc" ? "desc" : "asc"));
                        else {
                          setClientSortBy(id);
                          setClientSortDir(id === "amount" || id === "qty" || id === "volume" ? "desc" : "asc");
                        }
                      }}
                    >
                      {CLIENT_COLUMNS.find((c) => c.id === colId)?.label ?? colId}
                      {clientSortBy === colId ? (clientSortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((r) => (
                <tr key={r.client_id} className="border-t">
                  {visibleClientCols.map((colId) => {
                    const text =
                      colId === "client_id" ? String(r.client_id) :
                      colId === "client_name" ? r.client_name :
                      colId === "created_at" ? formatDate(r.created_at) :
                      colId === "category" ? (r.category || "—") :
                      colId === "amount" ? money(r.amount) :
                      colId === "qty" ? money(r.qty) :
                      colId === "volume" ? money(r.volume) :
                      colId === "agent" ? (r.agent_code ? `${r.agent_name} (${r.agent_code})` : r.agent_name) :
                      r.territory;
                    return (
                      <td key={`${r.client_id}-${colId}`} className={cn("px-2 py-2", colId === "amount" || colId === "qty" || colId === "volume" ? "text-right tabular-nums" : "")}>
                        {text}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {!reportQ.isLoading && filteredClients.length === 0 ? (
                <tr><td colSpan={Math.max(1, visibleClientCols.length)} className="px-3 py-4 text-muted-foreground">Нет данных</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            Показано {filteredClients.length} / {reportQ.data?.total ?? 0}
          </span>
          <div className="flex items-center gap-2">
            <span>Σ {money(reportQ.data?.totals.amount ?? 0)}</span>
            <Button variant="outline" size="sm" disabled={(applied.page ?? 1) <= 1} onClick={() => { const n = Math.max(1, applied.page - 1); setDraft((d) => ({ ...d, page: n })); setApplied((d) => ({ ...d, page: n })); }}>Назад</Button>
            <span>{applied.page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={(applied.page ?? 1) >= totalPages} onClick={() => { const n = Math.min(totalPages, applied.page + 1); setDraft((d) => ({ ...d, page: n })); setApplied((d) => ({ ...d, page: n })); }}>Вперёд</Button>
          </div>
        </div>
      </div>

      <div className="rounded border bg-card">
        <div className="border-b px-3 py-2 text-sm font-semibold">По агентам</div>
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setAgentColumnDialogOpen(true)}>
              <ListOrdered className="mr-1 h-4 w-4" />
              Колонки
            </Button>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={String(agentLimit)}
              onChange={(e) => {
                const next = Number.parseInt(e.target.value, 10) || 10;
                setAgentLimit(next);
                setAgentPage(1);
              }}
            >
              {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <div className="relative min-w-[180px] flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 pl-8 text-sm"
                placeholder="Поиск в таблице агентов"
                value={agentTableSearch}
                onChange={(e) => {
                  setAgentTableSearch(e.target.value);
                  setAgentPage(1);
                }}
              />
            </div>
          </div>
          <div className="ml-auto flex shrink-0 items-center justify-end">
            <Button variant="outline" size="sm" onClick={() => void downloadAgentsExcel()} disabled={exportingAgents || !reportQ.data}>
              <FileSpreadsheet className="mr-1 h-4 w-4" />
              Excel (по агентам)
            </Button>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[900px] text-xs">
            <thead className="app-table-thead">
              <tr>
                {visibleAgentCols.map((colId) => (
                  <th key={colId} className={cn("px-2 py-2", colId === "agent" ? "text-left" : "text-right")}>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-semibold"
                      onClick={() => {
                        const id = colId as AgentColId;
                        if (agentSortBy === id) setAgentSortDir((d) => (d === "asc" ? "desc" : "asc"));
                        else {
                          setAgentSortBy(id);
                          setAgentSortDir(id === "agent" ? "asc" : "desc");
                        }
                      }}
                    >
                      {AGENT_COLUMNS.find((c) => c.id === colId)?.label ?? colId}
                      {agentSortBy === colId ? (agentSortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agentRowsPaged.map((r, idx) => (
                <tr key={`${r.agent_id ?? 0}-${idx}`} className="border-t">
                  {visibleAgentCols.map((colId) => {
                    const text =
                      colId === "agent" ? (r.agent_code ? `${r.agent_name} (${r.agent_code})` : r.agent_name) :
                      colId === "akb" ? String(r.akb) :
                      colId === "okb" ? String(r.okb) :
                      colId === "akb_percent" ? formatNumberGrouped(r.akb_percent, { maxFractionDigits: 2 }) :
                      colId === "qty" ? money(r.qty) :
                      colId === "volume" ? money(r.volume) :
                      money(r.amount);
                    return <td key={`${idx}-${colId}`} className={cn("px-2 py-2", colId === "agent" ? "" : "text-right tabular-nums")}>{text}</td>;
                  })}
                </tr>
              ))}
              {!reportQ.isLoading && agentRowsPaged.length === 0 ? (
                <tr><td colSpan={Math.max(1, visibleAgentCols.length)} className="px-3 py-4 text-muted-foreground">Нет данных</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            Показано {agentRowsPaged.length} / {filteredAgents.length}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={agentPage <= 1} onClick={() => setAgentPage((p) => Math.max(1, p - 1))}>Назад</Button>
            <span>{agentPage} / {agentTotalPages}</span>
            <Button variant="outline" size="sm" disabled={agentPage >= agentTotalPages} onClick={() => setAgentPage((p) => Math.min(agentTotalPages, p + 1))}>Вперёд</Button>
          </div>
        </div>
      </div>

      <TableColumnSettingsDialog
        open={clientColumnDialogOpen}
        onOpenChange={setClientColumnDialogOpen}
        title="Колонки: Клиенты"
        description="Настройка видимых столбцов и порядка для таблицы клиентов."
        columns={CLIENT_COLUMNS}
        columnOrder={clientColumnOrder}
        hiddenColumnIds={clientHiddenColumnIds}
        onSave={(next) => {
          setClientColumnOrder(next.columnOrder);
          setClientHiddenColumnIds(new Set(next.hiddenColumnIds));
        }}
        onReset={() => {
          setClientColumnOrder(CLIENT_COLUMNS.map((c) => c.id));
          setClientHiddenColumnIds(new Set());
        }}
      />
      <TableColumnSettingsDialog
        open={agentColumnDialogOpen}
        onOpenChange={setAgentColumnDialogOpen}
        title="Колонки: По агентам"
        description="Настройка видимых столбцов и порядка для таблицы агентов."
        columns={AGENT_COLUMNS}
        columnOrder={agentColumnOrder}
        hiddenColumnIds={agentHiddenColumnIds}
        onSave={(next) => {
          setAgentColumnOrder(next.columnOrder);
          setAgentHiddenColumnIds(new Set(next.hiddenColumnIds));
        }}
        onReset={() => {
          setAgentColumnOrder(AGENT_COLUMNS.map((c) => c.id));
          setAgentHiddenColumnIds(new Set());
        }}
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
