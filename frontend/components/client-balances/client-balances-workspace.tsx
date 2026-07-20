"use client";

import { ClientBalancesBulkPaymentDialog } from "@/components/client-balances/client-balances-bulk-payment-dialog";
import {
  ClientBalancesFiltersPanel,
  type ClientBalancesFilterForm
} from "@/components/client-balances/client-balances-filters-panel";
import {
  buildConsignmentBalancesQuery,
  ConsignmentBalancesTable,
  downloadConsignmentBalancesExcel
} from "@/components/client-balances/client-balances-consignment-panel";
import {
  CbCheckbox,
  CbPagination,
  CbSummaryCard,
  CbTabButton,
  CbToolButton,
  overdueBadgeClass
} from "@/components/client-balances/client-balances-template-ui";
import { TableColumnSettingsDialog } from "@/components/data-table/table-column-settings-dialog";
import { PageShell } from "@/components/dashboard/page-shell";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { api } from "@/lib/api";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import {
  appendPositiveIntListParam,
  appendStringListParam,
  joinMultiFilterValues,
  pruneToAllowedOptions,
  splitMultiFilterValues
} from "@/lib/client-filter-select-value";
import type {
  AgentBalanceRow,
  ClientBalanceListResponse,
  ClientBalanceRow,
  ClientBalanceTerritoryOptions,
  ClientBalanceViewMode
} from "@/lib/client-balances-types";
import {
  CLIENT_BALANCES_AGENTS_COLUMN_DEFS,
  CLIENT_BALANCES_AGENTS_COLUMN_IDS,
  CLIENT_BALANCES_AGENTS_TABLE_ID,
  CLIENT_BALANCES_CLIENTS_TABLE_ID,
  CLIENT_BALANCES_COLUMN_DEFS,
  CLIENT_BALANCES_COLUMN_IDS,
  CLIENT_BALANCES_CONSIGNMENT_COLUMN_DEFS,
  CLIENT_BALANCES_CONSIGNMENT_COLUMN_IDS,
  CLIENT_BALANCES_CONSIGNMENT_TABLE_ID,
  CLIENT_BALANCES_DEFAULT_HIDDEN,
  CLIENT_BALANCES_DELIVERY_COLUMN_DEFS,
  CLIENT_BALANCES_DELIVERY_COLUMN_IDS,
  CLIENT_BALANCES_DELIVERY_TABLE_ID,
  CLIENT_BALANCES_LEGACY_COLUMN_DEFS,
  CLIENT_BALANCES_LEGACY_COLUMN_IDS,
  CLIENT_BALANCES_LEGACY_TABLE_ID,
  CLIENT_BALANCES_SORT_KEY,
  clientBalancesColLabel,
  formatDebtExcelCell,
  type ClientBalancesColumnId
} from "@/lib/client-balances-table-columns";
import type {
  ConsignmentBalanceListResponse,
  ConsignmentBalanceRow
} from "@/lib/consignment-balances-types";
import type { TerritoryNode } from "@/lib/territory-tree";
import { formatClientDisplayId } from "@shared/client-display-id";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { getUserFacingError } from "@/lib/error-utils";
import { paymentMethodSelectOptions, type ProfilePaymentMethodEntry } from "@/lib/payment-method-options";
import { buildZoneRegionCityCascadeOptions } from "@/lib/territory-client-filters";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { STALE } from "@/lib/query-stale";
import { useActiveTradeDirectionsCatalog } from "@/hooks/use-active-trade-directions-catalog";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { TableSearchField } from "@/components/ui/table-search-field";
import { DEFAULT_TABLE_PAGE_SIZES } from "@/lib/table-page-sizes";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  AlertCircle,
  Copy,
  FileSpreadsheet,
  LayoutGrid,
  RefreshCw
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

type StaffPick = {
  id: number;
  fio: string;
  code?: string | null;
  supervisor_user_id?: number | null;
  branch?: string | null;
  supervisees?: Array<{ id: number; fio: string; code?: string | null }>;
  trade_direction?: string | null;
  expeditor_assignment_rules?: {
    trade_directions?: string[];
    agent_ids?: number[];
    price_types?: string[];
    warehouse_ids?: number[];
    territories?: string[];
    weekdays?: number[];
  };
};

type FilterForm = ClientBalancesFilterForm;

const defaultForm = (): FilterForm => ({
  agent_id: "",
  expeditor_user_id: "",
  supervisor_user_id: "",
  trade_direction: "",
  category: "",
  status: "",
  balance_filter: "",
  territory_zone: "",
  territory_region: "",
  territory_city: "",
  balance_date: "",
  order_date: "",
  license_from: "",
  license_to: "",
  agent_branch: "",
  agent_payment_type: ""
});

function parseAmount(s: string): number {
  const t = String(s)
    .trim()
    .replace(/\u00a0/g, "")
    .replace(/\s/g, "")
    .replace(/\u2212/g, "-")
    .replace(/−/g, "-")
    .replace(/,/g, ".");
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

function formatDt(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  } catch {
    return "—";
  }
}

function clientDisplayId(r: ClientBalanceRow): string {
  return formatClientDisplayId(r.client_id, r.client_code);
}

/** Backend `label` va jadval sarlavhasi registr / bo‘shliq bo‘yicha farq qilmasin. */
function normPayColumnLabel(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ");
}

