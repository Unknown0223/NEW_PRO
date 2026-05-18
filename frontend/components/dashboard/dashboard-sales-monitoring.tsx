"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import {
  MonitoringClientDayColumnTotalsChart,
  MonitoringDailyRevenueLine,
  MonitoringYearComparisonBars,
  SalesShareDonut,
  type ShareDonutSlice
} from "@/components/charts/analytics-charts";
import { TableColumnSettingsDialog, type ColumnDefItem } from "@/components/data-table/table-column-settings-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { filterPanelSelectClassName } from "@/components/ui/filter-select";
import { SupervisorDashboardMultiFilter } from "@/components/dashboard/supervisor-dashboard-multi-filter";
import { Label } from "@/components/ui/label";
import {
  MonthYearPickerPopover,
  parseYearMonthYm,
  toYearMonthString
} from "@/components/ui/month-year-picker-popover";
import { api } from "@/lib/api";
import type { TerritoryNode } from "@/lib/territory-tree";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { cn } from "@/lib/utils";
import { createTerritoryLabelResolver } from "@/lib/territory-filter-labels";
import { STALE } from "@/lib/query-stale";
import {
  qkDashboardAgentsActive,
  qkDashboardClientReferences,
  qkDashboardProductCategories,
  qkDashboardSupervisorsActive
} from "@/lib/dashboard-shared-query-keys";
import { staffDashboardMultiItem } from "@/lib/order-picker-labels";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { ArrowDownRight, ArrowUpRight, Calendar, Download, LayoutGrid, RotateCcw } from "lucide-react";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

type StaffPick = { id: number; fio: string; code?: string | null };

type NameId = { id: number; name: string };

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

function uniqSorted(values: string[]): string[] {
  const s = new Set<string>();
  for (const v of values) {
    const t = normTrim(v);
    if (t) s.add(t);
  }
  return Array.from(s).sort((a, b) => a.localeCompare(b, "ru"));
}

function collectCascadeFromTreeMulti(
  nodes: TerritoryNode[] | undefined,
  selectedZonesRaw: string[] | undefined,
  selectedRegionsRaw: string[] | undefined
): { zones: string[]; regions: string[]; cities: string[] } {
  const selectedZones = new Set((selectedZonesRaw ?? []).map(normTrim).filter(Boolean));
  const selectedRegions = new Set((selectedRegionsRaw ?? []).map(normTrim).filter(Boolean));

  const zones = new Set<string>();
  const regions = new Set<string>();
  const cities = new Set<string>();

  const zoneOk = (z: string) => selectedZones.size === 0 || selectedZones.has(z);
  const regionOk = (r: string) => selectedRegions.size === 0 || selectedRegions.has(r);

  const walk = (list: TerritoryNode[], depth: number, path: string[]) => {
    for (const n of list) {
      if (n.active === false) continue;
      const name = normTrim(n.name);
      if (!name) continue;
      const nextPath = [...path, name];
      if (depth === 0) zones.add(name);
      if (depth === 1) {
        const z = nextPath[0] ?? "";
        if (zoneOk(z)) regions.add(name);
      }
      if (depth === 2) {
        const z = nextPath[0] ?? "";
        const r = nextPath[1] ?? "";
        if (zoneOk(z) && regionOk(r)) cities.add(name);
      }
      if (n.children?.length) walk(n.children, depth + 1, nextPath);
    }
  };

  walk(nodes ?? [], 0, []);
  return { zones: uniqSorted([...zones]), regions: uniqSorted([...regions]), cities: uniqSorted([...cities]) };
}

type MonitoringDraft = {
  month: number;
  year: number;
  branch_codes: string[];
  territory_ids: string[];
  territory_1_list: string[];
  territory_2_list: string[];
  territory_3_list: string[];
  agent_ids: string[];
  supervisor_ids: string[];
  payment_methods: string[];
  order_statuses: string[];
  category_ids: string[];
};

type Snapshot = {
  plan_fact: {
    plan_sales: string;
    fact_sales: string;
    execution_pct: number | null;
    plan_note: string;
  };
  summary?: {
    orders_count: number;
    delivered_orders_count: number;
    order_success_pct: number | null;
    aov: string;
    active_territory_keys: number;
    growth_vs_prev_month_sales_pct: number | null;
    growth_vs_prev_year_sales_pct: number | null;
    forecast_month_end_sales: string | null;
    return_loss_sum: string;
  };
  period: { from: string; to: string };
  akb_okb: { akb: number; okb: number; coverage_pct: number };
  category_sales: Array<{
    category: string;
    sales_sum: string;
    share_pct: number;
    orders_count?: number;
    line_qty?: string;
  }>;
  product_group_sales?: Array<{ product_group: string; sales_sum: string; share_pct: number }>;
  branch_performance: Array<{
    branch: string;
    akb: number;
    okb?: number;
    coverage_pct?: number;
    plan_sales: string;
    fact_sales: string;
    execution_pct: number | null;
    rank?: number;
  }>;
  supervisor_performance: Array<{
    supervisor_id: number | null;
    supervisor_name: string;
    akb: number;
    orders_count?: number;
    plan_sales: string;
    fact_sales: string;
    execution_pct: number | null;
    plan_fact_gap?: string;
    rank?: number;
  }>;
  trade_directions: Array<{ direction: string; sales_sum: string; share_pct: number }>;
  daily_sales: Array<{ day: string; sales_sum: string; orders_count: number }>;
  sales_channels: Array<{
    channel: string;
    sales_sum: string;
    share_pct: number;
    orders_count?: number;
    active_clients?: number;
    avg_check?: string;
  }>;
  portfolio_akb: { akb: number; okb: number; coverage_pct: number };
  sku_matrix: Array<{
    sku: string;
    name: string;
    total_sum: string;
    total_qty?: string;
    sum_new: string;
    sum_confirmed: string;
    sum_shipped: string;
    sum_delivered: string;
    sum_cancelled: string;
    sum_returned: string;
    return_pct?: number | null;
    cancel_pct?: number | null;
  }>;
  client_daily_sales: Array<{ client_id: number; client_name: string; day: string; sales_sum: string }>;
  year_comparison?: {
    current: { year: number; month: number; akb: number; orders_count: number; sales_sum: string };
    previous: { year: number; month: number; akb: number; orders_count: number; sales_sum: string };
    growth_pct: { akb: number | null; orders_count: number | null; sales_sum: number | null };
  };
  meta?: { branch_options: string[]; payment_method_options?: string[] };
};

