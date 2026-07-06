"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { SupervisorDashboardMultiFilter } from "@/components/dashboard/supervisor-dashboard-multi-filter";
import { SupervisorEnterpriseKpiPanel } from "@/components/dashboard/supervisor/supervisor-enterprise-kpi-panel";
import { SupervisorEnterpriseSection } from "@/components/dashboard/supervisor/supervisor-enterprise-section";
import {
  SupervisorProductAnalyticsTable,
  analyticsDimensionLabel
} from "@/components/dashboard/supervisor/supervisor-product-analytics-table";
import {
  SupervisorEnterprisePager,
  SupervisorEnterpriseSegmentTabs,
  SupervisorEnterpriseTableWrap,
  SupervisorEnterpriseToolbar
} from "@/components/dashboard/supervisor/supervisor-enterprise-ui";
import {
  formatPhotoReportCell,
  SupervisorPhotoReportModal,
  type SupervisorPhotoReportModalTarget
} from "@/components/dashboard/supervisor/supervisor-photo-report-modal";
import type { SupervisorPaymentSlot } from "@/components/dashboard/supervisor/supervisor-enterprise-payment-card";
import { DatePickerPopover, formatRuDateButton } from "@/components/ui/date-picker-popover";
import { filterSelectClassName } from "@/components/ui/filter-select";
import { api } from "@/lib/api";
import {
  buildSupervisorDashboardQueryString,
  type SupervisorDashboardQueryInput
} from "@/lib/dashboard-supervisor-query";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { createTerritoryLabelResolver } from "@/lib/territory-filter-labels";
import type { TerritoryNode } from "@/lib/territory-tree";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  CalendarDays,
  Package,
  RotateCcw,
  TrendingUp,
  Users
} from "lucide-react";
import { localYmd } from "@/components/ui/date-picker-popover";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { STALE } from "@/lib/query-stale";
import { useDashboardMeta } from "@/lib/use-dashboard-meta";
import { staffDashboardMultiItem } from "@/lib/order-picker-labels";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as XLSX from "xlsx";

type StaffPick = { id: number; fio: string; code?: string | null };
type SupervisorFilterDraft = SupervisorDashboardQueryInput;

type SupervisorDashboardData = {
  kpi: {
    total_sales_sum: string;
    cash_sales_sum: string;
    sales_by_payment_method: Array<{ method: string; sum: string }>;
    monthly_kpi_plan_sum?: string;
    monthly_kpi_fact_mtd_sum?: string;
    monthly_kpi_execution_pct?: number | null;
    planned_visits: number;
    visited_planned: number;
    visited_total: number;
    successful_visits: number;
    gps_visits: number;
    photo_reports: number;
    visit_pct: number;
    success_pct: number;
    gps_pct: number;
    photo_pct: number;
  };
  product_analytics: {
    by_category: ProductRow[];
    by_group: ProductRow[];
    by_brand: ProductRow[];
  };
  product_matrix: {
    by_category: ProductMatrixBlock;
    by_group: ProductMatrixBlock;
    by_brand: ProductMatrixBlock;
  };
  visit_report: {
    rows: VisitRow[];
    totals: VisitTotals;
  };
  efficiency_report: {
    by_agents: EfficiencyRow[];
    by_supervisors: EfficiencyRow[];
  };
};

type ProductRow = {
  dimension: string;
  share_pct: number;
  revenue: string;
  quantity: string;
  akb: number;
};

type ProductMatrixValue = {
  revenue: string;
  quantity: string;
  akb: number;
  orders: number;
};

type ProductMatrixActorRow = {
  id: number;
  name: string;
  values: Record<string, ProductMatrixValue>;
};

type ProductMatrixBlock = {
  dimensions: string[];
  by_agents: ProductMatrixActorRow[];
  by_supervisors: ProductMatrixActorRow[];
};

type VisitPlanDetail = {
  visited_order_sum: string;
  visited_order_qty: string;
  visited_no_order: number;
  not_visited_order_sum: string;
  not_visited_order_qty: string;
  photo: number;
};

type VisitOutsideDetail = VisitPlanDetail;

type VisitRow = {
  agent_id: number;
  agent_name: string;
  agent_code: string | null;
  planned_visits: number;
  visited_planned: number;
  visited_unplanned: number;
  visited_total: number;
  not_visited: number;
  visits_with_orders: number;
  visits_without_orders: number;
  gps_visits: number;
  photo_reports: number;
  sales_sum: string;
  sales_qty: string;
  plan_detail: VisitPlanDetail;
  outside_detail: VisitOutsideDetail;
};

type VisitTotals = Omit<VisitRow, "agent_id" | "agent_name">;

function visitAgentLabel(r: Pick<VisitRow, "agent_id" | "agent_code" | "agent_name">): string {
  const idPart = String(r.agent_id).padStart(2, "0");
  const code = (r.agent_code ?? "").trim() || "—";
  return `${idPart} - ${code} - ${r.agent_name}`;
}

/** «Продажи по товарам» / универсальный отчёт bilan bir xil trigger */
const FILTER_TRIGGER =
  "h-8 min-h-8 w-full min-w-0 max-w-none px-2 text-xs font-normal shadow-sm";

function uniqSortedTerritoryValues(values: string[]): string[] {
  const s = new Set<string>();
  for (const v of values) {
    const t = String(v ?? "").trim();
    if (t) s.add(t);
  }
  return [...s].sort((a, b) => a.localeCompare(b, "ru"));
}

/** GET /reports/product-sales/filter-options — kaskad hudud va spravochniklar manbasi */
type ProductSalesFilterOpts = {
  territory_1?: string[];
  territory_2?: string[];
  territory_3?: string[];
  territory_2_by_1?: Record<string, string[]>;
  territory_3_by_2?: Record<string, string[]>;
  regions_by_zone?: Record<string, string[]>;
  cities_by_zone_region?: Record<string, string[]>;
  territory_tree?: Array<{ zone: string; region: string; city: string }>;
  agents?: Array<{ id: number; name: string; code: string }>;
  supervisors?: Array<{ id: number; name: string; code: string }>;
  categories?: Array<{ id: number; name: string }>;
  trade_directions?: Array<{ id: number; name: string; code: string }>;
  payment_methods?: Array<{ id: string; label: string }>;
};

/** Backend `paymentMethodStorageKey` bilan mos (finance-refs). */
function paymentMethodStorageKeyFe(e: { name: string; code?: string | null }): string {
  const c = String(e.code ?? "").trim();
  if (c) return c.slice(0, 64);
  return String(e.name ?? "").trim().slice(0, 64);
}

function buildPaymentSlotMatchKeys(
  def: { value: string; label: string },
  entries:
    | Array<{ id: string; name: string; code?: string | null; active?: boolean }>
    | undefined
): Set<string> {
  const keys = new Set<string>();
  const add = (s: string | undefined) => {
    const t = normTrim(s);
    if (!t) return;
    keys.add(t);
    keys.add(t.toLowerCase());
  };
  add(def.value);
  add(def.label);
  const v = normTrim(def.value);
  const lb = normTrim(def.label);
  for (const e of entries ?? []) {
    if (e.active === false) continue;
    const id = normTrim(e.id);
    const sk = paymentMethodStorageKeyFe(e);
    if (id && (id === v || id === lb)) {
      add(id);
      add(e.name);
      add(e.code ?? undefined);
      add(sk);
    }
    if (sk && (sk === v || sk === lb)) {
      add(id);
      add(e.name);
      add(e.code ?? undefined);
      add(sk);
    }
  }
  return keys;
}