function amountForPaymentLabel(
  amounts: { label: string; amount: string }[],
  label: string,
  fallbackIndex?: number
): string {
  const want = normPayColumnLabel(label);
  const hit = amounts.find((x) => normPayColumnLabel(x.label) === want);
  if (hit) return hit.amount;
  if (
    typeof fallbackIndex === "number" &&
    Number.isInteger(fallbackIndex) &&
    fallbackIndex >= 0 &&
    fallbackIndex < amounts.length
  ) {
    return amounts[fallbackIndex]?.amount ?? "0";
  }
  return "0";
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

type SortDir = "asc" | "desc";

function SortTh({
  label,
  sortKey,
  current,
  onSort,
  className,
  align = "left"
}: {
  label: ReactNode;
  sortKey: string;
  current: { col: string; dir: SortDir };
  onSort: (key: string) => void;
  className?: string;
  align?: "left" | "right";
}) {
  const active = current.col === sortKey;
  return (
    <th className={cn(className, align === "right" && "text-right")}>
      <button
        type="button"
        className={cn(
          "inline-flex max-w-full items-center gap-1 rounded px-0.5 py-0.5 text-[12.5px] font-medium text-slate-500 hover:bg-muted hover:text-slate-700",
          align === "right" && "ml-auto w-full justify-end"
        )}
        onClick={() => onSort(sortKey)}
      >
        <span className="min-w-0 truncate text-left">{label}</span>
        {active ? (
          current.dir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-45" aria-hidden />
        )}
      </button>
    </th>
  );
}

function appendBranchListParam(params: URLSearchParams, raw: string): void {
  const items = splitMultiFilterValues(raw);
  if (items.length === 0) return;
  if (items.length === 1) params.set("agent_branch", items[0]!);
  else params.set("branch_ids", items.join(","));
}

function appendExclusiveEnumListParam(
  params: URLSearchParams,
  singleKey: string,
  multiKey: string,
  raw: string,
  allValues: string[]
): void {
  const items = splitMultiFilterValues(raw).filter((x) => allValues.includes(x));
  if (items.length === 0) return;
  if (items.length >= allValues.length) return;
  if (items.length === 1) params.set(singleKey, items[0]!);
  else params.set(multiKey, items.join(","));
}

function buildQuery(
  form: FilterForm,
  view: Exclude<ClientBalanceViewMode, "clients_consignment">,
  page: number,
  limit: number,
  search: string,
  sort: { col: string; dir: SortDir },
  largeExport?: boolean
): string {
  const p = new URLSearchParams();
  p.set("view", view);
  p.set("page", String(page));
  p.set("limit", String(limit));
  if (largeExport) {
    p.set("large_export", "1");
  }
  if (search.trim()) p.set("search", search.trim());
  appendPositiveIntListParam(p, "agent_id", "agent_ids", form.agent_id);
  appendPositiveIntListParam(p, "expeditor_user_id", "expeditor_user_ids", form.expeditor_user_id);
  appendPositiveIntListParam(p, "supervisor_user_id", "supervisor_user_ids", form.supervisor_user_id);
  appendStringListParam(p, "trade_direction", form.trade_direction);
  appendStringListParam(p, "category", form.category);
  appendExclusiveEnumListParam(p, "status", "statuses", form.status, ["active", "inactive"]);
  appendExclusiveEnumListParam(p, "balance_filter", "balance_filters", form.balance_filter, [
    "debt",
    "credit"
  ]);
  appendStringListParam(p, "territory_zone", form.territory_zone);
  appendStringListParam(p, "territory_region", form.territory_region);
  appendStringListParam(p, "territory_city", form.territory_city);
  if (form.balance_date.trim()) p.set("balance_as_of", form.balance_date.trim());
  if (form.order_date.trim()) {
    p.set("order_date_from", form.order_date.trim());
    p.set("order_date_to", form.order_date.trim());
  }
  if (form.license_from.trim()) p.set("consignment_due_from", form.license_from.trim());
  if (form.license_to.trim()) p.set("consignment_due_to", form.license_to.trim());
  appendBranchListParam(p, form.agent_branch);
  appendStringListParam(p, "agent_payment_type", form.agent_payment_type);
  if (sort.col.trim()) {
    p.set("sort_by", sort.col.trim());
    p.set("sort_dir", sort.dir);
  }
  return p.toString();
}

/** Hudud tanlovlari: filial / agent / boshqalar bo‘yicha (territory-options API), «Применить»siz. */
function buildTerritoryScopeParams(form: FilterForm): string {
  const p = new URLSearchParams();
  appendBranchListParam(p, form.agent_branch);
  appendPositiveIntListParam(p, "agent_id", "agent_ids", form.agent_id);
  appendPositiveIntListParam(p, "expeditor_user_id", "expeditor_user_ids", form.expeditor_user_id);
  appendPositiveIntListParam(p, "supervisor_user_id", "supervisor_user_ids", form.supervisor_user_id);
  appendStringListParam(p, "trade_direction", form.trade_direction);
  appendStringListParam(p, "category", form.category);
  appendExclusiveEnumListParam(p, "status", "statuses", form.status, ["active", "inactive"]);
  appendStringListParam(p, "agent_payment_type", form.agent_payment_type);
  return p.toString();
}

/** Qoidalarsiz ekspektor: tanlangan filial bilan mos kelmasa, boshqa filialdagi qatorlarni yashiramiz. */
function expeditorMatchesBranchContext(exp: StaffPick, selectedBranch: string): boolean {
  const b = normTrim(selectedBranch);
  if (!b) return true;
  const rules = exp.expeditor_assignment_rules;
  const hasAgentOrTdRules =
    rules &&
    typeof rules === "object" &&
    ((rules.agent_ids?.length ?? 0) > 0 || (rules.trade_directions?.length ?? 0) > 0);
  if (hasAgentOrTdRules) return true;
  const eb = normTrim(exp.branch);
  if (!eb) return true;
  return eb === b;
}

/** Zakaz id ro‘yxat qatorida (API: delivery_order_id yoki order_id). */
function rowDeliveryOrderId(r: ClientBalanceRow): number | undefined {
  const raw = r.delivery_order_id ?? r.order_id ?? null;
  if (raw == null) return undefined;
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function clientBalanceRowKey(
  view: ClientBalanceViewMode,
  r: ClientBalanceRow,
  rowIndex: number
): string {
  if (view === "clients_delivery") {
    const oid = rowDeliveryOrderId(r);
    if (oid != null) return `o:${oid}`;
    return `c:${r.client_id}:i:${rowIndex}`;
  }
  return `c:${r.client_id}`;
}

/**
 * Balans / способ оплаты: manfiy = qarz (qizil), nol va musbat = yashil.
 */
function MoneyCell({
  value,
  align = "right",
  className,
  /** Svodka-kartochkalar: nol ham «NAQD» kabi qalin, kulrang emas */
  summaryKpi = false
}: {
  value: string;
  align?: "left" | "right" | "center";
  className?: string;
  summaryKpi?: boolean;
}) {
  const n = parseAmount(value);
  const debt = n < 0;
  const credit = n > 0;
  return (
    <span
      className={cn(
        "whitespace-nowrap tabular-nums",
        align === "right" && "block text-right",
        align === "center" && "block text-center",
        align === "left" && "block text-left",
        debt && "font-bold text-[#e02b2b]",
        credit && "font-bold text-[#0c8f5a]",
        !debt &&
          !credit &&
          (summaryKpi
            ? "font-semibold text-slate-700"
            : "font-medium text-slate-500"),
        className
      )}
    >
      {formatNumberGrouped(value, { maxFractionDigits: 2 })}
    </span>
  );
}

function excelCellForClientBalanceCol(r: ClientBalanceRow, colId: string): string | number {
  switch (colId) {
    case "order_id": {
      const oid = rowDeliveryOrderId(r);
      if (oid == null) return "";
      return r.delivery_order_number?.trim() ? `${oid} / ${r.delivery_order_number}` : String(oid);
    }
    case "client_id":
      return clientDisplayId(r);
    case "name":
      return r.name;
    case "agent_name":
      return r.agent_name ?? "";
    case "agent_code":
      return r.agent_code ?? "";
    case "supervisor_name":
      return r.supervisor_name ?? "";
    case "legal_name":
      return r.legal_name ?? "";
    case "trade_direction":
      return r.trade_direction ?? "";
    case "inn":
      return r.inn ?? "";
    case "phone":
      return r.phone ?? "";
    case "license_until":
      return r.license_until ? formatDateOnly(r.license_until) : "";
    case "days_overdue":
      return r.days_overdue ?? "";
    case "last_order_at":
      return r.last_order_at ?? "";
    case "last_payment_at":
      return r.last_payment_at ?? "";
    case "days_since_payment":
      return r.days_since_payment ?? "";
    case "balance":
      return r.balance;
    case "legacy_debt":
      return formatDebtExcelCell(r.legacy_debt, r.legacy_agent_names);
    case "current_debt":
      return formatDebtExcelCell(r.current_debt, r.current_agent_name);
    case "legacy_agent_names":
      return r.legacy_agent_names?.trim() || "";
    default:
      return "";
  }
}

async function downloadClientsExcel(
  rows: ClientBalanceRow[],
  view: ClientBalanceViewMode,
  paymentColumnLabels: string[],
  visibleColumnOrder: string[]
) {
  const variant =
    view === "clients_delivery" ? "delivery" : view === "clients_legacy" ? "legacy" : "clients";
  const baseHeaders = visibleColumnOrder.map((id) => clientBalancesColLabel(id, variant));
  const payHeaders = paymentColumnLabels.length > 0 ? paymentColumnLabels : [];
  const headers = [...baseHeaders, ...payHeaders];
  const dataRows = rows.map((r) => {
    const base = visibleColumnOrder.map((id) => {
      if (variant === "legacy" && (id === "legacy_debt" || id === "current_debt")) {
        return id === "legacy_debt" ? (r.legacy_debt ?? "0") : (r.current_debt ?? "0");
      }
      return excelCellForClientBalanceCol(r, id);
    });
    const payCells = payHeaders.map((lab, idx) =>
      amountForPaymentLabel(r.payment_amounts, lab, idx)
    );
    return [...base, ...payCells];
  });
  const sheet =
    view === "clients_delivery"
      ? "По доставленным заказам"
      : view === "clients_legacy"
        ? "Долг старого агента"
        : "По клиентам";
  await downloadXlsxSheet(
    `balansy-klientov-${new Date().toISOString().slice(0, 10)}.xlsx`,
    sheet,
    headers,
    dataRows
  );
}

async function downloadAgentsExcel(
  rows: AgentBalanceRow[],
  paymentColumnLabels: string[],
  visibleColumnOrder: string[]
) {
  const baseHeaders = visibleColumnOrder.map((id) => clientBalancesColLabel(id, "agents"));
  const headers = [...baseHeaders, ...paymentColumnLabels];
  const dataRows = rows.map((r) => {
    const base = visibleColumnOrder.map((colId) => {
      switch (colId) {
        case "agent_name":
          return r.agent_name ?? "";
        case "agent_code":
          return r.agent_code ?? "";
        case "clients_count":
          return r.clients_count;
        case "balance":
          return r.balance;
        case "legacy_debt":
          return r.legacy_debt ?? "0";
        case "current_debt":
          return r.current_debt ?? "0";
        case "is_active":
          return r.is_active === false ? "Архив" : r.is_active === true ? "Активен" : "";
        default:
          return "";
      }
    });
    return [
      ...base,
      ...paymentColumnLabels.map((lab, idx) => amountForPaymentLabel(r.payment_amounts, lab, idx))
    ];
  });
  await downloadXlsxSheet(
    `balansy-agentov-${new Date().toISOString().slice(0, 10)}.xlsx`,
    "По агентам",
    headers,
    dataRows
  );
}

function normTrim(s: string | null | undefined): string {
  return (s ?? "").trim();
}

type AgentFilterSkip = Partial<{
  branch: true;
  supervisor: true;
  agent: true;
  tradeDirection: true;
  expeditor: true;
}>;

function agentMatchesExpeditor(agent: StaffPick, exp: StaffPick | undefined): boolean {
  if (!exp) return true;
  const rules = exp.expeditor_assignment_rules;
  if (!rules || typeof rules !== "object") return true;
  const agentIds = rules.agent_ids ?? [];
  const tds = rules.trade_directions ?? [];
  const hasRestrict = agentIds.length > 0 || tds.length > 0;
  if (!hasRestrict) return true;
  if (agentIds.length > 0 && agentIds.includes(agent.id)) return true;
  const td = normTrim(agent.trade_direction);
  if (tds.length > 0 && td) {
    if (tds.some((x) => normTrim(x) === td)) return true;
  }
  if (tds.length > 0 && !td) return false;
  return agentIds.length > 0 ? false : true;
}

function filterAgentsForBalances(
  agents: StaffPick[],
  expeditors: StaffPick[] | undefined,
  d: FilterForm,
  skip: AgentFilterSkip
): StaffPick[] {
  const branches = skip.branch ? [] : splitMultiFilterValues(d.agent_branch);
  const supIds = skip.supervisor
    ? []
    : splitMultiFilterValues(d.supervisor_user_id)
        .map((s) => Number.parseInt(s, 10))
        .filter((n) => Number.isFinite(n) && n > 0);
  const tds = skip.tradeDirection ? [] : splitMultiFilterValues(d.trade_direction);
  const agentIds = skip.agent
    ? []
    : splitMultiFilterValues(d.agent_id)
        .map((s) => Number.parseInt(s, 10))
        .filter((n) => Number.isFinite(n) && n > 0);
  const expIds = skip.expeditor ? [] : splitMultiFilterValues(d.expeditor_user_id);

  return agents.filter((a) => {
    if (agentIds.length > 0 && !agentIds.includes(a.id)) return false;
    if (branches.length > 0 && !branches.includes(normTrim(a.branch))) return false;
    if (supIds.length > 0 && !supIds.includes(a.supervisor_user_id ?? -1)) return false;
    if (tds.length > 0 && !tds.includes(normTrim(a.trade_direction))) return false;
    if (expIds.length > 0) {
      const matchesAny = expIds.some((expId) => {
        const exp = expeditors?.find((e) => String(e.id) === expId);
        return agentMatchesExpeditor(a, exp);
      });
      if (!matchesAny) return false;
    }
    return true;
  });
}

function parseClientBalancesView(raw: string | null | undefined): ClientBalanceViewMode {
  if (raw === "agents") return "agents";
  if (raw === "clients_delivery") return "clients_delivery";
  if (raw === "clients_legacy") return "clients_legacy";
  if (raw === "clients_consignment" || raw === "consignment") return "clients_consignment";
  return "clients";
}

export function ClientBalancesWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [draft, setDraft] = useState<FilterForm>(() => defaultForm());
  const [applied, setApplied] = useState<FilterForm>(() => defaultForm());
  const [view, setView] = useState<ClientBalanceViewMode>(() =>
    parseClientBalancesView(searchParams.get("view"))
  );
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [copyFlash, setCopyFlash] = useState(false);
  /** Tanlangan qatorlar (sahifa almashganda ham saqlanadi) */
  const [selectedClients, setSelectedClients] = useState<Map<string, ClientBalanceRow>>(
    () => new Map()
  );
  const [bulkPayOpen, setBulkPayOpen] = useState(false);
  const [bulkPayClients, setBulkPayClients] = useState<ClientBalanceRow[]>([]);
  const [excelBusy, setExcelBusy] = useState(false);
  const [clientSort, setClientSort] = useState<{ col: string; dir: SortDir }>({ col: "", dir: "asc" });
  const [agentSort, setAgentSort] = useState<{ col: string; dir: SortDir }>({ col: "", dir: "asc" });

  const clientsTablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: CLIENT_BALANCES_CLIENTS_TABLE_ID,
    defaultColumnOrder: [...CLIENT_BALANCES_COLUMN_IDS],
    defaultHiddenColumnIds: [...CLIENT_BALANCES_DEFAULT_HIDDEN],
    defaultPageSize: 10,
    allowedPageSizes: DEFAULT_TABLE_PAGE_SIZES
  });
  const deliveryTablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: CLIENT_BALANCES_DELIVERY_TABLE_ID,
    defaultColumnOrder: [...CLIENT_BALANCES_DELIVERY_COLUMN_IDS],
    defaultHiddenColumnIds: [...CLIENT_BALANCES_DEFAULT_HIDDEN],
    defaultPageSize: 10,
    allowedPageSizes: DEFAULT_TABLE_PAGE_SIZES
  });
  const legacyTablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: CLIENT_BALANCES_LEGACY_TABLE_ID,
    defaultColumnOrder: [...CLIENT_BALANCES_LEGACY_COLUMN_IDS],
    defaultPageSize: 10,
    allowedPageSizes: DEFAULT_TABLE_PAGE_SIZES
  });
  const consignmentTablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: CLIENT_BALANCES_CONSIGNMENT_TABLE_ID,
    defaultColumnOrder: [...CLIENT_BALANCES_CONSIGNMENT_COLUMN_IDS],
    defaultPageSize: 10,
    allowedPageSizes: DEFAULT_TABLE_PAGE_SIZES
  });
  const agentsTablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: CLIENT_BALANCES_AGENTS_TABLE_ID,
    defaultColumnOrder: [...CLIENT_BALANCES_AGENTS_COLUMN_IDS],
    defaultPageSize: 10,
    allowedPageSizes: DEFAULT_TABLE_PAGE_SIZES
  });
  const columnPrefs =
    view === "clients_delivery"
      ? deliveryTablePrefs
      : view === "clients_legacy"
        ? legacyTablePrefs
        : view === "clients_consignment"
          ? consignmentTablePrefs
          : view === "agents"
            ? agentsTablePrefs
            : clientsTablePrefs;
  const limit = columnPrefs.pageSize;

  const isConsignmentView = view === "clients_consignment";
  const activeSort = view === "agents" ? agentSort : clientSort;
  const mainView = view === "clients_consignment" ? "clients" : view;
  const queryString = useMemo(
    () =>
      isConsignmentView
        ? ""
        : buildQuery(
            applied,
            mainView as Exclude<ClientBalanceViewMode, "clients_consignment">,
            page,
            limit,
            search,
            activeSort
          ),
    [applied, isConsignmentView, mainView, page, limit, search, activeSort]
  );
  const consignmentQueryString = useMemo(
    () =>
      isConsignmentView
        ? buildConsignmentBalancesQuery(applied, page, limit, search)
        : "",
    [applied, isConsignmentView, page, limit, search]
  );

  const listQ = useQuery({
    queryKey: ["client-balances", tenantSlug, queryString],
    enabled: Boolean(tenantSlug) && hydrated && !isConsignmentView,
    staleTime: STALE.heavyList,
    placeholderData: keepPreviousData,
    structuralSharing: false,
    queryFn: async () => {
      const { data } = await api.get<ClientBalanceListResponse>(
        `/api/${tenantSlug}/client-balances?${queryString}`
      );
      return data;
    }
  });

  const consignmentQ = useQuery({
    queryKey: ["client-balances-consignment", tenantSlug, consignmentQueryString],
    enabled: Boolean(tenantSlug) && hydrated && isConsignmentView,
    staleTime: STALE.heavyList,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data } = await api.get<ConsignmentBalanceListResponse>(
        `/api/${tenantSlug}/client-balances/consignment?${consignmentQueryString}`
      );
      return data;
    }
  });

  const territoryScopeParams = useMemo(() => buildTerritoryScopeParams(draft), [draft]);

  const territoryQ = useQuery({
    queryKey: ["client-balances-territory", tenantSlug, territoryScopeParams],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const qs = territoryScopeParams.trim();
      const { data } = await api.get<{ data: ClientBalanceTerritoryOptions }>(
        `/api/${tenantSlug}/client-balances/territory-options${qs ? `?${qs}` : ""}`
      );
      return data.data;
    }
  });

  const clientRefsQ = useQuery({
    queryKey: ["clients", "references", tenantSlug, "client-balances"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{
        regions?: string[];
        cities?: string[];
        districts?: string[];
        zones?: string[];
        neighborhoods?: string[];
        categories?: string[];
        category_options?: Array<string | { value?: string; label?: string }>;
        region_options?: { value: string; label: string }[];
        city_options?: { value: string; label: string }[];
      }>(`/api/${tenantSlug}/clients/references`);
      return data;
    }
  });

  const agentsQ = useQuery({
    queryKey: ["agents", tenantSlug, "client-balances-filters"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: StaffPick[] }>(`/api/${tenantSlug}/agents?is_active=true`);
      return data.data;
    }
  });

  const expeditorsQ = useQuery({
    queryKey: ["expeditors", tenantSlug, "client-balances-filters"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: StaffPick[] }>(`/api/${tenantSlug}/expeditors?is_active=true`);
      return data.data;
    }
  });

  const supervisorsQ = useQuery({
    queryKey: ["supervisors", tenantSlug, "client-balances-filters"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: StaffPick[] }>(
        `/api/${tenantSlug}/supervisors?is_active=true`
      );
      return data.data;
    }
  });

  const tradeDirectionsCatalog = useActiveTradeDirectionsCatalog(tenantSlug, "client-balances");
  const catalogTradeDirectionLabels = tradeDirectionsCatalog.labels;

  const profileQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug, "client-balances-paytypes"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{
        references?: {
          payment_types?: string[];
          payment_method_entries?: ProfilePaymentMethodEntry[];
        };
      }>(`/api/${tenantSlug}/settings/profile`);
      return data.references ?? {};
    }
  });

  const territoryNodesQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug, "territory-nodes-for-balances"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{
        references?: {
          territory_nodes?: TerritoryNode[];
        };
      }>(`/api/${tenantSlug}/settings/profile`);
      return data.references?.territory_nodes ?? [];
    }
  });

  const applyFilters = useCallback(() => {
    setApplied({ ...draft });
    setPage(1);
  }, [draft]);

  const resetFilters = useCallback(() => {
    const fresh = defaultForm();
    setDraft(fresh);
    setApplied(fresh);
    setPage(1);
  }, []);

  const clientRowsForSelection: ClientBalanceRow[] =
    view === "clients" && listQ.data?.view === "clients"
      ? (listQ.data.data as ClientBalanceRow[])
      : view === "clients_delivery" && listQ.data?.view === "clients_delivery"
        ? (listQ.data.data as ClientBalanceRow[])
        : view === "clients_legacy" && listQ.data?.view === "clients_legacy"
          ? (listQ.data.data as ClientBalanceRow[])
          : [];
  const agentRows = (listQ.data?.view === "agents" ? listQ.data.data : []) as AgentBalanceRow[];
  const consignmentRows = (consignmentQ.data?.data ?? []) as ConsignmentBalanceRow[];
  const summaryBalance = isConsignmentView
    ? consignmentQ.data?.summary.total_debt
    : listQ.data?.summary.balance;
  const paymentByType = isConsignmentView
    ? (consignmentQ.data?.summary.payment_by_type ?? [])
    : (listQ.data?.summary.payment_by_type ?? []);
  const paymentColumnLabels = paymentByType.map((x) => x.label);
  const onClientSort = useCallback((key: string) => {
    setPage(1);
    setClientSort((prev) =>
      prev.col !== key ? { col: key, dir: "asc" } : { col: key, dir: prev.dir === "asc" ? "desc" : "asc" }
    );
  }, []);
  const onAgentSort = useCallback((key: string) => {
    setPage(1);
    setAgentSort((prev) =>
      prev.col !== key ? { col: key, dir: "asc" } : { col: key, dir: prev.dir === "asc" ? "desc" : "asc" }
    );
  }, []);

  const activeListTotal = isConsignmentView ? consignmentQ.data?.total : listQ.data?.total;
  const activeListLimit = isConsignmentView ? consignmentQ.data?.limit : listQ.data?.limit;
  const totalPages =
    activeListTotal != null && activeListLimit
      ? Math.max(1, Math.ceil(activeListTotal / activeListLimit))
      : 1;
  const listErrorDetail = useMemo(() => {
    const err = isConsignmentView ? consignmentQ.error : listQ.error;
    const isErr = isConsignmentView ? consignmentQ.isError : listQ.isError;
    if (!isErr || !err) return null;
    return getUserFacingError(err);
  }, [
    isConsignmentView,
    listQ.isError,
    listQ.error,
    consignmentQ.isError,
    consignmentQ.error
  ]);

  const isClientLikeView =
    view === "clients" || view === "clients_delivery" || view === "clients_legacy";
  const showColumnSettings =
    isClientLikeView || view === "clients_consignment" || view === "agents";

  const onTabView = (v: string | null) => {
    const next = parseClientBalancesView(v);
    setView(next);
    setPage(1);
    setSelectedClients(new Map());
    const params = new URLSearchParams(searchParams.toString());
    if (next === "clients") params.delete("view");
    else params.set("view", next);
    const qs = params.toString();
    router.replace(qs ? `/client-balances?${qs}` : "/client-balances", { scroll: false });
  };

  const toggleSelect = (row: ClientBalanceRow, rowIndex: number) => {
    const key = clientBalanceRowKey(view, row, rowIndex);
    setSelectedClients((prev) => {
      const n = new Map(prev);
      if (n.has(key)) n.delete(key);
      else n.set(key, row);
      return n;
    });
  };

  const toggleSelectAllPage = () => {
    if (!isClientLikeView) return;
    const keys = clientRowsForSelection.map((r, i) => clientBalanceRowKey(view, r, i));
    const allOn = keys.length > 0 && keys.every((k) => selectedClients.has(k));
    setSelectedClients((prev) => {
      const n = new Map(prev);
      if (allOn) {
        for (const k of keys) n.delete(k);
      } else {
        clientRowsForSelection.forEach((r, i) => {
          n.set(clientBalanceRowKey(view, r, i), r);
        });
      }
      return n;
    });
  };

  const openBulkPayModal = () => {
    if (selectedClients.size === 0) return;
    const byClient = new Map<number, ClientBalanceRow>();
    for (const r of Array.from(selectedClients.values())) {
      byClient.set(r.client_id, r);
    }
    setBulkPayClients(Array.from(byClient.values()));
    setBulkPayOpen(true);
  };

  const runExcelExport = useCallback(async () => {
    if (!tenantSlug) return;
    setExcelBusy(true);
    try {
      if (isConsignmentView) {
        const qs = buildConsignmentBalancesQuery(applied, 1, 5000, search, true);
        const { data } = await api.get<ConsignmentBalanceListResponse>(
          `/api/${tenantSlug}/client-balances/consignment?${qs}`
        );
        const payLabels = (data.summary.payment_by_type ?? []).map((x) => x.label);
        await downloadConsignmentBalancesExcel(
          data.data,
          payLabels,
          consignmentTablePrefs.visibleColumnOrder
        );
        return;
      }
      const qs = buildQuery(
        applied,
        view as Exclude<ClientBalanceViewMode, "clients_consignment">,
        1,
        5000,
        search,
        activeSort,
        true
      );
      const { data } = await api.get<ClientBalanceListResponse>(
        `/api/${tenantSlug}/client-balances?${qs}`
      );
      const payLabels = data.summary.payment_by_type.map((x) => x.label);
      if (data.view === "agents") {
        await downloadAgentsExcel(
          data.data as AgentBalanceRow[],
          payLabels,
          agentsTablePrefs.visibleColumnOrder
        );
      } else {
        const visible =
          data.view === "clients_delivery"
            ? deliveryTablePrefs.visibleColumnOrder
            : data.view === "clients_legacy"
              ? legacyTablePrefs.visibleColumnOrder
              : clientsTablePrefs.visibleColumnOrder;
        await downloadClientsExcel(data.data as ClientBalanceRow[], data.view, payLabels, visible);
      }
    } finally {
      setExcelBusy(false);
    }
  }, [
    tenantSlug,
    applied,
    view,
    search,
    activeSort,
    isConsignmentView,
    clientsTablePrefs.visibleColumnOrder,
    deliveryTablePrefs.visibleColumnOrder,
    legacyTablePrefs.visibleColumnOrder,
    consignmentTablePrefs.visibleColumnOrder,
    agentsTablePrefs.visibleColumnOrder
  ]);

  const paymentTypeFilterOpts = useMemo(
    () => paymentMethodSelectOptions(profileQ.data, profileQ.data?.payment_types),
    [profileQ.data]
  );
  const categoryFilterOpts = useMemo(() => {
    const fromOptions = (clientRefsQ.data?.category_options ?? [])
      .map((o) => (typeof o === "string" ? o : (o?.label ?? o?.value ?? "")))
      .map((x) => String(x).trim())
      .filter(Boolean);
    const fromList = (clientRefsQ.data?.categories ?? []).map((x) => String(x).trim()).filter(Boolean);
    return Array.from(new Set([...fromOptions, ...fromList])).sort((a, b) => a.localeCompare(b, "ru"));
  }, [clientRefsQ.data]);

  const agentsSrc = useMemo(() => agentsQ.data ?? [], [agentsQ.data]);
  const expeditorsSrc = useMemo(() => expeditorsQ.data ?? [], [expeditorsQ.data]);

  const balanceCascade = useMemo(() => {
    const d = draft;
    return {
      forAgentSelect: filterAgentsForBalances(agentsSrc, expeditorsSrc, d, { agent: true }),
      forSupervisorSelect: filterAgentsForBalances(agentsSrc, expeditorsSrc, d, { supervisor: true }),
      forBranchSelect: filterAgentsForBalances(agentsSrc, expeditorsSrc, d, { branch: true }),
      forTradeDirectionSelect: filterAgentsForBalances(agentsSrc, expeditorsSrc, d, { tradeDirection: true }),
      forExpeditorSelect: filterAgentsForBalances(agentsSrc, expeditorsSrc, d, { expeditor: true })
    };
  }, [agentsSrc, expeditorsSrc, draft]);

  const filteredAgents = balanceCascade.forAgentSelect;

  const filteredSupervisors = useMemo(() => {
    const supIds = new Set(
      balanceCascade.forSupervisorSelect
        .map((a) => a.supervisor_user_id)
        .filter((x): x is number => x != null && Number.isFinite(Number(x)))
    );
    const branches = splitMultiFilterValues(draft.agent_branch);
    const all = supervisorsQ.data ?? [];
    const branchFiltered =
      branches.length === 0
        ? all
        : all.filter((s) => branches.includes(normTrim(s.branch)));
    if (supIds.size === 0) return branchFiltered;
    return branchFiltered.filter((s) => supIds.has(s.id));
  }, [supervisorsQ.data, draft.agent_branch, balanceCascade.forSupervisorSelect]);

  const to = territoryQ.data;

  const branchSelectOptionsFiltered = useMemo(() => {
    const fromAgents = new Set<string>();
    for (const a of balanceCascade.forBranchSelect) {
      const b = normTrim(a.branch);
      if (b) fromAgents.add(b);
    }
    let list = Array.from(fromAgents).sort((a, b) => a.localeCompare(b, "ru"));
    const territoryBranches = to?.branches ?? [];
    if (territoryBranches.length > 0) {
      const allowed = new Set(territoryBranches.map(normTrim));
      list = list.filter((b) => allowed.has(b));
      if (list.length === 0) {
        list = territoryBranches.map(normTrim).filter(Boolean).sort((a, b) => a.localeCompare(b, "ru"));
      }
    }
    return list;
  }, [balanceCascade.forBranchSelect, to?.branches]);

  const tradeDirectionFilterOpts = useMemo(() => {
    const fromAgents = new Set<string>();
    for (const a of balanceCascade.forTradeDirectionSelect) {
      const t = normTrim(a.trade_direction);
      if (t) fromAgents.add(t);
    }
    const dirs = Array.from(fromAgents).sort((a, b) => a.localeCompare(b, "ru"));
    if (dirs.length > 0) return dirs;
    return catalogTradeDirectionLabels;
  }, [balanceCascade.forTradeDirectionSelect, catalogTradeDirectionLabels]);

  const filteredExpeditors = useMemo(() => {
    const branches = splitMultiFilterValues(draft.agent_branch);
    return (expeditorsQ.data ?? []).filter((e) => {
      if (!balanceCascade.forExpeditorSelect.some((a) => agentMatchesExpeditor(a, e))) return false;
      if (branches.length === 0) return true;
      return branches.some((b) => expeditorMatchesBranchContext(e, b));
    });
  }, [expeditorsQ.data, balanceCascade.forExpeditorSelect, draft.agent_branch]);

  useEffect(() => {
    const vals = splitMultiFilterValues(draft.agent_id);
    if (vals.length === 0) return;
    const allowed = new Set(filteredAgents.map((a) => String(a.id)));
    const next = joinMultiFilterValues(pruneToAllowedOptions(vals, allowed));
    if (next !== draft.agent_id) setDraft((d) => ({ ...d, agent_id: next }));
  }, [filteredAgents, draft.agent_id]);

  useEffect(() => {
    const vals = splitMultiFilterValues(draft.supervisor_user_id);
    if (vals.length === 0) return;
    const allowed = new Set(filteredSupervisors.map((s) => String(s.id)));
    const next = joinMultiFilterValues(pruneToAllowedOptions(vals, allowed));
    if (next !== draft.supervisor_user_id) setDraft((d) => ({ ...d, supervisor_user_id: next }));
  }, [filteredSupervisors, draft.supervisor_user_id]);

  useEffect(() => {
    const vals = splitMultiFilterValues(draft.agent_branch);
    if (vals.length === 0) return;
    const allowed = new Set(branchSelectOptionsFiltered);
    const next = joinMultiFilterValues(pruneToAllowedOptions(vals, allowed));
    if (next !== draft.agent_branch) setDraft((d) => ({ ...d, agent_branch: next }));
  }, [branchSelectOptionsFiltered, draft.agent_branch]);

  useEffect(() => {
    const vals = splitMultiFilterValues(draft.trade_direction);
    if (vals.length === 0) return;
    const allowed = new Set(tradeDirectionFilterOpts);
    const next = joinMultiFilterValues(pruneToAllowedOptions(vals, allowed));
    if (next !== draft.trade_direction) setDraft((d) => ({ ...d, trade_direction: next }));
  }, [tradeDirectionFilterOpts, draft.trade_direction]);

  useEffect(() => {
    const vals = splitMultiFilterValues(draft.expeditor_user_id);
    if (vals.length === 0) return;
    const allowed = new Set(filteredExpeditors.map((e) => String(e.id)));
    const next = joinMultiFilterValues(pruneToAllowedOptions(vals, allowed));
    if (next !== draft.expeditor_user_id) setDraft((d) => ({ ...d, expeditor_user_id: next }));
  }, [filteredExpeditors, draft.expeditor_user_id]);

  const territoryCascadeScope = useMemo(
    () => ({
      zone: splitMultiFilterValues(draft.territory_zone)[0] ?? "",
      region: splitMultiFilterValues(draft.territory_region)[0] ?? "",
      city: splitMultiFilterValues(draft.territory_city)[0] ?? ""
    }),
    [draft.territory_zone, draft.territory_region, draft.territory_city]
  );

  const territoryCascade = useMemo(
    () =>
      buildZoneRegionCityCascadeOptions(
        clientRefsQ.data,
        to,
        territoryNodesQ.data,
        {
          zone: territoryCascadeScope.zone,
          region: territoryCascadeScope.region,
          city: territoryCascadeScope.city
        }
      ),
    [clientRefsQ.data, to, territoryNodesQ.data, territoryCascadeScope]
  );

  const zoneOptionKeys = useMemo(
    () => territoryCascade.zones.map((o) => o.value).join("\u0001"),
    [territoryCascade.zones]
  );
  const regionOptionKeys = useMemo(
    () => territoryCascade.regions.map((o) => o.value).join("\u0001"),
    [territoryCascade.regions]
  );
  const cityOptionKeys = useMemo(
    () => territoryCascade.cities.map((o) => o.value).join("\u0001"),
    [territoryCascade.cities]
  );

  useEffect(() => {
    const vals = splitMultiFilterValues(draft.territory_zone);
    if (vals.length === 0) return;
    const allowed = new Set(
      zoneOptionKeys
        .split("\u0001")
        .map((x) => normTrim(x))
        .filter(Boolean)
    );
    const next = joinMultiFilterValues(pruneToAllowedOptions(vals, allowed));
    if (next !== draft.territory_zone) {
      setDraft((d) => ({ ...d, territory_zone: next, territory_region: "", territory_city: "" }));
    }
  }, [zoneOptionKeys, draft.territory_zone]);

  useEffect(() => {
    const vals = splitMultiFilterValues(draft.territory_region);
    if (vals.length === 0) return;
    const allowed = new Set(
      regionOptionKeys
        .split("\u0001")
        .map((x) => normTrim(x))
        .filter(Boolean)
    );
    const next = joinMultiFilterValues(pruneToAllowedOptions(vals, allowed));
    if (next !== draft.territory_region) {
      setDraft((d) => ({ ...d, territory_region: next, territory_city: "" }));
    }
  }, [regionOptionKeys, draft.territory_region]);

  useEffect(() => {
    const vals = splitMultiFilterValues(draft.territory_city);
    if (vals.length === 0) return;
    const allowed = new Set(
      cityOptionKeys
        .split("\u0001")
        .map((x) => normTrim(x))
        .filter(Boolean)
    );
    const next = joinMultiFilterValues(pruneToAllowedOptions(vals, allowed));
    if (next !== draft.territory_city) setDraft((d) => ({ ...d, territory_city: next }));
  }, [cityOptionKeys, draft.territory_city]);

  return (
    <PageShell>
      <TableColumnSettingsDialog
        open={columnDialogOpen}
        onOpenChange={setColumnDialogOpen}
        title="Управление столбцами"
        description="Видимые столбцы и порядок сохраняются для вашей учётной записи."
        columns={
          view === "clients_delivery"
            ? [...CLIENT_BALANCES_DELIVERY_COLUMN_DEFS]
            : view === "clients_legacy"
              ? [...CLIENT_BALANCES_LEGACY_COLUMN_DEFS]
              : view === "clients_consignment"
                ? [...CLIENT_BALANCES_CONSIGNMENT_COLUMN_DEFS]
                : view === "agents"
                  ? [...CLIENT_BALANCES_AGENTS_COLUMN_DEFS]
                  : [...CLIENT_BALANCES_COLUMN_DEFS]
        }
        columnOrder={columnPrefs.columnOrder}
        hiddenColumnIds={columnPrefs.hiddenColumnIds}
        saving={columnPrefs.saving}
        onSave={(next) => columnPrefs.saveColumnLayout(next)}
        onReset={() => columnPrefs.resetColumnLayout()}
      />
      <div className="space-y-4">
        <ClientBalancesFiltersPanel
          draft={draft}
          onDraftChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          onApply={applyFilters}
          onReset={resetFilters}
          branchOptions={branchSelectOptionsFiltered}
          agentOptions={filteredAgents}
          supervisorOptions={filteredSupervisors}
          expeditorOptions={filteredExpeditors}
          categoryOptions={categoryFilterOpts}
          tradeDirectionOptions={tradeDirectionFilterOpts}
          paymentTypeOptions={paymentTypeFilterOpts}
          territoryCascade={territoryCascade}
        />

        {summaryBalance != null ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
            <CbSummaryCard
              title={
                view === "clients_legacy"
                  ? "Долг старого агента"
                  : view === "clients_consignment"
                    ? "Долг по консигнации"
                    : "Общий"
              }
              amount={parseAmount(summaryBalance)}
              iconIndex={0}
            />
            {paymentByType.map((row, i) => (
              <CbSummaryCard
                key={`${row.label}-${i}`}
                title={row.label}
                amount={parseAmount(row.amount)}
                iconIndex={i + 1}
              />
            ))}
          </div>
        ) : null}

        <div>
          <div className="flex flex-wrap">
            <CbTabButton active={view === "clients"} onClick={() => onTabView("clients")}>
              По клиентам
            </CbTabButton>
            <CbTabButton active={view === "agents"} onClick={() => onTabView("agents")}>
              По агентам
            </CbTabButton>
            <CbTabButton active={view === "clients_delivery"} onClick={() => onTabView("clients_delivery")}>
              По доставке
            </CbTabButton>
            <CbTabButton active={view === "clients_legacy"} onClick={() => onTabView("clients_legacy")}>
              Долг старого агента
            </CbTabButton>
            <CbTabButton
              active={view === "clients_consignment"}
              onClick={() => onTabView("clients_consignment")}
            >
              По консигнации
            </CbTabButton>
          </div>

          <div className="rounded-xl rounded-tl-none bg-card shadow-[0_1px_4px_rgba(15,40,60,0.08)]">
            <div className="flex flex-wrap items-center gap-2.5 p-4">
              <select
                value={String(limit)}
                title="Строк на странице"
                onChange={(e) => {
                  columnPrefs.setPageSize(Number.parseInt(e.target.value, 10) || 10);
                  setPage(1);
                }}
                className="h-10 rounded-lg border border-border bg-card px-2.5 text-[13px] text-slate-700 outline-none hover:border-border"
              >
                {DEFAULT_TABLE_PAGE_SIZES.map((n) => (
                  <option key={n} value={String(n)}>
                    {n}
                  </option>
                ))}
              </select>
              {isClientLikeView && selectedClients.size > 0 ? (
                <button
                  type="button"
                  className="flex h-10 shrink-0 items-center gap-2 rounded-lg bg-[#0e9180] px-4 text-[13.5px] font-medium text-white hover:bg-[#0c7d6f]"
                  onClick={openBulkPayModal}
                >
                  Оплатить
                  <span className="rounded-md bg-card/20 px-1.5 text-xs tabular-nums">
                    {selectedClients.size}
                  </span>
                </button>
              ) : null}
              <TableSearchField
                className="h-10 min-w-[220px] flex-1 sm:max-w-[300px]"
                inputClassName="h-10 rounded-lg border-border text-[13.5px]"
                placeholder="ur_29411, ID, имя…"
                onSearch={(q) => {
                  setSearch(q);
                  setPage(1);
                }}
              />
              {showColumnSettings ? (
                <CbToolButton title="Столбцы" onClick={() => setColumnDialogOpen(true)}>
                  <LayoutGrid size={16} className="text-slate-600" />
                </CbToolButton>
              ) : null}
              <button
                type="button"
                disabled={
                  excelBusy ||
                  (isConsignmentView
                    ? !consignmentQ.data?.data.length
                    : !listQ.data?.data.length)
                }
                onClick={() => void runExcelExport()}
                className="flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13.5px] font-medium text-slate-700 transition-colors hover:bg-muted disabled:opacity-60"
              >
                <FileSpreadsheet size={16} className="text-emerald-600" />
                {excelBusy ? "Экспорт…" : "Excel"}
              </button>
              <CbToolButton
                title="Обновить"
                onClick={() =>
                  void (isConsignmentView ? consignmentQ.refetch() : listQ.refetch())
                }
              >
                <RefreshCw
                  size={16}
                  className={cn(
                    "text-[#0e9180]",
                    (isConsignmentView ? consignmentQ.isFetching : listQ.isFetching) && "animate-spin"
                  )}
                />
              </CbToolButton>
            </div>

            {listErrorDetail ? (
              <p className="px-4 pb-4 text-sm text-red-600">{listErrorDetail}</p>
            ) : view === "clients" ? (
              <ClientLikeTable
                variant="clients"
                statusFilter={applied.status}
                visibleColumnOrder={clientsTablePrefs.visibleColumnOrder}
                rowKey={(r, idx) => clientBalanceRowKey(view, r, idx)}
                paymentColumnLabels={paymentColumnLabels}
                sort={clientSort}
                onSort={onClientSort}
                loading={listQ.isLoading}
                rows={listQ.data?.view === "clients" ? (listQ.data.data as ClientBalanceRow[]) : []}
                selected={selectedClients}
                onToggle={toggleSelect}
                onToggleAll={toggleSelectAllPage}
                onCopyId={(text) =>
                  void copyToClipboard(text).then((ok) => {
                    if (ok) {
                      setCopyFlash(true);
                      window.setTimeout(() => setCopyFlash(false), 1200);
                    }
                  })
                }
              />
            ) : view === "clients_delivery" ? (
              <ClientLikeTable
                variant="delivery"
                statusFilter={applied.status}
                visibleColumnOrder={deliveryTablePrefs.visibleColumnOrder}
                rowKey={(r, idx) => clientBalanceRowKey(view, r, idx)}
                paymentColumnLabels={paymentColumnLabels}
                sort={clientSort}
                onSort={onClientSort}
                loading={listQ.isLoading}
                rows={
                  listQ.data?.view === "clients_delivery"
                    ? (listQ.data.data as ClientBalanceRow[])
                    : []
                }
                selected={selectedClients}
                onToggle={toggleSelect}
                onToggleAll={toggleSelectAllPage}
                onCopyId={(text) =>
                  void copyToClipboard(text).then((ok) => {
                    if (ok) {
                      setCopyFlash(true);
                      window.setTimeout(() => setCopyFlash(false), 1200);
                    }
                  })
                }
              />
            ) : view === "clients_legacy" ? (
              <ClientLikeTable
                variant="legacy"
                statusFilter={applied.status}
                visibleColumnOrder={legacyTablePrefs.visibleColumnOrder}
                rowKey={(r, idx) => clientBalanceRowKey(view, r, idx)}
                paymentColumnLabels={paymentColumnLabels}
                sort={clientSort}
                onSort={onClientSort}
                loading={listQ.isLoading}
                rows={
                  listQ.data?.view === "clients_legacy"
                    ? (listQ.data.data as ClientBalanceRow[])
                    : []
                }
                selected={selectedClients}
                onToggle={toggleSelect}
                onToggleAll={toggleSelectAllPage}
                onCopyId={(text) =>
                  void copyToClipboard(text).then((ok) => {
                    if (ok) {
                      setCopyFlash(true);
                      window.setTimeout(() => setCopyFlash(false), 1200);
                    }
                  })
                }
              />
            ) : view === "clients_consignment" ? (
              <ConsignmentBalancesTable
                loading={consignmentQ.isLoading}
                rows={consignmentRows}
                paymentColumnLabels={paymentColumnLabels}
                visibleColumnOrder={consignmentTablePrefs.visibleColumnOrder}
                statusFilter={applied.status}
              />
            ) : (
              <div className="space-y-2">
                <p className="px-4 text-xs text-slate-500">
                  Только активные агенты на рабочем месте. Долг текущего агента — его заказы и остаток
                  уволенных агентов; долг старого агента — только ещё активных предыдущих агентов.
                </p>
                <div className="scrollbar-none overflow-x-auto">
                  <table
                    className="w-full min-w-0 border-collapse text-[13px]"
                    style={{
                      minWidth: Math.max(
                        900,
                        700 +
                          agentsTablePrefs.visibleColumnOrder.length * 90 +
                          paymentColumnLabels.length * 112
                      )
                    }}
                  >
                    <thead>
                      <tr className="border-y border-border text-left text-[12.5px] font-medium text-slate-500">
                        {agentsTablePrefs.visibleColumnOrder.map((colId) => {
                          const label = clientBalancesColLabel(colId, "agents");
                          const sortKey =
                            colId === "is_active"
                              ? undefined
                              : colId === "agent_name"
                                ? "agent_name"
                                : colId;
                          const right =
                            colId === "clients_count" ||
                            colId === "balance" ||
                            colId === "legacy_debt" ||
                            colId === "current_debt";
                          if (!sortKey) {
                            return (
                              <th key={colId} className="whitespace-nowrap px-3 py-3.5">
                                {label}
                              </th>
                            );
                          }
                          return (
                            <SortTh
                              key={colId}
                              label={label}
                              sortKey={sortKey}
                              current={agentSort}
                              onSort={onAgentSort}
                              className={cn(
                                "whitespace-nowrap px-3 py-3.5",
                                right && "text-right",
                                colId === "agent_name" && "px-4"
                              )}
                              align={right ? "right" : undefined}
                            />
                          );
                        })}
                        {paymentColumnLabels.map((lab) => (
                          <SortTh
                            key={lab}
                            label={<span title={lab}>{lab}</span>}
                            sortKey={`pay:${lab}`}
                            current={agentSort}
                            onSort={onAgentSort}
                            className="max-w-[10rem] truncate whitespace-nowrap px-3 py-3.5 text-xs"
                            align="right"
                          />
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {listQ.isLoading ? (
                        <tr>
                          <td
                            colSpan={
                              Math.max(1, agentsTablePrefs.visibleColumnOrder.length) +
                              paymentColumnLabels.length
                            }
                            className="px-4 py-16 text-center text-slate-400"
                          >
                            Загрузка…
                          </td>
                        </tr>
                      ) : agentRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={
                              Math.max(1, agentsTablePrefs.visibleColumnOrder.length) +
                              paymentColumnLabels.length
                            }
                            className="px-4 py-16 text-center text-slate-400"
                          >
                            По заданным фильтрам данные не найдены
                          </td>
                        </tr>
                      ) : (
                        agentRows.map((r, idx) => (
                          <tr
                            key={`${r.agent_id ?? "none"}-${idx}`}
                            className="border-b border-slate-50 transition-colors hover:bg-muted/60"
                          >
                            {agentsTablePrefs.visibleColumnOrder.map((colId) => {
                              switch (colId) {
                                case "agent_name":
                                  return (
                                    <td
                                      key={colId}
                                      className="max-w-[14rem] truncate whitespace-nowrap px-4 py-3.5"
                                      title={
                                        r.agent_id != null
                                          ? (r.agent_name ?? undefined)
                                          : "Без агента"
                                      }
                                    >
                                      {r.agent_id != null ? (
                                        <span className="font-medium text-slate-800">
                                          {r.agent_name ?? "—"}
                                        </span>
                                      ) : (
                                        <span className="text-slate-400">Без агента</span>
                                      )}
                                    </td>
                                  );
                                case "agent_code":
                                  return (
                                    <td
                                      key={colId}
                                      className="max-w-[8rem] truncate whitespace-nowrap px-3 py-3.5 font-mono text-xs text-slate-600"
                                      title={r.agent_code ?? undefined}
                                    >
                                      {r.agent_code ?? "—"}
                                    </td>
                                  );
                                case "clients_count":
                                  return (
                                    <td
                                      key={colId}
                                      className="whitespace-nowrap px-3 py-3.5 text-right tabular-nums text-slate-700"
                                    >
                                      {r.clients_count}
                                    </td>
                                  );
                                case "balance":
                                  return (
                                    <td key={colId} className="whitespace-nowrap px-3 py-3.5">
                                      <MoneyCell value={r.balance} />
                                    </td>
                                  );
                                case "legacy_debt":
                                  return (
                                    <td key={colId} className="whitespace-nowrap px-3 py-3.5">
                                      <MoneyCell value={r.legacy_debt ?? "0"} />
                                    </td>
                                  );
                                case "current_debt":
                                  return (
                                    <td key={colId} className="whitespace-nowrap px-3 py-3.5">
                                      <MoneyCell value={r.current_debt ?? "0"} />
                                    </td>
                                  );
                                case "is_active":
                                  return (
                                    <td
                                      key={colId}
                                      className="whitespace-nowrap px-3 py-3.5 text-xs text-slate-600"
                                    >
                                      {r.is_active === false ? (
                                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-500">
                                          Архив
                                        </span>
                                      ) : r.is_active === true ? (
                                        <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-700">
                                          Активен
                                        </span>
                                      ) : (
                                        "—"
                                      )}
                                    </td>
                                  );
                                default:
                                  return (
                                    <td
                                      key={colId}
                                      className="whitespace-nowrap px-3 py-3.5 text-slate-300"
                                    >
                                      —
                                    </td>
                                  );
                              }
                            })}
                            {paymentColumnLabels.map((lab, payIdx) => (
                              <td
                                key={`${r.agent_id ?? "x"}-${payIdx}-${lab}`}
                                className="whitespace-nowrap px-3 py-3.5"
                              >
                                <MoneyCell
                                  value={amountForPaymentLabel(r.payment_amounts, lab, payIdx)}
                                />
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {copyFlash ? (
              <p className="px-4 pb-2 text-xs text-[#0c8f5a]" role="status">
                Скопировано
              </p>
            ) : null}

            {activeListTotal != null && activeListTotal > 0 ? (
              <CbPagination
                page={page}
                totalPages={totalPages}
                total={activeListTotal}
                limit={activeListLimit ?? limit}
                selectedCount={isClientLikeView ? selectedClients.size : 0}
                onPage={setPage}
              />
            ) : null}
          </div>
        </div>
      </div>
      {tenantSlug ? (
        <ClientBalancesBulkPaymentDialog
          open={bulkPayOpen}
          onOpenChange={(o) => {
            setBulkPayOpen(o);
            if (!o) setBulkPayClients([]);
          }}
          tenantSlug={tenantSlug}
          clients={bulkPayClients}
          paymentColumnLabels={paymentColumnLabels}
          tradeDirections={catalogTradeDirectionLabels}
          onSaved={() => setSelectedClients(new Map())}
        />
      ) : null}
    </PageShell>
  );
}

function isStatusFilterAll(raw: string): boolean {
  const vals = splitMultiFilterValues(raw);
  if (vals.length === 0) return true;
  return vals.includes("active") && vals.includes("inactive");
}

function DebtWithAgentCell({
  amount,
  agentNames
}: {
  amount: string;
  agentNames?: string | null;
}) {
  const names = agentNames?.trim();
  return (
    <div className="flex max-w-[14rem] items-center justify-end gap-1.5 whitespace-nowrap">
      <MoneyCell value={amount} />
      {names ? (
        <span className="max-w-[6rem] truncate text-[10px] font-normal text-slate-500" title={names}>
          {names}
        </span>
      ) : null}
    </div>
  );
}

function ClientLikeTable({
  variant,
  statusFilter,
  visibleColumnOrder,
  rowKey,
  paymentColumnLabels,
  sort,
  onSort,
  loading,
  rows,
  selected,
  onToggle,
  onToggleAll,
  onCopyId
}: {
  variant: "clients" | "delivery" | "legacy";
  /** «Все» — inactive + non-zero balans uchun belgi */
  statusFilter: string;
  visibleColumnOrder: string[];
  rowKey: (r: ClientBalanceRow, rowIndex: number) => string;
  paymentColumnLabels: string[];
  sort: { col: string; dir: SortDir };
  onSort: (key: string) => void;
  loading: boolean;
  rows: ClientBalanceRow[];
  selected: Map<string, ClientBalanceRow>;
  onToggle: (row: ClientBalanceRow, rowIndex: number) => void;
  onToggleAll: () => void;
  onCopyId: (text: string) => void;
}) {
  const router = useRouter();

  const nPay = paymentColumnLabels.length;
  const colCount = 1 + visibleColumnOrder.length + nPay;
  const note =
    variant === "delivery"
      ? "Одна строка — один доставленный неоплаченный заказ. Клик по строке (кроме ссылки и чекбокса) открывает карточку заказа."
      : variant === "legacy"
        ? "Только клиенты с долгом старого агента (заказы, оформленные не текущим агентом клиента)."
        : null;
  const tableMinPx = Math.max(1100, 900 + visibleColumnOrder.length * 72 + nPay * 112);
  const debtNamesInline = variant !== "legacy";

  const renderHeader = (colId: string) => {
    const label = clientBalancesColLabel(colId, variant);
    const sortKey = CLIENT_BALANCES_SORT_KEY[colId as ClientBalancesColumnId];
    const rightAlign =
      colId === "balance" ||
      colId === "legacy_debt" ||
      colId === "current_debt" ||
      colId === "days_overdue" ||
      colId === "days_since_payment";
    if (!sortKey) {
      return (
        <th
          key={colId}
          className={cn(
            "whitespace-nowrap px-3 py-3.5 text-[12.5px] font-medium text-slate-500",
            rightAlign && "text-right"
          )}
        >
          {label}
        </th>
      );
    }
    return (
      <SortTh
        key={colId}
        label={label}
        sortKey={sortKey}
        current={sort}
        onSort={onSort}
        className={cn("whitespace-nowrap px-3 py-3.5", rightAlign && "text-right")}
        align={rightAlign ? "right" : undefined}
      />
    );
  };

  const renderCell = (r: ClientBalanceRow, rowIndex: number, colId: string) => {
    const oid = rowDeliveryOrderId(r);
    switch (colId) {
      case "order_id": {
        const orderLabel =
          oid != null
            ? `#${oid}${r.delivery_order_number?.trim() ? ` / ${r.delivery_order_number.trim()}` : ""}`
            : null;
        return (
          <td key={colId} className="max-w-[12rem] whitespace-nowrap px-3 py-3.5 text-xs">
            {orderLabel != null && oid != null ? (
              <Link
                className="block truncate font-medium text-[#0e9180] underline-offset-2 hover:underline"
                href={`/orders/${oid}`}
                title={orderLabel}
              >
                {orderLabel}
              </Link>
            ) : (
              "—"
            )}
          </td>
        );
      }
      case "client_id":
        return (
          <td key={colId} className="whitespace-nowrap px-3 py-3.5 font-mono text-xs">
            <div className="flex items-center gap-1.5">
              <Link
                className="shrink-0 font-medium text-[#0e9180] underline-offset-2 hover:underline"
                href={`/clients/${r.client_id}/balances`}
              >
                {clientDisplayId(r)}
              </Link>
              <button
                type="button"
                className="shrink-0 text-slate-300 hover:text-slate-500"
                title="Копировать"
                onClick={() => onCopyId(clientDisplayId(r))}
              >
                <Copy size={13} />
              </button>
            </div>
          </td>
        );
      case "name":
        return (
          <td key={colId} className="max-w-[16rem] whitespace-nowrap px-3 py-3.5">
            <div className="flex max-w-full items-center gap-1.5">
              <Link
                className="min-w-0 truncate font-medium text-slate-800 underline-offset-2 hover:underline"
                href={`/clients/${r.client_id}/balances`}
                title={r.name}
              >
                {r.name}
              </Link>
              {isStatusFilterAll(statusFilter) &&
              r.is_active === false &&
              parseAmount(r.balance) !== 0 ? (
                <span
                  className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:bg-amber-500/25 dark:text-amber-300"
                  title="Неактивный клиент с ненулевым балансом"
                >
                  <AlertCircle className="h-3 w-3" />
                </span>
              ) : null}
            </div>
          </td>
        );
      case "agent_name": {
        const tags = r.agent_tags.length ? r.agent_tags : [r.agent_name ?? "—"];
        return (
          <td key={colId} className="max-w-[14rem] whitespace-nowrap px-3 py-3.5">
            <div className="flex min-w-0 max-w-full flex-nowrap items-center gap-1 overflow-hidden">
              {tags.map((t, i) => (
                <span
                  key={i}
                  className="min-w-0 max-w-full truncate rounded-md bg-[#e6f4f2] px-2 py-1 text-[11.5px] font-medium uppercase text-[#0c7d6f]"
                  title={String(t)}
                >
                  {String(t)}
                </span>
              ))}
            </div>
          </td>
        );
      }
      case "legacy_agent_names":
        return (
          <td
            key={colId}
            className="max-w-[12rem] truncate whitespace-nowrap px-3 py-3.5 text-xs text-slate-700"
            title={r.legacy_agent_names ?? undefined}
          >
            {r.legacy_agent_names?.trim() || "—"}
          </td>
        );
      case "agent_code":
        return (
          <td
            key={colId}
            className="max-w-[8rem] truncate whitespace-nowrap px-3 py-3.5 font-mono text-xs text-slate-600"
            title={r.agent_code ?? undefined}
          >
            {r.agent_code ?? "—"}
          </td>
        );
      case "supervisor_name":
        return (
          <td
            key={colId}
            className="max-w-[8rem] truncate whitespace-nowrap px-3 py-3.5 text-xs text-slate-600"
            title={r.supervisor_name ?? undefined}
          >
            {r.supervisor_name ?? "—"}
          </td>
        );
      case "legal_name":
        return (
          <td
            key={colId}
            className="max-w-[10rem] truncate whitespace-nowrap px-3 py-3.5 text-xs text-slate-700"
            title={r.legal_name ?? undefined}
          >
            {r.legal_name ?? "—"}
          </td>
        );
      case "trade_direction":
        return (
          <td key={colId} className="max-w-[8rem] whitespace-nowrap px-3 py-3.5 text-xs">
            {r.trade_direction ? (
              <span
                className="inline-block max-w-full truncate rounded-md border border-border px-2 py-1 text-[11.5px] font-medium text-slate-600"
                title={r.trade_direction}
              >
                {r.trade_direction}
              </span>
            ) : (
              "—"
            )}
          </td>
        );
      case "inn":
        return (
          <td key={colId} className="whitespace-nowrap px-3 py-3.5 font-mono text-xs text-slate-500">
            {r.inn ?? "—"}
          </td>
        );
      case "phone":
        return (
          <td key={colId} className="whitespace-nowrap px-3 py-3.5 text-xs text-slate-600">
            {r.phone ?? "—"}
          </td>
        );
      case "license_until":
        return (
          <td key={colId} className="whitespace-nowrap px-3 py-3.5 text-xs text-slate-600">
            {formatDateOnly(r.license_until)}
          </td>
        );
      case "days_overdue":
        return (
          <td key={colId} className="whitespace-nowrap px-3 py-3.5 text-right tabular-nums">
            {r.days_overdue != null ? (
              <span
                className={cn(
                  "inline-block rounded-md px-2 py-1 text-[12px] font-semibold ring-1 ring-inset",
                  overdueBadgeClass(r.days_overdue)
                )}
              >
                {r.days_overdue}
              </span>
            ) : (
              <span className="text-slate-300">—</span>
            )}
          </td>
        );
      case "last_order_at":
        return (
          <td key={colId} className="whitespace-nowrap px-3 py-3.5 text-xs text-slate-600">
            {formatDt(r.last_order_at)}
          </td>
        );
      case "last_payment_at":
        return (
          <td key={colId} className="whitespace-nowrap px-3 py-3.5 text-xs text-slate-600">
            {formatDt(r.last_payment_at)}
          </td>
        );
      case "days_since_payment":
        return (
          <td key={colId} className="whitespace-nowrap px-3 py-3.5 text-right tabular-nums text-slate-600">
            {r.days_since_payment != null ? r.days_since_payment : "—"}
          </td>
        );
      case "balance":
        return (
          <td key={colId} className="whitespace-nowrap px-4 py-3.5">
            <MoneyCell value={r.balance} />
          </td>
        );
      case "legacy_debt":
        return (
          <td key={colId} className="whitespace-nowrap px-3 py-3.5">
            {debtNamesInline ? (
              <DebtWithAgentCell amount={r.legacy_debt ?? "0"} agentNames={r.legacy_agent_names} />
            ) : (
              <MoneyCell value={r.legacy_debt ?? "0"} />
            )}
          </td>
        );
      case "current_debt":
        return (
          <td key={colId} className="whitespace-nowrap px-3 py-3.5">
            {debtNamesInline ? (
              <DebtWithAgentCell amount={r.current_debt ?? "0"} agentNames={r.current_agent_name} />
            ) : (
              <MoneyCell value={r.current_debt ?? "0"} />
            )}
          </td>
        );
      default:
        return (
          <td key={colId} className="whitespace-nowrap px-3 py-3.5 text-slate-300">
            —
          </td>
        );
    }
  };

  return (
    <div className="space-y-2">
      {note ? <p className="px-4 text-xs text-slate-500">{note}</p> : null}
      <div className="scrollbar-none overflow-x-auto">
        <table
          className="w-full min-w-0 border-collapse text-[13px]"
          style={{ minWidth: tableMinPx }}
        >
          <thead>
            <tr className="border-y border-border text-left text-[12.5px] font-medium text-slate-500">
              <th className="sticky left-0 z-10 w-12 border-r border-border bg-card px-4 py-3.5">
                <CbCheckbox
                  checked={rows.length > 0 && rows.every((r, i) => selected.has(rowKey(r, i)))}
                  onChange={onToggleAll}
                />
              </th>
              {visibleColumnOrder.map((colId) => renderHeader(colId))}
              {paymentColumnLabels.map((lab) => (
                <SortTh
                  key={lab}
                  label={<span title={lab}>{lab}</span>}
                  sortKey={`pay:${lab}`}
                  current={sort}
                  onSort={onSort}
                  className="max-w-[10rem] truncate whitespace-nowrap px-3 py-3.5 text-xs"
                  align="right"
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-16 text-center text-slate-400">
                  Загрузка…
                </td>
              </tr>
            ) : visibleColumnOrder.length === 0 && nPay === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-16 text-center text-slate-400">
                  Нет видимых столбцов
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-16 text-center text-slate-400">
                  По заданным фильтрам данные не найдены
                </td>
              </tr>
            ) : (
              <>
                {rows.map((r, rowIndex) => {
                  const oid = rowDeliveryOrderId(r);
                  return (
                    <tr
                      key={rowKey(r, rowIndex)}
                      className={cn(
                        "border-b border-slate-50 transition-colors hover:bg-muted/60",
                        variant === "delivery" && oid != null && "cursor-pointer"
                      )}
                      onClick={(e) => {
                        if (variant !== "delivery" || oid == null) return;
                        const el = e.target as HTMLElement;
                        if (el.closest("a,button,input,label")) return;
                        router.push(`/orders/${oid}`);
                      }}
                    >
                      <td
                        className="sticky left-0 z-10 whitespace-nowrap border-r border-border bg-card px-4 py-3.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <CbCheckbox
                          checked={selected.has(rowKey(r, rowIndex))}
                          onChange={() => onToggle(r, rowIndex)}
                        />
                      </td>
                      {visibleColumnOrder.map((colId) => renderCell(r, rowIndex, colId))}
                      {paymentColumnLabels.map((lab, idx) => (
                        <td
                          key={`${rowKey(r, rowIndex)}-${lab}`}
                          className="whitespace-nowrap px-3 py-3.5"
                        >
                          <MoneyCell value={amountForPaymentLabel(r.payment_amounts, lab, idx)} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
