"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { SupervisorDashboardMultiFilter } from "@/components/dashboard/supervisor-dashboard-multi-filter";
import { TableColumnSettingsDialog, type ColumnDefItem } from "@/components/data-table/table-column-settings-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { FilterSearchableSelect } from "@/components/ui/filter-searchable-select";
import { filterPanelSelectClassName } from "@/components/ui/filter-select";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { TerritoryNode } from "@/lib/territory-tree";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { createTerritoryLabelResolver } from "@/lib/territory-filter-labels";
import { STALE } from "@/lib/query-stale";
import {
  qkDashboardClientReferences,
  qkDashboardProductCategories,
  qkDashboardSupervisorsActive
} from "@/lib/dashboard-shared-query-keys";
import { staffDashboardMultiItem } from "@/lib/order-picker-labels";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, LayoutGrid, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

type StaffPick = { id: number; fio: string; code?: string | null };
type NameId = { id: number; name: string };

type ProductSalesFilterOpts = {
  territory_1?: string[];
  territory_2?: string[];
  territory_3?: string[];
  territory_2_by_1?: Record<string, string[]>;
  territory_3_by_2?: Record<string, string[]>;
  regions_by_zone?: Record<string, string[]>;
  cities_by_zone_region?: Record<string, string[]>;
  territory_tree?: Array<{ zone: string; region: string; city: string }>;
  trade_directions?: Array<{ id: number; name: string; code: string }>;
  payment_methods?: Array<{ id: string; label: string }>;
};

type SalesFilterDraft = {
  date_type: "order_date" | "shipment_date";
  from: string;
  to: string;
  status: string[];
  category_ids: string[];
  manufacturer_ids: string[];
  supervisor_ids: string[];
  group_ids: string[];
  brand_ids: string[];
  trade_directions: string[];
  territory_1_list: string[];
  territory_2_list: string[];
  territory_3_list: string[];
  payment_types: string[];
};

type QuickRangeKey =
  | "custom"
  | "today"
  | "yesterday"
  | "last3"
  | "last7"
  | "last30"
  | "this_month"
  | "prev_month";

type SalesDashboardData = {
  total_sales_summary: {
    total_sales_sum: string;
    orders_count: number;
  };
  payment_method_analytics: Array<{ payment_type: string; sales_sum: string; share_pct: number }>;
  product_category_analytics: Array<{ category: string; sales_sum: string; share_pct: number }>;
  product_group_analytics: Array<{ product_group: string; sales_sum: string; share_pct: number }>;
  category_performance_table: Array<{
    category: string;
    sales_sum: string;
    sold_qty: string;
    volume: string;
    akb: number;
    share_pct: number;
  }>;
  orders_refusals: {
    accepted: number;
    rejected: number;
    pending: number;
    total: number;
    conversion_pct: number;
  };
  refusal_reason_analytics: Array<{ reason: string; count: number; share_pct: number }>;
  sales_dynamics: Array<{ period: string; sales_sum: string; orders_count: number }>;
  akb_okb_block: { akb: number; okb: number; coverage_pct: number };
  territory_analytics: Array<{
    territory: string;
    sales_sum: string;
    akb: number;
    okb: number;
    coverage_pct: number;
  }>;
  agent_analytics: Array<{
    agent_id: number;
    agent_name: string;
    agent_code: string | null;
    sales_sum: string;
    akb: number;
    okb: number;
    coverage_pct: number;
  }>;
};

const SALES_CAT_PERF_TABLE_ID = "dashboard-sales/category-performance";
const SALES_AGENT_TABLE_ID = "dashboard-sales/agent-analytics";

const SALES_CAT_PERF_COL_DEFS: ColumnDefItem[] = [
  { id: "category", label: "Категория" },
  { id: "sales_sum", label: "Сумма продаж" },
  { id: "sold_qty", label: "Кол-во" },
  { id: "volume", label: "Объем" },
  { id: "akb", label: "АКБ" },
  { id: "share_pct", label: "Доля" }
];
const SALES_CAT_PERF_DEFAULT_ORDER = SALES_CAT_PERF_COL_DEFS.map((c) => c.id);

const SALES_AGENT_COL_DEFS: ColumnDefItem[] = [
  { id: "agent_name", label: "Агент" },
  { id: "agent_code", label: "Код" },
  { id: "sales_sum", label: "Сумма продаж" },
  { id: "akb", label: "АКБ" },
  { id: "okb", label: "ОКБ" },
  { id: "coverage_pct", label: "Процент ОКБ" }
];
const SALES_AGENT_DEFAULT_ORDER = SALES_AGENT_COL_DEFS.map((c) => c.id);

function decodeAccessTokenSub(accessToken: string | null | undefined): number | null {
  if (!accessToken) return null;
  try {
    const parts = accessToken.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1]!;
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    const padded = pad ? b64 + "=".repeat(4 - pad) : b64;
    const json = JSON.parse(atob(padded)) as { sub?: unknown };
    const id = Number.parseInt(String(json.sub ?? ""), 10);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

function defaultDraft(supervisorId = ""): SalesFilterDraft {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  return {
    date_type: "shipment_date",
    from,
    to,
    status: [],
    category_ids: [],
    manufacturer_ids: [],
    supervisor_ids: supervisorId ? [supervisorId] : [],
    group_ids: [],
    brand_ids: [],
    trade_directions: [],
    territory_1_list: [],
    territory_2_list: [],
    territory_3_list: [],
    payment_types: []
  };
}

function normTrim(s: string): string {
  return String(s ?? "").trim();
}

function joinCsv(values: string[] | undefined): string {
  if (!values || values.length === 0) return "";
  const set = new Set<string>();
  for (const v of values) {
    const t = normTrim(v);
    if (t) set.add(t);
  }
  return Array.from(set).join(",");
}

function fmtMoney(v: string | number): string {
  return formatNumberGrouped(v, { minFractionDigits: 2, maxFractionDigits: 2 });
}

function fmtCount(v: string | number): string {
  return formatNumberGrouped(v, { maxFractionDigits: 0 });
}

function TablePager({
  total,
  page,
  pageSize,
  onPageChange
}: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIdx = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIdx = Math.min(total, safePage * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-muted/10 px-2 py-2 text-[11px] text-muted-foreground">
      <span className="tabular-nums">{total === 0 ? "0 записей" : `${startIdx}–${endIdx} из ${total}`}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm hover:bg-muted disabled:opacity-50"
          disabled={safePage <= 1}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
        >
          Назад
        </button>
        <span className="min-w-[4.25rem] text-center tabular-nums text-foreground">
          {safePage} / {totalPages}
        </span>
        <button
          type="button"
          className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm hover:bg-muted disabled:opacity-50"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
        >
          Вперёд
        </button>
      </div>
    </div>
  );
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  new: "Новая",
  confirmed: "Подтверждена",
  picking: "На сборке",
  delivering: "В доставке",
  delivered: "Доставлена",
  cancelled: "Отказ",
  returned: "Возврат"
};

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  cash: "Наличные",
  naqd: "Наличные",
  nalichnye: "Наличные",
  card: "Карта",
  terminal: "Терминал",
  transfer: "Перевод",
  bank_transfer: "Банковский перевод",
  click: "Click",
  payme: "Payme",
  uzs_payme: "Payme (UZS)",
  uzs_click: "Click (UZS)"
};