function breakdownRowMatchesPaymentKeys(rawMethod: string, keySet: Set<string>): boolean {
  const raw = normTrim(rawMethod);
  if (!raw) return false;
  return keySet.has(raw) || keySet.has(raw.toLowerCase());
}

function addMoneyStr(a: string, b: string): string {
  const parse = (s: string) => {
    const t = String(s ?? "").replace(/\s/g, "").replace(",", ".");
    const n = Number.parseFloat(t);
    return Number.isFinite(n) ? n : 0;
  };
  return (parse(a) + parse(b)).toFixed(2);
}

type VisitReportXlsxMerge = { s: { r: number; c: number }; e: { r: number; c: number } };

function visitReportParseNum(v: string | number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const t = String(v ?? "0").replace(/\s/g, "").replace(",", ".");
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

function visitRowToSheetRow(r: VisitRow): (string | number)[] {
  return [
    visitAgentLabel(r),
    r.planned_visits,
    r.visited_planned,
    r.not_visited,
    visitReportParseNum(r.plan_detail.visited_order_sum),
    visitReportParseNum(r.plan_detail.visited_order_qty),
    r.plan_detail.visited_no_order,
    visitReportParseNum(r.plan_detail.not_visited_order_sum),
    visitReportParseNum(r.plan_detail.not_visited_order_qty),
    r.plan_detail.photo,
    visitReportParseNum(r.outside_detail.visited_order_sum),
    visitReportParseNum(r.outside_detail.visited_order_qty),
    r.outside_detail.visited_no_order,
    visitReportParseNum(r.outside_detail.not_visited_order_sum),
    visitReportParseNum(r.outside_detail.not_visited_order_qty),
    r.outside_detail.photo
  ];
}

function visitTotalsToSheetRow(t: VisitTotals): (string | number)[] {
  return [
    "Итого",
    t.planned_visits,
    t.visited_planned,
    t.not_visited,
    visitReportParseNum(t.plan_detail.visited_order_sum),
    visitReportParseNum(t.plan_detail.visited_order_qty),
    t.plan_detail.visited_no_order,
    visitReportParseNum(t.plan_detail.not_visited_order_sum),
    visitReportParseNum(t.plan_detail.not_visited_order_qty),
    t.plan_detail.photo,
    visitReportParseNum(t.outside_detail.visited_order_sum),
    visitReportParseNum(t.outside_detail.visited_order_qty),
    t.outside_detail.visited_no_order,
    visitReportParseNum(t.outside_detail.not_visited_order_sum),
    visitReportParseNum(t.outside_detail.not_visited_order_qty),
    t.outside_detail.photo
  ];
}

/** Jadvaldagi 4 qatorli sarlavha + birlashtirishlar — UI bilan bir xil tuzilish */
function buildVisitReportSheetMerges(): VisitReportXlsxMerge[] {
  return [
    { s: { r: 0, c: 0 }, e: { r: 3, c: 0 } },
    { s: { r: 0, c: 1 }, e: { r: 0, c: 9 } },
    { s: { r: 0, c: 10 }, e: { r: 0, c: 15 } },
    { s: { r: 1, c: 1 }, e: { r: 3, c: 1 } },
    { s: { r: 1, c: 2 }, e: { r: 3, c: 2 } },
    { s: { r: 1, c: 3 }, e: { r: 3, c: 3 } },
    { s: { r: 1, c: 4 }, e: { r: 1, c: 6 } },
    { s: { r: 1, c: 7 }, e: { r: 1, c: 8 } },
    { s: { r: 1, c: 9 }, e: { r: 3, c: 9 } },
    { s: { r: 1, c: 10 }, e: { r: 1, c: 12 } },
    { s: { r: 1, c: 13 }, e: { r: 1, c: 14 } },
    { s: { r: 1, c: 15 }, e: { r: 3, c: 15 } },
    { s: { r: 2, c: 4 }, e: { r: 2, c: 5 } },
    { s: { r: 2, c: 6 }, e: { r: 3, c: 6 } },
    { s: { r: 2, c: 7 }, e: { r: 2, c: 8 } },
    { s: { r: 2, c: 10 }, e: { r: 2, c: 11 } },
    { s: { r: 2, c: 12 }, e: { r: 3, c: 12 } },
    { s: { r: 2, c: 13 }, e: { r: 2, c: 14 } }
  ];
}

function exportVisitReportToXlsx(rows: VisitRow[], totals: VisitTotals, filename: string) {
  const empty = (): string[] => Array.from({ length: 16 }, () => "");

  const r0 = empty();
  r0[0] = "Агент";
  r0[1] = "По плану";
  r0[10] = "Вне плана";

  const r1 = empty();
  r1[1] = "План";
  r1[2] = "Посещено";
  r1[3] = "Непосещено";
  r1[4] = "Посещено";
  r1[7] = "Непосещено";
  r1[9] = "Фото";
  r1[10] = "Посещено";
  r1[13] = "Непосещено";
  r1[15] = "Фото";

  const r2 = empty();
  r2[4] = "Заказ";
  r2[6] = "Нет заказа (не результативно)";
  r2[7] = "Заказ";
  r2[10] = "Заказ";
  r2[12] = "Нет заказа (не результативно)";
  r2[13] = "Заказ";

  const r3 = empty();
  r3[4] = "Сумма";
  r3[5] = "Количество";
  r3[7] = "Сумма";
  r3[8] = "Количество";
  r3[10] = "Сумма";
  r3[11] = "Количество";
  r3[13] = "Сумма";
  r3[14] = "Количество";

  const aoa: (string | number)[][] = [r0, r1, r2, r3];
  for (const row of rows) {
    aoa.push(visitRowToSheetRow(row));
  }
  aoa.push(visitTotalsToSheetRow(totals));

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!merges"] = buildVisitReportSheetMerges();
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Дневной отчет");
  XLSX.writeFile(wb, filename);
}

/** Ranglar: `globals.css` → `.supervisor-visit-report`, `.svr-*` (tema tokenlari) */

function renderDailyVisitReportTable(rows: VisitRow[], totals: VisitTotals) {
  const fmtSum = (v: string) => formatNumberGrouped(v, { maxFractionDigits: 2 });
  const fmtQty = (v: string) => formatNumberGrouped(v, { maxFractionDigits: 3 });
  const thPlan = "svr-th svr-th--sub-plan";
  const thOut = "svr-th svr-th--sub-out";
  const td = "svr-td";
  const tdFoot = "svr-td svr-td--foot";
  return (
    <SupervisorEnterpriseTableWrap className="supervisor-visit-report">
      <table className="w-full min-w-[1100px] border-collapse text-xs">
        <thead>
          <tr>
            <th rowSpan={4} className="svr-th svr-th--agent align-middle whitespace-normal">
              Агент
            </th>
            <th colSpan={9} className="svr-th svr-th--band-plan">
              По плану
            </th>
            <th colSpan={6} className="svr-th svr-th--band-out">
              Вне плана
            </th>
          </tr>
          <tr>
            <th rowSpan={3} className={`${thPlan} align-middle`}>
              План
            </th>
            <th rowSpan={3} className={`${thPlan} align-middle`}>
              Посещено
            </th>
            <th rowSpan={3} className={`${thPlan} align-middle`}>
              Непосещено
            </th>
            <th colSpan={3} className={thPlan}>
              Посещено
            </th>
            <th colSpan={2} className={thPlan}>
              Непосещено
            </th>
            <th rowSpan={3} className={`${thPlan} align-middle`}>
              Фото
            </th>
            <th colSpan={3} className={thOut}>
              Посещено
            </th>
            <th colSpan={2} className={thOut}>
              Непосещено
            </th>
            <th rowSpan={3} className={`${thOut} align-middle`}>
              Фото
            </th>
          </tr>
          <tr>
            <th colSpan={2} className={thPlan}>
              Заказ
            </th>
            <th rowSpan={2} className={`${thPlan} align-middle text-[10px] font-normal`}>
              Нет заказа
              <br />
              <span className="text-[9px] opacity-90">(не результативно)</span>
            </th>
            <th colSpan={2} className={thPlan}>
              Заказ
            </th>
            <th colSpan={2} className={thOut}>
              Заказ
            </th>
            <th rowSpan={2} className={`${thOut} align-middle text-[10px] font-normal`}>
              Нет заказа
              <br />
              <span className="text-[9px] opacity-90">(не результативно)</span>
            </th>
            <th colSpan={2} className={thOut}>
              Заказ
            </th>
          </tr>
          <tr>
            <th className={thPlan}>Сумма</th>
            <th className={thPlan}>Количество</th>
            <th className={thPlan}>Сумма</th>
            <th className={thPlan}>Количество</th>
            <th className={thOut}>Сумма</th>
            <th className={thOut}>Количество</th>
            <th className={thOut}>Сумма</th>
            <th className={thOut}>Количество</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.agent_id} className="svr-tr-data">
              <td className={`${td} svr-td--agent`}>{visitAgentLabel(r)}</td>
              <td className={td}>{r.planned_visits}</td>
              <td className={td}>{r.visited_planned}</td>
              <td className={td}>{r.not_visited}</td>
              <td className={td}>{fmtSum(r.plan_detail.visited_order_sum)}</td>
              <td className={td}>{fmtQty(r.plan_detail.visited_order_qty)}</td>
              <td className={td}>{r.plan_detail.visited_no_order}</td>
              <td className={td}>{fmtSum(r.plan_detail.not_visited_order_sum)}</td>
              <td className={td}>{fmtQty(r.plan_detail.not_visited_order_qty)}</td>
              <td className={td}>{r.plan_detail.photo}</td>
              <td className={td}>{fmtSum(r.outside_detail.visited_order_sum)}</td>
              <td className={td}>{fmtQty(r.outside_detail.visited_order_qty)}</td>
              <td className={td}>{r.outside_detail.visited_no_order}</td>
              <td className={td}>{fmtSum(r.outside_detail.not_visited_order_sum)}</td>
              <td className={td}>{fmtQty(r.outside_detail.not_visited_order_qty)}</td>
              <td className={td}>{r.outside_detail.photo}</td>
            </tr>
          ))}
          <tr>
            <td className={`${td} svr-td--agent svr-td--foot`}>Итого</td>
            <td className={tdFoot}>{totals.planned_visits}</td>
            <td className={tdFoot}>{totals.visited_planned}</td>
            <td className={tdFoot}>{totals.not_visited}</td>
            <td className={tdFoot}>{fmtSum(totals.plan_detail.visited_order_sum)}</td>
            <td className={tdFoot}>{fmtQty(totals.plan_detail.visited_order_qty)}</td>
            <td className={tdFoot}>{totals.plan_detail.visited_no_order}</td>
            <td className={tdFoot}>{fmtSum(totals.plan_detail.not_visited_order_sum)}</td>
            <td className={tdFoot}>{fmtQty(totals.plan_detail.not_visited_order_qty)}</td>
            <td className={tdFoot}>{totals.plan_detail.photo}</td>
            <td className={tdFoot}>{fmtSum(totals.outside_detail.visited_order_sum)}</td>
            <td className={tdFoot}>{fmtQty(totals.outside_detail.visited_order_qty)}</td>
            <td className={tdFoot}>{totals.outside_detail.visited_no_order}</td>
            <td className={tdFoot}>{fmtSum(totals.outside_detail.not_visited_order_sum)}</td>
            <td className={tdFoot}>{fmtQty(totals.outside_detail.not_visited_order_qty)}</td>
            <td className={tdFoot}>{totals.outside_detail.photo}</td>
          </tr>
        </tbody>
      </table>
    </SupervisorEnterpriseTableWrap>
  );
}

