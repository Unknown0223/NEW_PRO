"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { SupervisorDashboardMultiFilter } from "@/components/dashboard/supervisor-dashboard-multi-filter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePickerPopover, formatRuDateButton } from "@/components/ui/date-picker-popover";
import { filterSelectClassName } from "@/components/ui/filter-select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  CalendarDays,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  Loader2,
  RotateCcw,
  Search
} from "lucide-react";
import { localYmd } from "@/components/ui/date-picker-popover";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { STALE } from "@/lib/query-stale";
import {
  qkDashboardAgentsActive,
  qkDashboardClientReferences,
  qkDashboardSupervisorsActive
} from "@/lib/dashboard-shared-query-keys";
import { staffDashboardMultiItem } from "@/lib/order-picker-labels";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import * as XLSX from "xlsx";

type StaffPick = { id: number; fio: string; code?: string | null };
type SupervisorFilterDraft = SupervisorDashboardQueryInput;

type SupervisorDashboardData = {
  kpi: {
    total_sales_sum: string;
    cash_sales_sum: string;
    sales_by_payment_method: Array<{ method: string; sum: string }>;
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

const KPI_PAY_STRIP_BG = [
  "bg-teal-600",
  "bg-emerald-600",
  "bg-amber-500",
  "bg-violet-600",
  "bg-sky-600"
] as const;

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

function KpiPaymentStripCard(props: {
  title: string;
  amount: string;
  headerBgClass: string;
  empty?: boolean;
  /** «По плану» bilan bir xil fon (Общая сумма) */
  headerMatchPlan?: boolean;
  compact?: boolean;
}) {
  const muted = Boolean(props.empty);
  const c = props.compact;
  return (
    <div
      className={cn("flex flex-col overflow-hidden rounded-md border border-border/60 shadow-sm", muted && "opacity-70")}
    >
      <div
        className={cn(
          "text-center font-semibold uppercase leading-tight tracking-wide",
          c ? "px-1.5 py-1 text-[10px]" : "px-2 py-2 text-[11px]",
          props.headerMatchPlan ? "kpi-supervisor-strip-total" : cn("text-white", props.headerBgClass)
        )}
      >
        {props.title}
      </div>
      <div
        className={cn(
          "bg-card text-center font-semibold tabular-nums text-foreground",
          c ? "px-1.5 py-1.5 text-sm sm:text-[0.95rem]" : "px-2 py-3 text-base sm:text-lg"
        )}
      >
        {muted ? "—" : formatNumberGrouped(props.amount, { maxFractionDigits: 2 })}
      </div>
    </div>
  );
}

type VisitReportXlsxMerge = { s: { r: number; c: number }; e: { r: number; c: number } };

function visitReportParseNum(v: string | number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const t = String(v ?? "0").replace(/\s/g, "").replace(",", ".");
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

/** 0% — qizil; keyin tezroq sariq → boy yashil (hue ~162). */
function kpiPercentCardStyle(pct: number): CSSProperties {
  const tLin = Math.min(100, Math.max(0, Number.isFinite(pct) ? pct : 0)) / 100;
  const t = Math.pow(tLin, 0.68);
  let hue: number;
  if (t <= 0.42) {
    hue = (t / 0.42) * 48;
  } else {
    hue = 48 + ((t - 0.42) / 0.58) * (162 - 48);
  }
  const sat = 58 + tLin * 22;
  const light = 90 - tLin * 5;
  const borderL = Math.max(56, light - 13);
  return {
    backgroundColor: `hsl(${hue} ${sat}% ${light}%)`,
    borderColor: `hsl(${hue} ${Math.min(90, sat + 5)}% ${borderL}%)`
  };
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
    <div className="supervisor-visit-report">
      <table className="w-full min-w-[1100px] border-collapse text-sm">
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
    </div>
  );
}

type EfficiencyRow = {
  id: number;
  name: string;
  order_count: number;
  cancelled_count: number;
  planned_visits: number;
  visited_total: number;
  rejected_visits: number;
  unvisited: number;
  visit_pct: number;
  photo_reports: number;
  total_sales_sum: string;
};

type CollapsibleSection = "products" | "visits" | "efficiency" | null;

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
  const [productAxis, setProductAxis] = useState<string | null>("agents");
  const [productMetric, setProductMetric] = useState<string | null>("revenue");
  const [effTab, setEffTab] = useState<string | null>("agents");
  const [activeSection, setActiveSection] = useState<CollapsibleSection>("products");
  const [productPage, setProductPage] = useState(1);
  const [productLimit, setProductLimit] = useState(20);
  const [productSearch, setProductSearch] = useState("");
  const [visitPage, setVisitPage] = useState(1);
  const [visitLimit, setVisitLimit] = useState(10);
  const [visitSearch, setVisitSearch] = useState("");
  const [effPage, setEffPage] = useState(1);
  const [effLimit, setEffLimit] = useState(20);
  const [effSearch, setEffSearch] = useState("");
  const datePickerAnchorRef = useRef<HTMLButtonElement | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const selfSupervisorId = useMemo(
    () => (role === "supervisor" ? decodeAccessTokenSub(accessToken) : null),
    [role, accessToken]
  );
  const selfSupervisorIdStr = selfSupervisorId != null ? String(selfSupervisorId) : "";

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
    queryKey: ["dashboard-supervisor", "profile", tenantSlug],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{
        references?: {
          payment_method_entries?: Array<{ id: string; name: string; active?: boolean; code?: string | null }>;
          payment_types?: string[];
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
        region_options?: Array<{ value?: string; label?: string }>;
        city_options?: Array<{ value?: string; label?: string }>;
      }>(`/api/${tenantSlug}/clients/references`);
      return data;
    }
  });

  const productSalesFiltersQ = useQuery({
    queryKey: ["dashboard-supervisor", "product-sales-filter-options", tenantSlug],
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

  const effectiveQs = useMemo(() => buildSupervisorDashboardQueryString(applied), [applied]);

  const dataQ = useQuery({
    queryKey: ["dashboard-supervisor", tenantSlug, effectiveQs],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.live,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
    queryFn: async () => {
      const { data } = await api.get<SupervisorDashboardData>(`/api/${tenantSlug}/dashboard/supervisor?${effectiveQs}`);
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
    const fromEntries = (profileQ.data?.payment_method_entries ?? [])
      .filter((p) => p?.active !== false)
      .map((p) => {
        const id = String(p.id ?? "").trim();
        const label = String(p.name ?? "").trim();
        const code = typeof p.code === "string" ? p.code.trim() : "";
        return { value: id, label, code };
      })
      .filter((p) => p.value && p.label);
    if (fromEntries.length > 0) return fromEntries;
    const legacy = (profileQ.data?.payment_types ?? [])
      .map((x) => String(x).trim())
      .filter(Boolean)
      .map((x) => ({ value: x, label: x, code: "" as const }));
    return legacy;
  }, [profileQ.data]);

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
    const entries = profileQ.data?.payment_method_entries;
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
  }, [dataQ.data, paymentFilterOptions, profileQ.data?.payment_method_entries]);

  const resolveTerritoryDisplay = useMemo(
    () =>
      createTerritoryLabelResolver({
        zones: clientRefsQ.data?.zones,
        region_options: (clientRefsQ.data?.region_options ?? [])
          .filter((o): o is { value: string; label?: string | undefined } => Boolean(o?.value))
          .map((o) => ({ value: o.value, label: o.label ?? undefined })),
        city_options: (clientRefsQ.data?.city_options ?? [])
          .filter((o): o is { value: string; label?: string | undefined } => Boolean(o?.value))
          .map((o) => ({ value: o.value, label: o.label ?? undefined })),
        territory_nodes: profileQ.data?.territory_nodes as TerritoryNode[] | undefined
      }),
    [
      clientRefsQ.data?.zones,
      clientRefsQ.data?.region_options,
      clientRefsQ.data?.city_options,
      profileQ.data?.territory_nodes
    ]
  );

  /** Kaskad: «Продажи по товарам» filter-options + mijozlar references (kod → ном) */
  const supervisorTerritoryZoneOptions = useMemo(() => {
    const hasReport = (reportFilters?.territory_1?.length ?? 0) > 0;
    const list = hasReport ? (reportFilters?.territory_1 ?? []) : (clientRefsQ.data?.zones ?? []);
    return uniqSortedTerritoryValues(list).map((z) => ({
      value: z,
      label: resolveTerritoryDisplay(z)
    }));
  }, [reportFilters?.territory_1, clientRefsQ.data?.zones, resolveTerritoryDisplay]);

  const supervisorTerritoryRegionOptions = useMemo(() => {
    const zones = draft.territory_1_list.map(normTrim).filter(Boolean);
    let rows: string[];
    if (zones.length === 0) {
      const hasReport = (reportFilters?.territory_2?.length ?? 0) > 0;
      rows = hasReport ? (reportFilters?.territory_2 ?? []) : (clientRefsQ.data?.regions ?? []);
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
      if (rows.length === 0) rows = reportFilters?.territory_2 ?? clientRefsQ.data?.regions ?? [];
    }
    return uniqSortedTerritoryValues(rows).map((r) => ({
      value: r,
      label: resolveTerritoryDisplay(r)
    }));
  }, [draft.territory_1_list, reportFilters, clientRefsQ.data?.regions, resolveTerritoryDisplay]);

  const supervisorTerritoryCityOptions = useMemo(() => {
    const zones = draft.territory_1_list.map(normTrim).filter(Boolean);
    const regions = draft.territory_2_list.map(normTrim).filter(Boolean);
    let rows: string[];

    if (regions.length === 0) {
      if (zones.length === 0) {
        const hasReport = (reportFilters?.territory_3?.length ?? 0) > 0;
        rows = hasReport ? (reportFilters?.territory_3 ?? []) : (clientRefsQ.data?.cities ?? []);
      } else {
        const set = new Set<string>();
        for (const row of reportFilters?.territory_tree ?? []) {
          const rz = normTrim(row.zone);
          const city = normTrim(row.city);
          if (!city) continue;
          if (zones.some((z) => z.toLowerCase() === rz.toLowerCase())) set.add(city);
        }
        rows = [...set];
        if (rows.length === 0) rows = reportFilters?.territory_3 ?? clientRefsQ.data?.cities ?? [];
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
      if (rows.length === 0) rows = [...(reportFilters?.territory_3 ?? clientRefsQ.data?.cities ?? [])];
    }

    return uniqSortedTerritoryValues(rows).map((c) => ({
      value: c,
      label: resolveTerritoryDisplay(c)
    }));
  }, [
    draft.territory_1_list,
    draft.territory_2_list,
    reportFilters,
    clientRefsQ.data?.cities,
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
    return (profileQ.data?.trade_directions ?? []).map((t) => ({
      value: t,
      label: t,
      searchText: t
    }));
  }, [reportFilters?.trade_directions, profileQ.data?.trade_directions]);

  const agentPickOptions = useMemo((): StaffPick[] => {
    const a = reportFilters?.agents;
    if (a?.length) return a.map((x) => ({ id: x.id, fio: x.name, code: x.code }));
    return agentsQ.data ?? [];
  }, [reportFilters?.agents, agentsQ.data]);

  const supervisorPickOptions = useMemo((): StaffPick[] => {
    const s = reportFilters?.supervisors;
    if (s?.length) return s.map((x) => ({ id: x.id, fio: x.name, code: x.code }));
    return supervisorsQ.data ?? [];
  }, [reportFilters?.supervisors, supervisorsQ.data]);

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
  const visitPaged = paginateRows(visitFiltered, visitPage, visitLimit);
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

  return (
    <PageShell>
      <PageHeader
        title={headerTitle}
        description={headerDescription}
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
        <div className="space-y-4">
          <div className="space-y-2 rounded border bg-card p-2">
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

          {dataQ.isLoading ? <p className="text-sm text-muted-foreground">Загрузка данных…</p> : null}
          {dataQ.isError ? <p className="text-sm text-destructive">Не удалось загрузить дашборд.</p> : null}

          {dataQ.data ? (
            <>
              <section className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold tracking-tight">Ключевые показатели</h2>
                  <p className="text-sm text-muted-foreground">Сводка за выбранную дату и фильтры</p>
                </div>
                {kpiPaymentColumnSlots ? (
                  <div className="flex flex-col gap-2">
                    {/* Yuqori: «Общая сумма» + barcha способы оплаты — qator uzunligi tenant sozlamasiga mos */}
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                      {kpiPaymentColumnSlots.map((slot, col) => {
                        const payColorIdx =
                          col === 0 ? 0 : (col - 1) % KPI_PAY_STRIP_BG.length;
                        return (
                        <KpiPaymentStripCard
                          key={`kpi-strip-${col}`}
                          title={slot.title}
                          amount={slot.amount}
                          empty={slot.empty}
                          compact
                          headerMatchPlan={col === 0}
                          headerBgClass={
                            col === 0
                              ? ""
                              : slot.empty
                                ? "bg-muted-foreground/45"
                                : KPI_PAY_STRIP_BG[payColorIdx]!
                          }
                        />
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <Card
                        className="flex min-h-[132px] flex-col border-2 shadow-none transition-[background-color,border-color] duration-300 ease-out"
                        style={kpiPercentCardStyle(dataQ.data.kpi.visit_pct)}
                      >
                        <CardHeader className="flex flex-1 flex-col justify-center space-y-1 pb-2 pt-3">
                          <CardDescription className="text-xs font-medium text-foreground/85">
                            Посещения (по визитам)
                          </CardDescription>
                          <CardTitle className="text-lg font-semibold tabular-nums leading-tight text-foreground sm:text-xl">
                            {dataQ.data.kpi.visit_pct}%
                          </CardTitle>
                          <CardDescription className="text-xs text-foreground/75">
                            План {dataQ.data.kpi.planned_visits} · Факт {dataQ.data.kpi.visited_planned}
                          </CardDescription>
                        </CardHeader>
                      </Card>
                      <Card
                        className="flex min-h-[132px] flex-col border-2 shadow-none transition-[background-color,border-color] duration-300 ease-out"
                        style={kpiPercentCardStyle(dataQ.data.kpi.success_pct)}
                      >
                        <CardHeader className="flex flex-1 flex-col justify-center space-y-1 pb-2 pt-3">
                          <CardDescription className="text-xs font-medium text-foreground/85">Успешные визиты</CardDescription>
                          <CardTitle className="text-lg font-semibold tabular-nums leading-tight text-foreground sm:text-xl">
                            {dataQ.data.kpi.success_pct}%
                          </CardTitle>
                          <CardDescription className="text-xs text-foreground/75">
                            {dataQ.data.kpi.successful_visits} / {dataQ.data.kpi.visited_total}
                          </CardDescription>
                        </CardHeader>
                      </Card>
                      <Card
                        className="flex min-h-[132px] flex-col border-2 shadow-none transition-[background-color,border-color] duration-300 ease-out"
                        style={kpiPercentCardStyle(dataQ.data.kpi.gps_pct)}
                      >
                        <CardHeader className="flex flex-1 flex-col justify-center space-y-1 pb-2 pt-3">
                          <CardDescription className="text-xs font-medium text-foreground/85">Посещения (по GPS)</CardDescription>
                          <CardTitle className="text-lg font-semibold tabular-nums leading-tight text-foreground sm:text-xl">
                            {dataQ.data.kpi.gps_pct}%
                          </CardTitle>
                          <CardDescription className="text-xs text-foreground/75">
                            {dataQ.data.kpi.gps_visits} из {dataQ.data.kpi.planned_visits}
                          </CardDescription>
                        </CardHeader>
                      </Card>
                      <Card
                        className="flex min-h-[132px] flex-col border-2 shadow-none transition-[background-color,border-color] duration-300 ease-out"
                        style={kpiPercentCardStyle(dataQ.data.kpi.photo_pct)}
                      >
                        <CardHeader className="flex flex-1 flex-col justify-center space-y-1 pb-2 pt-3">
                          <CardDescription className="text-xs font-medium text-foreground/85">Фото отчёты</CardDescription>
                          <CardTitle className="text-lg font-semibold tabular-nums leading-tight text-foreground sm:text-xl">
                            {dataQ.data.kpi.photo_pct}%
                          </CardTitle>
                          <CardDescription className="text-xs text-foreground/75">
                            {dataQ.data.kpi.photo_reports} из {dataQ.data.kpi.planned_visits}
                          </CardDescription>
                        </CardHeader>
                      </Card>
                    </div>
                  </div>
                ) : null}
              </section>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => toggleSection("products")}
                      className="flex items-center gap-2 text-left"
                    >
                      {activeSection === "products" ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <div>
                        <CardTitle>Аналитика по продуктам</CardTitle>
                        <CardDescription className="mt-0.5 font-normal">Матрица по категориям, группам и брендам</CardDescription>
                      </div>
                    </button>
                  </div>
                </CardHeader>
                {activeSection === "products" && <CardContent>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground">
                        Строк на странице{" "}
                        <select
                          className="ml-1 h-8 rounded border border-input bg-background px-1 text-xs"
                          value={String(productLimit)}
                          onChange={(e) => {
                            const next = Number.parseInt(e.target.value, 10) || 20;
                            setProductLimit(next);
                            setProductPage(1);
                          }}
                        >
                          {[10, 20, 30, 50, 100].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Input
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Поиск"
                        className="h-8 w-[180px] text-xs"
                      />
                      <button
                        type="button"
                        className="h-8 rounded border border-input bg-background px-2 text-xs hover:bg-muted"
                        onClick={() =>
                          exportRowsToXlsx(
                            toProductExportRows(productFiltered, productMatrixBlock?.dimensions ?? [], productMetric ?? "revenue"),
                            "po-kategorii-produktov.xlsx"
                          )
                        }
                      >
                        Excel
                      </button>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Всего: {productFiltered.length}
                    </span>
                  </div>
                  <Tabs value={productTab} onValueChange={setProductTab}>
                    <TabsList>
                      <TabsTrigger value="category">По категории продуктов</TabsTrigger>
                      <TabsTrigger value="group">По группам товаров</TabsTrigger>
                      <TabsTrigger value="brand">По брендам</TabsTrigger>
                    </TabsList>
                    <TabsContent value="category">
                      {renderProductMatrixBlock(
                        productPaged.rows,
                        productMatrixBlock?.dimensions ?? [],
                        productAxis ?? "agents",
                        productMetric ?? "revenue",
                        setProductAxis,
                        setProductMetric
                      )}
                    </TabsContent>
                    <TabsContent value="group">
                      {renderProductMatrixBlock(
                        productPaged.rows,
                        productMatrixBlock?.dimensions ?? [],
                        productAxis ?? "agents",
                        productMetric ?? "revenue",
                        setProductAxis,
                        setProductMetric
                      )}
                    </TabsContent>
                    <TabsContent value="brand">
                      {renderProductMatrixBlock(
                        productPaged.rows,
                        productMatrixBlock?.dimensions ?? [],
                        productAxis ?? "agents",
                        productMetric ?? "revenue",
                        setProductAxis,
                        setProductMetric
                      )}
                    </TabsContent>
                  </Tabs>
                  {renderPager(productPaged.page, productPaged.totalPages, setProductPage)}
                </CardContent>}
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => toggleSection("visits")}
                      className="flex items-center gap-2 text-left"
                    >
                      {activeSection === "visits" ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <CardTitle>Дневной отчет по визитам</CardTitle>
                    </button>
                  </div>
                </CardHeader>
                {activeSection === "visits" && <CardContent className="overflow-x-auto">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-xs text-muted-foreground">
                        Строк на странице{" "}
                        <select
                          className="ml-1 h-8 rounded border border-input bg-background px-1 text-xs"
                          value={String(visitLimit)}
                          onChange={(e) => {
                            const next = Number.parseInt(e.target.value, 10) || 20;
                            setVisitLimit(next);
                            setVisitPage(1);
                          }}
                        >
                          {[10, 20, 30, 50, 100].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={visitSearch}
                          onChange={(e) => setVisitSearch(e.target.value)}
                          placeholder="Поиск"
                          className="h-8 w-[200px] pl-8 text-xs"
                          aria-label="Поиск по агенту"
                        />
                      </div>
                      <button
                        type="button"
                        className="inline-flex h-8 items-center gap-1 rounded border border-primary/35 bg-primary/10 px-2 text-xs font-medium text-primary hover:bg-primary/15"
                        onClick={() =>
                          exportVisitReportToXlsx(
                            visitFiltered,
                            dataQ.data.visit_report.totals,
                            "dnevnoy-otchet-po-vizitam.xlsx"
                          )
                        }
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5 text-primary" aria-hidden />
                        Excel
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-8 items-center justify-center rounded border border-input bg-background px-2 text-xs hover:bg-muted disabled:opacity-50"
                        disabled={dataQ.isFetching}
                        onClick={() => void dataQ.refetch()}
                        aria-label="Обновить отчёт"
                      >
                        <Loader2 className={`h-3.5 w-3.5 ${dataQ.isFetching ? "animate-spin" : ""}`} />
                      </button>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Всего: {visitFiltered.length}
                    </span>
                  </div>
                  {renderDailyVisitReportTable(visitPaged.rows, dataQ.data.visit_report.totals)}
                  {renderVisitReportPager(
                    visitPaged.page,
                    visitPaged.totalPages,
                    visitFiltered.length,
                    visitLimit,
                    setVisitPage
                  )}
                </CardContent>}
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleSection("efficiency")}
                      className="flex items-center gap-2 text-left"
                    >
                      {activeSection === "efficiency" ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <CardTitle>Отчет по эффективности</CardTitle>
                    </button>
                  </div>
                </CardHeader>
                {activeSection === "efficiency" && <CardContent>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground">
                        Строк на странице{" "}
                        <select
                          className="ml-1 h-8 rounded border border-input bg-background px-1 text-xs"
                          value={String(effLimit)}
                          onChange={(e) => {
                            const next = Number.parseInt(e.target.value, 10) || 20;
                            setEffLimit(next);
                            setEffPage(1);
                          }}
                        >
                          {[10, 20, 30, 50, 100].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Input
                        value={effSearch}
                        onChange={(e) => setEffSearch(e.target.value)}
                        placeholder="Поиск"
                        className="h-8 w-[180px] text-xs"
                      />
                      <button
                        type="button"
                        className="h-8 rounded border border-input bg-background px-2 text-xs hover:bg-muted"
                        onClick={() => exportRowsToXlsx(effFiltered, "torgovye-agenty.xlsx")}
                      >
                        Excel
                      </button>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Всего: {effFiltered.length}
                    </span>
                  </div>
                  <Tabs value={effTab} onValueChange={setEffTab}>
                    <TabsList>
                      <TabsTrigger value="agents">Торговые агенты</TabsTrigger>
                      <TabsTrigger value="supervisors">Супервайзеры</TabsTrigger>
                    </TabsList>
                    <TabsContent value="agents">{renderEfficiencyTable(effPaged.rows)}</TabsContent>
                    <TabsContent value="supervisors">{renderEfficiencyTable(effPaged.rows)}</TabsContent>
                  </Tabs>
                  {renderPager(effPaged.page, effPaged.totalPages, setEffPage)}
                </CardContent>}
              </Card>
            </>
          ) : null}
        </div>
      )}
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

function renderPager(page: number, totalPages: number, onPage: (next: number) => void) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-end gap-2 text-xs">
      <button
        type="button"
        className="h-8 rounded border border-input bg-background px-2 disabled:opacity-50"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Назад
      </button>
      <span className="text-muted-foreground">
        Стр. {page} / {totalPages}
      </span>
      <button
        type="button"
        className="h-8 rounded border border-input bg-background px-2 disabled:opacity-50"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
      >
        Вперёд
      </button>
    </div>
  );
}

/** Shablon: «Показано 1 – 10 / 440», faol sahifa — primary (teal) */
function renderVisitReportPager(
  page: number,
  totalPages: number,
  totalRows: number,
  pageSize: number,
  onPage: (next: number) => void
) {
  const safeSize = Math.max(1, pageSize);
  const from = totalRows === 0 ? 0 : (page - 1) * safeSize + 1;
  const to = totalRows === 0 ? 0 : Math.min(page * safeSize, totalRows);
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">
        Показано {from} – {to} / {totalRows}
      </span>
      {totalPages > 1 ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="h-8 rounded border border-input bg-background px-2 disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            aria-label="Предыдущая страница"
          >
            Назад
          </button>
          <span
            className="inline-flex h-8 min-w-[2.25rem] items-center justify-center rounded-md border border-sidebar-border bg-sidebar px-2 font-semibold text-sidebar-foreground shadow-sm"
            title={`Страница ${page} из ${totalPages}`}
          >
            {page}
          </span>
          <span className="text-muted-foreground">/ {totalPages}</span>
          <button
            type="button"
            className="h-8 rounded border border-input bg-background px-2 disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => onPage(page + 1)}
            aria-label="Следующая страница"
          >
            Вперёд
          </button>
        </div>
      ) : null}
    </div>
  );
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
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={axis} onValueChange={setAxis}>
          <TabsList className="h-8">
            <TabsTrigger value="agents" className="h-6 px-2 text-xs">По агентам</TabsTrigger>
            <TabsTrigger value="supervisors" className="h-6 px-2 text-xs">По супервайзерам</TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs value={metric} onValueChange={setMetric}>
          <TabsList className="h-8">
            <TabsTrigger value="akb" className="h-6 px-2 text-xs">АКБ</TabsTrigger>
            <TabsTrigger value="quantity" className="h-6 px-2 text-xs">Объем</TabsTrigger>
            <TabsTrigger value="revenue" className="h-6 px-2 text-xs">Сумма</TabsTrigger>
            <TabsTrigger value="orders" className="h-6 px-2 text-xs">Количество</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead className="app-table-thead">
            <tr>
              <th className="px-2 py-2 text-left text-xs">{actorLabel}</th>
              {dimensions.map((d) => (
                <th key={d} className="px-2 py-2 text-right text-xs">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/60">
                <td className="px-2 py-1.5">{r.name}</td>
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
                    <td key={`${r.id}-${d}`} className="px-2 py-1.5 text-right tabular-nums">
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="px-2 py-4 text-center text-muted-foreground" colSpan={Math.max(2, dimensions.length + 1)}>
                  Пусто ({metricTitle})
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderEfficiencyTable(rows: EfficiencyRow[]) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead className="app-table-thead">
          <tr>
            <th className="px-2 py-2 text-left text-xs">Сотрудник</th>
            <th className="px-2 py-2 text-right text-xs">Заказы</th>
            <th className="px-2 py-2 text-right text-xs">План</th>
            <th className="px-2 py-2 text-right text-xs">Визиты</th>
            <th className="px-2 py-2 text-right text-xs">Отказы</th>
            <th className="px-2 py-2 text-right text-xs">Непосещено</th>
            <th className="px-2 py-2 text-right text-xs">Посещения %</th>
            <th className="px-2 py-2 text-right text-xs">Фото</th>
            <th className="px-2 py-2 text-right text-xs">Сумма</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/60">
              <td className="px-2 py-1.5">{r.name}</td>
              <td className="px-2 py-1.5 text-right">{r.order_count}</td>
              <td className="px-2 py-1.5 text-right">{r.planned_visits}</td>
              <td className="px-2 py-1.5 text-right">{r.visited_total}</td>
              <td className="px-2 py-1.5 text-right">{r.rejected_visits}</td>
              <td className="px-2 py-1.5 text-right">{r.unvisited}</td>
              <td className="px-2 py-1.5 text-right">{r.visit_pct}%</td>
              <td className="px-2 py-1.5 text-right">{r.photo_reports}</td>
              <td className="px-2 py-1.5 text-right">{formatNumberGrouped(r.total_sales_sum, { maxFractionDigits: 2 })}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td className="px-2 py-4 text-center text-muted-foreground" colSpan={9}>
                Пусто
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