async function fetchSnapshot(tenantSlug: string, qs: string): Promise<Snapshot> {
  const { data } = await api.get(`/api/${tenantSlug}/dashboard/sales-monitoring?${qs}`);
  return data as Snapshot;
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

const ORDER_STATUS_OPTIONS = [
  { value: "", label: "Все (кроме отмен/возвратов)" },
  { value: "new", label: "Новый" },
  { value: "confirmed", label: "Подтверждён" },
  { value: "picking", label: "Комплектация" },
  { value: "delivering", label: "Доставка" },
  { value: "delivered", label: "Доставлен" },
  { value: "cancelled", label: "Отменён" },
  { value: "returned", label: "Возврат" }
];

function toDonutSlices(
  rows: Array<{
    name: string;
    value: number;
    share_pct?: number;
    orders_count?: number;
    line_qty?: number;
  }>,
  topN: number,
  othersLabel: string
): ShareDonutSlice[] {
  if (rows.length <= topN) {
    return rows.map((r, i) => ({
      status: `row_${i}`,
      name: r.name,
      value: r.value,
      share_pct: r.share_pct,
      orders_count: r.orders_count,
      line_qty: r.line_qty
    }));
  }
  const head = rows.slice(0, topN);
  const tail = rows.slice(topN);
  const otherVal = tail.reduce((s, r) => s + r.value, 0);
  const total = rows.reduce((s, r) => s + r.value, 0);
  const otherShare = total > 0 ? (otherVal / total) * 100 : 0;
  return [
    ...head.map((r, i) => ({
      status: `row_${i}`,
      name: r.name,
      value: r.value,
      share_pct: r.share_pct,
      orders_count: r.orders_count,
      line_qty: r.line_qty
    })),
    {
      status: "other",
      name: othersLabel,
      value: otherVal,
      share_pct: Math.round(otherShare * 10) / 10
    }
  ];
}

function fmtMoney(v: string | number): string {
  return formatNumberGrouped(v, { minFractionDigits: 2, maxFractionDigits: 2 });
}

function fmtCount(v: string | number): string {
  return formatNumberGrouped(v, { maxFractionDigits: 0 });
}

function fmtQty(v: string | number | undefined): string {
  if (v == null || v === "") return "—";
  return formatNumberGrouped(v, { minFractionDigits: 0, maxFractionDigits: 3 });
}

function pct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v.toFixed(1)}%`;
}

function num(v: string | number): number {
  const n = typeof v === "string" ? Number.parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

/** KPI / выполнение: зелёный ≥100, серый ≥80, оранжевый ≥50, красный <50 */
function executionClass(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return "text-muted-foreground";
  if (pct >= 100) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 80) return "text-slate-600 dark:text-slate-300";
  if (pct >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function coverageClass(pct: number): string {
  if (pct >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function growthClass(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return "text-muted-foreground";
  if (p >= 15) return "text-emerald-600 dark:text-emerald-400";
  if (p >= 0) return "text-slate-600 dark:text-slate-300";
  return "text-red-600 dark:text-red-400";
}

/** Глобальный максимум + пик строки — слабые клиенты остаются читаемыми, «всплески по дням» заметнее */
function matrixCellHeatStyle(value: number, rowMax: number, globalMax: number): CSSProperties {
  if (value <= 0) return {};
  const denom = Math.max(globalMax, rowMax, 1e-9);
  const r = Math.min(1, value / denom);
  return { backgroundColor: `hsl(152 55% 36% / ${0.07 + r * 0.34})` };
}

function matrixDayHeaderParts(day: string): { ddmm: string; weekday: string } {
  if (day.length >= 10) {
    const y = day.slice(0, 4);
    const m = day.slice(5, 7);
    const d = day.slice(8, 10);
    const dt = new Date(`${y}-${m}-${d}T12:00:00`);
    const weekday =
      Number.isFinite(dt.getTime()) ? dt.toLocaleDateString("ru-RU", { weekday: "short" }) : "";
    return { ddmm: `${d}.${m}`, weekday };
  }
  return { ddmm: day, weekday: "" };
}

/** Высокие доли отмен/возвратов по сумме строки — визуальный маркер */
function skuNeedsAttention(r: Snapshot["sku_matrix"][number]): boolean {
  const ret = r.return_pct ?? 0;
  const can = r.cancel_pct ?? 0;
  return ret >= 5 || can >= 12;
}

const MON_BRANCH_TABLE_ID = "dashboard-sales-monitoring/branch-performance";
const MON_SUP_TABLE_ID = "dashboard-sales-monitoring/supervisor-performance";
const MON_SKU_TABLE_ID = "dashboard-sales-monitoring/sku-matrix";

const MON_BRANCH_COLS: ColumnDefItem[] = [
  { id: "rank", label: "#" },
  { id: "branch", label: "Филиал" },
  { id: "akb", label: "АКБ" },
  { id: "okb", label: "ОКБ" },
  { id: "coverage_pct", label: "Покрытие" },
  { id: "plan_sales", label: "План" },
  { id: "fact_sales", label: "Факт" },
  { id: "execution_pct", label: "Выполнение" }
];
const MON_BRANCH_DEFAULT_ORDER = MON_BRANCH_COLS.map((c) => c.id);

const MON_SUP_COLS: ColumnDefItem[] = [
  { id: "rank", label: "#" },
  { id: "supervisor_name", label: "Супервайзер" },
  { id: "akb", label: "АКБ" },
  { id: "orders_count", label: "Заказы" },
  { id: "plan_sales", label: "План" },
  { id: "fact_sales", label: "Факт" },
  { id: "plan_fact_gap", label: "Разрыв" },
  { id: "execution_pct", label: "%" }
];
const MON_SUP_DEFAULT_ORDER = MON_SUP_COLS.map((c) => c.id);

const MON_SKU_COLS: ColumnDefItem[] = [
  { id: "name", label: "Товар" },
  { id: "sku", label: "SKU" },
  { id: "total_qty", label: "Кол-во" },
  { id: "total_sum", label: "Всего" },
  { id: "return_pct", label: "Возв. %" },
  { id: "cancel_pct", label: "Отм. %" },
  { id: "sum_new", label: "Новый" },
  { id: "sum_cancelled", label: "Отменён" },
  { id: "sum_confirmed", label: "Подтв." },
  { id: "sum_shipped", label: "Отгр." },
  { id: "sum_delivered", label: "Достав." },
  { id: "sum_returned", label: "Возврат" }
];
const MON_SKU_DEFAULT_ORDER = MON_SKU_COLS.map((c) => c.id);

function formatMonthYearRu(month: number, year: number): string {
  const m = Math.min(12, Math.max(1, month));
  const y = Math.max(2000, Math.min(2100, year));
  const d = new Date(y, m - 1, 1);
  if (!Number.isFinite(d.getTime())) return `${m} · ${y}`;
  const s = d.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function addCalendarMonths(y: number, month1to12: number, delta: number): { year: number; month: number } {
  const d = new Date(y, month1to12 - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/** Месяц, в который попадает начало скользящего окна N дней (API — календарный месяц) */
function monthYearFromEndMinusDays(span: number): { year: number; month: number } {
  const end = new Date();
  end.setHours(12, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - (span - 1));
  return { year: start.getFullYear(), month: start.getMonth() + 1 };
}

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

function defaultDraft(supervisorId = ""): MonitoringDraft {
  const d = new Date();
  return {
    month: d.getMonth() + 1,
    year: d.getFullYear(),
    branch_codes: [],
    territory_ids: [],
    territory_1_list: [],
    territory_2_list: [],
    territory_3_list: [],
    agent_ids: [],
    supervisor_ids: supervisorId ? [supervisorId] : [],
    payment_methods: [],
    order_statuses: [],
    category_ids: []
  };
}

function RadialExecutionRing({ pct, className }: { pct: number | null; className?: string }) {
  const has = pct != null && Number.isFinite(pct);
  const p = has ? Math.min(100, Math.max(0, pct!)) : 0;
  const r = 52;
  const c = 2 * Math.PI * r;
  const dash = has ? (p / 100) * c : 0;
  const tone = !has
    ? "stroke-muted-foreground/40"
    : p >= 100
      ? "stroke-emerald-500"
      : p >= 80
        ? "stroke-slate-400"
        : p >= 50
          ? "stroke-amber-500"
          : "stroke-red-500";
  return (
    <div className={cn("relative flex flex-col items-center justify-center", className)}>
      <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" className="stroke-muted/40" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          className={tone}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
        <span className={cn("text-2xl font-semibold tabular-nums", executionClass(pct))}>{pct == null ? "—" : `${p.toFixed(0)}%`}</span>
        <span className="text-[10px] text-muted-foreground">факт / план</span>
      </div>
    </div>
  );
}

function buildClientDayMatrix(
  rows: Array<{ client_id: number; client_name: string; day: string; sales_sum: string }>
): { clients: Array<{ id: number; name: string; cells: Map<string, string> }>; days: string[] } {
  const byClient = new Map<number, { name: string; cells: Map<string, string> }>();
  const daySet = new Set<string>();
  for (const r of rows) {
    daySet.add(r.day);
    const cur = byClient.get(r.client_id) ?? { name: r.client_name, cells: new Map<string, string>() };
    cur.cells.set(r.day, r.sales_sum);
    byClient.set(r.client_id, cur);
  }
  const days = Array.from(daySet).sort();
  const clients = Array.from(byClient.entries())
    .map(([id, v]) => ({ id, name: v.name, cells: v.cells }))
    .sort((a, b) => {
      const sa = Array.from(a.cells.values()).reduce((s, x) => s + num(x), 0);
      const sb = Array.from(b.cells.values()).reduce((s, x) => s + num(x), 0);
      return sb - sa;
    });
  return { clients, days };
}

const filterField = "min-h-10 min-w-0 space-y-1";
const tableWrap = "relative overflow-auto rounded-md border border-border";
const theadSticky = "sticky top-0 z-20 border-b border-border bg-muted/95 backdrop-blur-sm shadow-sm";

const MATRIX_DAYS_PER_WEEK = 7;

const TABLE_PAGE_SIZES = [10, 25, 50, 100] as const;

function TablePager({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange
}: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const start = total === 0 ? 0 : safePage * pageSize + 1;
  const end = Math.min(total, (safePage + 1) * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-muted/10 px-2 py-2 text-[11px] text-muted-foreground">
      <span className="tabular-nums">
        {total === 0 ? "0 записей" : `${start}–${end} из ${total}`}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5">
          <span className="shrink-0 text-muted-foreground">На странице</span>
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number.parseInt(e.target.value, 10) || 10)}
          >
            {TABLE_PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs"
            disabled={safePage <= 0}
            onClick={() => onPageChange(safePage - 1)}
          >
            Назад
          </Button>
          <span className="min-w-[4.25rem] text-center tabular-nums text-foreground">
            {safePage + 1} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs"
            disabled={safePage >= totalPages - 1}
            onClick={() => onPageChange(safePage + 1)}
          >
            Вперёд
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DashboardSalesMonitoring() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const role = useEffectiveRole();
  const hydrated = useAuthStoreHydrated();
  const selfSupervisorId = useMemo(
    () => (role === "supervisor" ? decodeAccessTokenSub(accessToken) : null),
    [role, accessToken]
  );
  const selfSupervisorIdStr = selfSupervisorId != null ? String(selfSupervisorId) : "";

  const periodAnchorRef = useRef<HTMLButtonElement>(null);
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false);

  const [draft, setDraft] = useState<MonitoringDraft>(() => defaultDraft());
  const [applied, setApplied] = useState<MonitoringDraft>(() => defaultDraft());

  const branchTablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: MON_BRANCH_TABLE_ID,
    defaultColumnOrder: MON_BRANCH_DEFAULT_ORDER,
    defaultPageSize: 10,
    allowedPageSizes: [10, 20, 30, 50]
  });
  const [branchColumnsOpen, setBranchColumnsOpen] = useState(false);

  const supTablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: MON_SUP_TABLE_ID,
    defaultColumnOrder: MON_SUP_DEFAULT_ORDER,
    defaultPageSize: 10,
    allowedPageSizes: [10, 20, 30, 50]
  });
  const [supColumnsOpen, setSupColumnsOpen] = useState(false);

  const skuTablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: MON_SKU_TABLE_ID,
    defaultColumnOrder: MON_SKU_DEFAULT_ORDER,
    defaultPageSize: 10,
    allowedPageSizes: [10, 20, 30, 50]
  });
  const [skuColumnsOpen, setSkuColumnsOpen] = useState(false);

  useEffect(() => {
    if (!selfSupervisorIdStr) return;
    setDraft((p) =>
      p.supervisor_ids.length === 1 && p.supervisor_ids[0] === selfSupervisorIdStr
        ? p
        : { ...p, supervisor_ids: [selfSupervisorIdStr] }
    );
    setApplied((p) =>
      p.supervisor_ids.length === 1 && p.supervisor_ids[0] === selfSupervisorIdStr
        ? p
        : { ...p, supervisor_ids: [selfSupervisorIdStr] }
    );
  }, [selfSupervisorIdStr]);

  const supervisorsQ = useQuery({
    queryKey: qkDashboardSupervisorsActive(tenantSlug),
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: StaffPick[] }>(`/api/${tenantSlug}/supervisors?is_active=true`);
      return data.data ?? [];
    }
  });

  const agentsQ = useQuery({
    queryKey: qkDashboardAgentsActive(tenantSlug),
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: StaffPick[] }>(`/api/${tenantSlug}/agents?is_active=true`);
      return data.data ?? [];
    }
  });

  const territoriesQ = useQuery({
    queryKey: ["sales-monitoring", "territories", tenantSlug],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    retry: false,
    queryFn: async () => {
      try {
        const { data } = await api.get<{ data: Array<{ id: number; name: string; code?: string | null }> }>(
          `/api/${tenantSlug}/territories?limit=300&page=1`
        );
        return data.data ?? [];
      } catch {
        return [];
      }
    }
  });

  const profileQ = useQuery({
    queryKey: ["sales-monitoring", "profile", tenantSlug],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{ references?: { territory_nodes?: TerritoryNode[] } }>(
        `/api/${tenantSlug}/settings/profile`
      );
      return data.references ?? {};
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

  const categoriesQ = useQuery({
    queryKey: qkDashboardProductCategories(tenantSlug),
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: NameId[] }>(`/api/${tenantSlug}/product-categories`);
      return data.data ?? [];
    }
  });

  const queryString = useMemo(() => {
    const q = new URLSearchParams();
    q.set("month", String(applied.month));
    q.set("year", String(applied.year));
    const branches = joinCsv(applied.branch_codes);
    if (branches) q.set("branches", branches);
    const tid = joinCsv(applied.territory_ids);
    if (tid) q.set("territory_ids", tid);
    const t1 = joinCsv(applied.territory_1_list);
    if (t1) q.set("territory_1", t1);
    const t2 = joinCsv(applied.territory_2_list);
    if (t2) q.set("territory_2", t2);
    const t3 = joinCsv(applied.territory_3_list);
    if (t3) q.set("territory_3", t3);
    const agentIds = joinCsv(applied.agent_ids);
    if (agentIds) q.set("agent_ids", agentIds);
    const supIds = joinCsv(applied.supervisor_ids);
    if (supIds) q.set("supervisor_ids", supIds);
    const pay = joinCsv(applied.payment_methods);
    if (pay) q.set("payment_methods", pay);
    const st = joinCsv(applied.order_statuses);
    if (st) q.set("order_statuses", st);
    const cat = joinCsv(applied.category_ids);
    if (cat) q.set("category_ids", cat);
    return q.toString();
  }, [applied]);

  useEffect(() => {
    setBranchPage(0);
    setSupervisorPage(0);
    setSkuPage(0);
    setMatrixPage(0);
    setMatrixWeekIndex(0);
  }, [queryString]);

  const dataQ = useQuery({
    queryKey: ["sales-monitoring", tenantSlug, queryString],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: 60_000,
    queryFn: () => fetchSnapshot(tenantSlug!, queryString)
  });

  const territoryRefsBundle = useMemo(() => {
    const d = clientRefsQ.data;
    return {
      zones: d?.zones ?? [],
      regions: d?.regions ?? [],
      cities: d?.cities ?? []
    };
  }, [clientRefsQ.data]);

  const territoryCascade = useMemo(() => {
    const fromTree = collectCascadeFromTreeMulti(
      profileQ.data?.territory_nodes,
      draft.territory_1_list,
      draft.territory_2_list
    );
    return {
      zones: uniqSorted([...territoryRefsBundle.zones, ...fromTree.zones]),
      regions: uniqSorted([...territoryRefsBundle.regions, ...fromTree.regions]),
      cities: uniqSorted([...territoryRefsBundle.cities, ...fromTree.cities])
    };
  }, [
    profileQ.data?.territory_nodes,
    territoryRefsBundle.zones,
    territoryRefsBundle.regions,
    territoryRefsBundle.cities,
    draft.territory_1_list,
    draft.territory_2_list
  ]);

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

  const territoryZoneSelectOptions = useMemo(
    () => territoryCascade.zones.map((v) => ({ value: v, label: resolveTerritoryDisplay(v) })),
    [territoryCascade.zones, resolveTerritoryDisplay]
  );
  const territoryRegionSelectOptions = useMemo(
    () => territoryCascade.regions.map((v) => ({ value: v, label: resolveTerritoryDisplay(v) })),
    [territoryCascade.regions, resolveTerritoryDisplay]
  );
  const territoryCitySelectOptions = useMemo(
    () => territoryCascade.cities.map((v) => ({ value: v, label: resolveTerritoryDisplay(v) })),
    [territoryCascade.cities, resolveTerritoryDisplay]
  );

  const branchOptions = useMemo(() => {
    const raw = dataQ.data?.meta?.branch_options ?? [];
    return raw.map((b: string) => ({ value: b, label: b }));
  }, [dataQ.data?.meta?.branch_options]);

  const supervisorOptions = useMemo(
    () => (supervisorsQ.data ?? []).map((s) => staffDashboardMultiItem(s)),
    [supervisorsQ.data]
  );

  const agentOptions = useMemo(
    () => (agentsQ.data ?? []).map((a) => staffDashboardMultiItem(a)),
    [agentsQ.data]
  );

  const territoryOptions = useMemo(
    () =>
      (territoriesQ.data ?? []).map((t) => ({
        value: String(t.id),
        label: (t.name ?? "").trim() || `ID ${t.id}`,
        searchText: [String(t.id), t.code, t.name]
          .filter((x) => x != null && String(x).trim())
          .join(" ")
      })),
    [territoriesQ.data]
  );

  const categoryFilterOptions = useMemo(
    () => (categoriesQ.data ?? []).map((c) => ({ value: String(c.id), label: c.name })),
    [categoriesQ.data]
  );

  const paymentMethodFilterOptions = useMemo(() => {
    const fromMeta = dataQ.data?.meta?.payment_method_options ?? [];
    return fromMeta.map((p) => ({ value: p, label: p }));
  }, [dataQ.data?.meta?.payment_method_options]);

  const dailyRevenueRows = useMemo(
    () =>
      (dataQ.data?.daily_sales ?? []).map((r) => ({
        day: r.day,
        revenue: num(r.sales_sum)
      })),
    [dataQ.data?.daily_sales]
  );

  const categorySlices = useMemo(() => {
    const rows = (dataQ.data?.category_sales ?? [])
      .map((r) => ({
        name: r.category,
        value: num(r.sales_sum),
        share_pct: r.share_pct,
        orders_count: r.orders_count,
        line_qty: r.line_qty != null ? num(r.line_qty) : undefined
      }))
      .sort((a, b) => b.value - a.value);
    return toDonutSlices(rows, 8, "Прочие категории");
  }, [dataQ.data?.category_sales]);

  const groupSlices = useMemo(() => {
    const rows = (dataQ.data?.product_group_sales ?? [])
      .map((r) => ({
        name: r.product_group === "Без группы" ? "Без классификации" : r.product_group,
        value: num(r.sales_sum),
        share_pct: r.share_pct
      }))
      .sort((a, b) => b.value - a.value);
    if (rows.length > 0) return toDonutSlices(rows, 8, "Прочие группы");
    const catTotal = (dataQ.data?.category_sales ?? []).reduce((s, r) => s + num(r.sales_sum), 0);
    if (catTotal > 0) {
      return [
        {
          status: "ungrouped_fallback",
          name: "Без классификации",
          value: catTotal,
          share_pct: 100
        }
      ];
    }
    return [];
  }, [dataQ.data?.product_group_sales, dataQ.data?.category_sales]);

  const clientMatrix = useMemo(
    () => buildClientDayMatrix(dataQ.data?.client_daily_sales ?? []),
    [dataQ.data?.client_daily_sales]
  );

  const matrixStats = useMemo(() => {
    const colTotals = new Map<string, number>();
    const rowTotals = new Map<number, number>();
    const rowMax = new Map<number, number>();
    const activeDays = new Map<number, number>();
    let maxCell = 0;
    for (const c of clientMatrix.clients) {
      let rowSum = 0;
      let rMax = 0;
      let daysWithSale = 0;
      for (const day of clientMatrix.days) {
        const v = num(c.cells.get(day) ?? 0);
        rowSum += v;
        if (v > rMax) rMax = v;
        if (v > 0) daysWithSale += 1;
        colTotals.set(day, (colTotals.get(day) ?? 0) + v);
        if (v > maxCell) maxCell = v;
      }
      rowTotals.set(c.id, rowSum);
      rowMax.set(c.id, rMax);
      activeDays.set(c.id, daysWithSale);
    }
    return { colTotals, rowTotals, rowMax, activeDays, maxCell };
  }, [clientMatrix]);

  const [matrixClientSearch, setMatrixClientSearch] = useState("");
  const [matrixPage, setMatrixPage] = useState(0);
  const [matrixPageSize, setMatrixPageSize] = useState(10);
  const [matrixWeekIndex, setMatrixWeekIndex] = useState(0);
  const [branchPage, setBranchPage] = useState(0);
  const [branchPageSize, setBranchPageSize] = useState(10);
  const [supervisorPage, setSupervisorPage] = useState(0);
  const [supervisorPageSize, setSupervisorPageSize] = useState(10);
  const [skuPage, setSkuPage] = useState(0);
  const [skuPageSize, setSkuPageSize] = useState(10);

  const matrixFilteredClients = useMemo(() => {
    const q = matrixClientSearch.trim().toLowerCase();
    if (!q) return clientMatrix.clients;
    return clientMatrix.clients.filter((c) => c.name.toLowerCase().includes(q));
  }, [clientMatrix.clients, matrixClientSearch]);

  const matrixTotalRows = matrixFilteredClients.length;
  const matrixTotalPages = Math.max(1, Math.ceil(matrixTotalRows / matrixPageSize));
  const matrixPageSafe = Math.min(matrixPage, matrixTotalPages - 1);
  const matrixVisibleClients = useMemo(
    () => matrixFilteredClients.slice(matrixPageSafe * matrixPageSize, matrixPageSafe * matrixPageSize + matrixPageSize),
    [matrixFilteredClients, matrixPageSafe, matrixPageSize]
  );

  useEffect(() => {
    setMatrixPage(0);
  }, [matrixClientSearch, matrixPageSize]);

  const matrixGrandTotal = useMemo(
    () => Array.from(matrixStats.rowTotals.values()).reduce((s, v) => s + v, 0),
    [matrixStats.rowTotals]
  );

  const matrixWeekCount = Math.max(1, Math.ceil(clientMatrix.days.length / MATRIX_DAYS_PER_WEEK));
  const matrixWeekSafe = Math.min(matrixWeekIndex, matrixWeekCount - 1);
  const matrixWeekDaySlice = useMemo(() => {
    const days = clientMatrix.days;
    if (days.length === 0) return [];
    const start = matrixWeekSafe * MATRIX_DAYS_PER_WEEK;
    return days.slice(start, start + MATRIX_DAYS_PER_WEEK);
  }, [clientMatrix.days, matrixWeekSafe]);

  useEffect(() => {
    const mc = Math.max(1, Math.ceil(clientMatrix.days.length / MATRIX_DAYS_PER_WEEK));
    setMatrixWeekIndex((w) => Math.min(w, mc - 1));
  }, [clientMatrix.days.length]);

  const matrixWeekChartSeries = useMemo(
    () =>
      matrixWeekDaySlice.map((day) => ({
        dayKey: day,
        label: matrixDayHeaderParts(day).ddmm,
        total: matrixStats.colTotals.get(day) ?? 0
      })),
    [matrixWeekDaySlice, matrixStats.colTotals]
  );

  const matrixWeekColGrand = useMemo(
    () => matrixWeekDaySlice.reduce((s, day) => s + (matrixStats.colTotals.get(day) ?? 0), 0),
    [matrixWeekDaySlice, matrixStats.colTotals]
  );

  const matrixWeekGlobalMax = useMemo(() => {
    let m = 0;
    for (const c of matrixVisibleClients) {
      for (const day of matrixWeekDaySlice) {
        const v = num(c.cells.get(day) ?? 0);
        if (v > m) m = v;
      }
    }
    return m;
  }, [matrixVisibleClients, matrixWeekDaySlice]);

  const [cumulativeChart, setCumulativeChart] = useState(false);

  const yc = dataQ.data?.year_comparison;
  const yoyBarRows = useMemo(() => {
    if (!yc) return [];
    return [
      { name: "АКБ", previous: yc.previous.akb, current: yc.current.akb },
      { name: "Заказы", previous: yc.previous.orders_count, current: yc.current.orders_count },
      {
        name: "Сумма (млн)",
        previous: num(yc.previous.sales_sum) / 1_000_000,
        current: num(yc.current.sales_sum) / 1_000_000
      }
    ];
  }, [yc]);

  const compactSelect = `${filterPanelSelectClassName} h-10 min-w-0 w-full text-xs`;
  const filterLbl = "text-xs font-medium text-muted-foreground";

  const apply = () => {
    setApplied({
      ...draft,
      supervisor_ids: selfSupervisorIdStr ? [selfSupervisorIdStr] : draft.supervisor_ids
    });
  };

  const reset = () => {
    const f = defaultDraft(selfSupervisorIdStr);
    setDraft(f);
    setApplied(f);
  };

  const d = dataQ.data;

  useEffect(() => {
    if (!d) return;
    setBranchPage((p) => {
      const tp = Math.max(1, Math.ceil(d.branch_performance.length / branchPageSize));
      return Math.min(p, tp - 1);
    });
    setSupervisorPage((p) => {
      const tp = Math.max(1, Math.ceil(d.supervisor_performance.length / supervisorPageSize));
      return Math.min(p, tp - 1);
    });
    setSkuPage((p) => {
      const tp = Math.max(1, Math.ceil(d.sku_matrix.length / skuPageSize));
      return Math.min(p, tp - 1);
    });
  }, [d, branchPageSize, supervisorPageSize, skuPageSize, d?.branch_performance.length, d?.supervisor_performance.length, d?.sku_matrix.length]);

  useEffect(() => {
    setMatrixPage((p) => {
      const tp = Math.max(1, Math.ceil(matrixFilteredClients.length / matrixPageSize));
      return Math.min(p, tp - 1);
    });
  }, [matrixFilteredClients.length, matrixPageSize, clientMatrix.clients.length]);

  const branchLen = d?.branch_performance.length ?? 0;
  const branchTP = Math.max(1, Math.ceil(branchLen / branchPageSize));
  const branchPSafe = Math.min(branchPage, branchTP - 1);
  const branchSlice = useMemo(() => {
    if (!d) return [];
    return d.branch_performance.slice(branchPSafe * branchPageSize, branchPSafe * branchPageSize + branchPageSize);
  }, [d, branchPSafe, branchPageSize]);

  const supervisorLen = d?.supervisor_performance.length ?? 0;
  const supervisorTP = Math.max(1, Math.ceil(supervisorLen / supervisorPageSize));
  const supervisorPSafe = Math.min(supervisorPage, supervisorTP - 1);
  const supervisorSlice = useMemo(() => {
    if (!d) return [];
    return d.supervisor_performance.slice(
      supervisorPSafe * supervisorPageSize,
      supervisorPSafe * supervisorPageSize + supervisorPageSize
    );
  }, [d, supervisorPSafe, supervisorPageSize]);

  const skuLen = d?.sku_matrix.length ?? 0;
  const skuTP = Math.max(1, Math.ceil(skuLen / skuPageSize));
  const skuPSafe = Math.min(skuPage, skuTP - 1);
  const skuSlice = useMemo(() => {
    if (!d) return [];
    return d.sku_matrix.slice(skuPSafe * skuPageSize, skuPSafe * skuPageSize + skuPageSize);
  }, [d, skuPSafe, skuPageSize]);

  const matrixMinW = 200 + Math.max(matrixWeekDaySlice.length, 1) * 76 + 92;

  const exportMonitoring = async () => {
    const snap = dataQ.data;
    if (!snap || !tenantSlug) return;
    const px = `sales-monitoring-${tenantSlug}-${applied.year}-${String(applied.month).padStart(2, "0")}`;
    await exportSheetsToXlsx(px, [
      {
        name: "Summary",
        rows: [
          ["Показатель", "Значение"],
          ["Заказы", snap.summary?.orders_count ?? ""],
          ["Доставлено", snap.summary?.delivered_orders_count ?? ""],
          ["Успех %", snap.summary?.order_success_pct ?? ""],
          ["Средний чек", snap.summary?.aov ?? ""],
          ["Рост к пр. месяцу %", snap.summary?.growth_vs_prev_month_sales_pct ?? ""],
          ["Рост к пр. году %", snap.summary?.growth_vs_prev_year_sales_pct ?? ""],
          ["Прогноз на конец мес.", snap.summary?.forecast_month_end_sales ?? ""],
          ["Потери возвратов", snap.summary?.return_loss_sum ?? ""],
          ["Активных локаций", snap.summary?.active_territory_keys ?? ""]
        ]
      },
      {
        name: "Филиалы",
        rows: [
          ["Ранг", "Филиал", "АКБ", "ОКБ", "Покрытие %", "Факт"],
          ...snap.branch_performance.map((r) => [
            r.rank ?? "",
            r.branch,
            r.akb,
            r.okb ?? "",
            r.coverage_pct != null ? r.coverage_pct.toFixed(1) : "",
            num(r.fact_sales)
          ])
        ]
      },
      {
        name: "SKU",
        rows: [
          ["Товар", "SKU", "Сумма", "Кол-во", "Возврат %", "Отмена %"],
          ...snap.sku_matrix.map((r) => [
            r.name,
            r.sku,
            num(r.total_sum),
            r.total_qty ?? "",
            r.return_pct ?? "",
            r.cancel_pct ?? ""
          ])
        ]
      }
    ]);
  };

  return (
    <PageShell>
      <PageHeader
        title="Мониторинг продаж и планов"
        description="Корпоративный центр: KPI, филиалы, супервайзеры, SKU, клиентская активность."
      />

      {!hydrated ? (
        <p className="text-sm text-muted-foreground">Загрузка сессии…</p>
      ) : !tenantSlug ? (
        <p className="text-sm text-destructive">Сессия не найдена.</p>
      ) : (
        <div className="flex flex-col gap-6">
          <TableColumnSettingsDialog
            open={branchColumnsOpen}
            onOpenChange={setBranchColumnsOpen}
            title="Столбцы таблицы"
            description="Видимые столбцы и порядок сохраняются для вашей учётной записи."
            columns={[...MON_BRANCH_COLS]}
            columnOrder={branchTablePrefs.columnOrder}
            hiddenColumnIds={branchTablePrefs.hiddenColumnIds}
            saving={branchTablePrefs.saving}
            onSave={(next) => branchTablePrefs.saveColumnLayout(next)}
            onReset={() => branchTablePrefs.resetColumnLayout()}
          />
          <TableColumnSettingsDialog
            open={supColumnsOpen}
            onOpenChange={setSupColumnsOpen}
            title="Столбцы таблицы"
            description="Видимые столбцы и порядок сохраняются для вашей учётной записи."
            columns={[...MON_SUP_COLS]}
            columnOrder={supTablePrefs.columnOrder}
            hiddenColumnIds={supTablePrefs.hiddenColumnIds}
            saving={supTablePrefs.saving}
            onSave={(next) => supTablePrefs.saveColumnLayout(next)}
            onReset={() => supTablePrefs.resetColumnLayout()}
          />
          <TableColumnSettingsDialog
            open={skuColumnsOpen}
            onOpenChange={setSkuColumnsOpen}
            title="Столбцы таблицы"
            description="Видимые столбцы и порядок сохраняются для вашей учётной записи."
            columns={[...MON_SKU_COLS]}
            columnOrder={skuTablePrefs.columnOrder}
            hiddenColumnIds={skuTablePrefs.hiddenColumnIds}
            saving={skuTablePrefs.saving}
            onSave={(next) => skuTablePrefs.saveColumnLayout(next)}
            onReset={() => skuTablePrefs.resetColumnLayout()}
          />
          <Card className="border border-border/80 bg-card shadow-md">
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Фильтры и период</p>
                  <p className="text-xs text-muted-foreground">Выберите месяц и срез, затем «Применить»</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    ref={periodAnchorRef}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 min-w-[10.5rem] justify-center gap-2 tabular-nums"
                    aria-expanded={periodPickerOpen}
                    aria-haspopup="dialog"
                    onClick={() => setPeriodPickerOpen((o) => !o)}
                  >
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate text-xs font-medium">{formatMonthYearRu(draft.month, draft.year)}</span>
                  </Button>
                  <MonthYearPickerPopover
                    open={periodPickerOpen}
                    onOpenChange={setPeriodPickerOpen}
                    anchorRef={periodAnchorRef}
                    value={toYearMonthString(draft.year, draft.month - 1)}
                    onChange={(ym) => {
                      const parsed = parseYearMonthYm(ym);
                      if (parsed) setDraft((p) => ({ ...p, year: parsed.y, month: parsed.m + 1 }));
                    }}
                    extraPresets={
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-7 shrink-0 px-2 text-[10px]"
                          onClick={() => {
                            setDraft((p) => ({ ...p, ...addCalendarMonths(p.year, p.month, -1) }));
                            setPeriodPickerOpen(false);
                          }}
                        >
                          Пред. мес.
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-7 shrink-0 px-2 text-[10px]"
                          onClick={() => {
                            setDraft((p) => ({ ...p, year: p.year - 1 }));
                            setPeriodPickerOpen(false);
                          }}
                        >
                          −1 год
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-7 shrink-0 px-2 text-[10px]"
                          onClick={() => {
                            setDraft((p) => ({ ...p, ...monthYearFromEndMinusDays(7) }));
                            setPeriodPickerOpen(false);
                          }}
                        >
                          7 дн.
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-7 shrink-0 px-2 text-[10px]"
                          onClick={() => {
                            setDraft((p) => ({ ...p, ...monthYearFromEndMinusDays(30) }));
                            setPeriodPickerOpen(false);
                          }}
                        >
                          30 дн.
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-7 shrink-0 px-2 text-[10px]"
                          onClick={() => {
                            const y = new Date().getFullYear();
                            setDraft((p) => ({ ...p, month: 1, year: y }));
                            setPeriodPickerOpen(false);
                          }}
                        >
                          Янв. года
                        </Button>
                      </>
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0 gap-1.5"
                    disabled={!d}
                    onClick={() => void exportMonitoring()}
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    Excel
                  </Button>
                </div>
              </div>
            <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              <div className={filterField}>
                <SupervisorDashboardMultiFilter
                  placeholder="Филиал"
                  searchPlaceholder="Филиал"
                  triggerClassName={cn(compactSelect, "w-full")}
                  items={branchOptions.map((o) => ({ id: o.value, title: o.label }))}
                  selectedValues={draft.branch_codes}
                  onChange={(next) => setDraft((p) => ({ ...p, branch_codes: next }))}
                />
              </div>

              <div className={filterField}>
                <SupervisorDashboardMultiFilter
                  placeholder="Территория"
                  searchPlaceholder="Территория"
                  triggerClassName={cn(compactSelect, "w-full")}
                  items={territoryOptions.map((o) => ({
                    id: o.value,
                    title: o.label,
                    searchText: o.searchText
                  }))}
                  selectedValues={draft.territory_ids}
                  onChange={(next) =>
                    setDraft((p) => ({
                      ...p,
                      territory_ids: next,
                      territory_1_list: [],
                      territory_2_list: [],
                      territory_3_list: []
                    }))
                  }
                />
              </div>

              <div className={filterField}>
                <SupervisorDashboardMultiFilter
                  placeholder="Зона"
                  searchPlaceholder="Зона"
                  triggerClassName={cn(compactSelect, "w-full")}
                  items={territoryZoneSelectOptions.map((o) => ({ id: o.value, title: o.label }))}
                  selectedValues={draft.territory_1_list}
                  onChange={(next) =>
                    setDraft((p) => ({
                      ...p,
                      territory_1_list: next,
                      territory_2_list: [],
                      territory_3_list: [],
                      territory_ids: []
                    }))
                  }
                />
              </div>

              <div className={filterField}>
                <SupervisorDashboardMultiFilter
                  placeholder="Область"
                  searchPlaceholder="Область"
                  triggerClassName={cn(compactSelect, "w-full")}
                  items={territoryRegionSelectOptions.map((o) => ({ id: o.value, title: o.label }))}
                  selectedValues={draft.territory_2_list}
                  onChange={(next) =>
                    setDraft((p) => ({
                      ...p,
                      territory_2_list: next,
                      territory_3_list: [],
                      territory_ids: []
                    }))
                  }
                />
              </div>

              <div className={filterField}>
                <SupervisorDashboardMultiFilter
                  placeholder="Город"
                  searchPlaceholder="Город"
                  triggerClassName={cn(compactSelect, "w-full")}
                  items={territoryCitySelectOptions.map((o) => ({ id: o.value, title: o.label }))}
                  selectedValues={draft.territory_3_list}
                  onChange={(next) =>
                    setDraft((p) => ({
                      ...p,
                      territory_3_list: next,
                      territory_ids: []
                    }))
                  }
                />
              </div>

              <div className={filterField}>
                <SupervisorDashboardMultiFilter
                  placeholder="Агент"
                  searchPlaceholder="Агент"
                  triggerClassName={cn(compactSelect, "w-full")}
                  items={agentOptions}
                  selectedValues={draft.agent_ids}
                  onChange={(next) => setDraft((p) => ({ ...p, agent_ids: next }))}
                />
              </div>

              <div className={filterField}>
                <SupervisorDashboardMultiFilter
                  placeholder="Супервайзер"
                  searchPlaceholder="Супервайзер"
                  triggerClassName={cn(compactSelect, "w-full")}
                  items={supervisorOptions}
                  selectedValues={draft.supervisor_ids}
                  disabled={Boolean(selfSupervisorIdStr)}
                  onChange={(next) => setDraft((p) => ({ ...p, supervisor_ids: next }))}
                />
              </div>

              <div className={filterField}>
                <SupervisorDashboardMultiFilter
                  placeholder="Способ оплаты"
                  searchPlaceholder="Оплата"
                  triggerClassName={cn(compactSelect, "w-full")}
                  items={paymentMethodFilterOptions.map((o) => ({ id: o.value, title: o.label }))}
                  selectedValues={draft.payment_methods}
                  onChange={(next) => setDraft((p) => ({ ...p, payment_methods: next }))}
                />
              </div>

              <div className={filterField}>
                <SupervisorDashboardMultiFilter
                  placeholder="Статус заказа"
                  searchPlaceholder="Статус"
                  triggerClassName={cn(compactSelect, "w-full")}
                  items={ORDER_STATUS_OPTIONS.map((o) => ({ id: o.value, title: o.label }))}
                  selectedValues={draft.order_statuses}
                  onChange={(next) => setDraft((p) => ({ ...p, order_statuses: next }))}
                />
              </div>

              <div className={filterField}>
                <SupervisorDashboardMultiFilter
                  placeholder="Категория товара"
                  searchPlaceholder="Категория"
                  triggerClassName={cn(compactSelect, "w-full")}
                  items={categoryFilterOptions.map((o) => ({ id: o.value, title: o.label }))}
                  selectedValues={draft.category_ids}
                  onChange={(next) => setDraft((p) => ({ ...p, category_ids: next }))}
                />
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-border/50 pt-3">
              <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5" onClick={reset}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                Сброс
              </Button>
              <Button type="button" size="sm" className="h-9 px-5 text-xs font-semibold" onClick={apply}>
                Применить
              </Button>
            </div>
            </CardContent>
          </Card>

          {dataQ.isLoading || dataQ.isFetching ? (
            <div className="grid animate-pulse gap-3 md:grid-cols-3">
              <div className="h-28 rounded-lg bg-muted/40" />
              <div className="h-28 rounded-lg bg-muted/40" />
              <div className="h-28 rounded-lg bg-muted/40" />
            </div>
          ) : null}
          {dataQ.isError ? <p className="text-sm text-destructive">Не удалось загрузить мониторинг.</p> : null}

          {d ? (
            <>
              {/* KPI ROW */}
              <section aria-label="KPI план и факт" className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Card className="min-h-[140px] border-border/80 shadow-sm md:basis-1/3">
                  <CardHeader className="pb-2 pt-4">
                    <CardDescription>План</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
                      {fmtMoney(d.plan_fact.plan_sales)}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">Monthly target (источник плана)</p>
                  </CardHeader>
                </Card>
                <Card className="min-h-[140px] border-border/80 shadow-sm md:basis-1/3">
                  <CardHeader className="pb-2 pt-4">
                    <CardDescription>Факт</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums tracking-tight text-emerald-700 dark:text-emerald-400 sm:text-3xl">
                      {fmtMoney(d.plan_fact.fact_sales)}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Период {d.period.from} — {d.period.to}
                    </p>
                  </CardHeader>
                </Card>
                <Card className="min-h-[140px] border-border/80 shadow-sm md:basis-1/3">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
                    <div>
                      <CardDescription>Выполнение</CardDescription>
                      <p className="text-[11px] text-muted-foreground">факт / план × 100%</p>
                    </div>
                    <RadialExecutionRing pct={d.plan_fact.execution_pct} className="shrink-0 scale-90" />
                  </CardHeader>
                </Card>
              </section>
              {d.plan_fact.plan_note ? <p className="text-xs text-muted-foreground">{d.plan_fact.plan_note}</p> : null}

              {/* OKB / AKB / COVERAGE */}
              <section aria-label="ОКБ и АКБ" className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Card className="border-border/80 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription>ОКБ</CardDescription>
                    <CardTitle className="text-xl tabular-nums">{fmtCount(d.akb_okb.okb)}</CardTitle>
                    <p className="text-xs text-muted-foreground">клиентов в портфеле</p>
                  </CardHeader>
                </Card>
                <Card className="border-border/80 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription>АКБ</CardDescription>
                    <CardTitle className="text-xl tabular-nums">{fmtCount(d.akb_okb.akb)}</CardTitle>
                    <p className="text-xs text-muted-foreground">активные в периоде</p>
                  </CardHeader>
                </Card>
                <Card className="border-border/80 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription>Покрытие АКБ / ОКБ</CardDescription>
                    <CardTitle className={cn("text-xl tabular-nums", coverageClass(d.akb_okb.coverage_pct))}>
                      {d.akb_okb.coverage_pct.toFixed(1)}%
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">АКБ ÷ ОКБ × 100%</p>
                  </CardHeader>
                </Card>
              </section>

              {d.summary ? (
                <>
                  {(d.summary.growth_vs_prev_month_sales_pct != null && d.summary.growth_vs_prev_month_sales_pct < -5) ||
                  (d.summary.order_success_pct != null && d.summary.order_success_pct < 65) ||
                  num(d.summary.return_loss_sum) > num(d.plan_fact.fact_sales) * 0.08 ? (
                    <div
                      className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-50"
                      role="status"
                    >
                      <span className="font-medium">Внимание: </span>
                      {d.summary.growth_vs_prev_month_sales_pct != null && d.summary.growth_vs_prev_month_sales_pct < -5
                        ? `продажи к прошлому месяцу ${d.summary.growth_vs_prev_month_sales_pct.toFixed(1)}%. `
                        : null}
                      {d.summary.order_success_pct != null && d.summary.order_success_pct < 65
                        ? `доля доставленных заказов ${d.summary.order_success_pct.toFixed(1)}%. `
                        : null}
                      {num(d.summary.return_loss_sum) > num(d.plan_fact.fact_sales) * 0.08
                        ? `сумма возвратов ${fmtMoney(d.summary.return_loss_sum)}. `
                        : null}
                    </div>
                  ) : null}
                  <section aria-label="Расширенные KPI" className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-4">
                    <Card className="border-border/70 bg-muted/20 shadow-sm">
                      <CardHeader className="p-3 pb-1">
                        <CardDescription className="text-[11px]">К прошлому месяцу</CardDescription>
                        <CardTitle
                          className={cn(
                            "flex items-center gap-1 text-lg tabular-nums",
                            growthClass(d.summary.growth_vs_prev_month_sales_pct)
                          )}
                        >
                          {d.summary.growth_vs_prev_month_sales_pct != null ? (
                            <>
                              {d.summary.growth_vs_prev_month_sales_pct >= 0 ? (
                                <ArrowUpRight className="h-4 w-4" aria-hidden />
                              ) : (
                                <ArrowDownRight className="h-4 w-4" aria-hidden />
                              )}
                              {pct(d.summary.growth_vs_prev_month_sales_pct)}
                            </>
                          ) : (
                            "—"
                          )}
                        </CardTitle>
                      </CardHeader>
                    </Card>
                    <Card className="border-border/70 bg-muted/20 shadow-sm">
                      <CardHeader className="p-3 pb-1">
                        <CardDescription className="text-[11px]">К прошлому году (сумма)</CardDescription>
                        <CardTitle
                          className={cn(
                            "flex items-center gap-1 text-lg tabular-nums",
                            growthClass(d.summary.growth_vs_prev_year_sales_pct)
                          )}
                        >
                          {d.summary.growth_vs_prev_year_sales_pct != null ? (
                            <>
                              {d.summary.growth_vs_prev_year_sales_pct >= 0 ? (
                                <ArrowUpRight className="h-4 w-4" aria-hidden />
                              ) : (
                                <ArrowDownRight className="h-4 w-4" aria-hidden />
                              )}
                              {pct(d.summary.growth_vs_prev_year_sales_pct)}
                            </>
                          ) : (
                            "—"
                          )}
                        </CardTitle>
                      </CardHeader>
                    </Card>
                    <Card className="border-border/70 bg-muted/20 shadow-sm">
                      <CardHeader className="p-3 pb-1">
                        <CardDescription className="text-[11px]">Средний чек (AOV)</CardDescription>
                        <CardTitle className="text-lg tabular-nums">{fmtMoney(d.summary.aov)}</CardTitle>
                      </CardHeader>
                    </Card>
                    <Card className="border-border/70 bg-muted/20 shadow-sm">
                      <CardHeader className="p-3 pb-1">
                        <CardDescription className="text-[11px]">Успешность доставки</CardDescription>
                        <CardTitle className="text-lg tabular-nums">{pct(d.summary.order_success_pct)}</CardTitle>
                      </CardHeader>
                    </Card>
                    <Card className="border-border/70 bg-muted/20 shadow-sm">
                      <CardHeader className="p-3 pb-1">
                        <CardDescription className="text-[11px]">Прогноз на конец месяца</CardDescription>
                        <CardTitle className="text-lg tabular-nums">
                          {d.summary.forecast_month_end_sales ? fmtMoney(d.summary.forecast_month_end_sales) : "—"}
                        </CardTitle>
                      </CardHeader>
                    </Card>
                    <Card className="border-border/70 bg-muted/20 shadow-sm">
                      <CardHeader className="p-3 pb-1">
                        <CardDescription className="text-[11px]">Локаций (зона/обл/гор)</CardDescription>
                        <CardTitle className="text-lg tabular-nums">{fmtCount(d.summary.active_territory_keys)}</CardTitle>
                      </CardHeader>
                    </Card>
                    <Card className="border-border/70 bg-muted/20 shadow-sm">
                      <CardHeader className="p-3 pb-1">
                        <CardDescription className="text-[11px]">Заказов в периоде</CardDescription>
                        <CardTitle className="text-lg tabular-nums">{fmtCount(d.summary.orders_count)}</CardTitle>
                      </CardHeader>
                    </Card>
                    <Card className="border-border/70 bg-muted/20 shadow-sm">
                      <CardHeader className="p-3 pb-1">
                        <CardDescription className="text-[11px]">Потери возвратов</CardDescription>
                        <CardTitle className="text-lg tabular-nums text-red-700/90 dark:text-red-400/90">
                          {fmtMoney(d.summary.return_loss_sum)}
                        </CardTitle>
                      </CardHeader>
                    </Card>
                  </section>
                </>
              ) : null}

              {/* CHART ROW — категории и группы */}
              <section aria-label="Доли продаж" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className="border-border/80 shadow-sm">
                  <CardHeader className="pb-0">
                    <CardTitle className="text-base">Категории</CardTitle>
                    <CardDescription>Доля суммы по категории товара</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[350px] pt-2">
                    <SalesShareDonut slices={categorySlices} height={310} />
                  </CardContent>
                </Card>
                <Card className="border-border/80 shadow-sm">
                  <CardHeader className="pb-0">
                    <CardTitle className="text-base">Группы товаров</CardTitle>
                    <CardDescription>Без группы — «Без группы»; unknown устраняется маппингом в каталоге</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[350px] pt-2">
                    {groupSlices.length > 0 ? (
                      <SalesShareDonut slices={groupSlices} height={310} />
                    ) : (
                      <div className="flex h-[310px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/15 text-sm text-muted-foreground">
                        Нет данных по группам товаров
                      </div>
                    )}
                  </CardContent>
                </Card>
              </section>

              {/* BRANCH TABLE */}
              <section aria-label="Филиалы">
                <Card className="border-border/80 shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-base">Филиалы</CardTitle>
                        <CardDescription>Ранг по факту; ОКБ — портфель; покрытие = АКБ/ОКБ</CardDescription>
                      </div>
                      {MON_BRANCH_COLS.length > 5 ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5"
                          onClick={() => setBranchColumnsOpen(true)}
                        >
                          <LayoutGrid className="h-4 w-4" aria-hidden />
                          Столбцы
                        </Button>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 sm:p-2">
                    <div className={cn(tableWrap, "max-h-[400px]")}>
                      <table className="w-full table-fixed border-collapse text-sm">
                        <thead className={theadSticky}>
                          <tr>
                            {branchTablePrefs.visibleColumnOrder.map((id) => {
                              switch (id) {
                                case "rank":
                                  return (
                                    <th key={id} className="w-[6%] px-2 py-2.5 text-right text-xs font-medium">
                                      #
                                    </th>
                                  );
                                case "branch":
                                  return (
                                    <th key={id} className="w-[26%] px-3 py-2.5 text-left text-xs font-medium">
                                      Филиал
                                    </th>
                                  );
                                case "akb":
                                  return (
                                    <th key={id} className="w-[12%] px-3 py-2.5 text-right text-xs font-medium">
                                      АКБ
                                    </th>
                                  );
                                case "okb":
                                  return (
                                    <th key={id} className="w-[12%] px-3 py-2.5 text-right text-xs font-medium">
                                      ОКБ
                                    </th>
                                  );
                                case "coverage_pct":
                                  return (
                                    <th key={id} className="w-[12%] px-3 py-2.5 text-right text-xs font-medium">
                                      Покрытие
                                    </th>
                                  );
                                case "plan_sales":
                                  return (
                                    <th key={id} className="w-[14%] px-3 py-2.5 text-right text-xs font-medium">
                                      План
                                    </th>
                                  );
                                case "fact_sales":
                                  return (
                                    <th key={id} className="w-[14%] px-3 py-2.5 text-right text-xs font-medium">
                                      Факт
                                    </th>
                                  );
                                case "execution_pct":
                                  return (
                                    <th key={id} className="w-[14%] px-3 py-2.5 text-right text-xs font-medium">
                                      Выполнение
                                    </th>
                                  );
                                default:
                                  return null;
                              }
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {branchSlice.map((r) => (
                            <tr key={r.branch} className="border-b border-border/50 hover:bg-muted/30">
                              {branchTablePrefs.visibleColumnOrder.map((id) => {
                                switch (id) {
                                  case "rank":
                                    return (
                                      <td key={id} className="px-2 py-2 text-right text-xs text-muted-foreground tabular-nums">
                                        {r.rank ?? "—"}
                                      </td>
                                    );
                                  case "branch":
                                    return (
                                      <td key={id} className="truncate px-3 py-2 font-medium">
                                        {r.branch}
                                      </td>
                                    );
                                  case "akb":
                                    return (
                                      <td key={id} className="px-3 py-2 text-right tabular-nums">
                                        {fmtCount(r.akb)}
                                      </td>
                                    );
                                  case "okb":
                                    return (
                                      <td key={id} className="px-3 py-2 text-right tabular-nums">
                                        {fmtCount(r.okb ?? 0)}
                                      </td>
                                    );
                                  case "coverage_pct":
                                    return (
                                      <td
                                        key={id}
                                        className={cn(
                                          "px-3 py-2 text-right tabular-nums font-medium",
                                          r.coverage_pct != null ? coverageClass(r.coverage_pct) : ""
                                        )}
                                      >
                                        {r.coverage_pct != null ? `${r.coverage_pct.toFixed(1)}%` : "—"}
                                      </td>
                                    );
                                  case "plan_sales":
                                    return (
                                      <td key={id} className="px-3 py-2 text-right tabular-nums">
                                        {fmtMoney(r.plan_sales)}
                                      </td>
                                    );
                                  case "fact_sales":
                                    return (
                                      <td key={id} className="px-3 py-2 text-right tabular-nums">
                                        {fmtMoney(r.fact_sales)}
                                      </td>
                                    );
                                  case "execution_pct":
                                    return (
                                      <td
                                        key={id}
                                        className={cn("px-3 py-2 text-right tabular-nums font-medium", executionClass(r.execution_pct))}
                                      >
                                        {pct(r.execution_pct)}
                                      </td>
                                    );
                                  default:
                                    return null;
                                }
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <TablePager
                      total={branchLen}
                      page={branchPSafe}
                      pageSize={branchPageSize}
                      onPageChange={setBranchPage}
                      onPageSizeChange={(s) => {
                        setBranchPageSize(s);
                        setBranchPage(0);
                      }}
                    />
                  </CardContent>
                </Card>
              </section>

              {/* SUPERVISOR TABLE */}
              <section aria-label="Супервайзеры">
                <Card className="border-border/80 shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-base">Супервайзеры</CardTitle>
                        <CardDescription>Ранг по факту; заказы; разрыв план−факт (при плане 0 — минус факт)</CardDescription>
                      </div>
                      {MON_SUP_COLS.length > 5 ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5"
                          onClick={() => setSupColumnsOpen(true)}
                        >
                          <LayoutGrid className="h-4 w-4" aria-hidden />
                          Столбцы
                        </Button>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 sm:p-2">
                    <div className={cn(tableWrap, "max-h-[400px]")}>
                      <table className="w-full min-w-[680px] table-fixed border-collapse text-sm">
                        <thead className={theadSticky}>
                          <tr>
                            {supTablePrefs.visibleColumnOrder.map((id) => {
                              switch (id) {
                                case "rank":
                                  return (
                                    <th key={id} className="w-[6%] px-2 py-2.5 text-right text-xs font-medium">
                                      #
                                    </th>
                                  );
                                case "supervisor_name":
                                  return (
                                    <th key={id} className="w-[24%] px-3 py-2.5 text-left text-xs font-medium">
                                      Супервайзер
                                    </th>
                                  );
                                case "akb":
                                  return (
                                    <th key={id} className="w-[11%] px-3 py-2.5 text-right text-xs font-medium">
                                      АКБ
                                    </th>
                                  );
                                case "orders_count":
                                  return (
                                    <th key={id} className="w-[11%] px-3 py-2.5 text-right text-xs font-medium">
                                      Заказы
                                    </th>
                                  );
                                case "plan_sales":
                                  return (
                                    <th key={id} className="w-[13%] px-3 py-2.5 text-right text-xs font-medium">
                                      План
                                    </th>
                                  );
                                case "fact_sales":
                                  return (
                                    <th key={id} className="w-[13%] px-3 py-2.5 text-right text-xs font-medium">
                                      Факт
                                    </th>
                                  );
                                case "plan_fact_gap":
                                  return (
                                    <th key={id} className="w-[11%] px-3 py-2.5 text-right text-xs font-medium">
                                      Разрыв
                                    </th>
                                  );
                                case "execution_pct":
                                  return (
                                    <th key={id} className="w-[11%] px-3 py-2.5 text-right text-xs font-medium">
                                      %
                                    </th>
                                  );
                                default:
                                  return null;
                              }
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {supervisorSlice.map((r) => (
                            <tr key={String(r.supervisor_id ?? "none")} className="border-b border-border/50 hover:bg-muted/30">
                              {supTablePrefs.visibleColumnOrder.map((id) => {
                                switch (id) {
                                  case "rank":
                                    return (
                                      <td key={id} className="px-2 py-2 text-right text-xs text-muted-foreground tabular-nums">
                                        {r.rank ?? "—"}
                                      </td>
                                    );
                                  case "supervisor_name":
                                    return (
                                      <td key={id} className="truncate px-3 py-2 font-medium">
                                        {r.supervisor_name}
                                      </td>
                                    );
                                  case "akb":
                                    return (
                                      <td key={id} className="px-3 py-2 text-right tabular-nums">
                                        {fmtCount(r.akb)}
                                      </td>
                                    );
                                  case "orders_count":
                                    return (
                                      <td key={id} className="px-3 py-2 text-right tabular-nums">
                                        {fmtCount(r.orders_count ?? 0)}
                                      </td>
                                    );
                                  case "plan_sales":
                                    return (
                                      <td key={id} className="px-3 py-2 text-right tabular-nums">
                                        {fmtMoney(r.plan_sales)}
                                      </td>
                                    );
                                  case "fact_sales":
                                    return (
                                      <td key={id} className="px-3 py-2 text-right tabular-nums">
                                        {fmtMoney(r.fact_sales)}
                                      </td>
                                    );
                                  case "plan_fact_gap":
                                    return (
                                      <td key={id} className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                        {r.plan_fact_gap != null ? fmtMoney(r.plan_fact_gap) : "—"}
                                      </td>
                                    );
                                  case "execution_pct":
                                    return (
                                      <td
                                        key={id}
                                        className={cn("px-3 py-2 text-right tabular-nums font-medium", executionClass(r.execution_pct))}
                                      >
                                        {pct(r.execution_pct)}
                                      </td>
                                    );
                                  default:
                                    return null;
                                }
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <TablePager
                      total={supervisorLen}
                      page={supervisorPSafe}
                      pageSize={supervisorPageSize}
                      onPageChange={setSupervisorPage}
                      onPageSizeChange={(s) => {
                        setSupervisorPageSize(s);
                        setSupervisorPage(0);
                      }}
                    />
                  </CardContent>
                </Card>
              </section>

              {/* TRADE DIRECTION + DAILY LINE */}
              <section aria-label="Направления и динамика" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className="border-border/80 shadow-sm lg:max-w-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Направления торговли</CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <table className="w-full min-w-[280px] border-collapse text-sm">
                      <thead className="border-b border-border bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs">Направление</th>
                          <th className="px-3 py-2 text-right text-xs">Сумма</th>
                          <th className="px-3 py-2 text-right text-xs">Доля</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.trade_directions.map((r) => (
                          <tr key={r.direction} className="border-b border-border/50">
                            <td className="px-3 py-2">{r.direction}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.sales_sum)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{r.share_pct.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
                <Card className="border-border/80 shadow-sm">
                  <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base">Продажи по дням</CardTitle>
                      <CardDescription>
                        {cumulativeChart ? "Накопительная сумма по дням периода" : "Сумма заказов по календарным дням"}
                      </CardDescription>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant={!cumulativeChart ? "default" : "outline"}
                        size="sm"
                        className="h-8 px-2.5 text-xs"
                        onClick={() => setCumulativeChart(false)}
                      >
                        По дням
                      </Button>
                      <Button
                        type="button"
                        variant={cumulativeChart ? "default" : "outline"}
                        size="sm"
                        className="h-8 px-2.5 text-xs"
                        onClick={() => setCumulativeChart(true)}
                      >
                        Накопит.
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="min-h-[320px]">
                    <MonitoringDailyRevenueLine rows={dailyRevenueRows} cumulative={cumulativeChart} />
                  </CardContent>
                </Card>
              </section>

              {/* ANALYTICS: портфель направлений + каналы */}
              <section aria-label="Аналитика портфеля" className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <div className="xl:col-span-2">
                  <Card className="h-full border-border/80 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Портфель по направлениям</CardTitle>
                      <CardDescription>Топ направлений: сумма и доля (сетка 3 колонки)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {d.trade_directions.slice(0, 9).map((r) => (
                          <div
                            key={r.direction}
                            className="rounded-lg border border-border/80 bg-card p-3 shadow-sm transition-colors hover:bg-muted/20"
                          >
                            <div className="text-xs font-medium text-muted-foreground">{r.direction}</div>
                            <div className="mt-1 text-lg font-semibold tabular-nums">{fmtMoney(r.sales_sum)}</div>
                            <div className="text-xs text-muted-foreground">{r.share_pct.toFixed(1)}% портфеля</div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
                <Card className="border-border/80 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Каналы продаж</CardTitle>
                    <CardDescription>Заказы, средний чек, активные клиенты</CardDescription>
                  </CardHeader>
                  <CardContent className="max-h-[320px] overflow-auto">
                    <table className="w-full min-w-[420px] border-collapse text-sm">
                      <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
                        <tr>
                          <th className="px-2 py-2 text-left text-xs font-medium">Канал</th>
                          <th className="px-2 py-2 text-right text-xs font-medium">Сумма</th>
                          <th className="px-2 py-2 text-right text-xs font-medium">%</th>
                          <th className="px-2 py-2 text-right text-xs font-medium">Заказы</th>
                          <th className="px-2 py-2 text-right text-xs font-medium">Ср. чек</th>
                          <th className="px-2 py-2 text-right text-xs font-medium">АКБ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.sales_channels.map((r) => (
                          <tr key={r.channel} className="border-b border-border/50 hover:bg-muted/25">
                            <td className="px-2 py-1.5 font-medium">{r.channel}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{fmtMoney(r.sales_sum)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                              {r.share_pct.toFixed(1)}%
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{fmtCount(r.orders_count ?? 0)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">
                              {r.avg_check != null && Number(r.avg_check) > 0 ? fmtMoney(r.avg_check) : "—"}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{fmtCount(r.active_clients ?? 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </section>

              {/* SKU TABLE */}
              <section aria-label="SKU">
                <Card className="border-border/80 shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-base">Продажи по SKU (статусы)</CardTitle>
                        <CardDescription>
                          Кол-во и доли отмен/возвратов по сумме строки; поток по статусам; маркер при высоких %
                        </CardDescription>
                      </div>
                      {MON_SKU_COLS.length > 5 ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5"
                          onClick={() => setSkuColumnsOpen(true)}
                        >
                          <LayoutGrid className="h-4 w-4" aria-hidden />
                          Столбцы
                        </Button>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 sm:p-2">
                    <div className={cn(tableWrap, "max-h-[600px]")}>
                      <table className="w-full min-w-[1280px] table-fixed border-collapse text-xs sm:text-sm">
                        <thead className={theadSticky}>
                          <tr>
                            {skuTablePrefs.visibleColumnOrder.map((id) => {
                              switch (id) {
                                case "name":
                                  return (
                                    <th key={id} className="w-[20%] px-2 py-2 text-left font-medium">
                                      Товар
                                    </th>
                                  );
                                case "sku":
                                  return (
                                    <th key={id} className="w-[8%] px-2 py-2 text-left font-medium">
                                      SKU
                                    </th>
                                  );
                                case "total_qty":
                                  return (
                                    <th key={id} className="w-[7%] px-2 py-2 text-right font-medium">
                                      Кол-во
                                    </th>
                                  );
                                case "total_sum":
                                  return (
                                    <th key={id} className="w-[8%] px-2 py-2 text-right font-medium">
                                      Всего
                                    </th>
                                  );
                                case "return_pct":
                                  return (
                                    <th key={id} className="w-[6%] px-2 py-2 text-right font-medium">
                                      Возв. %
                                    </th>
                                  );
                                case "cancel_pct":
                                  return (
                                    <th key={id} className="w-[6%] px-2 py-2 text-right font-medium">
                                      Отм. %
                                    </th>
                                  );
                                case "sum_new":
                                  return (
                                    <th key={id} className="w-[7%] px-2 py-2 text-right font-medium">
                                      Новый
                                    </th>
                                  );
                                case "sum_cancelled":
                                  return (
                                    <th key={id} className="w-[7%] px-2 py-2 text-right font-medium">
                                      Отменён
                                    </th>
                                  );
                                case "sum_confirmed":
                                  return (
                                    <th key={id} className="w-[7%] px-2 py-2 text-right font-medium">
                                      Подтв.
                                    </th>
                                  );
                                case "sum_shipped":
                                  return (
                                    <th key={id} className="w-[7%] px-2 py-2 text-right font-medium">
                                      Отгр.
                                    </th>
                                  );
                                case "sum_delivered":
                                  return (
                                    <th key={id} className="w-[7%] px-2 py-2 text-right font-medium">
                                      Достав.
                                    </th>
                                  );
                                case "sum_returned":
                                  return (
                                    <th key={id} className="w-[7%] px-2 py-2 text-right font-medium">
                                      Возврат
                                    </th>
                                  );
                                default:
                                  return null;
                              }
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {skuSlice.map((r) => (
                            <tr
                              key={r.sku + r.name}
                              className={cn(
                                "border-b border-border/50 hover:bg-muted/20",
                                skuNeedsAttention(r) && "border-l-[3px] border-l-amber-500 bg-amber-500/[0.06]"
                              )}
                            >
                              {skuTablePrefs.visibleColumnOrder.map((id) => {
                                switch (id) {
                                  case "name":
                                    return (
                                      <td key={id} className="truncate px-2 py-1.5">
                                        {r.name}
                                      </td>
                                    );
                                  case "sku":
                                    return (
                                      <td key={id} className="truncate px-2 py-1.5 font-mono text-[11px]">
                                        {r.sku}
                                      </td>
                                    );
                                  case "total_qty":
                                    return (
                                      <td key={id} className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                                        {fmtQty(r.total_qty)}
                                      </td>
                                    );
                                  case "total_sum":
                                    return (
                                      <td key={id} className="px-2 py-1.5 text-right tabular-nums font-medium">
                                        {fmtMoney(r.total_sum)}
                                      </td>
                                    );
                                  case "return_pct":
                                    return (
                                      <td
                                        key={id}
                                        className={cn(
                                          "px-2 py-1.5 text-right tabular-nums",
                                          (r.return_pct ?? 0) >= 5 && "font-medium text-amber-700 dark:text-amber-400"
                                        )}
                                      >
                                        {r.return_pct != null ? `${r.return_pct.toFixed(1)}%` : "—"}
                                      </td>
                                    );
                                  case "cancel_pct":
                                    return (
                                      <td
                                        key={id}
                                        className={cn(
                                          "px-2 py-1.5 text-right tabular-nums",
                                          (r.cancel_pct ?? 0) >= 12 && "font-medium text-amber-700 dark:text-amber-400"
                                        )}
                                      >
                                        {r.cancel_pct != null ? `${r.cancel_pct.toFixed(1)}%` : "—"}
                                      </td>
                                    );
                                  case "sum_new":
                                    return (
                                      <td key={id} className="px-2 py-1.5 text-right tabular-nums">
                                        {fmtMoney(r.sum_new)}
                                      </td>
                                    );
                                  case "sum_cancelled":
                                    return (
                                      <td key={id} className="px-2 py-1.5 text-right tabular-nums text-red-600/90 dark:text-red-400/90">
                                        {fmtMoney(r.sum_cancelled)}
                                      </td>
                                    );
                                  case "sum_confirmed":
                                    return (
                                      <td key={id} className="px-2 py-1.5 text-right tabular-nums">
                                        {fmtMoney(r.sum_confirmed)}
                                      </td>
                                    );
                                  case "sum_shipped":
                                    return (
                                      <td key={id} className="px-2 py-1.5 text-right tabular-nums">
                                        {fmtMoney(r.sum_shipped)}
                                      </td>
                                    );
                                  case "sum_delivered":
                                    return (
                                      <td key={id} className="px-2 py-1.5 text-right tabular-nums text-emerald-700/90 dark:text-emerald-400/90">
                                        {fmtMoney(r.sum_delivered)}
                                      </td>
                                    );
                                  case "sum_returned":
                                    return (
                                      <td key={id} className="px-2 py-1.5 text-right tabular-nums">
                                        {fmtMoney(r.sum_returned)}
                                      </td>
                                    );
                                  default:
                                    return null;
                                }
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <TablePager
                      total={skuLen}
                      page={skuPSafe}
                      pageSize={skuPageSize}
                      onPageChange={setSkuPage}
                      onPageSizeChange={(s) => {
                        setSkuPageSize(s);
                        setSkuPage(0);
                      }}
                    />
                  </CardContent>
                </Card>
              </section>

              {/* CLIENT × DAY MATRIX */}
              <section aria-label="Клиент по дням">
                <Card className="border-border/80 shadow-sm">
                  <CardHeader className="space-y-3 pb-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-1">
                        <CardTitle className="text-base">Клиент × день</CardTitle>
                        <CardDescription>
                          Слева — матрица по неделям (7 дней), справа — суммы по тем же дням; одинаковая высота
                          колонок на широком экране; пагинация по клиентам
                        </CardDescription>
                      </div>
                      <div className="w-full shrink-0 sm:w-[min(100%,260px)]">
                        <Label htmlFor="matrix-client-search" className={cn(filterLbl, "mb-1.5 block")}>
                          Клиент
                        </Label>
                        <Input
                          id="matrix-client-search"
                          placeholder="Поиск по названию…"
                          value={matrixClientSearch}
                          onChange={(e) => setMatrixClientSearch(e.target.value)}
                          className="h-9 text-sm"
                          autoComplete="off"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {clientMatrix.clients.length} клиентов · {clientMatrix.days.length} дн. в месяце · неделя{" "}
                      {matrixWeekSafe + 1}/{matrixWeekCount} (по {MATRIX_DAYS_PER_WEEK} дн.)
                      {matrixClientSearch.trim() ? ` · фильтр: ${matrixFilteredClients.length}` : ""}
                      {matrixTotalRows > 0
                        ? ` · клиенты: стр. ${matrixPageSafe + 1}/${matrixTotalPages}, по ${matrixPageSize}`
                        : ""}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3 p-0 sm:p-2 sm:pt-0">
                    {clientMatrix.clients.length === 0 ? (
                      <div className="rounded-md border border-dashed border-border/80 px-4 py-10 text-center text-sm text-muted-foreground">
                        Нет пар «клиент × день» за выбранный период и фильтры. Сузите фильтры или выберите другой месяц.
                      </div>
                    ) : matrixFilteredClients.length === 0 ? (
                      <div className="rounded-md border border-dashed border-border/80 px-4 py-10 text-center text-sm text-muted-foreground">
                        По запросу «{matrixClientSearch.trim()}» клиенты не найдены. Измените поиск.
                      </div>
                    ) : (
                      <div className="grid min-h-0 min-w-0 gap-4 xl:grid-cols-2 xl:items-stretch">
                        <div className="flex min-h-[min(420px,58vh)] min-w-0 flex-col overflow-hidden rounded-lg border border-border/80 bg-background px-2 py-2 shadow-sm sm:px-3">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] text-muted-foreground">
                              Неделя {matrixWeekSafe + 1} из {matrixWeekCount}
                            </span>
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 px-2 text-xs"
                                disabled={matrixWeekSafe <= 0}
                                onClick={() => setMatrixWeekIndex((w) => Math.max(0, w - 1))}
                              >
                                ←
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 px-2 text-xs"
                                disabled={matrixWeekSafe >= matrixWeekCount - 1}
                                onClick={() => setMatrixWeekIndex((w) => Math.min(matrixWeekCount - 1, w + 1))}
                              >
                                →
                              </Button>
                            </div>
                          </div>
                          <div className={cn(tableWrap, "min-h-0 flex-1 max-h-[min(480px,55vh)]")} style={{ overflow: "auto" }}>
                          <table className="border-collapse text-sm" style={{ minWidth: Math.max(matrixMinW, 520) }}>
                            <thead className={theadSticky}>
                              <tr>
                                <th
                                  className="sticky left-0 z-30 min-w-[200px] border-r border-border bg-muted/95 px-3 py-2 text-left text-xs font-medium shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]"
                                  style={{ width: 200 }}
                                >
                                  Клиент
                                </th>
                                {matrixWeekDaySlice.map((day) => {
                                  const { ddmm, weekday } = matrixDayHeaderParts(day);
                                  return (
                                    <th
                                      key={day}
                                      className="min-w-[76px] border-b border-border px-0.5 py-2 text-center align-bottom leading-tight text-muted-foreground"
                                      title={day.length >= 10 ? day.slice(0, 10) : day}
                                    >
                                      <span className="block text-[11px] font-semibold tracking-tight text-foreground/90">
                                        {ddmm}
                                      </span>
                                      {weekday ? (
                                        <span className="mt-0.5 block text-[9px] font-medium capitalize">{weekday}</span>
                                      ) : null}
                                    </th>
                                  );
                                })}
                                <th className="sticky right-0 z-30 min-w-[92px] border-l border-border bg-muted/95 px-2 py-2 text-right text-[10px] font-medium text-muted-foreground shadow-[-6px_0_8px_-4px_rgba(0,0,0,0.07)] backdrop-blur-sm">
                                  Σ (нед.)
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {matrixVisibleClients.map((c) => {
                                const rowWeekTot = matrixWeekDaySlice.reduce((s, day) => s + num(c.cells.get(day) ?? 0), 0);
                                const rowWeekMax = matrixWeekDaySlice.reduce(
                                  (m, day) => Math.max(m, num(c.cells.get(day) ?? 0)),
                                  0
                                );
                                const ad = matrixStats.activeDays.get(c.id) ?? 0;
                                return (
                                  <tr key={c.id} className="border-b border-border/50">
                                    <td
                                      className="sticky left-0 z-10 border-r border-border bg-background/95 px-3 py-1.5 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)] backdrop-blur-sm"
                                      style={{ maxWidth: 200 }}
                                      title={c.name}
                                    >
                                      <span className="block truncate font-medium">{c.name}</span>
                                      {ad > 0 ? (
                                        <span className="mt-0.5 block truncate text-[10px] font-normal text-muted-foreground">
                                          {ad} дн. с продажами
                                        </span>
                                      ) : null}
                                    </td>
                                    {matrixWeekDaySlice.map((day) => {
                                      const cell = c.cells.get(day);
                                      const n = cell ? num(cell) : 0;
                                      const colTot = matrixStats.colTotals.get(day) ?? 0;
                                      const rowPct = rowWeekTot > 0 ? (n / rowWeekTot) * 100 : 0;
                                      const colPct = colTot > 0 ? (n / colTot) * 100 : 0;
                                      const tip =
                                        n > 0
                                          ? `${c.name} · ${day.length >= 10 ? day.slice(0, 10) : day} · ${fmtMoney(cell!)} · ${rowPct.toFixed(0)}% недели · ${colPct.toFixed(0)}% дня`
                                          : `${c.name} · ${day.length >= 10 ? day.slice(0, 10) : day} · нет продаж`;
                                      return (
                                        <td
                                          key={day}
                                          className={cn(
                                            "px-0.5 py-1 text-right text-[10px] tabular-nums sm:text-[11px] sm:px-1 sm:py-1.5",
                                            n > 0 ? "font-medium text-foreground" : "text-muted-foreground"
                                          )}
                                          style={matrixCellHeatStyle(
                                            n,
                                            rowWeekMax,
                                            Math.max(matrixWeekGlobalMax, 1e-9)
                                          )}
                                          title={tip}
                                        >
                                          {cell ? fmtMoney(cell) : "—"}
                                        </td>
                                      );
                                    })}
                                    <td className="sticky right-0 z-10 border-l border-border bg-muted/20 px-2 py-1.5 text-right text-[10px] font-semibold tabular-nums shadow-[-6px_0_8px_-4px_rgba(0,0,0,0.05)] backdrop-blur-sm sm:text-xs">
                                      {fmtMoney(rowWeekTot)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="border-t-2 border-border bg-muted/50">
                                <td
                                  className="sticky left-0 z-20 border-r border-border bg-muted/50 px-3 py-2 text-xs font-semibold shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)] backdrop-blur-sm"
                                  style={{ maxWidth: 200 }}
                                >
                                  Итого по дням
                                </td>
                                {matrixWeekDaySlice.map((day) => (
                                  <td
                                    key={day}
                                    className="bg-muted/50 px-0.5 py-2 text-right text-[10px] font-semibold tabular-nums sm:text-xs"
                                  >
                                    {fmtMoney(matrixStats.colTotals.get(day) ?? 0)}
                                  </td>
                                ))}
                                <td className="sticky right-0 z-20 border-l border-border bg-muted/50 px-2 py-2 text-right text-[10px] font-bold tabular-nums shadow-[-6px_0_8px_-4px_rgba(0,0,0,0.06)] backdrop-blur-sm sm:text-xs">
                                  {fmtMoney(matrixWeekColGrand)}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                        <TablePager
                          total={matrixTotalRows}
                          page={matrixPageSafe}
                          pageSize={matrixPageSize}
                          onPageChange={setMatrixPage}
                          onPageSizeChange={(s) => {
                            setMatrixPageSize(s);
                            setMatrixPage(0);
                          }}
                        />
                        <div className="flex flex-wrap items-center gap-2 border-t border-border/40 px-1 py-2 text-[11px] text-muted-foreground sm:px-0">
                          <span className="shrink-0">Интенсивность ячейки:</span>
                          <div
                            className="h-2.5 w-[min(100%,160px)] shrink-0 rounded border border-border/70"
                            style={{
                              background:
                                "linear-gradient(to right, hsl(152 55% 36% / 0.06), hsl(152 55% 36% / 0.41))"
                            }}
                            aria-hidden
                          />
                          <span className="text-[10px]">неделя, пик строки</span>
                        </div>
                        </div>
                        <div className="flex min-h-[min(420px,58vh)] min-w-0 flex-col justify-center rounded-lg border border-border/80 bg-background p-2 shadow-sm sm:p-3 xl:min-h-0">
                          <MonitoringClientDayColumnTotalsChart daySeries={matrixWeekChartSeries} height={320} />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </section>

              {/* YEAR COMPARISON */}
              {yc ? (
                <section aria-label="Сравнение с прошлым годом">
                  <Card className="border-border/80 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">
                        {yc.previous.year}-{String(yc.previous.month).padStart(2, "0")} vs{" "}
                        {yc.current.year}-{String(yc.current.month).padStart(2, "0")}
                      </CardTitle>
                      <CardDescription>Таблица слева, график справа; сумма на графике — в млн</CardDescription>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-4">
                      <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:items-stretch">
                        <div className="flex min-w-0 flex-col overflow-hidden rounded-md border border-border">
                          <div className="overflow-x-auto">
                        <table className="w-full min-w-[280px] border-collapse text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs">Показатель</th>
                              <th className="px-3 py-2 text-right text-xs">Прошлый год</th>
                              <th className="px-3 py-2 text-right text-xs">Текущий</th>
                              <th className="px-3 py-2 text-right text-xs">Рост %</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-t border-border/60">
                              <td className="px-3 py-2">АКБ</td>
                              <td className="px-3 py-2 text-right tabular-nums">{fmtCount(yc.previous.akb)}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{fmtCount(yc.current.akb)}</td>
                              <td className={cn("px-3 py-2 text-right tabular-nums", growthClass(yc.growth_pct.akb))}>
                                {pct(yc.growth_pct.akb)}
                              </td>
                            </tr>
                            <tr className="border-t border-border/60">
                              <td className="px-3 py-2">Заказы</td>
                              <td className="px-3 py-2 text-right tabular-nums">{fmtCount(yc.previous.orders_count)}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{fmtCount(yc.current.orders_count)}</td>
                              <td className={cn("px-3 py-2 text-right tabular-nums", growthClass(yc.growth_pct.orders_count))}>
                                {pct(yc.growth_pct.orders_count)}
                              </td>
                            </tr>
                            <tr className="border-t border-border/60">
                              <td className="px-3 py-2">Сумма</td>
                              <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(yc.previous.sales_sum)}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(yc.current.sales_sum)}</td>
                              <td className={cn("px-3 py-2 text-right tabular-nums", growthClass(yc.growth_pct.sales_sum))}>
                                {pct(yc.growth_pct.sales_sum)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                          </div>
                        </div>
                        <div className="min-h-[220px] min-w-0 lg:min-h-[260px]">
                          <MonitoringYearComparisonBars rows={yoyBarRows} height={260} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </PageShell>
  );
}
