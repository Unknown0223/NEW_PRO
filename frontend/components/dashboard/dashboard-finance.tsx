"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { SupervisorDashboardMultiFilter } from "@/components/dashboard/supervisor-dashboard-multi-filter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { FilterSearchableSelect } from "@/components/ui/filter-searchable-select";
import { filterPanelSelectClassName } from "@/components/ui/filter-select";
import { TableColumnSettingsDialog, type ColumnDefItem } from "@/components/data-table/table-column-settings-dialog";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { createTerritoryLabelResolver } from "@/lib/territory-filter-labels";
import { STALE } from "@/lib/query-stale";
import {
  qkDashboardAgentsActive,
  qkDashboardClientReferences,
  qkDashboardSupervisorsActive
} from "@/lib/dashboard-shared-query-keys";
import { staffDashboardMultiItem } from "@/lib/order-picker-labels";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, LayoutGrid, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { TerritoryNode } from "@/lib/territory-tree";
import { useEffect, useMemo, useRef, useState } from "react";

type StaffPick = { id: number; fio: string; code?: string | null };

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

type FinanceFilterDraft = {
  date_type: "created_at" | "delivered_at";
  from: string;
  to: string;
  payment_types: string[];
  agent_ids: string[];
  supervisor_ids: string[];
  trade_directions: string[];
  client_categories: string[];
  territory_1_list: string[];
  territory_2_list: string[];
  territory_3_list: string[];
  statuses: string[];
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

type FinanceDashboardData = {
  summary: {
    total_sales_sum: string;
    total_payments_sum: string;
    total_returns_sum: string;
    net_sales_sum: string;
    outstanding_debt_sum: string;
    debt_ratio_pct: number;
  };
  category_analytics: Array<{
    category: string;
    sales_sum: string;
    sales_share_pct: number;
    order_count: number;
  }>;
  payment_type_analytics: Array<{
    payment_type: string;
    amount: string;
    share_pct: number;
  }>;
  territory_debts: Array<{
    territory: string;
    debt_sum: string;
    debtors_count: number;
  }>;
  general_balance: {
    total_balance: string;
    debt_clients_count: number;
    credit_clients_count: number;
  };
  debt_and_payment_by_period: Array<{
    period: string;
    debt_sum: string;
    payment_sum: string;
  }>;
  clients_debt_list: Array<{
    client_id: number;
    client_name: string;
    agent_name: string | null;
    supervisor_name: string | null;
    territory: string | null;
    ledger_balance: string;
    delivered_debt: string;
    effective_balance: string;
  }>;
};

const CLIENTS_TABLE_ID = "dashboard-finance/clients-debt-list";
const CLIENTS_COL_DEFS: ColumnDefItem[] = [
  { id: "client", label: "Клиент" },
  { id: "agent", label: "Агент" },
  { id: "supervisor", label: "Супервайзер" },
  { id: "ledger_balance", label: "Баланс" },
  { id: "delivered_debt", label: "Долг" },
  { id: "effective_balance", label: "Итог" }
];
const CLIENTS_DEFAULT_ORDER = CLIENTS_COL_DEFS.map((c) => c.id);

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

function defaultDraft(supervisorId = ""): FinanceFilterDraft {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  return {
    date_type: "created_at",
    from,
    to,
    payment_types: [],
    agent_ids: [],
    supervisor_ids: supervisorId ? [supervisorId] : [],
    trade_directions: [],
    client_categories: [],
    territory_1_list: [],
    territory_2_list: [],
    territory_3_list: [],
    statuses: []
  };
}

function fmtMoney(value: string | number): string {
  return formatNumberGrouped(value, { minFractionDigits: 2, maxFractionDigits: 2 });
}

function fmtCount(value: string | number): string {
  return formatNumberGrouped(value, { maxFractionDigits: 0 });
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

const pieLoading = () => (
  <div className="h-[240px] animate-pulse rounded-lg bg-muted/30" aria-hidden />
);

const ReportsStatusPie = dynamic(
  () => import("@/components/charts/analytics-charts").then((m) => ({ default: m.ReportsStatusPie })),
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

function fileToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-");
}

function normTrim(s: string): string {
  return String(s ?? "").trim();
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

export function DashboardFinance() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const role = useEffectiveRole();
  const hydrated = useAuthStoreHydrated();
  const selfSupervisorId = useMemo(
    () => (role === "supervisor" ? decodeAccessTokenSub(accessToken) : null),
    [role, accessToken]
  );
  const selfSupervisorIdStr = selfSupervisorId != null ? String(selfSupervisorId) : "";
  const [draft, setDraft] = useState<FinanceFilterDraft>(() => defaultDraft());
  const [applied, setApplied] = useState<FinanceFilterDraft>(() => defaultDraft());
  const [quickRange, setQuickRange] = useState<QuickRangeKey>("last30");
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const dateRangeAnchorRef = useRef<HTMLButtonElement>(null);

  const clientsTablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: CLIENTS_TABLE_ID,
    defaultColumnOrder: CLIENTS_DEFAULT_ORDER,
    defaultPageSize: 10,
    allowedPageSizes: [10, 20, 30, 50]
  });
  const [clientsColumnDialogOpen, setClientsColumnDialogOpen] = useState(false);
  const [clientsPage, setClientsPage] = useState(1);
  const [categoryPage, setCategoryPage] = useState(1);
  const [categoryPageSize, setCategoryPageSize] = useState(10);
  const [territoryPage, setTerritoryPage] = useState(1);
  const [territoryPageSize, setTerritoryPageSize] = useState(10);
  const [periodPage, setPeriodPage] = useState(1);
  const [periodPageSize, setPeriodPageSize] = useState(10);

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

  useEffect(() => {
    setClientsPage(1);
  }, [clientsTablePrefs.pageSize]);

  useEffect(() => {
    setCategoryPage(1);
  }, [categoryPageSize]);

  useEffect(() => {
    setTerritoryPage(1);
  }, [territoryPageSize]);

  useEffect(() => {
    setPeriodPage(1);
  }, [periodPageSize]);

  const agentsQ = useQuery({
    queryKey: qkDashboardAgentsActive(tenantSlug),
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: StaffPick[] }>(`/api/${tenantSlug}/agents?is_active=true`);
      return data.data ?? [];
    }
  });

  const supervisorsQ = useQuery({
    queryKey: qkDashboardSupervisorsActive(tenantSlug),
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: StaffPick[] }>(`/api/${tenantSlug}/supervisors?is_active=true`);
      return data.data ?? [];
    }
  });

  const profileQ = useQuery({
    queryKey: ["dashboard-finance", "profile", tenantSlug],
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

  const clientRefsQ = useQuery({
    queryKey: qkDashboardClientReferences(tenantSlug),
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{
        categories?: string[];
        category_options?: Array<string | { value?: string; label?: string }>;
        zones?: string[];
        regions?: string[];
        cities?: string[];
        region_options?: { value: string; label: string }[];
        city_options?: { value: string; label: string }[];
        city_territory_hints?: Record<string, { city_label?: string | null }>;
      }>(`/api/${tenantSlug}/clients/references`);
      return data;
    }
  });

  const productSalesFiltersQ = useQuery({
    queryKey: ["dashboard-finance", "product-sales-filter-options", tenantSlug],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: ProductSalesFilterOpts }>(
        `/api/${tenantSlug}/reports/product-sales/filter-options`
      );
      return data.data;
    }
  });

  const reportFilters = productSalesFiltersQ.data;

  const queryString = useMemo(() => {
    const q = new URLSearchParams();
    q.set("date_type", applied.date_type);
    q.set("from", applied.from);
    q.set("to", applied.to);
    const joinCsv = (values: string[]) => {
      const u = [...new Set(values.map((x) => String(x).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru"));
      return u.length ? u.join(",") : "";
    };
    const pay = joinCsv(applied.payment_types);
    if (pay) q.set("payment_type", pay);
    const agents = joinCsv(applied.agent_ids);
    if (agents) q.set("agent_ids", agents);
    const sups = joinCsv(applied.supervisor_ids);
    if (sups) q.set("supervisor_ids", sups);
    const td = joinCsv(applied.trade_directions);
    if (td) q.set("trade_direction", td);
    const cat = joinCsv(applied.client_categories);
    if (cat) q.set("client_category", cat);
    const t1 = joinCsv(applied.territory_1_list);
    if (t1) q.set("territory_1", t1);
    const t2 = joinCsv(applied.territory_2_list);
    if (t2) q.set("territory_2", t2);
    const t3 = joinCsv(applied.territory_3_list);
    if (t3) q.set("territory_3", t3);
    const st = joinCsv(applied.statuses);
    if (st) q.set("statuses", st);
    return q.toString();
  }, [applied]);

  const dataQ = useQuery({
    queryKey: ["dashboard-finance", tenantSlug, queryString],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.live,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
    queryFn: async () => {
      const { data } = await api.get<FinanceDashboardData>(`/api/${tenantSlug}/dashboard/finance?${queryString}`);
      return data;
    }
  });

  const categoryOptions = useMemo(() => {
    const fromOptions = (clientRefsQ.data?.category_options ?? [])
      .map((o) => (typeof o === "string" ? o : (o?.label ?? o?.value ?? "")))
      .map((x) => String(x).trim())
      .filter(Boolean);
    const fromList = (clientRefsQ.data?.categories ?? []).map((x) => String(x).trim()).filter(Boolean);
    return Array.from(new Set([...fromOptions, ...fromList])).sort((a, b) => a.localeCompare(b, "ru"));
  }, [clientRefsQ.data]);

  const paymentOptions = useMemo(() => {
    const fromReport = reportFilters?.payment_methods ?? [];
    if (fromReport.length > 0) {
      return fromReport.map((x) => ({ value: x.id, label: x.label }));
    }
    return (profileQ.data?.payment_method_entries ?? [])
      .filter((p) => p?.active !== false)
      .map((p) => ({ value: String(p.id ?? "").trim(), label: String(p.name ?? "").trim() }))
      .filter((p) => p.value && p.label);
  }, [reportFilters?.payment_methods, profileQ.data]);

  const dateTypeSelectOptions = useMemo(
    () => [
      { value: "created_at", label: "Дата заказа" },
      { value: "delivered_at", label: "Дата отгрузки" }
    ],
    []
  );

  const statusSelectOptions = useMemo(() => {
    const ids = ["new", "confirmed", "picking", "delivering", "delivered"] as const;
    return ids.map((s) => ({ value: s, label: formatStatusLabel(s) }));
  }, []);

  const tradeDirectionOptions = useMemo(() => {
    const fromReport = reportFilters?.trade_directions ?? [];
    if (fromReport.length > 0) {
      return fromReport.map((t) => ({
        value: t.name,
        label: t.name,
        searchText: [t.name, t.code].filter((x) => x != null && String(x).trim()).join(" ")
      }));
    }
    return (profileQ.data?.trade_directions ?? []).map((t) => ({
      value: t,
      label: t,
      searchText: t
    }));
  }, [reportFilters?.trade_directions, profileQ.data?.trade_directions]);

  const categorySelectOptions = useMemo(
    () => categoryOptions.map((c) => ({ value: c, label: c })),
    [categoryOptions]
  );

  const agentSelectOptions = useMemo(
    () => (agentsQ.data ?? []).map((a) => staffDashboardMultiItem(a)),
    [agentsQ.data]
  );

  const supervisorSelectOptions = useMemo(
    () => (supervisorsQ.data ?? []).map((a) => staffDashboardMultiItem(a)),
    [supervisorsQ.data]
  );

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
    let rows: string[];
    if (zones.length === 0) {
      const hasReport = (reportFilters?.territory_2?.length ?? 0) > 0;
      rows = hasReport ? (reportFilters?.territory_2 ?? []) : (clientRefsQ.data?.regions ?? []);
    } else {
      const acc = new Set<string>();
      for (const z of zones) {
        const chunk = reportFilters?.regions_by_zone?.[z] ?? reportFilters?.territory_2_by_1?.[z] ?? [];
        for (const r of chunk) acc.add(r);
      }
      rows = [...acc];
      if (rows.length === 0) rows = reportFilters?.territory_2 ?? clientRefsQ.data?.regions ?? [];
    }
    return uniqSorted(rows).map((r) => ({ value: r, label: resolveTerritoryDisplay(r) }));
  }, [draft.territory_1_list, reportFilters, clientRefsQ.data?.regions, resolveTerritoryDisplay]);

  const territoryCitySelectOptions = useMemo(() => {
    const zones = draft.territory_1_list.map(normTrim).filter(Boolean);
    const regions = draft.territory_2_list.map(normTrim).filter(Boolean);
    let rows: string[];
    if (regions.length === 0) {
      const hasReport = (reportFilters?.territory_3?.length ?? 0) > 0;
      rows = hasReport ? (reportFilters?.territory_3 ?? []) : (clientRefsQ.data?.cities ?? []);
    } else {
      const set = new Set<string>();
      for (const region of regions) {
        if (zones.length === 0) {
          for (const c of reportFilters?.territory_3_by_2?.[region] ?? []) set.add(c);
          continue;
        }
        for (const z of zones) {
          const key = `${z}|||${region}`;
          const list = reportFilters?.cities_by_zone_region?.[key] ?? [];
          if (list.length) for (const c of list) set.add(c);
        }
      }
      rows = [...set];
      if (rows.length === 0) rows = reportFilters?.territory_3 ?? clientRefsQ.data?.cities ?? [];
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
    () => `finance-${fileToken(applied.from)}-${fileToken(applied.to)}`,
    [applied.from, applied.to]
  );

  const exportAll = async () => {
    const d = dataQ.data;
    if (!d) return;
    await exportSheetsToXlsx(`${exportPrefix}-all`, [
      {
        name: "Сводка",
        rows: [
          ["Показатель", "Значение"],
          ["Сумма продаж", Number(d.summary.total_sales_sum)],
          ["Сумма оплат", Number(d.summary.total_payments_sum)],
          ["Сумма возвратов", Number(d.summary.total_returns_sum)],
          ["Чистая выручка", Number(d.summary.net_sales_sum)],
          ["Остаток долга", Number(d.summary.outstanding_debt_sum)],
          ["Доля долга, %", d.summary.debt_ratio_pct]
        ]
      },
      {
        name: "Типы оплат",
        rows: [
          ["Тип оплаты", "Сумма", "Доля, %"],
          ...d.payment_type_analytics.map((r) => [r.payment_type, Number(r.amount), r.share_pct])
        ]
      },
      {
        name: "Аналитика по категориям",
        rows: [
          ["Категория", "Сумма продаж", "Заказы", "Доля, %"],
          ...d.category_analytics.map((r) => [r.category, Number(r.sales_sum), r.order_count, r.sales_share_pct])
        ]
      },
      {
        name: "Долги по территориям",
        rows: [
          ["Территория", "Сумма долга", "Должники"],
          ...d.territory_debts.map((r) => [r.territory, Number(r.debt_sum), r.debtors_count])
        ]
      },
      {
        name: "Долги и оплаты",
        rows: [
          ["Период", "Сумма долга", "Сумма оплат"],
          ...d.debt_and_payment_by_period.map((r) => [r.period, Number(r.debt_sum), Number(r.payment_sum)])
        ]
      },
      {
        name: "Долги клиентов",
        rows: [
          [
            "ID клиента",
            "Клиент",
            "Агент",
            "Супервайзер",
            "Территория",
            "Баланс ledger",
            "Долг по доставке",
            "Эффективный баланс"
          ],
          ...d.clients_debt_list.map((r) => [
            r.client_id,
            r.client_name,
            r.agent_name ?? "",
            r.supervisor_name ?? "",
            r.territory ?? "",
            Number(r.ledger_balance),
            Number(r.delivered_debt),
            Number(r.effective_balance)
          ])
        ]
      }
    ]);
  };

  const exportCategoryAnalytics = async () => {
    const d = dataQ.data;
    if (!d) return;
    await exportSheetsToXlsx(`${exportPrefix}-category-analytics`, [
      {
        name: "Категории",
        rows: [
          ["Категория", "Сумма продаж", "Заказы", "Доля, %"],
          ...d.category_analytics.map((r) => [r.category, Number(r.sales_sum), r.order_count, r.sales_share_pct])
        ]
      }
    ]);
  };

  const exportTerritoryDebts = async () => {
    const d = dataQ.data;
    if (!d) return;
    await exportSheetsToXlsx(`${exportPrefix}-territory-debts`, [
      {
        name: "Территории",
        rows: [
          ["Территория", "Сумма долга", "Должники"],
          ...d.territory_debts.map((r) => [r.territory, Number(r.debt_sum), r.debtors_count])
        ]
      }
    ]);
  };

  const exportDebtAndPaymentsByPeriod = async () => {
    const d = dataQ.data;
    if (!d) return;
    await exportSheetsToXlsx(`${exportPrefix}-period-debt-payments`, [
      {
        name: "Периоды",
        rows: [
          ["Период", "Сумма долга", "Сумма оплат"],
          ...d.debt_and_payment_by_period.map((r) => [r.period, Number(r.debt_sum), Number(r.payment_sum)])
        ]
      }
    ]);
  };

  const exportClientsDebtList = async () => {
    const d = dataQ.data;
    if (!d) return;
    await exportSheetsToXlsx(`${exportPrefix}-clients-debt`, [
      {
        name: "Долги клиентов",
        rows: [
          [
            "ID клиента",
            "Клиент",
            "Агент",
            "Супервайзер",
            "Территория",
            "Баланс ledger",
            "Долг по доставке",
            "Эффективный баланс"
          ],
          ...d.clients_debt_list.map((r) => [
            r.client_id,
            r.client_name,
            r.agent_name ?? "",
            r.supervisor_name ?? "",
            r.territory ?? "",
            Number(r.ledger_balance),
            Number(r.delivered_debt),
            Number(r.effective_balance)
          ])
        ]
      }
    ]);
  };

  const categoryPie = useMemo(
    () =>
      (dataQ.data?.category_analytics ?? []).map((r, i) => ({
        status: `cat_${i}`,
        name: r.category,
        value: Number(r.sales_sum) || 0
      })),
    [dataQ.data]
  );
  const debtRatio = Math.max(0, Math.min(100, dataQ.data?.summary.debt_ratio_pct ?? 0));
  const debtPie = useMemo(
    () => [
      { status: "paid", name: "Оплачено", value: Math.max(0, 100 - debtRatio) },
      { status: "debt", name: "Долг", value: debtRatio }
    ],
    [debtRatio]
  );

  return (
    <PageShell>
      <PageHeader
        title="Финансы"
        description="Агрегированная финансовая аналитика: продажи, оплаты, задолженность и балансы."
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
                    checked={draft.date_type === "created_at"}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        date_type: e.target.checked ? "created_at" : "delivered_at"
                      }))
                    }
                  />
                  Дата заказа
                </label>
                <label className="inline-flex h-9 cursor-pointer select-none items-center gap-1.5 whitespace-nowrap rounded-md border border-input bg-background px-2.5 text-xs shadow-sm transition-colors hover:bg-muted/40 sm:px-3 sm:text-sm">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-primary sm:h-4 sm:w-4"
                    checked={draft.date_type === "delivered_at"}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        date_type: e.target.checked ? "delivered_at" : "created_at"
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
            open={clientsColumnDialogOpen}
            onOpenChange={setClientsColumnDialogOpen}
            title="Столбцы таблицы"
            description="Видимые столбцы и порядок сохраняются для вашей учётной записи."
            columns={[...CLIENTS_COL_DEFS]}
            columnOrder={clientsTablePrefs.columnOrder}
            hiddenColumnIds={clientsTablePrefs.hiddenColumnIds}
            saving={clientsTablePrefs.saving}
            onSave={(next) => clientsTablePrefs.saveColumnLayout(next)}
            onReset={() => clientsTablePrefs.resetColumnLayout()}
          />
          <div className="space-y-2 rounded border bg-card p-2">
            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
              <div className="min-w-0">
                <FilterSearchableSelect
                  emptyLabel="Тип даты"
                  className={cn(filterPanelSelectClassName, "h-8 min-h-8 w-full min-w-0 max-w-none px-2 text-xs font-normal shadow-sm")}
                  value={draft.date_type}
                  searchable={false}
                  onValueChange={(v) =>
                    setDraft((p) => ({
                      ...p,
                      date_type: (v as "created_at" | "delivered_at") || "created_at"
                    }))
                  }
                  options={dateTypeSelectOptions}
                />
              </div>
              <div className="min-w-0">
                <SupervisorDashboardMultiFilter
                  placeholder="Статус"
                  searchPlaceholder="Статус"
                  triggerClassName={cn(filterPanelSelectClassName, "h-8 min-h-8 w-full min-w-0 max-w-none px-2 text-xs font-normal shadow-sm")}
                  items={statusSelectOptions.map((o) => ({ id: o.value, title: o.label }))}
                  selectedValues={draft.statuses}
                  onChange={(next) => setDraft((p) => ({ ...p, statuses: next }))} 
                />
              </div>
              <div className="min-w-0">
                <SupervisorDashboardMultiFilter
                  placeholder="Способ оплаты"
                  searchPlaceholder="Оплата"
                  triggerClassName={cn(filterPanelSelectClassName, "h-8 min-h-8 w-full min-w-0 max-w-none px-2 text-xs font-normal shadow-sm")}
                  items={paymentOptions.map((p) => ({ id: p.value, title: formatPaymentTypeLabel(p.label) }))}
                  selectedValues={draft.payment_types}
                  onChange={(next) => setDraft((p) => ({ ...p, payment_types: next }))} 
                />
              </div>
              <div className="min-w-0">
                <SupervisorDashboardMultiFilter
                  placeholder="Агент"
                  searchPlaceholder="Агент"
                  triggerClassName={cn(filterPanelSelectClassName, "h-8 min-h-8 w-full min-w-0 max-w-none px-2 text-xs font-normal shadow-sm")}
                  items={agentSelectOptions}
                  selectedValues={draft.agent_ids}
                  onChange={(next) => setDraft((p) => ({ ...p, agent_ids: next }))} 
                />
              </div>
              <div className="min-w-0">
                <SupervisorDashboardMultiFilter
                  placeholder={selfSupervisorIdStr ? "Только вы" : "Супервайзер"}
                  searchPlaceholder="Супервайзер"
                  triggerClassName={cn(filterPanelSelectClassName, "h-8 min-h-8 w-full min-w-0 max-w-none px-2 text-xs font-normal shadow-sm")}
                  disabled={Boolean(selfSupervisorIdStr)}
                  items={supervisorSelectOptions}
                  selectedValues={draft.supervisor_ids}
                  onChange={(next) => setDraft((p) => ({ ...p, supervisor_ids: next }))} 
                />
              </div>
              <div className="min-w-0">
                <SupervisorDashboardMultiFilter
                  placeholder="Направление торговли"
                  searchPlaceholder="Направление"
                  triggerClassName={cn(filterPanelSelectClassName, "h-8 min-h-8 w-full min-w-0 max-w-none px-2 text-xs font-normal shadow-sm")}
                  items={tradeDirectionOptions.map((t) => ({
                    id: t.value,
                    title: t.label,
                    searchText: t.searchText
                  }))}
                  selectedValues={draft.trade_directions}
                  onChange={(next) => setDraft((p) => ({ ...p, trade_directions: next }))} 
                />
              </div>
              <div className="min-w-0">
                <SupervisorDashboardMultiFilter
                  placeholder="Категория клиента"
                  searchPlaceholder="Категория"
                  triggerClassName={cn(filterPanelSelectClassName, "h-8 min-h-8 w-full min-w-0 max-w-none px-2 text-xs font-normal shadow-sm")}
                  items={categorySelectOptions.map((c) => ({ id: c.value, title: c.label }))}
                  selectedValues={draft.client_categories}
                  onChange={(next) => setDraft((p) => ({ ...p, client_categories: next }))} 
                />
              </div>
              <div className="min-w-0">
                <SupervisorDashboardMultiFilter
                  placeholder="Зона"
                  searchPlaceholder="Зона"
                  triggerClassName={cn(filterPanelSelectClassName, "h-8 min-h-8 w-full min-w-0 max-w-none px-2 text-xs font-normal shadow-sm")}
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
                  triggerClassName={cn(filterPanelSelectClassName, "h-8 min-h-8 w-full min-w-0 max-w-none px-2 text-xs font-normal shadow-sm")}
                  items={territoryRegionSelectOptions.map((o) => ({ id: o.value, title: o.label }))}
                  selectedValues={draft.territory_2_list}
                  onChange={(next) => setDraft((p) => ({ ...p, territory_2_list: next, territory_3_list: [] }))} 
                />
              </div>
              <div className="min-w-0">
                <SupervisorDashboardMultiFilter
                  placeholder="Город"
                  searchPlaceholder="Город"
                  triggerClassName={cn(filterPanelSelectClassName, "h-8 min-h-8 w-full min-w-0 max-w-none px-2 text-xs font-normal shadow-sm")}
                  items={territoryCitySelectOptions.map((o) => ({ id: o.value, title: o.label }))}
                  selectedValues={draft.territory_3_list}
                  onChange={(next) => setDraft((p) => ({ ...p, territory_3_list: next }))} 
                />
              </div>
            </div>
          </div>

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
          {dataQ.isError ? <p className="text-sm text-destructive">Не удалось загрузить финансовый дашборд.</p> : null}

          {dataQ.data ? (
            <>
              <div className="grid gap-4 xl:grid-cols-12">
                {/* LEFT COLUMN */}
                <div className="space-y-4 xl:col-span-8">
                  {/* KPI: Продажи */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Продажи</CardTitle>
                      <CardDescription>Сводка по продажам и способам оплаты за выбранный период</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="rounded-md border p-3">
                        <div className="text-[11px] text-muted-foreground">Итого</div>
                        <div className="text-base font-semibold tabular-nums">{fmtMoney(dataQ.data.summary.total_sales_sum)}</div>
                      </div>
                      {(dataQ.data.payment_type_analytics.length > 0
                        ? dataQ.data.payment_type_analytics.slice(0, 5)
                        : [{ payment_type: "—", amount: "0", share_pct: 0 }]
                      ).map((r) => (
                        <div key={`kpi-pay-${r.payment_type}`} className="rounded-md border p-3">
                          <div className="text-[11px] text-muted-foreground">{formatPaymentTypeLabel(r.payment_type)}</div>
                          <div className="text-base font-semibold tabular-nums">{fmtMoney(r.amount)}</div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Charts row */}
                  <div className="grid min-w-0 gap-4 md:grid-cols-2">
                    <Card className="min-w-0">
                      <CardHeader>
                        <CardTitle className="text-base">По категориям</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ReportsStatusPie slices={categoryPie} />
                      </CardContent>
                    </Card>
                    <Card className="min-w-0">
                      <CardHeader>
                        <CardTitle className="text-base">По долгу</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ReportsStatusPie slices={debtPie} />
                      </CardContent>
                    </Card>
                  </div>

                  {/* Tables: categories */}
                  <Card className="flex min-h-0 min-w-0 flex-col">
                    <CardHeader className="shrink-0">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">По категориям</CardTitle>
                        <button type="button" className={exportButtonClass} onClick={() => void exportCategoryAnalytics()}>
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
                            value={String(categoryPageSize)}
                            onChange={(e) => setCategoryPageSize(Number.parseInt(e.target.value, 10) || 10)}
                          >
                            {[10, 20, 30, 50].map((n) => (
                              <option key={n} value={String(n)}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <table className="w-full min-w-[560px] border-collapse text-sm">
                        <thead className="app-table-thead">
                          <tr>
                            <th className="px-2 py-2 text-left text-xs">Категория</th>
                            <th className="px-2 py-2 text-right text-xs">Общая сумма</th>
                            <th className="px-2 py-2 text-right text-xs">Заказы</th>
                            <th className="px-2 py-2 text-right text-xs">Доля</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dataQ.data.category_analytics
                            .slice((categoryPage - 1) * categoryPageSize, categoryPage * categoryPageSize)
                            .map((r) => (
                            <tr key={r.category} className="border-b border-border/60">
                              <td className="px-2 py-1.5">{r.category}</td>
                              <td className="px-2 py-1.5 text-right">{fmtMoney(r.sales_sum)}</td>
                              <td className="px-2 py-1.5 text-right">{fmtCount(r.order_count)}</td>
                              <td className="px-2 py-1.5 text-right">{r.sales_share_pct.toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <TablePager
                        total={dataQ.data.category_analytics.length}
                        page={categoryPage}
                        pageSize={categoryPageSize}
                        onPageChange={setCategoryPage}
                      />
                    </CardContent>
                  </Card>

                  {/* Tables: territory debts */}
                  <Card className="flex min-h-0 min-w-0 flex-col">
                    <CardHeader className="shrink-0">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">Долги по территориям</CardTitle>
                        <button type="button" className={exportButtonClass} onClick={() => void exportTerritoryDebts()}>
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
                      <table className="w-full min-w-[560px] border-collapse text-sm">
                        <thead className="app-table-thead">
                          <tr>
                            <th className="px-2 py-2 text-left text-xs">Территория</th>
                            <th className="px-2 py-2 text-right text-xs">Долг</th>
                            <th className="px-2 py-2 text-right text-xs">Должники</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dataQ.data.territory_debts
                            .slice((territoryPage - 1) * territoryPageSize, territoryPage * territoryPageSize)
                            .map((r) => (
                            <tr key={r.territory} className="border-b border-border/60">
                              <td className="px-2 py-1.5">{resolveTerritoryDisplay(r.territory)}</td>
                              <td className="px-2 py-1.5 text-right">{fmtMoney(r.debt_sum)}</td>
                              <td className="px-2 py-1.5 text-right">{fmtCount(r.debtors_count)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <TablePager
                        total={dataQ.data.territory_debts.length}
                        page={territoryPage}
                        pageSize={territoryPageSize}
                        onPageChange={setTerritoryPage}
                      />
                    </CardContent>
                  </Card>
                </div>

                {/* RIGHT COLUMN */}
                <div className="space-y-4 xl:col-span-4">
                  <Card className="flex min-h-0 min-w-0 flex-col">
                    <CardHeader className="shrink-0">
                      <CardTitle className="text-base">Общий баланс (с учетом предоплат)</CardTitle>
                    </CardHeader>
                    <CardContent className="min-h-0 flex-1 space-y-3">
                      <div className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">UZS</div>
                        <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                          {fmtMoney(dataQ.data.general_balance.total_balance)}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {(dataQ.data.payment_type_analytics.length > 0
                          ? dataQ.data.payment_type_analytics.slice(0, 4)
                          : [{ payment_type: "—", amount: "0", share_pct: 0 }]
                        ).map((r) => (
                          <div key={`bal-pay-${r.payment_type}`} className="rounded-md border p-2">
                            <div className="text-[11px] text-muted-foreground">{formatPaymentTypeLabel(r.payment_type)}</div>
                            <div className="text-xs font-semibold tabular-nums sm:text-sm">{fmtMoney(r.amount)}</div>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-md border p-2">
                          <div className="text-[11px] text-muted-foreground">Клиенты с долгом</div>
                          <div className="text-sm font-semibold">{fmtCount(dataQ.data.general_balance.debt_clients_count)}</div>
                        </div>
                        <div className="rounded-md border p-2">
                          <div className="text-[11px] text-muted-foreground">Клиенты с предоплатой</div>
                          <div className="text-sm font-semibold">{fmtCount(dataQ.data.general_balance.credit_clients_count)}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="flex min-h-0 min-w-0 flex-col">
                    <CardHeader className="shrink-0">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">Долги и оплаты по периодам</CardTitle>
                        <button type="button" className={exportButtonClass} onClick={() => void exportDebtAndPaymentsByPeriod()}>
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
                            value={String(periodPageSize)}
                            onChange={(e) => setPeriodPageSize(Number.parseInt(e.target.value, 10) || 10)}
                          >
                            {[10, 20, 30, 50].map((n) => (
                              <option key={n} value={String(n)}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <table className="w-full min-w-[260px] border-collapse text-sm">
                        <thead className="app-table-thead">
                          <tr>
                            <th className="px-2 py-2 text-left text-xs">Период</th>
                            <th className="px-2 py-2 text-right text-xs">Долг</th>
                            <th className="px-2 py-2 text-right text-xs">Оплаты</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dataQ.data.debt_and_payment_by_period
                            .slice((periodPage - 1) * periodPageSize, periodPage * periodPageSize)
                            .map((r) => (
                            <tr key={r.period} className="border-b border-border/60">
                              <td className="px-2 py-1.5">{r.period}</td>
                              <td className="px-2 py-1.5 text-right">{fmtMoney(r.debt_sum)}</td>
                              <td className="px-2 py-1.5 text-right">{fmtMoney(r.payment_sum)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <TablePager
                        total={dataQ.data.debt_and_payment_by_period.length}
                        page={periodPage}
                        pageSize={periodPageSize}
                        onPageChange={setPeriodPage}
                      />
                    </CardContent>
                  </Card>

                  <Card className="flex min-h-0 min-w-0 flex-col">
                    <CardHeader className="shrink-0">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">Список клиентов</CardTitle>
                        <button type="button" className={exportButtonClass} onClick={() => void exportClientsDebtList()}>
                          Excel
                        </button>
                      </div>
                    </CardHeader>
                    <CardContent className="min-h-0 flex-1 overflow-x-auto">
                      {(() => {
                        const all = dataQ.data.clients_debt_list ?? [];
                        const total = all.length;
                        const pageSize = clientsTablePrefs.pageSize;
                        const totalPages = Math.max(1, Math.ceil(total / pageSize));
                        const safePage = Math.min(Math.max(1, clientsPage), totalPages);
                        const startIdx = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
                        const endIdx = Math.min(total, safePage * pageSize);
                        const pageRows = all.slice((safePage - 1) * pageSize, safePage * pageSize);

                        const visibleCols = clientsTablePrefs.visibleColumnOrder;
                        const renderHeaderCell = (id: string) => {
                          const label = CLIENTS_COL_DEFS.find((c) => c.id === id)?.label ?? id;
                          const right = id === "ledger_balance" || id === "delivered_debt" || id === "effective_balance";
                          return (
                            <th key={id} className={cn("px-2 py-2 text-xs", right ? "text-right" : "text-left")}>
                              {label}
                            </th>
                          );
                        };

                        const renderRowCell = (id: string, r: FinanceDashboardData["clients_debt_list"][number]) => {
                          if (id === "client") {
                            return (
                              <td key={id} className="px-2 py-1.5">
                                <Link href={`/clients/${r.client_id}`} className="text-primary hover:underline">
                                  {r.client_name}
                                </Link>
                              </td>
                            );
                          }
                          if (id === "agent") return <td key={id} className="px-2 py-1.5">{r.agent_name ?? "—"}</td>;
                          if (id === "supervisor") return <td key={id} className="px-2 py-1.5">{r.supervisor_name ?? "—"}</td>;
                          if (id === "ledger_balance") return <td key={id} className="px-2 py-1.5 text-right">{fmtMoney(r.ledger_balance)}</td>;
                          if (id === "delivered_debt") return <td key={id} className="px-2 py-1.5 text-right">{fmtMoney(r.delivered_debt)}</td>;
                          if (id === "effective_balance") return <td key={id} className="px-2 py-1.5 text-right font-semibold">{fmtMoney(r.effective_balance)}</td>;
                          return <td key={id} className="px-2 py-1.5">—</td>;
                        };

                        return (
                          <div className="min-h-0">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span className="shrink-0">Строк на странице</span>
                                  <select
                                    className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm"
                                    value={String(pageSize)}
                                    onChange={(e) => {
                                      clientsTablePrefs.setPageSize(Number.parseInt(e.target.value, 10) || 10);
                                      setClientsPage(1);
                                    }}
                                  >
                                    {[10, 20, 30, 50].map((n) => (
                                      <option key={n} value={String(n)}>
                                        {n}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <button
                                  type="button"
                                  className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-2 text-xs shadow-sm hover:bg-muted"
                                  title="Столбцы"
                                  onClick={() => setClientsColumnDialogOpen(true)}
                                >
                                  <LayoutGrid className="mr-1.5 size-4" />
                                  Столбцы
                                </button>
                              </div>
                            </div>

                            <table className="w-full min-w-[720px] border-collapse text-sm">
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
                                    <tr>{visibleCols.map(renderHeaderCell)}</tr>
                                  </thead>
                                  <tbody>
                                    {pageRows.map((r) => (
                                      <tr key={r.client_id} className="border-b border-border/60">
                                        {visibleCols.map((id) => renderRowCell(id, r))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </>
                              )}
                            </table>
                            <TablePager total={total} page={safePage} pageSize={pageSize} onPageChange={setClientsPage} />
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}
    </PageShell>
  );
}