const pieLoading = () => (
  <div className="h-[240px] animate-pulse rounded-lg bg-muted/30" aria-hidden />
);

const ReportsStatusPie = dynamic(
  () => import("@/components/charts/analytics-charts").then((m) => ({ default: m.ReportsStatusPie })),
  { ssr: false, loading: pieLoading }
);

const ReportsTrendCharts = dynamic(
  () => import("@/components/charts/analytics-charts").then((m) => ({ default: m.ReportsTrendCharts })),
  { ssr: false, loading: pieLoading }
);

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function quickRangeToDates(key: QuickRangeKey): { from: string; to: string } | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (key === "today") {
    const x = toYmd(today);
    return { from: x, to: x };
  }
  if (key === "yesterday") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    const x = toYmd(y);
    return { from: x, to: x };
  }
  if (key === "last3") {
    const from = new Date(today);
    from.setDate(from.getDate() - 2);
    return { from: toYmd(from), to: toYmd(today) };
  }
  if (key === "last7") {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { from: toYmd(from), to: toYmd(today) };
  }
  if (key === "last30") {
    const from = new Date(today);
    from.setDate(from.getDate() - 29);
    return { from: toYmd(from), to: toYmd(today) };
  }
  if (key === "this_month") {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { from: toYmd(from), to: toYmd(to) };
  }
  if (key === "prev_month") {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const to = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: toYmd(from), to: toYmd(to) };
  }
  return null;
}

function humanizeToken(value: string): string {
  return value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function formatStatusLabel(value: string): string {
  const key = value.trim().toLowerCase();
  const fallback = humanizeToken(value);
  return ORDER_STATUS_LABELS[key] ?? (fallback || "—");
}

function formatPaymentTypeLabel(value: string): string {
  const key = value.trim().toLowerCase();
  const fallback = humanizeToken(value);
  return PAYMENT_TYPE_LABELS[key] ?? (fallback || "—");
}

function formatReasonLabel(value: string): string {
  return humanizeToken(value) || "—";
}

function fileToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-");
}

async function exportSheetsToXlsx(
  fileName: string,
  sheets: Array<{ name: string; rows: Array<Array<string | number>> }>
): Promise<void> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    XLSX.utils.book_append_sheet(wb, ws, s.name);
  }
  XLSX.writeFile(wb, `${fileName}.xlsx`, { bookType: "xlsx", compression: true });
}