type EfficiencyRow = {
  id: number;
  name: string;
  agent_code?: string | null;
  order_count: number;
  cancelled_count: number;
  planned_visits: number;
  visited_total: number;
  rejected_visits: number;
  unvisited: number;
  visit_pct: number;
  photo_reports: number;
  photo_outlets: number;
  photo_count: number;
  total_sales_sum: string;
};

type CollapsibleSection = "analytics" | "products" | "visits" | "efficiency" | null;

function normTrim(v: string | null | undefined): string {
  return String(v ?? "").trim();
}

function recordLookupCi<T>(rec: Record<string, T> | undefined, key: string): T | undefined {
  if (!rec) return undefined;
  const p = normTrim(key);
  if (!p) return undefined;
  if (Object.prototype.hasOwnProperty.call(rec, p)) return rec[p];
  const pl = p.toLowerCase();
  for (const [k, v] of Object.entries(rec)) {
    if (normTrim(k).toLowerCase() === pl) return v;
  }
  return undefined;
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

function emptyFilters(supervisorId = ""): SupervisorFilterDraft {
  return {
    date: localYmd(new Date()),
    payment_types: [],
    agent_ids: [],
    supervisor_ids: supervisorId ? [supervisorId] : [],
    trade_directions: [],
    client_categories: [],
    territory_1_list: [],
    territory_2_list: [],
    territory_3_list: []
  };
}

export type DashboardHomeProps = {
  headerTitle?: string;
  headerDescription?: string;
};

export function DashboardHome({
  headerTitle = "Дашборд - Супервайзер",
  headerDescription = "Мониторинг в реальном времени, контроль план/факт и KPI."
}: DashboardHomeProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const role = useEffectiveRole();
  const hydrated = useAuthStoreHydrated();
  const [draft, setDraft] = useState<SupervisorFilterDraft>(() => emptyFilters());
  const [applied, setApplied] = useState<SupervisorFilterDraft>(() => emptyFilters());
  const [productTab, setProductTab] = useState<string | null>("category");
  const [analyticsTab, setAnalyticsTab] = useState<string | null>("category");
  const [productAxis, setProductAxis] = useState<string | null>("agents");
  const [productMetric, setProductMetric] = useState<string | null>("revenue");
  const [effTab, setEffTab] = useState<string | null>("agents");
  const [activeSection, setActiveSection] = useState<CollapsibleSection>(null);
  const [productPage, setProductPage] = useState(1);
  const [productLimit, setProductLimit] = useState(20);
  const [productSearch, setProductSearch] = useState("");
  const [visitPage, setVisitPage] = useState(1);
  const [visitLimit, setVisitLimit] = useState(10);
  const [visitSearch, setVisitSearch] = useState("");
  const [effPage, setEffPage] = useState(1);
  const [effLimit, setEffLimit] = useState(20);
  const [effSearch, setEffSearch] = useState("");
  const [photoReportTarget, setPhotoReportTarget] = useState<SupervisorPhotoReportModalTarget | null>(null);
  const [photoReportOpen, setPhotoReportOpen] = useState(false);
  const datePickerAnchorRef = useRef<HTMLButtonElement | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const selfSupervisorId = useMemo(
    () => (role === "supervisor" ? decodeAccessTokenSub(accessToken) : null),
    [role, accessToken]
  );
  const selfSupervisorIdStr = selfSupervisorId != null ? String(selfSupervisorId) : "";

  const {
    agents,
    supervisors,
    clientRefs,
    profileRefs,
    reportFilters: reportFiltersRaw
  } = useDashboardMeta(tenantSlug, hydrated);
  const reportFilters = reportFiltersRaw as ProductSalesFilterOpts | undefined;

  const effectiveQs = useMemo(() => buildSupervisorDashboardQueryString(applied), [applied]);

  const summaryQ = useQuery({
    queryKey: ["dashboard-supervisor", "summary", tenantSlug, effectiveQs],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.report,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
    queryFn: async () => {
      const { data } = await api.get(`/api/${tenantSlug}/dashboard/supervisor/summary?${effectiveQs}`);
      return data as Pick<SupervisorDashboardData, "kpi" | "efficiency_report"> & {
        visit_totals: SupervisorDashboardData["visit_report"]["totals"];
      };
    }
  });

  const visitsQ = useQuery({
    queryKey: ["dashboard-supervisor", "visits", tenantSlug, effectiveQs, visitPage, visitLimit],
    enabled: Boolean(tenantSlug) && hydrated && summaryQ.isSuccess && activeSection === "visits",
    staleTime: STALE.report,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
    queryFn: async () => {
      const { data } = await api.get(
        `/api/${tenantSlug}/dashboard/supervisor/visits?${effectiveQs}&page=${visitPage}&limit=${visitLimit}`
      );
      return data as {
        visit_report: SupervisorDashboardData["visit_report"];
        total: number;
      };
    }
  });

  const productsQ = useQuery({
    queryKey: ["dashboard-supervisor", "products", tenantSlug, effectiveQs],
    enabled:
      Boolean(tenantSlug) &&
      hydrated &&
      summaryQ.isSuccess &&
      (activeSection === "products" || activeSection === "analytics"),
    staleTime: STALE.report,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
    queryFn: async () => {
      const { data } = await api.get(`/api/${tenantSlug}/dashboard/supervisor/products?${effectiveQs}`);
      return data as Pick<SupervisorDashboardData, "product_analytics" | "product_matrix">;
    }
  });

  const dataQ = useMemo(() => {
    const summary = summaryQ.data;
    const visits = visitsQ.data;
    const products = productsQ.data;
    if (!summary) {
      return {
        data: undefined as SupervisorDashboardData | undefined,
        isLoading: summaryQ.isLoading,
        isFetching: summaryQ.isFetching || visitsQ.isFetching || productsQ.isFetching,
        isError: summaryQ.isError || visitsQ.isError || productsQ.isError,
        refetch: () => {
          void summaryQ.refetch();
          void visitsQ.refetch();
          void productsQ.refetch();
        }
      };
    }
    const merged: SupervisorDashboardData = {
      kpi: summary.kpi,
      efficiency_report: summary.efficiency_report,
      product_analytics: products?.product_analytics ?? { by_category: [], by_group: [], by_brand: [] },
      product_matrix: products?.product_matrix ?? {
        by_category: { dimensions: [], by_agents: [], by_supervisors: [] },
        by_group: { dimensions: [], by_agents: [], by_supervisors: [] },
        by_brand: { dimensions: [], by_agents: [], by_supervisors: [] }
      },
      visit_report: visits?.visit_report ?? {
        rows: [],
        totals: summary.visit_totals
      }
    };
    return {
      data: merged,
      isLoading: summaryQ.isLoading,
      isFetching: summaryQ.isFetching || visitsQ.isFetching || productsQ.isFetching,
      isError: summaryQ.isError || visitsQ.isError || productsQ.isError,
      refetch: () => {
        void summaryQ.refetch();
        void visitsQ.refetch();
        void productsQ.refetch();
      }
    };
  }, [summaryQ, visitsQ, productsQ]);

  const categoryOptions = useMemo(() => {
    const fromOptions = (clientRefs?.category_options ?? [])
      .map((o) => (typeof o === "string" ? o : (o?.label ?? o?.value ?? "")))
      .map((x) => String(x).trim())
      .filter(Boolean);
    const fromList = (clientRefs?.categories ?? []).map((x) => String(x).trim()).filter(Boolean);
    return Array.from(new Set([...fromOptions, ...fromList])).sort((a, b) => a.localeCompare(b, "ru"));
  }, [clientRefs]);
  const paymentOptions = useMemo(() => {
    const fromEntries = (profileRefs?.payment_method_entries ?? [])
      .filter((p) => p?.active !== false)
      .map((p) => {
        const id = String(p.id ?? "").trim();
        const label = String(p.name ?? "").trim();
        const code = typeof p.code === "string" ? p.code.trim() : "";
        return { value: id, label, code };
      })
      .filter((p) => p.value && p.label);
    if (fromEntries.length > 0) return fromEntries;
    const legacy = (profileRefs?.payment_types ?? [])
      .map((x) => String(x).trim())
      .filter(Boolean)
      .map((x) => ({ value: x, label: x, code: "" as const }));
    return legacy;
  }, [profileRefs]);

  const paymentFilterOptions = useMemo(() => {
    const fromReport = reportFilters?.payment_methods ?? [];
    if (fromReport.length > 0) {
      return fromReport.map((x) => ({ value: x.id, label: x.label }));
    }
    return paymentOptions.map((p) => ({ value: p.value, label: p.label }));
  }, [reportFilters?.payment_methods, paymentOptions]);

  /**
   * «Продажи по товарам» bilan bir xil: `payment_methods` kaliti (kod yoki nom), buyurtmada esa `id` yoki shu kalit bo‘lishi mumkin.
   * Har bir tizim usuli alohida kartochka; mos kelmaydigan qoldiq — «Не указано».
   */
  const kpiPaymentColumnSlots = useMemo(() => {
    if (!dataQ.data) return null;
    const kpi = dataQ.data.kpi;
    const breakdown = kpi.sales_by_payment_method ?? [];
    const entries = profileRefs?.payment_method_entries;
    const defs = paymentFilterOptions;

    if (defs.length === 0) {
      const paymentSlots = breakdown.map((row) => {
        const t = normTrim(row.method);
        return {
          title: t || "Не указано",
          amount: row.sum,
          empty: false
        };
      });
      return [{ title: "Общая сумма", amount: kpi.total_sales_sum, empty: false }, ...paymentSlots];
    }

    const slotMeta = defs.map((def) => ({
      def,
      keys: buildPaymentSlotMatchKeys(def, entries)
    }));
    const slotSums = slotMeta.map(() => "0");
    let orphanSum = "0";

    for (const row of breakdown) {
      const raw = normTrim(row.method);
      let idx = -1;
      for (let s = 0; s < slotMeta.length; s++) {
        if (breakdownRowMatchesPaymentKeys(raw, slotMeta[s]!.keys)) {
          idx = s;
          break;
        }
      }
      if (idx >= 0) slotSums[idx] = addMoneyStr(slotSums[idx]!, row.sum);
      else orphanSum = addMoneyStr(orphanSum, row.sum);
    }

    const paymentSlots = slotMeta.map(({ def }, i) => {
      const amount = slotSums[i]!;
      const n = Number.parseFloat(amount);
      const empty = !Number.isFinite(n) || n === 0;
      return { title: def.label, amount, empty };
    });

    const out: Array<{ title: string; amount: string; empty: boolean }> = [
      { title: "Общая сумма", amount: kpi.total_sales_sum, empty: false },
      ...paymentSlots
    ];
    const orphanNum = Number.parseFloat(orphanSum);
    if (Number.isFinite(orphanNum) && orphanNum !== 0) {
      out.push({ title: "Не указано", amount: orphanSum, empty: false });
    }
    return out;
  }, [dataQ.data, paymentFilterOptions, profileRefs?.payment_method_entries]);

  const enterprisePaymentSlots = useMemo((): SupervisorPaymentSlot[] => {
    if (!kpiPaymentColumnSlots) return [];
    return kpiPaymentColumnSlots.map((slot, i) => ({
      key: i === 0 ? "__total__" : `pay-${normTrim(slot.title).replace(/\s+/g, "_")}`,
      title: slot.title,
      amount: slot.amount,
      empty: slot.empty,
      isTotal: i === 0
    }));
  }, [kpiPaymentColumnSlots]);

  const analyticsRows = useMemo(() => {
    if (!dataQ.data) return [];
    const tab = analyticsTab ?? "category";
    if (tab === "group") return dataQ.data.product_analytics.by_group;
    if (tab === "brand") return dataQ.data.product_analytics.by_brand;
    return dataQ.data.product_analytics.by_category;
  }, [dataQ.data, analyticsTab]);

  const resolveTerritoryDisplay = useMemo(
    () =>
      createTerritoryLabelResolver({
        zones: clientRefs?.zones,
        region_options: (clientRefs?.region_options ?? [])
          .filter((o): o is { value: string; label?: string | undefined } => Boolean(o?.value))
          .map((o) => ({ value: o.value, label: o.label ?? undefined })),
        city_options: (clientRefs?.city_options ?? [])
          .filter((o): o is { value: string; label?: string | undefined } => Boolean(o?.value))
          .map((o) => ({ value: o.value, label: o.label ?? undefined })),
        territory_nodes: profileRefs?.territory_nodes as TerritoryNode[] | undefined
      }),
    [
      clientRefs?.zones,
      clientRefs?.region_options,
      clientRefs?.city_options,
      profileRefs?.territory_nodes
    ]
  );

  /** Kaskad: «Продажи по товарам» filter-options + mijozlar references (kod → ном) */
  const supervisorTerritoryZoneOptions = useMemo(() => {
    const hasReport = (reportFilters?.territory_1?.length ?? 0) > 0;
    const list = hasReport ? (reportFilters?.territory_1 ?? []) : (clientRefs?.zones ?? []);
    return uniqSortedTerritoryValues(list).map((z) => ({
      value: z,
      label: resolveTerritoryDisplay(z)
    }));
  }, [reportFilters?.territory_1, clientRefs?.zones, resolveTerritoryDisplay]);

  const supervisorTerritoryRegionOptions = useMemo(() => {
    const zones = draft.territory_1_list.map(normTrim).filter(Boolean);
    let rows: string[];
    if (zones.length === 0) {
      const hasReport = (reportFilters?.territory_2?.length ?? 0) > 0;
      rows = hasReport ? (reportFilters?.territory_2 ?? []) : (clientRefs?.regions ?? []);
    } else {
      const acc = new Set<string>();
      for (const z of zones) {
        const chunk =
          recordLookupCi(reportFilters?.regions_by_zone, z) ??
          recordLookupCi(reportFilters?.territory_2_by_1, z) ??
          [];
        for (const r of chunk) acc.add(r);
      }
      rows = [...acc];
      if (rows.length === 0) rows = reportFilters?.territory_2 ?? clientRefs?.regions ?? [];
    }
    return uniqSortedTerritoryValues(rows).map((r) => ({
      value: r,
      label: resolveTerritoryDisplay(r)
    }));
  }, [draft.territory_1_list, reportFilters, clientRefs?.regions, resolveTerritoryDisplay]);

  const supervisorTerritoryCityOptions = useMemo(() => {
    const zones = draft.territory_1_list.map(normTrim).filter(Boolean);
    const regions = draft.territory_2_list.map(normTrim).filter(Boolean);
    let rows: string[];

    if (regions.length === 0) {
      if (zones.length === 0) {
        const hasReport = (reportFilters?.territory_3?.length ?? 0) > 0;
        rows = hasReport ? (reportFilters?.territory_3 ?? []) : (clientRefs?.cities ?? []);
      } else {
        const set = new Set<string>();
        for (const row of reportFilters?.territory_tree ?? []) {
          const rz = normTrim(row.zone);
          const city = normTrim(row.city);
          if (!city) continue;
          if (zones.some((z) => z.toLowerCase() === rz.toLowerCase())) set.add(city);
        }
        rows = [...set];
        if (rows.length === 0) rows = reportFilters?.territory_3 ?? clientRefs?.cities ?? [];
      }
    } else {
      const set = new Set<string>();
      if (zones.length === 0) {
        for (const region of regions) {
          const cities = reportFilters?.territory_3_by_2?.[region] ?? [];
          if (cities.length === 0 && reportFilters?.cities_by_zone_region) {
            const rl = normTrim(region).toLowerCase();
            for (const [k, list] of Object.entries(reportFilters.cities_by_zone_region)) {
              const parts = k.split("|||");
              const kr = normTrim(parts[1] ?? "").toLowerCase();
              if (kr === rl) for (const c of list ?? []) set.add(c);
            }
          } else {
            for (const c of cities) set.add(c);
          }
        }
      } else {
        for (const region of regions) {
          for (const z of zones) {
            const zoneKey = normTrim(z);
            const key = `${zoneKey}|||${region}`;
            let cities = recordLookupCi(reportFilters?.cities_by_zone_region, key) ?? [];
            if (cities.length === 0 && reportFilters?.cities_by_zone_region) {
              const rl = normTrim(region).toLowerCase();
              const zl = zoneKey.toLowerCase();
              for (const [k, list] of Object.entries(reportFilters.cities_by_zone_region)) {
                const parts = k.split("|||");
                const kz = normTrim(parts[0] ?? "").toLowerCase();
                const kr = normTrim(parts[1] ?? "").toLowerCase();
                if (kr === rl && kz === zl) {
                  cities = list ?? [];
                  if (cities.length) break;
                }
              }
            }
            if (cities.length === 0 && reportFilters?.territory_tree?.length) {
              cities = reportFilters.territory_tree
                .filter((x) => {
                  const regionOk = normTrim(x.region).toLowerCase() === normTrim(region).toLowerCase();
                  const zoneOk = normTrim(x.zone).toLowerCase() === zoneKey.toLowerCase();
                  return regionOk && zoneOk;
                })
                .map((x) => x.city)
                .filter(Boolean) as string[];
            }
            if (cities.length === 0) cities = reportFilters?.territory_3_by_2?.[region] ?? [];
            for (const c of cities) set.add(c);
          }
        }
      }
      rows = [...set];
      if (rows.length === 0) rows = [...(reportFilters?.territory_3 ?? clientRefs?.cities ?? [])];
    }

    return uniqSortedTerritoryValues(rows).map((c) => ({
      value: c,
      label: resolveTerritoryDisplay(c)
    }));
  }, [
    draft.territory_1_list,
    draft.territory_2_list,
    reportFilters,
    clientRefs?.cities,
    resolveTerritoryDisplay
  ]);

  const categoryFilterOptions = useMemo(() => {
    const fromReport = reportFilters?.categories ?? [];
    if (fromReport.length > 0) {
      return fromReport.map((c) => ({ value: c.name, label: c.name }));
    }
    return categoryOptions.map((c) => ({ value: c, label: c }));
  }, [reportFilters?.categories, categoryOptions]);

  const tradeDirectionFilterOptions = useMemo(() => {
    const fromReport = reportFilters?.trade_directions ?? [];
    if (fromReport.length > 0) {
      return fromReport.map((t) => ({
        value: t.name,
        label: t.name,
        searchText: [t.name, t.code].filter((x) => x != null && String(x).trim()).join(" ")
      }));
    }
    return (profileRefs?.trade_directions ?? []).map((t) => ({
      value: t,
      label: t,
      searchText: t
    }));
  }, [reportFilters?.trade_directions, profileRefs?.trade_directions]);

  const agentPickOptions = useMemo((): StaffPick[] => {
    const a = reportFilters?.agents;
    if (a?.length) return a.map((x) => ({ id: x.id, fio: x.name, code: x.code }));
    return agents ?? [];
  }, [reportFilters?.agents, agents]);

  const supervisorPickOptions = useMemo((): StaffPick[] => {
    const s = reportFilters?.supervisors;
    if (s?.length) return s.map((x) => ({ id: x.id, fio: x.name, code: x.code }));
    return supervisors ?? [];
  }, [reportFilters?.supervisors, supervisors]);

  const filterRowSelect = cn(filterSelectClassName, FILTER_TRIGGER);

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

  const applyFilters = useMemo(
    () => () =>
      setApplied({
        ...draft,
        supervisor_ids: selfSupervisorIdStr ? [selfSupervisorIdStr] : draft.supervisor_ids
      }),
    [draft, selfSupervisorIdStr]
  );

  const effRows =
    effTab === "supervisors"
      ? (dataQ.data?.efficiency_report.by_supervisors ?? [])
      : (dataQ.data?.efficiency_report.by_agents ?? []);

  const productMatrixBlock =
    productTab === "group"
      ? dataQ.data?.product_matrix.by_group
      : productTab === "brand"
        ? dataQ.data?.product_matrix.by_brand
        : dataQ.data?.product_matrix.by_category;
  const productMatrixRows =
    productAxis === "supervisors"
      ? (productMatrixBlock?.by_supervisors ?? [])
      : (productMatrixBlock?.by_agents ?? []);
  const productFiltered = productMatrixRows.filter((r) =>
    !productSearch.trim() || r.name.toLowerCase().includes(productSearch.trim().toLowerCase())
  );
  const visitTotalPages = Math.max(1, Math.ceil((visitsQ.data?.total ?? 0) / visitLimit));
  const visitFiltered = (dataQ.data?.visit_report.rows ?? []).filter((r) => {
    const q = visitSearch.trim().toLowerCase();
    if (!q) return true;
    const label = visitAgentLabel(r).toLowerCase();
    const code = (r.agent_code ?? "").toLowerCase();
    return label.includes(q) || code.includes(q) || String(r.agent_id).includes(q);
  });
  const effFiltered = effRows.filter((r) =>
    !effSearch.trim() || r.name.toLowerCase().includes(effSearch.trim().toLowerCase())
  );
  const productPaged = paginateRows(productFiltered, productPage, productLimit);
  const visitPaged = { rows: visitFiltered, page: visitPage, totalPages: visitTotalPages };
  const effPaged = paginateRows(effFiltered, effPage, effLimit);

  const toggleSection = (key: Exclude<CollapsibleSection, null>) => {
    setActiveSection((prev) => (prev === key ? null : key));
  };

  useEffect(() => {
    setProductPage(1);
  }, [productTab]);

  useEffect(() => {
    setProductPage(1);
  }, [productAxis, productMetric]);

  useEffect(() => {
    setProductPage(1);
  }, [productSearch]);

  useEffect(() => {
    setVisitPage(1);
  }, [visitSearch]);

  useEffect(() => {
    setEffPage(1);
  }, [effSearch]);

  useEffect(() => {
    setEffPage(1);
  }, [effTab]);

  useEffect(() => {
    if (dataQ.data && activeSection === null) {
      setActiveSection("analytics");
    }
  }, [dataQ.data, activeSection]);

  return (
    <PageShell className="max-w-none space-y-5">
      <PageHeader
        className="border-b border-border/60 pb-5 dark:border-border/80"
        title={<span className="text-2xl font-bold tracking-tight">{headerTitle}</span>}
        description={<span className="text-sm text-muted-foreground">{headerDescription}</span>}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              ref={datePickerAnchorRef}
              type="button"
              className="inline-flex h-9 min-w-[10.5rem] items-center justify-between gap-2 rounded-md border border-input px-3 text-xs font-medium hover:bg-muted"
              onClick={() => setDatePickerOpen((v) => !v)}
              aria-expanded={datePickerOpen}
              aria-haspopup="dialog"
            >
              <span>{formatRuDateButton(draft.date) || "дд.мм.гггг"}</span>
              <CalendarDays className="h-3.5 w-3.5 opacity-70" />
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-md border border-input px-3 text-xs font-medium hover:bg-muted"
              onClick={() => {
                const fresh = emptyFilters(selfSupervisorIdStr);
                setDraft(fresh);
                setApplied(fresh);
              }}
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
          </div>
        }
      />

      {!hydrated ? (
        <p className="text-sm text-muted-foreground">Загрузка сессии…</p>
      ) : !tenantSlug ? (
        <p className="text-sm text-destructive">Сессия не найдена. Войдите заново.</p>
      ) : (
        <div className="space-y-5">
          <div className="border-b border-border pb-4">
            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
              <div className="min-w-0">
                <SupervisorDashboardMultiFilter
                  placeholder="Способ оплаты (заказ)"
                  searchPlaceholder="Оплата"
                  triggerClassName={filterRowSelect}
                  items={paymentFilterOptions.map((p) => ({ id: p.value, title: p.label }))}
                  selectedValues={draft.payment_types}
                  onChange={(next) => setDraft((p) => ({ ...p, payment_types: next }))}
                />
              </div>
              <div className="min-w-0">
                <SupervisorDashboardMultiFilter
                  placeholder="Агент"
                  searchPlaceholder="Агент"
                  triggerClassName={filterRowSelect}
                  items={agentPickOptions.map((a) => staffDashboardMultiItem(a))}
                  selectedValues={draft.agent_ids}
                  onChange={(next) => setDraft((p) => ({ ...p, agent_ids: next }))}
                />
              </div>
              <div className="min-w-0">
                <SupervisorDashboardMultiFilter
                  placeholder={selfSupervisorIdStr ? "Только вы" : "Супервайзер"}
                  searchPlaceholder="Супервайзер"
                  triggerClassName={filterRowSelect}
                  disabled={Boolean(selfSupervisorIdStr)}
                  items={supervisorPickOptions.map((a) => staffDashboardMultiItem(a))}
                  selectedValues={draft.supervisor_ids}
                  onChange={(next) => setDraft((p) => ({ ...p, supervisor_ids: next }))}
                />
              </div>
              <div className="min-w-0">
                <SupervisorDashboardMultiFilter
                  placeholder="Направление торговли"
                  searchPlaceholder="Направление"
                  triggerClassName={filterRowSelect}
                  items={tradeDirectionFilterOptions.map((t) => ({
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
                  placeholder="Категория"
                  searchPlaceholder="Категория"
                  triggerClassName={filterRowSelect}
                  items={categoryFilterOptions.map((c) => ({ id: c.value, title: c.label }))}
                  selectedValues={draft.client_categories}
                  onChange={(next) => setDraft((p) => ({ ...p, client_categories: next }))}
                />
              </div>
              <div className="min-w-0">
                <SupervisorDashboardMultiFilter
                  placeholder="Зона"
                  searchPlaceholder="Зона"
                  triggerClassName={filterRowSelect}
                  items={supervisorTerritoryZoneOptions.map((o) => ({ id: o.value, title: o.label }))}
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
                  triggerClassName={filterRowSelect}
                  items={supervisorTerritoryRegionOptions.map((o) => ({ id: o.value, title: o.label }))}
                  selectedValues={draft.territory_2_list}
                  onChange={(next) => setDraft((p) => ({ ...p, territory_2_list: next, territory_3_list: [] }))}
                />
              </div>
              <div className="min-w-0">
                <SupervisorDashboardMultiFilter
                  placeholder="Город"
                  searchPlaceholder="Город"
                  triggerClassName={filterRowSelect}
                  items={supervisorTerritoryCityOptions.map((o) => ({ id: o.value, title: o.label }))}
                  selectedValues={draft.territory_3_list}
                  onChange={(next) => setDraft((p) => ({ ...p, territory_3_list: next }))}
                />
              </div>
            </div>
          </div>
          <DatePickerPopover
            open={datePickerOpen}
            onOpenChange={setDatePickerOpen}
            anchorRef={datePickerAnchorRef as RefObject<HTMLElement | null>}
            value={draft.date}
            onChange={(iso) => setDraft((p) => ({ ...p, date: iso || localYmd(new Date()) }))}
          />

          {dataQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка KPI…</p>
          ) : null}
          {dataQ.isError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              Не удалось загрузить дашборд.
            </div>
          ) : null}

          {dataQ.data ? (
            <>
              {enterprisePaymentSlots.length > 0 ? (
                <SupervisorEnterpriseKpiPanel
                  paymentSlots={enterprisePaymentSlots}
                  visitKpi={dataQ.data.kpi}
                  salesPlanKpi={{
                    planSum: dataQ.data.kpi.monthly_kpi_plan_sum ?? "0",
                    factMtdSum: dataQ.data.kpi.monthly_kpi_fact_mtd_sum ?? "0",
                    executionPct: dataQ.data.kpi.monthly_kpi_execution_pct ?? null
                  }}
                />
              ) : null}

              <SupervisorEnterpriseSection
                title="Ключевые показатели"
                subtitle="Доля, сумма и АКБ по ассортименту"
                icon={<TrendingUp className="h-4 w-4 text-teal-600" aria-hidden />}
                iconClassName="bg-teal-50 text-teal-600 dark:bg-teal-950/40"
                expanded={activeSection === "analytics"}
                onToggle={() => toggleSection("analytics")}
                headerExtra={
                  <SupervisorEnterpriseSegmentTabs
                    tabs={[
                      { key: "category", label: "По категории продуктов" },
                      { key: "group", label: "По группам товаров" },
                      { key: "brand", label: "По брендам" }
                    ]}
                    value={analyticsTab ?? "category"}
                    onChange={setAnalyticsTab}
                  />
                }
              >
                {productsQ.isLoading && activeSection === "analytics" ? (
                  <p className="text-sm text-muted-foreground">Загрузка аналитики…</p>
                ) : (
                  <SupervisorProductAnalyticsTable
                    rows={analyticsRows}
                    dimensionLabel={analyticsDimensionLabel(analyticsTab ?? "category")}
                  />
                )}
              </SupervisorEnterpriseSection>

              <SupervisorEnterpriseSection
                title="Продажа по категории продуктов"
                subtitle="Матрица по агентам и супервайзерам"
                icon={<Package className="h-4 w-4 text-indigo-600" aria-hidden />}
                iconClassName="bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40"
                expanded={activeSection === "products"}
                onToggle={() => toggleSection("products")}
              >
                {activeSection === "products" ? (
                <div className="space-y-4">
                  <SupervisorEnterpriseSegmentTabs
                    tabs={[
                      { key: "category", label: "По категории продуктов" },
                      { key: "group", label: "По группам товаров" },
                      { key: "brand", label: "По брендам" }
                    ]}
                    value={productTab ?? "category"}
                    onChange={setProductTab}
                  />
                  <SupervisorEnterpriseToolbar
                    pageSize={productLimit}
                    onPageSizeChange={(n) => {
                      setProductLimit(n);
                      setProductPage(1);
                    }}
                    search={productSearch}
                    onSearchChange={setProductSearch}
                    onExcel={() =>
                      exportRowsToXlsx(
                        toProductExportRows(
                          productFiltered,
                          productMatrixBlock?.dimensions ?? [],
                          productMetric ?? "revenue"
                        ),
                        "po-kategorii-produktov.xlsx"
                      )
                    }
                    totalCount={productFiltered.length}
                  />
                  {renderProductMatrixBlock(
                    productPaged.rows,
                    productMatrixBlock?.dimensions ?? [],
                    productAxis ?? "agents",
                    productMetric ?? "revenue",
                    setProductAxis,
                    setProductMetric
                  )}
                  <SupervisorEnterprisePager
                    page={productPaged.page}
                    totalPages={productPaged.totalPages}
                    totalRows={productFiltered.length}
                    pageSize={productLimit}
                    onPage={setProductPage}
                  />
                </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Нажмите заголовок, чтобы загрузить матрицу.</p>
                )}
              </SupervisorEnterpriseSection>

              <SupervisorEnterpriseSection
                title="Дневной отчет по визитам"
                subtitle="План и вне плана по агентам"
                icon={<Users className="h-4 w-4 text-blue-600" aria-hidden />}
                iconClassName="bg-blue-50 text-blue-600 dark:bg-blue-950/40"
                expanded={activeSection === "visits"}
                onToggle={() => toggleSection("visits")}
              >
                {activeSection === "visits" ? (
                <div>
                  <SupervisorEnterpriseToolbar
                    pageSize={visitLimit}
                    onPageSizeChange={(n) => {
                      setVisitLimit(n);
                      setVisitPage(1);
                    }}
                    search={visitSearch}
                    onSearchChange={setVisitSearch}
                    searchPlaceholder="Поиск по агенту"
                    onExcel={() => {
                      const totals = dataQ.data?.visit_report.totals;
                      if (!totals) return;
                      void exportVisitReportToXlsx(visitFiltered, totals, "dnevnoy-otchet-po-vizitam.xlsx");
                    }}
                    onRefresh={() => void dataQ.refetch()}
                    refreshing={dataQ.isFetching}
                    totalCount={visitFiltered.length}
                  />
                  {renderDailyVisitReportTable(visitPaged.rows, dataQ.data.visit_report.totals)}
                  <SupervisorEnterprisePager
                    page={visitPaged.page}
                    totalPages={visitPaged.totalPages}
                    totalRows={visitFiltered.length}
                    pageSize={visitLimit}
                    onPage={setVisitPage}
                  />
                </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Нажмите заголовок, чтобы открыть отчёт.</p>
                )}
              </SupervisorEnterpriseSection>

              <SupervisorEnterpriseSection
                title="Отчет по эффективности"
                subtitle="Торговые агенты и супервайзеры"
                icon={<BarChart3 className="h-4 w-4 text-violet-600" aria-hidden />}
                iconClassName="bg-violet-50 text-violet-600 dark:bg-violet-950/40"
                expanded={activeSection === "efficiency"}
                onToggle={() => toggleSection("efficiency")}
              >
                {activeSection === "efficiency" ? (
                <div className="space-y-4">
                  <SupervisorEnterpriseSegmentTabs
                    tabs={[
                      { key: "agents", label: "Торговые агенты" },
                      { key: "supervisors", label: "Супервайзеры" }
                    ]}
                    value={effTab ?? "agents"}
                    onChange={setEffTab}
                  />
                  <SupervisorEnterpriseToolbar
                    pageSize={effLimit}
                    onPageSizeChange={(n) => {
                      setEffLimit(n);
                      setEffPage(1);
                    }}
                    search={effSearch}
                    onSearchChange={setEffSearch}
                    onExcel={() => exportRowsToXlsx(effFiltered, "torgovye-agenty.xlsx")}
                    totalCount={effFiltered.length}
                  />
                  {renderEfficiencyTable(effPaged.rows, {
                    agentsOnly: effTab === "agents",
                    onPhotoReportClick: (row) => {
                      setPhotoReportTarget({
                        agentId: row.id,
                        agentName: row.name,
                        agentCode: row.agent_code,
                        photoOutlets: row.photo_outlets,
                        photoCount: row.photo_count
                      });
                      setPhotoReportOpen(true);
                    }
                  })}
                  <SupervisorEnterprisePager
                    page={effPaged.page}
                    totalPages={effPaged.totalPages}
                    totalRows={effFiltered.length}
                    pageSize={effLimit}
                    onPage={setEffPage}
                  />
                </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Нажмите заголовок, чтобы открыть отчёт.</p>
                )}
              </SupervisorEnterpriseSection>
            </>
          ) : null}
        </div>
      )}
      <SupervisorPhotoReportModal
        open={photoReportOpen}
        onOpenChange={(next) => {
          setPhotoReportOpen(next);
          if (!next) setPhotoReportTarget(null);
        }}
        tenantSlug={tenantSlug ?? ""}
        filters={applied}
        target={photoReportTarget}
      />
    </PageShell>
  );
}

function paginateRows<T>(rows: T[], page: number, limit: number): { rows: T[]; page: number; totalPages: number } {
  const safeLimit = Math.min(100, Math.max(1, limit || 20));
  const totalPages = Math.max(1, Math.ceil(rows.length / safeLimit));
  const safePage = Math.min(totalPages, Math.max(1, page || 1));
  const from = (safePage - 1) * safeLimit;
  return {
    rows: rows.slice(from, from + safeLimit),
    page: safePage,
    totalPages
  };
}

function exportRowsToXlsx(rows: Array<Record<string, unknown>>, filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, filename);
}

function toProductExportRows(
  rows: ProductMatrixActorRow[],
  dimensions: string[],
  metric: string
): Array<Record<string, unknown>> {
  return rows.map((row) => {
    const out: Record<string, unknown> = { actor: row.name };
    for (const d of dimensions) {
      const v = row.values[d];
      if (!v) out[d] = 0;
      else if (metric === "akb") out[d] = v.akb;
      else if (metric === "quantity") out[d] = v.quantity;
      else if (metric === "orders") out[d] = v.orders;
      else out[d] = v.revenue;
    }
    return out;
  });
}

function renderProductMatrixBlock(
  rows: ProductMatrixActorRow[],
  dimensions: string[],
  axis: string,
  metric: string,
  setAxis: (value: string | null) => void,
  setMetric: (value: string | null) => void
) {
  const metricTitle =
    metric === "akb" ? "АКБ" : metric === "quantity" ? "Объем" : metric === "orders" ? "Количество" : "Сумма";
  const actorLabel = axis === "supervisors" ? "Супервайзеры" : "Агенты";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SupervisorEnterpriseSegmentTabs
          tabs={[
            { key: "agents", label: "По агентам" },
            { key: "supervisors", label: "По супервайзерам" }
          ]}
          value={axis}
          onChange={setAxis}
        />
        <SupervisorEnterpriseSegmentTabs
          tabs={[
            { key: "akb", label: "АКБ" },
            { key: "quantity", label: "Объем" },
            { key: "revenue", label: "Сумма" },
            { key: "orders", label: "Количество" }
          ]}
          value={metric}
          onChange={setMetric}
        />
      </div>
      <SupervisorEnterpriseTableWrap>
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="bg-muted/80 dark:bg-muted/50">
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {actorLabel}
              </th>
              {dimensions.map((d) => (
                <th
                  key={d}
                  className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border dark:divide-border">
            {rows.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-teal-50/40 dark:hover:bg-teal-950/20">
                <td className="px-5 py-3.5 font-medium text-foreground">{r.name}</td>
                {dimensions.map((d) => {
                  const cell = r.values[d];
                  let value = "0";
                  if (cell) {
                    if (metric === "akb") value = String(cell.akb);
                    else if (metric === "quantity") value = formatNumberGrouped(cell.quantity, { maxFractionDigits: 3 });
                    else if (metric === "orders") value = String(cell.orders);
                    else value = formatNumberGrouped(cell.revenue, { maxFractionDigits: 2 });
                  }
                  return (
                    <td key={`${r.id}-${d}`} className="px-5 py-3.5 text-right tabular-nums">
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td
                  className="px-5 py-8 text-center text-muted-foreground"
                  colSpan={Math.max(2, dimensions.length + 1)}
                >
                  Пусто ({metricTitle})
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </SupervisorEnterpriseTableWrap>
    </div>
  );
}

function renderEfficiencyTable(
  rows: EfficiencyRow[],
  opts?: {
    agentsOnly?: boolean;
    onPhotoReportClick?: (row: EfficiencyRow) => void;
  }
) {
  const agentsOnly = opts?.agentsOnly ?? false;
  const onPhotoReportClick = opts?.onPhotoReportClick;

  return (
    <SupervisorEnterpriseTableWrap>
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="bg-muted/80 dark:bg-muted/50">
            <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Сотрудник
            </th>
            <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Заказы
            </th>
            <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              План
            </th>
            <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Визиты
            </th>
            <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Отказы
            </th>
            <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Непосещено
            </th>
            <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Посещения %
            </th>
            <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Фотоотчет
            </th>
            <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Сумма
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border dark:divide-border">
          {rows.map((r) => {
            const outlets = r.photo_outlets ?? r.photo_reports ?? 0;
            const photoCount = r.photo_count ?? r.photo_reports ?? 0;
            const photoLabel = formatPhotoReportCell(outlets, photoCount);
            const photoClickable = agentsOnly && photoCount > 0 && onPhotoReportClick != null;

            return (
            <tr key={r.id} className="transition-colors hover:bg-teal-50/40 dark:hover:bg-teal-950/20">
              <td className="px-5 py-3.5 font-medium text-foreground">{r.name}</td>
              <td className="px-5 py-3.5 text-right tabular-nums">{r.order_count}</td>
              <td className="px-5 py-3.5 text-right tabular-nums">{r.planned_visits}</td>
              <td className="px-5 py-3.5 text-right tabular-nums">{r.visited_total}</td>
              <td className="px-5 py-3.5 text-right tabular-nums">{r.rejected_visits}</td>
              <td className="px-5 py-3.5 text-right tabular-nums">{r.unvisited}</td>
              <td className="px-5 py-3.5 text-right tabular-nums">{r.visit_pct}%</td>
              <td className="px-5 py-3.5 text-right tabular-nums">
                {photoClickable ? (
                  <button
                    type="button"
                    onClick={() => onPhotoReportClick(r)}
                    className="text-teal-600 hover:text-teal-500 hover:underline dark:text-teal-400"
                  >
                    {photoLabel}
                  </button>
                ) : (
                  <span className="text-muted-foreground">{photoLabel}</span>
                )}
              </td>
              <td className="px-5 py-3.5 text-right font-semibold tabular-nums">
                {formatNumberGrouped(r.total_sales_sum, { maxFractionDigits: 2 })}
              </td>
            </tr>
            );
          })}
          {rows.length === 0 ? (
            <tr>
              <td className="px-5 py-8 text-center text-muted-foreground" colSpan={9}>
                Пусто
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </SupervisorEnterpriseTableWrap>
  );
}