export function DashboardSales() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const role = useEffectiveRole();
  const hydrated = useAuthStoreHydrated();
  const selfSupervisorId = useMemo(
    () => (role === "supervisor" ? decodeAccessTokenSub(accessToken) : null),
    [role, accessToken]
  );
  const selfSupervisorIdStr = selfSupervisorId != null ? String(selfSupervisorId) : "";
  const [draft, setDraft] = useState<SalesFilterDraft>(() => defaultDraft());
  const [applied, setApplied] = useState<SalesFilterDraft>(() => defaultDraft());
  const [quickRange, setQuickRange] = useState<QuickRangeKey>("last30");
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const dateRangeAnchorRef = useRef<HTMLButtonElement>(null);

  const [categoryPerfPage, setCategoryPerfPage] = useState(1);
  const [categoryPerfPageSize, setCategoryPerfPageSize] = useState(10);
  const [territoryPage, setTerritoryPage] = useState(1);
  const [territoryPageSize, setTerritoryPageSize] = useState(10);
  const [agentPage, setAgentPage] = useState(1);
  const [agentPageSize, setAgentPageSize] = useState(10);

  const catPerfTablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: SALES_CAT_PERF_TABLE_ID,
    defaultColumnOrder: SALES_CAT_PERF_DEFAULT_ORDER,
    defaultPageSize: 10,
    allowedPageSizes: [10, 20, 30, 50]
  });
  const [catPerfColumnsOpen, setCatPerfColumnsOpen] = useState(false);

  const agentTablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: SALES_AGENT_TABLE_ID,
    defaultColumnOrder: SALES_AGENT_DEFAULT_ORDER,
    defaultPageSize: 10,
    allowedPageSizes: [10, 20, 30, 50]
  });
  const [agentColumnsOpen, setAgentColumnsOpen] = useState(false);

  useEffect(() => {
    if (!selfSupervisorIdStr) return;
    setDraft((prev) =>
      prev.supervisor_ids.length === 1 && prev.supervisor_ids[0] === selfSupervisorIdStr
        ? prev
        : { ...prev, supervisor_ids: [selfSupervisorIdStr] }
    );
    setApplied((prev) =>
      prev.supervisor_ids.length === 1 && prev.supervisor_ids[0] === selfSupervisorIdStr
        ? prev
        : { ...prev, supervisor_ids: [selfSupervisorIdStr] }
    );
  }, [selfSupervisorIdStr]);

  useEffect(() => setCategoryPerfPage(1), [categoryPerfPageSize]);
  useEffect(() => setTerritoryPage(1), [territoryPageSize]);
  useEffect(() => setAgentPage(1), [agentPageSize]);

  const supervisorsQ = useQuery({
    queryKey: qkDashboardSupervisorsActive(tenantSlug),
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: StaffPick[] }>(`/api/${tenantSlug}/supervisors?is_active=true`);
      return data.data ?? [];
    }
  });

  const categoriesQ = useQuery({
    queryKey: qkDashboardProductCategories(tenantSlug),
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: NameId[] }>(`/api/${tenantSlug}/product-categories`);
      return data.data ?? [];
    }
  });

  const brandsQ = useQuery({
    queryKey: ["dashboard-sales", "brands", tenantSlug],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: NameId[] }>(`/api/${tenantSlug}/catalog/brands?limit=200&page=1`);
      return data.data ?? [];
    }
  });

  const groupsQ = useQuery({
    queryKey: ["dashboard-sales", "groups", tenantSlug],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: NameId[] }>(
        `/api/${tenantSlug}/catalog/product-groups?limit=200&page=1`
      );
      return data.data ?? [];
    }
  });

  const manufacturersQ = useQuery({
    queryKey: ["dashboard-sales", "manufacturers", tenantSlug],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: NameId[] }>(
        `/api/${tenantSlug}/catalog/manufacturers?limit=200&page=1`
      );
      return data.data ?? [];
    }
  });

  const clientRefsQ = useQuery({
    queryKey: qkDashboardClientReferences(tenantSlug),
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{
        regions?: string[];
        cities?: string[];
        zones?: string[];
        region_options?: { value: string; label: string }[];
        city_options?: { value: string; label: string }[];
        city_territory_hints?: Record<string, { city_label?: string | null }>;
      }>(`/api/${tenantSlug}/clients/references`);
      return data;
    }
  });

  const profileQ = useQuery({
    queryKey: ["dashboard-sales", "profile", tenantSlug],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{
        references?: {
          payment_method_entries?: Array<{ id: string; name: string; active?: boolean }>;
          trade_directions?: string[];
          territory_nodes?: TerritoryNode[];
        };
      }>(`/api/${tenantSlug}/settings/profile`);
      return data.references ?? {};
    }
  });

  const queryString = useMemo(() => {
    const q = new URLSearchParams();
    q.set("date_type", applied.date_type);
    q.set("from", applied.from);
    q.set("to", applied.to);
    const status = joinCsv(applied.status);
    if (status) q.set("status", status);
    const cats = joinCsv(applied.category_ids);
    if (cats) q.set("category_ids", cats);
    const mans = joinCsv(applied.manufacturer_ids);
    if (mans) q.set("manufacturer_ids", mans);
    const sups = joinCsv(applied.supervisor_ids);
    if (sups) q.set("supervisor_ids", sups);
    const groups = joinCsv(applied.group_ids);
    if (groups) q.set("group_ids", groups);
    const brands = joinCsv(applied.brand_ids);
    if (brands) q.set("brand_ids", brands);
    const td = joinCsv(applied.trade_directions);
    if (td) q.set("trade_direction", td);
    const t1 = joinCsv(applied.territory_1_list);
    if (t1) q.set("territory_1", t1);
    const t2 = joinCsv(applied.territory_2_list);
    if (t2) q.set("territory_2", t2);
    const t3 = joinCsv(applied.territory_3_list);
    if (t3) q.set("territory_3", t3);
    const pay = joinCsv(applied.payment_types);
    if (pay) q.set("payment_types", pay);
    return q.toString();
  }, [applied]);

  const dataQ = useQuery({
    queryKey: ["dashboard-sales", tenantSlug, queryString],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.live,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
    queryFn: async () => {
      const { data } = await api.get<SalesDashboardData>(`/api/${tenantSlug}/dashboard/sales?${queryString}`);
      return data;
    }
  });

  const paymentOptions = useMemo(
    () =>
      (profileQ.data?.payment_method_entries ?? [])
        .filter((p) => p.active !== false)
        .map((p) => ({ value: String(p.id ?? "").trim(), label: String(p.name ?? "").trim() }))
        .filter((p) => p.value && p.label),
    [profileQ.data]
  );

  const dateTypeSelectOptions = useMemo(
    () => [
      { value: "order_date", label: "Дата заявки" },
      { value: "shipment_date", label: "Дата отгрузки" }
    ],
    []
  );

  const statusSelectOptions = useMemo(
    () =>
      (["new", "confirmed", "picking", "delivering", "delivered", "cancelled"] as const).map((s) => ({
        value: s,
        label: formatStatusLabel(s)
      })),
    []
  );

  const categorySelectOptions = useMemo(
    () =>
      (categoriesQ.data ?? []).map((x) => ({
        value: String(x.id),
        label: x.name
      })),
    [categoriesQ.data]
  );

  const manufacturerSelectOptions = useMemo(
    () =>
      (manufacturersQ.data ?? []).map((x) => ({
        value: String(x.id),
        label: x.name
      })),
    [manufacturersQ.data]
  );

  const groupSelectOptions = useMemo(
    () =>
      (groupsQ.data ?? []).map((x) => ({
        value: String(x.id),
        label: x.name
      })),
    [groupsQ.data]
  );

  const brandSelectOptions = useMemo(
    () =>
      (brandsQ.data ?? []).map((x) => ({
        value: String(x.id),
        label: x.name
      })),
    [brandsQ.data]
  );

  const supervisorSelectOptions = useMemo(
    () => (supervisorsQ.data ?? []).map((s) => staffDashboardMultiItem(s)),
    [supervisorsQ.data]
  );

  const tradeDirectionOptions = useMemo(
    () => (profileQ.data?.trade_directions ?? []).map((t) => ({ value: t, label: t })),
    [profileQ.data?.trade_directions]
  );
  const productSalesFiltersQ = useQuery({
    queryKey: ["dashboard-sales", "report-filters", tenantSlug],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: ProductSalesFilterOpts }>(
        `/api/${tenantSlug}/reports/product-sales/filter-options`
      );
      return data.data ?? {};
    }
  });

  const reportFilters = productSalesFiltersQ.data;

  const resolvePaymentMethodDisplay = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profileQ.data?.payment_method_entries ?? []) {
      const id = normTrim(String(p.id ?? ""));
      const name = normTrim(String(p.name ?? ""));
      if (!id) continue;
      m.set(id, name || id);
      m.set(id.toLowerCase(), name || id);
    }
    return (ref: string) => {
      const k = normTrim(ref);
      if (!k || k === "—") return "—";
      return m.get(k) ?? m.get(k.toLowerCase()) ?? formatPaymentTypeLabel(k);
    };
  }, [profileQ.data?.payment_method_entries]);

  const resolveTerritoryDisplay = useMemo(
    () =>
      createTerritoryLabelResolver({
        zones: clientRefsQ.data?.zones,
        region_options: clientRefsQ.data?.region_options,
        city_options: clientRefsQ.data?.city_options,
        city_territory_hints: clientRefsQ.data?.city_territory_hints,
        territory_nodes: profileQ.data?.territory_nodes
      }),
    [clientRefsQ.data, profileQ.data?.territory_nodes]
  );

  const uniqSorted = (values: string[]) => {
    const s = new Set<string>();
    for (const v of values) {
      const t = String(v ?? "").trim();
      if (t) s.add(t);
    }
    return [...s].sort((a, b) => a.localeCompare(b, "ru"));
  };

  const territoryZoneSelectOptions = useMemo(() => {
    const hasReport = (reportFilters?.territory_1?.length ?? 0) > 0;
    const base = hasReport ? (reportFilters?.territory_1 ?? []) : (clientRefsQ.data?.zones ?? []);
    return uniqSorted(base).map((z) => ({ value: z, label: resolveTerritoryDisplay(z) }));
  }, [reportFilters?.territory_1, clientRefsQ.data?.zones, resolveTerritoryDisplay]);

  const territoryRegionSelectOptions = useMemo(() => {
    const zones = draft.territory_1_list.map(normTrim).filter(Boolean);
    let rows: string[] = [];
    if (zones.length === 0) {
      const hasReport = (reportFilters?.territory_2?.length ?? 0) > 0;
      rows = hasReport ? (reportFilters?.territory_2 ?? []) : (clientRefsQ.data?.regions ?? []);
    } else {
      const set = new Set<string>();
      for (const z of zones) {
        const chunk = reportFilters?.regions_by_zone?.[z] ?? reportFilters?.territory_2_by_1?.[z] ?? [];
        for (const r of chunk) set.add(r);
      }
      rows = [...set];
      if (rows.length === 0) rows = reportFilters?.territory_2 ?? clientRefsQ.data?.regions ?? [];
    }
    return uniqSorted(rows).map((r) => ({ value: r, label: resolveTerritoryDisplay(r) }));
  }, [draft.territory_1_list, reportFilters, clientRefsQ.data?.regions, resolveTerritoryDisplay]);

  const territoryCitySelectOptions = useMemo(() => {
    const zones = draft.territory_1_list.map(normTrim).filter(Boolean);
    const regions = draft.territory_2_list.map(normTrim).filter(Boolean);
    let rows: string[] = [];
    if (zones.length === 0 && regions.length === 0) {
      const hasReport = (reportFilters?.territory_3?.length ?? 0) > 0;
      rows = hasReport ? (reportFilters?.territory_3 ?? []) : (clientRefsQ.data?.cities ?? []);
    } else if (regions.length > 0) {
      const set = new Set<string>();
      for (const region of regions) {
        for (const c of reportFilters?.territory_3_by_2?.[region] ?? []) set.add(c);
      }
      rows = [...set];
      if (rows.length === 0) rows = reportFilters?.territory_3 ?? clientRefsQ.data?.cities ?? [];
    } else {
      rows = reportFilters?.territory_3 ?? clientRefsQ.data?.cities ?? [];
    }
    return uniqSorted(rows).map((c) => ({ value: c, label: resolveTerritoryDisplay(c) }));
  }, [draft.territory_1_list, draft.territory_2_list, reportFilters, clientRefsQ.data?.cities, resolveTerritoryDisplay]);

  const applyFilters = () => {
    setApplied({
      ...draft,
      supervisor_ids: selfSupervisorIdStr ? [selfSupervisorIdStr] : draft.supervisor_ids
    });
  };

  const resetFilters = () => {
    const fresh = defaultDraft(selfSupervisorIdStr);
    setDraft(fresh);
    setApplied(fresh);
    setQuickRange("last30");
  };

  const exportButtonClass =
    "inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-2 text-xs font-medium hover:bg-muted";
  const exportPrefix = useMemo(
    () => `sales-${fileToken(applied.from)}-${fileToken(applied.to)}`,
    [applied.from, applied.to]
  );

  const exportPaymentMethods = async () => {
    const d = dataQ.data;
    if (!d) return;
    await exportSheetsToXlsx(`${exportPrefix}-oplata`, [
      {
        name: "Оплаты",
        rows: [
          ["Способ оплаты", "Сумма", "Доля, %"],
          ...d.payment_method_analytics.map((r) => [
            resolvePaymentMethodDisplay(r.payment_type),
            Number(r.sales_sum),
            r.share_pct
          ])
        ]
      }
    ]);
  };

  const exportOrdersRefusals = async () => {
    const d = dataQ.data;
    if (!d) return;
    const o = d.orders_refusals;
    await exportSheetsToXlsx(`${exportPrefix}-otkazy`, [
      {
        name: "Отказы",
        rows: [
          ["Показатель", "Значение"],
          ["Принято", o.accepted],
          ["Отклонено", o.rejected],
          ["В обработке", o.pending],
          ["Всего", o.total],
          ["Конверсия, %", o.conversion_pct]
        ]
      }
    ]);
  };

  const exportProductCategories = async () => {
    const d = dataQ.data;
    if (!d) return;
    await exportSheetsToXlsx(`${exportPrefix}-kat-prod`, [
      {
        name: "Категории",
        rows: [
          ["Категория", "Сумма", "Доля, %"],
          ...d.product_category_analytics.map((r) => [r.category, Number(r.sales_sum), r.share_pct])
        ]
      }
    ]);
  };

  const exportProductGroups = async () => {
    const d = dataQ.data;
    if (!d) return;
    await exportSheetsToXlsx(`${exportPrefix}-gruppy`, [
      {
        name: "Группы",
        rows: [
          ["Группа", "Сумма", "Доля, %"],
          ...d.product_group_analytics.map((r) => [r.product_group, Number(r.sales_sum), r.share_pct])
        ]
      }
    ]);
  };

  const exportCategoryPerformance = async () => {
    const d = dataQ.data;
    if (!d) return;
    await exportSheetsToXlsx(`${exportPrefix}-effekt`, [
      {
        name: "Эффективность",
        rows: [
          ["Категория", "Сумма продаж", "Кол-во", "Объем", "АКБ", "Доля, %"],
          ...d.category_performance_table.map((r) => [
            r.category,
            Number(r.sales_sum),
            Number(r.sold_qty),
            Number(r.volume),
            r.akb,
            r.share_pct
          ])
        ]
      }
    ]);
  };

  const exportSalesDynamics = async () => {
    const d = dataQ.data;
    if (!d) return;
    await exportSheetsToXlsx(`${exportPrefix}-dinamika`, [
      {
        name: "Динамика",
        rows: [
          ["Период", "Сумма продаж", "Заказы"],
          ...d.sales_dynamics.map((r) => [r.period, Number(r.sales_sum), r.orders_count])
        ]
      }
    ]);
  };

  const exportRefusalReasons = async () => {
    const d = dataQ.data;
    if (!d) return;
    await exportSheetsToXlsx(`${exportPrefix}-prichiny`, [
      {
        name: "Причины",
        rows: [
          ["Причина", "Кол-во", "Доля, %"],
          ...d.refusal_reason_analytics.map((r) => [formatReasonLabel(r.reason), r.count, r.share_pct])
        ]
      }
    ]);
  };

  const exportTerritoryAnalytics = async () => {
    const d = dataQ.data;
    if (!d) return;
    await exportSheetsToXlsx(`${exportPrefix}-territorii`, [
      {
        name: "Территории",
        rows: [
          ["Территория", "Сумма", "АКБ", "ОКБ", "Процент ОКБ"],
          ...d.territory_analytics.map((r) => [
            resolveTerritoryDisplay(r.territory),
            Number(r.sales_sum),
            r.akb,
            r.okb,
            r.coverage_pct
          ])
        ]
      }
    ]);
  };

  const exportAgentAnalytics = async () => {
    const d = dataQ.data;
    if (!d) return;
    await exportSheetsToXlsx(`${exportPrefix}-agenty`, [
      {
        name: "Агенты",
        rows: [
          ["Агент", "Код", "Сумма продаж", "АКБ", "ОКБ", "Процент ОКБ"],
          ...d.agent_analytics.map((r) => [
            r.agent_name,
            r.agent_code ?? "",
            Number(r.sales_sum),
            r.akb,
            r.okb,
            r.coverage_pct
          ])
        ]
      }
    ]);
  };

  const exportAll = async () => {
    const d = dataQ.data;
    if (!d) return;
    const s = d.total_sales_summary;
    const a = d.akb_okb_block;
    await exportSheetsToXlsx(`${exportPrefix}-all`, [
      {
        name: "Сводка",
        rows: [
          ["Показатель", "Значение"],
          ["Общая сумма", Number(s.total_sales_sum)],
          ["Заказы", s.orders_count],
          ["АКБ", a.akb],
          ["ОКБ", a.okb],
          ["Процент ОКБ, %", a.coverage_pct]
        ]
      },
      {
        name: "Оплаты",
        rows: [
          ["Способ оплаты", "Сумма", "Доля, %"],
          ...d.payment_method_analytics.map((r) => [
            resolvePaymentMethodDisplay(r.payment_type),
            Number(r.sales_sum),
            r.share_pct
          ])
        ]
      },
      {
        name: "Отказы",
        rows: [
          ["Показатель", "Значение"],
          ["Принято", d.orders_refusals.accepted],
          ["Отклонено", d.orders_refusals.rejected],
          ["В обработке", d.orders_refusals.pending],
          ["Всего", d.orders_refusals.total],
          ["Конверсия, %", d.orders_refusals.conversion_pct]
        ]
      },
      {
        name: "Категории",
        rows: [
          ["Категория", "Сумма", "Доля, %"],
          ...d.product_category_analytics.map((r) => [r.category, Number(r.sales_sum), r.share_pct])
        ]
      },
      {
        name: "Группы",
        rows: [
          ["Группа", "Сумма", "Доля, %"],
          ...d.product_group_analytics.map((r) => [r.product_group, Number(r.sales_sum), r.share_pct])
        ]
      },
      {
        name: "Эффективность",
        rows: [
          ["Категория", "Сумма продаж", "Кол-во", "Объем", "АКБ", "Доля, %"],
          ...d.category_performance_table.map((r) => [
            r.category,
            Number(r.sales_sum),
            Number(r.sold_qty),
            Number(r.volume),
            r.akb,
            r.share_pct
          ])
        ]
      },
      {
        name: "Динамика",
        rows: [
          ["Период", "Сумма продаж", "Заказы"],
          ...d.sales_dynamics.map((r) => [r.period, Number(r.sales_sum), r.orders_count])
        ]
      },
      {
        name: "Причины",
        rows: [
          ["Причина", "Кол-во", "Доля, %"],
          ...d.refusal_reason_analytics.map((r) => [formatReasonLabel(r.reason), r.count, r.share_pct])
        ]
      },
      {
        name: "Территории",
        rows: [
          ["Территория", "Сумма", "АКБ", "ОКБ", "Процент ОКБ"],
          ...d.territory_analytics.map((r) => [
            resolveTerritoryDisplay(r.territory),
            Number(r.sales_sum),
            r.akb,
            r.okb,
            r.coverage_pct
          ])
        ]
      },
      {
        name: "Агенты",
        rows: [
          ["Агент", "Код", "Сумма продаж", "АКБ", "ОКБ", "Процент ОКБ"],
          ...d.agent_analytics.map((r) => [
            r.agent_name,
            r.agent_code ?? "",
            Number(r.sales_sum),
            r.akb,
            r.okb,
            r.coverage_pct
          ])
        ]
      }
    ]);
  };

  const categoryPie = useMemo(
    () =>
      (dataQ.data?.product_category_analytics ?? []).map((r, i) => ({
        status: `cat_${i}`,
        name: r.category,
        value: Number(r.sales_sum) || 0
      })),
    [dataQ.data]
  );
  const groupPie = useMemo(
    () =>
      (dataQ.data?.product_group_analytics ?? []).map((r, i) => ({
        status: `grp_${i}`,
        name: r.product_group,
        value: Number(r.sales_sum) || 0
      })),
    [dataQ.data]
  );
  const trendRows = useMemo(
    () =>
      (dataQ.data?.sales_dynamics ?? []).map((r) => ({
        dateShort: r.period.length >= 10 ? r.period.slice(5, 10) : r.period,
        orders: r.orders_count,
        revenue: Number(r.sales_sum) || 0
      })),
    [dataQ.data]
  );

  return (
    <PageShell>
      <PageHeader
        title="Дашборд продаж"
        description="Аналитика продаж: покрытие, структура оплат, территории и эффективность агентов."
        actions={
          <div className="flex w-full max-w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-md border border-input px-3 text-xs font-medium hover:bg-muted"
                onClick={resetFilters}
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                Сброс
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground hover:opacity-95"
                onClick={applyFilters}
              >
                Применить
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-muted"
                onClick={() => void exportAll()}
                disabled={!dataQ.data}
              >
                Excel (всё)
              </button>
            </div>
            <div className="hidden h-7 w-px shrink-0 bg-border sm:block" aria-hidden />
            <div className="inline-flex max-w-full flex-nowrap items-center gap-2 overflow-x-auto py-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-3 [&::-webkit-scrollbar]:hidden">
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                <label className="inline-flex h-9 cursor-pointer select-none items-center gap-1.5 whitespace-nowrap rounded-md border border-input bg-background px-2.5 text-xs shadow-sm transition-colors hover:bg-muted/40 sm:px-3 sm:text-sm">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-primary sm:h-4 sm:w-4"
                    checked={draft.date_type === "order_date"}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        date_type: e.target.checked ? "order_date" : "shipment_date"
                      }))
                    }
                  />
                  Дата заявки
                </label>
                <label className="inline-flex h-9 cursor-pointer select-none items-center gap-1.5 whitespace-nowrap rounded-md border border-input bg-background px-2.5 text-xs shadow-sm transition-colors hover:bg-muted/40 sm:px-3 sm:text-sm">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-primary sm:h-4 sm:w-4"
                    checked={draft.date_type === "shipment_date"}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        date_type: e.target.checked ? "shipment_date" : "order_date"
                      }))
                    }
                  />
                  Дата отгрузки
                </label>
                <label className="inline-flex h-9 cursor-pointer select-none items-center gap-1.5 whitespace-nowrap rounded-md border border-input bg-background px-2.5 text-xs shadow-sm transition-colors hover:bg-muted/40 sm:px-3 sm:text-sm">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-primary sm:h-4 sm:w-4"
                    checked={quickRange === "last3"}
                    onChange={(e) => {
                      if (!e.target.checked) {
                        setQuickRange("custom");
                        return;
                      }
                      const next = quickRangeToDates("last3");
                      if (!next) return;
                      setQuickRange("last3");
                      setDraft((p) => ({ ...p, from: next.from, to: next.to }));
                    }}
                  />
                  За 3 дня
                </label>
              </div>
              <div className="hidden h-7 w-px shrink-0 bg-border sm:block" aria-hidden />
              <button
                ref={dateRangeAnchorRef}
                type="button"
                className={cn(
                  "inline-flex h-9 min-w-[10.5rem] max-w-[min(100vw-8rem,20rem)] shrink-0 items-center gap-2 rounded-md border border-input bg-background px-2.5 text-left text-xs shadow-sm outline-none transition-colors sm:min-w-[12rem] sm:px-3",
                  "hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  dateRangeOpen && "border-primary/60 bg-primary/5"
                )}
                title="Календарь: выбор дней и пресетов"
                aria-label={`Период отчёта: ${formatDateRangeButton(draft.from, draft.to)}`}
                aria-expanded={dateRangeOpen}
                aria-haspopup="dialog"
                onClick={() => setDateRangeOpen((o) => !o)}
              >
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground sm:h-4 sm:w-4" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{formatDateRangeButton(draft.from, draft.to)}</span>
              </button>
            </div>
          </div>
        }
      />

      {!hydrated ? (
        <p className="text-sm text-muted-foreground">Загрузка сессии…</p>
      ) : !tenantSlug ? (
        <p className="text-sm text-destructive">Сессия не найдена. Войдите заново.</p>
      ) : (
        <div className="space-y-4">
          <TableColumnSettingsDialog
            open={catPerfColumnsOpen}
            onOpenChange={setCatPerfColumnsOpen}
            title="Столбцы таблицы"
            description="Видимые столбцы и порядок сохраняются для вашей учётной записи."
            columns={[...SALES_CAT_PERF_COL_DEFS]}
            columnOrder={catPerfTablePrefs.columnOrder}
            hiddenColumnIds={catPerfTablePrefs.hiddenColumnIds}
            saving={catPerfTablePrefs.saving}
            onSave={(next) => catPerfTablePrefs.saveColumnLayout(next)}
            onReset={() => catPerfTablePrefs.resetColumnLayout()}
          />
          <TableColumnSettingsDialog
            open={agentColumnsOpen}
            onOpenChange={setAgentColumnsOpen}
            title="Столбцы таблицы"
            description="Видимые столбцы и порядок сохраняются для вашей учётной записи."
            columns={[...SALES_AGENT_COL_DEFS]}
            columnOrder={agentTablePrefs.columnOrder}
            hiddenColumnIds={agentTablePrefs.hiddenColumnIds}
            saving={agentTablePrefs.saving}
            onSave={(next) => agentTablePrefs.saveColumnLayout(next)}
            onReset={() => agentTablePrefs.resetColumnLayout()}
          />
          <Card>
            <CardContent className="p-4">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                <div className="min-w-0">
                  <FilterSearchableSelect
                    emptyLabel="Тип даты"
                    className={cn(filterPanelSelectClassName, "h-10 min-w-0 max-w-none text-xs")}
                    value={draft.date_type}
                    searchable={false}
                    onValueChange={(v) =>
                      setDraft((p) => ({
                        ...p,
                        date_type: (v as "order_date" | "shipment_date") || "shipment_date"
                      }))
                    }
                    options={dateTypeSelectOptions}
                  />
                </div>
                <div className="min-w-0">
                  <SupervisorDashboardMultiFilter
                    placeholder="Статус"
                    searchPlaceholder="Статус"
                    triggerClassName={cn(filterPanelSelectClassName, "h-10 min-w-0 max-w-none text-xs")}
                    items={statusSelectOptions.map((o) => ({ id: o.value, title: o.label }))}
                    selectedValues={draft.status}
                    onChange={(next) => setDraft((p) => ({ ...p, status: next }))}
                  />
                </div>
                <div className="min-w-0">
                  <SupervisorDashboardMultiFilter
                    placeholder="Категория товара"
                    searchPlaceholder="Категория"
                    triggerClassName={cn(filterPanelSelectClassName, "h-10 min-w-0 max-w-none text-xs")}
                    items={categorySelectOptions.map((o) => ({ id: o.value, title: o.label }))}
                    selectedValues={draft.category_ids}
                    onChange={(next) => setDraft((p) => ({ ...p, category_ids: next }))}
                  />
                </div>
                <div className="min-w-0">
                  <SupervisorDashboardMultiFilter
                    placeholder="Производитель"
                    searchPlaceholder="Производитель"
                    triggerClassName={cn(filterPanelSelectClassName, "h-10 min-w-0 max-w-none text-xs")}
                    items={manufacturerSelectOptions.map((o) => ({ id: o.value, title: o.label }))}
                    selectedValues={draft.manufacturer_ids}
                    onChange={(next) => setDraft((p) => ({ ...p, manufacturer_ids: next }))}
                  />
                </div>
                <div className="min-w-0">
                  <SupervisorDashboardMultiFilter
                    placeholder="Супервайзер"
                    searchPlaceholder="Супервайзер"
                    triggerClassName={cn(filterPanelSelectClassName, "h-10 min-w-0 max-w-none text-xs")}
                    items={supervisorSelectOptions}
                    selectedValues={draft.supervisor_ids}
                    disabled={Boolean(selfSupervisorIdStr)}
                    onChange={(next) => setDraft((p) => ({ ...p, supervisor_ids: next }))}
                  />
                </div>
                <div className="min-w-0">
                  <SupervisorDashboardMultiFilter
                    placeholder="Группы товаров"
                    searchPlaceholder="Группа"
                    triggerClassName={cn(filterPanelSelectClassName, "h-10 min-w-0 max-w-none text-xs")}
                    items={groupSelectOptions.map((o) => ({ id: o.value, title: o.label }))}
                    selectedValues={draft.group_ids}
                    onChange={(next) => setDraft((p) => ({ ...p, group_ids: next }))}
                  />
                </div>
                <div className="min-w-0">
                  <SupervisorDashboardMultiFilter
                    placeholder="Бренды"
                    searchPlaceholder="Бренд"
                    triggerClassName={cn(filterPanelSelectClassName, "h-10 min-w-0 max-w-none text-xs")}
                    items={brandSelectOptions.map((o) => ({ id: o.value, title: o.label }))}
                    selectedValues={draft.brand_ids}
                    onChange={(next) => setDraft((p) => ({ ...p, brand_ids: next }))}
                  />
                </div>
                <div className="min-w-0">
                  <SupervisorDashboardMultiFilter
                    placeholder="Направление торговли"
                    searchPlaceholder="Направление"
                    triggerClassName={cn(filterPanelSelectClassName, "h-10 min-w-0 max-w-none text-xs")}
                    items={tradeDirectionOptions.map((o) => ({ id: o.value, title: o.label }))}
                    selectedValues={draft.trade_directions}
                    onChange={(next) => setDraft((p) => ({ ...p, trade_directions: next }))}
                  />
                </div>
                <div className="min-w-0">
                  <SupervisorDashboardMultiFilter
                    placeholder="Зона"
                    searchPlaceholder="Зона"
                    triggerClassName={cn(filterPanelSelectClassName, "h-10 min-w-0 max-w-none text-xs")}
                    items={territoryZoneSelectOptions.map((o) => ({ id: o.value, title: o.label }))}
                    selectedValues={draft.territory_1_list}
                    onChange={(next) =>
                      setDraft((p) => ({ ...p, territory_1_list: next, territory_2_list: [], territory_3_list: [] }))
                    }
                  />
                </div>
                <div className="min-w-0">
                  <SupervisorDashboardMultiFilter
                    placeholder="Область"
                    searchPlaceholder="Область"
                    triggerClassName={cn(filterPanelSelectClassName, "h-10 min-w-0 max-w-none text-xs")}
                    items={territoryRegionSelectOptions.map((o) => ({ id: o.value, title: o.label }))}
                    selectedValues={draft.territory_2_list}
                    onChange={(next) => setDraft((p) => ({ ...p, territory_2_list: next, territory_3_list: [] }))}
                  />
                </div>
                <div className="min-w-0">
                  <SupervisorDashboardMultiFilter
                    placeholder="Город"
                    searchPlaceholder="Город"
                    triggerClassName={cn(filterPanelSelectClassName, "h-10 min-w-0 max-w-none text-xs")}
                    items={territoryCitySelectOptions.map((o) => ({ id: o.value, title: o.label }))}
                    selectedValues={draft.territory_3_list}
                    onChange={(next) => setDraft((p) => ({ ...p, territory_3_list: next }))}
                  />
                </div>
                <div className="min-w-0">
                  <SupervisorDashboardMultiFilter
                    placeholder="Способ оплаты"
                    searchPlaceholder="Оплата"
                    triggerClassName={cn(filterPanelSelectClassName, "h-10 min-w-0 max-w-none text-xs")}
                    items={paymentOptions.map((o) => ({ id: o.value, title: formatPaymentTypeLabel(o.label) }))}
                    selectedValues={draft.payment_types}
                    onChange={(next) => setDraft((p) => ({ ...p, payment_types: next }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <DateRangePopover
            open={dateRangeOpen}
            onOpenChange={setDateRangeOpen}
            anchorRef={dateRangeAnchorRef}
            dateFrom={draft.from}
            dateTo={draft.to}
            onApply={({ dateFrom, dateTo }) => {
              setDraft((p) => ({ ...p, from: dateFrom, to: dateTo }));
              setQuickRange("custom");
            }}
          />

          {dataQ.isLoading ? <p className="text-sm text-muted-foreground">Загрузка данных…</p> : null}
          {dataQ.isError ? <p className="text-sm text-destructive">Не удалось загрузить дашборд продаж.</p> : null}

          {dataQ.data ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <Card><CardHeader className="pb-2"><CardDescription>Общая сумма</CardDescription><CardTitle>{fmtMoney(dataQ.data.total_sales_summary.total_sales_sum)}</CardTitle></CardHeader></Card>
                <Card><CardHeader className="pb-2"><CardDescription>Заказы</CardDescription><CardTitle>{fmtCount(dataQ.data.total_sales_summary.orders_count)}</CardTitle></CardHeader></Card>
                <Card><CardHeader className="pb-2"><CardDescription>АКБ</CardDescription><CardTitle>{fmtCount(dataQ.data.akb_okb_block.akb)}</CardTitle></CardHeader></Card>
                <Card><CardHeader className="pb-2"><CardDescription>ОКБ</CardDescription><CardTitle>{fmtCount(dataQ.data.akb_okb_block.okb)}</CardTitle></CardHeader></Card>
                <Card><CardHeader className="pb-2"><CardDescription>Процент ОКБ</CardDescription><CardTitle>{dataQ.data.akb_okb_block.coverage_pct.toFixed(1)}%</CardTitle></CardHeader></Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">По способам оплаты</CardTitle>
                      <button type="button" className={exportButtonClass} onClick={() => void exportPaymentMethods()}>
                        Excel
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <table className="w-full min-w-[420px] border-collapse text-sm">
                      <thead className="app-table-thead"><tr><th className="px-2 py-2 text-left text-xs">Способ оплаты</th><th className="px-2 py-2 text-right text-xs">Сумма</th><th className="px-2 py-2 text-right text-xs">Доля</th></tr></thead>
                      <tbody>
                        {dataQ.data.payment_method_analytics.map((r) => (
                          <tr key={r.payment_type} className="border-b border-border/60">
                            <td className="px-2 py-1.5">{resolvePaymentMethodDisplay(r.payment_type)}</td>
                            <td className="px-2 py-1.5 text-right">{fmtMoney(r.sales_sum)}</td>
                            <td className="px-2 py-1.5 text-right">{r.share_pct.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">Заказы / отказы</CardTitle>
                      <button type="button" className={exportButtonClass} onClick={() => void exportOrdersRefusals()}>
                        Excel
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded border p-2"><div className="text-xs text-muted-foreground">Принято</div><div className="text-lg font-semibold">{fmtCount(dataQ.data.orders_refusals.accepted)}</div></div>
                      <div className="rounded border p-2"><div className="text-xs text-muted-foreground">Отклонено</div><div className="text-lg font-semibold">{fmtCount(dataQ.data.orders_refusals.rejected)}</div></div>
                      <div className="rounded border p-2"><div className="text-xs text-muted-foreground">В обработке</div><div className="text-lg font-semibold">{fmtCount(dataQ.data.orders_refusals.pending)}</div></div>
                      <div className="rounded border p-2"><div className="text-xs text-muted-foreground">Конверсия</div><div className="text-lg font-semibold">{dataQ.data.orders_refusals.conversion_pct.toFixed(1)}%</div></div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">По категориям продуктов</CardTitle>
                      <button type="button" className={exportButtonClass} onClick={() => void exportProductCategories()}>
                        Excel
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ReportsStatusPie slices={categoryPie} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">По группам товаров</CardTitle>
                      <button type="button" className={exportButtonClass} onClick={() => void exportProductGroups()}>
                        Excel
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ReportsStatusPie slices={groupPie} />
                  </CardContent>
                </Card>
              </div>

              <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                <Card className="flex min-h-0 min-w-0 flex-col">
                  <CardHeader className="shrink-0">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">По категориям (таблица эффективности)</CardTitle>
                      <button type="button" className={exportButtonClass} onClick={() => void exportCategoryPerformance()}>
                        Excel
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="min-h-0 flex-1 overflow-x-auto">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="shrink-0">Строк на странице</span>
                        <select
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm"
                          value={String(categoryPerfPageSize)}
                          onChange={(e) => setCategoryPerfPageSize(Number.parseInt(e.target.value, 10) || 10)}
                        >
                          {[10, 20, 30, 50].map((n) => (
                            <option key={n} value={String(n)}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </label>
                      {SALES_CAT_PERF_COL_DEFS.length > 5 ? (
                        <button
                          type="button"
                          className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-2 text-xs shadow-sm hover:bg-muted"
                          title="Столбцы"
                          onClick={() => setCatPerfColumnsOpen(true)}
                        >
                          <LayoutGrid className="mr-1.5 size-4" />
                          Столбцы
                        </button>
                      ) : null}
                    </div>
                    {(() => {
                      const visibleCols = catPerfTablePrefs.visibleColumnOrder;
                      const labelById = Object.fromEntries(SALES_CAT_PERF_COL_DEFS.map((c) => [c.id, c.label]));
                      const pageRows = dataQ.data.category_performance_table.slice(
                        (categoryPerfPage - 1) * categoryPerfPageSize,
                        categoryPerfPage * categoryPerfPageSize
                      );
                      const rightCols = new Set(["sales_sum", "sold_qty", "volume", "akb", "share_pct"]);
                      const renderHeader = (id: string) => (
                        <th key={id} className={cn("px-2 py-2 text-xs", rightCols.has(id) ? "text-right" : "text-left")}>
                          {labelById[id] ?? id}
                        </th>
                      );
                      const renderCell = (id: string, r: SalesDashboardData["category_performance_table"][number]) => {
                        if (id === "category") return <td key={id} className="px-2 py-1.5">{r.category}</td>;
                        if (id === "sales_sum") return <td key={id} className="px-2 py-1.5 text-right">{fmtMoney(r.sales_sum)}</td>;
                        if (id === "sold_qty") return <td key={id} className="px-2 py-1.5 text-right">{fmtCount(r.sold_qty)}</td>;
                        if (id === "volume") return <td key={id} className="px-2 py-1.5 text-right">{fmtCount(r.volume)}</td>;
                        if (id === "akb") return <td key={id} className="px-2 py-1.5 text-right">{fmtCount(r.akb)}</td>;
                        if (id === "share_pct") return <td key={id} className="px-2 py-1.5 text-right">{r.share_pct.toFixed(1)}%</td>;
                        return <td key={id} className="px-2 py-1.5">—</td>;
                      };

                      return (
                        <table className="w-full min-w-[900px] border-collapse text-sm">
                          {visibleCols.length === 0 ? (
                            <tbody>
                              <tr>
                                <td className="px-3 py-10 text-center text-muted-foreground">
                                  Нет видимых столбцов. Откройте «Столбцы» и включите колонки.
                                </td>
                              </tr>
                            </tbody>
                          ) : (
                            <>
                              <thead className="app-table-thead">
                                <tr>{visibleCols.map(renderHeader)}</tr>
                              </thead>
                              <tbody>
                                {pageRows.map((r) => (
                                  <tr key={r.category} className="border-b border-border/60">
                                    {visibleCols.map((id) => renderCell(id, r))}
                                  </tr>
                                ))}
                              </tbody>
                            </>
                          )}
                        </table>
                      );
                    })()}
                    <TablePager
                      total={dataQ.data.category_performance_table.length}
                      page={categoryPerfPage}
                      pageSize={categoryPerfPageSize}
                      onPageChange={setCategoryPerfPage}
                    />
                  </CardContent>
                </Card>
                <Card className="flex min-h-0 min-w-0 flex-col">
                  <CardHeader className="shrink-0">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">Динамика продаж</CardTitle>
                      <button type="button" className={exportButtonClass} onClick={() => void exportSalesDynamics()}>
                        Excel
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="min-h-0 flex-1">
                    <ReportsTrendCharts rows={trendRows} />
                  </CardContent>
                </Card>
              </div>

              <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                <Card className="flex min-h-0 min-w-0 flex-col">
                  <CardHeader className="shrink-0">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">Причина отказа</CardTitle>
                      <button type="button" className={exportButtonClass} onClick={() => void exportRefusalReasons()}>
                        Excel
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="min-h-0 flex-1 overflow-x-auto">
                    <table className="w-full min-w-[420px] border-collapse text-sm">
                      <thead className="app-table-thead">
                        <tr>
                          <th className="px-2 py-2 text-left text-xs">Причина</th>
                          <th className="px-2 py-2 text-right text-xs">Кол-во</th>
                          <th className="px-2 py-2 text-right text-xs">Доля</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dataQ.data.refusal_reason_analytics.map((r) => (
                          <tr key={r.reason} className="border-b border-border/60">
                            <td className="px-2 py-1.5">{formatReasonLabel(r.reason)}</td>
                            <td className="px-2 py-1.5 text-right">{fmtCount(r.count)}</td>
                            <td className="px-2 py-1.5 text-right">{r.share_pct.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
                <Card className="flex min-h-0 min-w-0 flex-col">
                  <CardHeader className="shrink-0">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">Аналитика по территориям</CardTitle>
                      <button type="button" className={exportButtonClass} onClick={() => void exportTerritoryAnalytics()}>
                        Excel
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="min-h-0 flex-1 overflow-x-auto">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="shrink-0">Строк на странице</span>
                        <select
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm"
                          value={String(territoryPageSize)}
                          onChange={(e) => setTerritoryPageSize(Number.parseInt(e.target.value, 10) || 10)}
                        >
                          {[10, 20, 30, 50].map((n) => (
                            <option key={n} value={String(n)}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <table className="w-full min-w-[520px] border-collapse text-sm">
                      <thead className="app-table-thead">
                        <tr>
                          <th className="px-2 py-2 text-left text-xs">Территория</th>
                          <th className="px-2 py-2 text-right text-xs">Сумма</th>
                          <th className="px-2 py-2 text-right text-xs">АКБ</th>
                          <th className="px-2 py-2 text-right text-xs">ОКБ</th>
                          <th className="px-2 py-2 text-right text-xs">Процент ОКБ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dataQ.data.territory_analytics
                          .slice((territoryPage - 1) * territoryPageSize, territoryPage * territoryPageSize)
                          .map((r) => (
                          <tr key={r.territory} className="border-b border-border/60">
                            <td className="px-2 py-1.5">{resolveTerritoryDisplay(r.territory)}</td>
                            <td className="px-2 py-1.5 text-right">{fmtMoney(r.sales_sum)}</td>
                            <td className="px-2 py-1.5 text-right">{fmtCount(r.akb)}</td>
                            <td className="px-2 py-1.5 text-right">{fmtCount(r.okb)}</td>
                            <td className="px-2 py-1.5 text-right">{r.coverage_pct.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <TablePager
                      total={dataQ.data.territory_analytics.length}
                      page={territoryPage}
                      pageSize={territoryPageSize}
                      onPageChange={setTerritoryPage}
                    />
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">Аналитика по агентам</CardTitle>
                    <button type="button" className={exportButtonClass} onClick={() => void exportAgentAnalytics()}>
                      Excel
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="shrink-0">Строк на странице</span>
                      <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm"
                        value={String(agentPageSize)}
                        onChange={(e) => setAgentPageSize(Number.parseInt(e.target.value, 10) || 10)}
                      >
                        {[10, 20, 30, 50].map((n) => (
                          <option key={n} value={String(n)}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                    {SALES_AGENT_COL_DEFS.length > 5 ? (
                      <button
                        type="button"
                        className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-2 text-xs shadow-sm hover:bg-muted"
                        title="Столбцы"
                        onClick={() => setAgentColumnsOpen(true)}
                      >
                        <LayoutGrid className="mr-1.5 size-4" />
                        Столбцы
                      </button>
                    ) : null}
                  </div>
                  {(() => {
                    const visibleCols = agentTablePrefs.visibleColumnOrder;
                    const labelById = Object.fromEntries(SALES_AGENT_COL_DEFS.map((c) => [c.id, c.label]));
                    const pageRows = dataQ.data.agent_analytics.slice(
                      (agentPage - 1) * agentPageSize,
                      agentPage * agentPageSize
                    );
                    const rightCols = new Set(["sales_sum", "akb", "okb", "coverage_pct"]);
                    const renderHeader = (id: string) => (
                      <th key={id} className={cn("px-2 py-2 text-xs", rightCols.has(id) ? "text-right" : "text-left")}>
                        {labelById[id] ?? id}
                      </th>
                    );
                    const renderCell = (id: string, r: SalesDashboardData["agent_analytics"][number]) => {
                      if (id === "agent_name") return <td key={id} className="px-2 py-1.5">{r.agent_name}</td>;
                      if (id === "agent_code") return <td key={id} className="px-2 py-1.5">{r.agent_code ?? "—"}</td>;
                      if (id === "sales_sum") return <td key={id} className="px-2 py-1.5 text-right">{fmtMoney(r.sales_sum)}</td>;
                      if (id === "akb") return <td key={id} className="px-2 py-1.5 text-right">{fmtCount(r.akb)}</td>;
                      if (id === "okb") return <td key={id} className="px-2 py-1.5 text-right">{fmtCount(r.okb)}</td>;
                      if (id === "coverage_pct") return <td key={id} className="px-2 py-1.5 text-right">{r.coverage_pct.toFixed(1)}%</td>;
                      return <td key={id} className="px-2 py-1.5">—</td>;
                    };

                    return (
                      <table className="w-full min-w-[980px] border-collapse text-sm">
                        {visibleCols.length === 0 ? (
                          <tbody>
                            <tr>
                              <td className="px-3 py-10 text-center text-muted-foreground">
                                Нет видимых столбцов. Откройте «Столбцы» и включите колонки.
                              </td>
                            </tr>
                          </tbody>
                        ) : (
                          <>
                            <thead className="app-table-thead">
                              <tr>{visibleCols.map(renderHeader)}</tr>
                            </thead>
                            <tbody>
                              {pageRows.map((r) => (
                                <tr key={r.agent_id} className="border-b border-border/60">
                                  {visibleCols.map((id) => renderCell(id, r))}
                                </tr>
                              ))}
                            </tbody>
                          </>
                        )}
                      </table>
                    );
                  })()}
                  <TablePager
                    total={dataQ.data.agent_analytics.length}
                    page={agentPage}
                    pageSize={agentPageSize}
                    onPageChange={setAgentPage}
                  />
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      )}
    </PageShell>
  );
}
