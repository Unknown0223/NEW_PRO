"use client";

import { TableColumnSettingsDialog } from "@/components/data-table/table-column-settings-dialog";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { FilterSearchableSelect } from "@/components/ui/filter-searchable-select";
import { filterPanelSelectClassName } from "@/components/ui/filter-select";
import {
  SearchableMultiSelectPanel,
  type SearchableMultiSelectItem
} from "@/components/ui/searchable-multi-select-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { isAdminOrOperatorLikeRole } from "@/lib/distribution-roles";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { paymentMethodSelectOptions, type ProfilePaymentMethodEntry } from "@/lib/payment-method-options";
import type { PaymentListApiResponse, PaymentListApiRow } from "@/lib/payment-list-types";
import { STALE } from "@/lib/query-stale";
import type { ClientBalanceTerritoryOptions } from "@/lib/client-balances-types";
import {
  buildClientTerritoryFilterLevels,
  buildPaymentTerritorySelectOptions,
  type ClientTerritoryFilterField
} from "@/lib/territory-client-filters";
import type { TerritoryNode } from "@/lib/territory-tree";
import { cn } from "@/lib/utils";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import {
  DEFAULT_EXPEDITOR_PAYMENT_REQUEST_COLUMN_ORDER,
  DEFAULT_HIDDEN_EXPEDITOR_PAYMENT_REQUEST_COLUMNS,
  EXPEDITOR_PAYMENT_REQUEST_COLUMNS,
  EXPEDITOR_PAYMENT_REQUESTS_TABLE_ID
} from "@/components/payments/expeditor-payment-requests-table-config";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  Columns3,
  Download,
  Filter,
  RefreshCw,
  RotateCcw,
  Search,
  Settings
} from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";

type SourceTab = "expeditor" | "collector" | "van" | "bank";
type DealType = "regular" | "consignment" | "both";
type StatusFilter = "pending_confirmation" | "confirmed" | "rejected" | "";

type StaffPick = { id: number; fio: string; code?: string | null };

type FilterState = {
  tab: SourceTab;
  dealType: DealType;
  dateFrom: string;
  dateTo: string;
  status: StatusFilter;
  expeditorIds: number[];
  agentIds: number[];
  paymentType: string;
  tradeDirection: string;
  territoryZone: string;
  territoryRegion: string;
  territoryCity: string;
  territoryDistrict: string;
  search: string;
};

function monthUtc(): { from: string; to: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return { from: `${y}-${pad(m + 1)}-01`, to: `${y}-${pad(m + 1)}-${pad(last)}` };
}

function defaultFilters(): FilterState {
  const { from, to } = monthUtc();
  return {
    tab: "expeditor",
    dealType: "both",
    dateFrom: from,
    dateTo: to,
    status: "pending_confirmation",
    expeditorIds: [],
    agentIds: [],
    paymentType: "",
    tradeDirection: "",
    territoryZone: "",
    territoryRegion: "",
    territoryCity: "",
    territoryDistrict: "",
    search: ""
  };
}

function readTerritoryFilter(f: FilterState, field: ClientTerritoryFilterField): string {
  switch (field) {
    case "zone":
      return f.territoryZone;
    case "region":
      return f.territoryRegion;
    case "city":
      return f.territoryCity;
    case "district":
      return f.territoryDistrict;
    default:
      return "";
  }
}

function patchTerritoryFilter(f: FilterState, field: ClientTerritoryFilterField, value: string): FilterState {
  switch (field) {
    case "zone":
      return { ...f, territoryZone: value, territoryRegion: "", territoryCity: "", territoryDistrict: "" };
    case "region":
      return { ...f, territoryRegion: value, territoryCity: "", territoryDistrict: "" };
    case "city":
      return { ...f, territoryCity: value, territoryDistrict: "" };
    case "district":
      return { ...f, territoryDistrict: value };
    default:
      return f;
  }
}

/** GET /payments `sort_by` — «Срок» (`term`) bo‘yicha bazada alohida maydon yo‘q */
const EPR_SORTABLE_COLUMN_IDS = new Set<string>([
  "payment_id",
  "paid_at",
  "expeditor",
  "client_name",
  "territory",
  "agent",
  "consignment",
  "order_id",
  "amount",
  "payment_type",
  "trade_direction",
  "note",
  "last_change",
  "changed_by"
]);

type EprPaymentRequestSortKey =
  | "payment_id"
  | "paid_at"
  | "expeditor"
  | "client_name"
  | "territory"
  | "agent"
  | "consignment"
  | "order_id"
  | "amount"
  | "payment_type"
  | "trade_direction"
  | "note"
  | "last_change"
  | "changed_by";

const EPR_SORT_DEFAULT: { sortBy: EprPaymentRequestSortKey; sortDir: "asc" | "desc" } = {
  sortBy: "paid_at",
  sortDir: "desc"
};

function defaultSortDirForColumn(colId: string): "asc" | "desc" {
  const descFirst = new Set([
    "payment_id",
    "paid_at",
    "amount",
    "order_id",
    "consignment",
    "last_change"
  ]);
  return descFirst.has(colId) ? "desc" : "asc";
}

function buildListQuery(
  f: FilterState,
  args: { page: number; limit: number; sortBy: EprPaymentRequestSortKey; sortDir: "asc" | "desc" }
): string {
  const p = new URLSearchParams();
  p.set("page", String(args.page));
  p.set("limit", String(args.limit));
  p.set("entry_kind", "payment");
  p.set("date_field", "created_at");
  if (f.dateFrom.trim()) p.set("date_from", f.dateFrom.trim());
  if (f.dateTo.trim()) p.set("date_to", f.dateTo.trim());
  if (f.dealType !== "both") p.set("deal_type", f.dealType);
  p.set("application_channel", f.tab);
  if (f.status) p.set("payment_status", f.status);
  if (f.expeditorIds.length > 0) p.set("expeditor_user_ids", f.expeditorIds.join(","));
  if (f.agentIds.length > 0) p.set("agent_ids", f.agentIds.join(","));
  if (f.paymentType.trim() && f.paymentType !== "__all__") p.set("payment_type", f.paymentType.trim());
  if (f.tradeDirection.trim() && f.tradeDirection !== "__all__") p.set("trade_direction", f.tradeDirection.trim());
  if (f.territoryZone.trim()) p.set("territory_zone", f.territoryZone.trim());
  if (f.territoryRegion.trim()) p.set("territory_region", f.territoryRegion.trim());
  if (f.territoryCity.trim()) p.set("territory_city", f.territoryCity.trim());
  if (f.territoryDistrict.trim()) p.set("territory_district", f.territoryDistrict.trim());
  if (f.search.trim()) p.set("search", f.search.trim());
  p.set("sort_by", args.sortBy);
  p.set("sort_dir", args.sortDir);
  return p.toString();
}

/** Alohida filtr / jadval kartalari — chegaralar bir-biriga qo‘shilmasin */
const blockCardClass =
  "rounded-xl border border-slate-200 bg-white shadow-sm dark:border-border dark:bg-card dark:shadow-none";

/** Тип заявки / дата — ikki qator (sarlavha + boshqaruv) */
const filterFieldShellStacked =
  "flex min-h-[3.25rem] flex-col justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-input dark:bg-background";
/** Popover / trigger filtrlari uchun bir xil fon va chegarа */
const eprFilterTriggerTint = "border-slate-200 bg-white dark:border-input dark:bg-background";

const filterFieldCaption = "text-[10px] font-medium uppercase tracking-wide text-muted-foreground";

export function ExpeditorPaymentRequestsWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const role = useEffectiveRole();
  const qc = useQueryClient();
  const canAct = isAdminOrOperatorLikeRole(role);
  const isAdmin = role === "admin";

  const [applied, setApplied] = useState<FilterState>(() => defaultFilters());
  const [draft, setDraft] = useState<FilterState>(() => defaultFilters());
  /** Ochiq portal-filtrlarni faqat «Применить» / сброс / tabda yopish. Ochilishda bump qilinmasin — aks holda barcha instanslar o‘zini yopadi. */
  const [filterCloseTok, setFilterCloseTok] = useState(0);
  const [exMultiSearch, setExMultiSearch] = useState("");
  const [agMultiSearch, setAgMultiSearch] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const dateRef = useRef<HTMLButtonElement>(null);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<EprPaymentRequestSortKey>(EPR_SORT_DEFAULT.sortBy);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(EPR_SORT_DEFAULT.sortDir);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false);

  const tablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: EXPEDITOR_PAYMENT_REQUESTS_TABLE_ID,
    defaultColumnOrder: DEFAULT_EXPEDITOR_PAYMENT_REQUEST_COLUMN_ORDER,
    defaultPageSize: 10,
    allowedPageSizes: [10, 20, 30, 50],
    defaultHiddenColumnIds: [...DEFAULT_HIDDEN_EXPEDITOR_PAYMENT_REQUEST_COLUMNS]
  });

  const allowedColIds = useMemo(() => new Set(EXPEDITOR_PAYMENT_REQUEST_COLUMNS.map((c) => c.id)), []);
  const visibleDataColumns = useMemo(
    () => tablePrefs.visibleColumnOrder.filter((id) => allowedColIds.has(id)),
    [tablePrefs.visibleColumnOrder, allowedColIds]
  );

  const expeditorsQ = useQuery({
    queryKey: ["expeditors", tenantSlug, "payment-requests"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: StaffPick[] }>(`/api/${tenantSlug}/expeditors?is_active=true`);
      return data.data ?? [];
    }
  });

  const agentsQ = useQuery({
    queryKey: ["agents", tenantSlug, "payment-requests"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: StaffPick[] }>(`/api/${tenantSlug}/agents?is_active=true`);
      return data.data ?? [];
    }
  });

  const filterOptQ = useQuery({
    queryKey: ["agents-filter-options", tenantSlug, "expeditor-requests"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: { trade_directions: string[] } }>(
        `/api/${tenantSlug}/agents/filter-options`
      );
      return data.data;
    }
  });

  const clientRefsQ = useQuery({
    queryKey: ["clients-references", tenantSlug, "expeditor-requests"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{
        regions?: string[];
        cities?: string[];
        districts?: string[];
        zones?: string[];
        region_options?: { value: string; label: string }[];
        city_options?: { value: string; label: string }[];
      }>(`/api/${tenantSlug}/clients/references`);
      return data;
    }
  });

  const territoryOptsQ = useQuery({
    queryKey: ["client-balances-territory-options", tenantSlug, "expeditor-requests"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: ClientBalanceTerritoryOptions }>(
        `/api/${tenantSlug}/client-balances/territory-options`
      );
      return data.data;
    }
  });

  const profileQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug, "expeditor-requests-methods"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{
        references?: {
          payment_types?: string[];
          payment_method_entries?: ProfilePaymentMethodEntry[];
          trade_directions?: string[];
          territory_levels?: string[];
          territory_nodes?: TerritoryNode[];
        };
      }>(`/api/${tenantSlug}/settings/profile`);
      return data.references ?? {};
    }
  });

  const territoryFilterSpecs = useMemo(
    () => buildClientTerritoryFilterLevels(profileQ.data?.territory_levels),
    [profileQ.data?.territory_levels]
  );

  const payFilterOpts = useMemo(
    () => paymentMethodSelectOptions(profileQ.data, profileQ.data?.payment_types),
    [profileQ.data]
  );

  const tradeDirectionOptions = useMemo(() => {
    const s = new Set<string>();
    for (const x of filterOptQ.data?.trade_directions ?? []) {
      const t = x.trim();
      if (t) s.add(t);
    }
    for (const x of profileQ.data?.trade_directions ?? []) {
      const t = x.trim();
      if (t) s.add(t);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ru"));
  }, [filterOptQ.data?.trade_directions, profileQ.data?.trade_directions]);

  const tradeDirectionFilterOptions = useMemo(
    () => tradeDirectionOptions.map((td) => ({ value: td, label: td })),
    [tradeDirectionOptions]
  );

  const expeditorMultiItems = useMemo((): SearchableMultiSelectItem<number>[] => {
    const q = exMultiSearch.trim().toLowerCase();
    const rows = (expeditorsQ.data ?? []).map((e) => {
      const title = `${e.fio}${e.code ? ` (${e.code})` : ""}`;
      return { id: e.id, title, subtitle: e.code ?? null };
    });
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.subtitle && r.subtitle.toLowerCase().includes(q)) ||
        String(r.id).includes(q)
    );
  }, [expeditorsQ.data, exMultiSearch]);

  const agentMultiItems = useMemo((): SearchableMultiSelectItem<number>[] => {
    const q = agMultiSearch.trim().toLowerCase();
    const rows = (agentsQ.data ?? []).map((a) => ({
      id: a.id,
      title: `${a.fio}${a.code ? ` (${a.code})` : ""}`,
      subtitle: a.code ?? null
    }));
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.subtitle && r.subtitle.toLowerCase().includes(q)) ||
        String(r.id).includes(q)
    );
  }, [agentsQ.data, agMultiSearch]);

  const listQ = useQuery({
    queryKey: ["expeditor-payment-requests", tenantSlug, applied, page, tablePrefs.pageSize, sortBy, sortDir],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.list,
    queryFn: async () => {
      const qs = buildListQuery(applied, { page, limit: tablePrefs.pageSize, sortBy, sortDir });
      const { data } = await api.get<PaymentListApiResponse>(`/api/${tenantSlug}/payments?${qs}`);
      return data;
    }
  });

  const handleSortColumnClick = useCallback((colId: string) => {
    if (!EPR_SORTABLE_COLUMN_IDS.has(colId)) return;
    const key = colId as EprPaymentRequestSortKey;
    setPage(1);
    setSelected(new Set());
    setSortBy((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir(defaultSortDirForColumn(colId));
      return key;
    });
  }, []);

  const batchConfirmMut = useMutation({
    mutationFn: async (ids: number[]) => {
      const { data } = await api.post<{ ok: number[]; failed: { id: number; error: string }[] }>(
        `/api/${tenantSlug}/payments/batch-confirm`,
        { ids }
      );
      return data;
    },
    onSuccess: () => {
      setSelected(new Set());
      void qc.invalidateQueries({ queryKey: ["expeditor-payment-requests", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["payments", tenantSlug] });
    }
  });

  const [rejectBusy, setRejectBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const applyFilters = useCallback(() => {
    setFilterCloseTok((t) => t + 1);
    setApplied({ ...draft });
    setPage(1);
    setSelected(new Set());
  }, [draft]);

  const resetFilters = useCallback(() => {
    setFilterCloseTok((t) => t + 1);
    const d = defaultFilters();
    setDraft(d);
    setApplied(d);
    setPage(1);
    setSelected(new Set());
    setSortBy(EPR_SORT_DEFAULT.sortBy);
    setSortDir(EPR_SORT_DEFAULT.sortDir);
  }, []);

  const setTab = (tab: SourceTab) => {
    setFilterCloseTok((t) => t + 1);
    setDraft((d) => ({ ...d, tab }));
    setApplied((a) => ({ ...a, tab }));
    setPage(1);
    setSelected(new Set());
  };

  const toggleRow = (id: number) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const rows = listQ.data?.data ?? [];
  const total = listQ.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / tablePrefs.pageSize));
  const pendingOnPage = rows.filter((r) => r.workflow_status === "pending_confirmation").map((r) => r.id);
  const allPendingSelected =
    pendingOnPage.length > 0 && pendingOnPage.every((id) => selected.has(id));

  const toggleAllPage = () => {
    if (pendingOnPage.length === 0) return;
    const allSel = pendingOnPage.every((id) => selected.has(id));
    setSelected((prev) => {
      const n = new Set(prev);
      if (allSel) for (const id of pendingOnPage) n.delete(id);
      else for (const id of pendingOnPage) n.add(id);
      return n;
    });
  };

  const selectedRows = useMemo(
    () => rows.filter((r) => selected.has(r.id)),
    [rows, selected]
  );
  const allSelectedPending =
    selectedRows.length > 0 && selectedRows.every((r) => r.workflow_status === "pending_confirmation");
  const allSelectedConfirmed =
    selectedRows.length > 0 && selectedRows.every((r) => r.workflow_status === "confirmed");
  const deleteActionEnabled =
    canAct &&
    selected.size > 0 &&
    !rejectBusy &&
    !deleteBusy &&
    (allSelectedPending || (isAdmin && allSelectedConfirmed));

  const exportXlsx = useCallback(async () => {
    if (!rows.length) return;
    await downloadXlsxSheet(
      `expeditor-payment-requests-${applied.dateFrom}_${applied.dateTo}.xlsx`,
      "Заявки",
      [
        "ID оплаты",
        "Дата оплаты",
        "Экспедитор",
        "Клиенты",
        "Территория",
        "Агент",
        "Консигнация",
        "Заказ ID",
        "Сумма",
        "Способ оплаты",
        "Срок",
        "Направление торговли",
        "Комментарий",
        "Дата последнего изменения",
        "Кто изменил",
        "Статус"
      ],
      rows.map((r) => [
        r.id,
        r.paid_at?.slice(0, 10) ?? r.created_at?.slice(0, 10) ?? "",
        r.expeditor_name ?? "",
        r.client_name,
        [r.client_region, r.client_city, r.client_district].filter(Boolean).join(" / "),
        r.agent_name ?? "",
        r.consignment ? "да" : "нет",
        r.order_number ?? "",
        r.amount,
        r.payment_type,
        "—",
        r.trade_direction ?? "",
        r.note ?? "",
        r.confirmed_at ?? r.created_at ?? "",
        r.deleted_by_name ?? "—",
        r.workflow_status
      ]),
      { colWidths: [10, 12, 16, 22, 22, 14, 10, 12, 12, 14, 8, 16, 28, 18, 14, 18] }
    );
  }, [applied.dateFrom, applied.dateTo, rows]);

  if (!hydrated) return <p className="text-sm text-muted-foreground">Загрузка сессии…</p>;
  if (!tenantSlug) {
    return (
      <p className="text-sm text-destructive">
        <Link href="/login" className="underline">
          Войти
        </Link>
      </p>
    );
  }

  const dataColSpan = 1 + visibleDataColumns.length;

  const renderPaymentRequestDataCell = (r: PaymentListApiRow, colId: string) => {
    switch (colId) {
      case "payment_id":
        return (
          <td key={colId} className="px-2 py-2 font-mono text-xs">
            <Link href={`/payments/${r.id}`} className="text-teal-700 underline dark:text-teal-400">
              {r.id}
            </Link>
          </td>
        );
      case "paid_at":
        return (
          <td key={colId} className="px-2 py-2 tabular-nums text-xs text-slate-700 dark:text-foreground/90">
            {r.paid_at?.slice(0, 10) ?? "—"}
          </td>
        );
      case "expeditor":
        return (
          <td key={colId} className="max-w-[120px] truncate px-2 py-2 text-xs">
            {r.expeditor_name ?? "—"}
          </td>
        );
      case "client_name":
        return (
          <td key={colId} className="max-w-[140px] truncate px-2 py-2 font-medium">
            {r.client_name}
          </td>
        );
      case "territory":
        return (
          <td key={colId} className="max-w-[160px] truncate px-2 py-2 text-xs text-muted-foreground">
            {[r.client_region, r.client_city, r.client_district].filter(Boolean).join(" / ") || "—"}
          </td>
        );
      case "agent":
        return (
          <td key={colId} className="max-w-[100px] truncate px-2 py-2 text-xs">
            {r.agent_name ?? "—"}
          </td>
        );
      case "consignment":
        return (
          <td key={colId} className="px-2 py-2 text-xs">
            {r.consignment ? "да" : "нет"}
          </td>
        );
      case "order_id":
        return (
          <td key={colId} className="px-2 py-2 font-mono text-xs">
            {r.order_number ?? "—"}
          </td>
        );
      case "amount":
        return (
          <td key={colId} className="px-2 py-2 text-right tabular-nums font-semibold text-slate-900 dark:text-foreground">
            {formatNumberGrouped(r.amount, { minFractionDigits: 0, maxFractionDigits: 0 })}
          </td>
        );
      case "payment_type":
        return (
          <td key={colId} className="max-w-[100px] truncate px-2 py-2 text-xs">
            {r.payment_type}
          </td>
        );
      case "term":
        return (
          <td key={colId} className="px-2 py-2 text-xs text-muted-foreground">
            —
          </td>
        );
      case "trade_direction":
        return (
          <td key={colId} className="max-w-[120px] truncate px-2 py-2 text-xs">
            {r.trade_direction ?? "—"}
          </td>
        );
      case "note":
        return (
          <td
            key={colId}
            className="max-w-[180px] truncate px-2 py-2 text-xs text-muted-foreground"
            title={r.note ?? ""}
          >
            {r.note ?? "—"}
          </td>
        );
      case "last_change":
        return (
          <td key={colId} className="whitespace-nowrap px-2 py-2 text-xs text-muted-foreground">
            {(r.confirmed_at ?? r.created_at)?.slice(0, 19).replace("T", " ") ?? "—"}
          </td>
        );
      case "changed_by":
        return (
          <td key={colId} className="max-w-[100px] truncate px-2 py-2 text-xs text-muted-foreground">
            {r.deleted_by_name ?? "—"}
          </td>
        );
      default:
        return null;
    }
  };

  const thClassForCol = (colId: string) =>
    cn(
      "px-2 py-2.5",
      colId === "amount" && "text-right",
      colId === "note" && "min-w-[140px]"
    );

  const tabBtn = (key: SourceTab, label: string) => (
    <Button
      key={key}
      type="button"
      size="sm"
      variant={draft.tab === key ? "default" : "outline"}
      className={cn(
        "h-9 rounded-md px-4 text-sm font-medium shadow-sm",
        draft.tab === key
          ? "bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-600"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-input dark:bg-card dark:text-muted-foreground dark:hover:bg-muted/60"
      )}
      onClick={() => setTab(key)}
    >
      {label}
    </Button>
  );

  return (
    <PageShell className="space-y-6">
      <PageHeader
        className="border-0 pb-1 dark:border-transparent"
        title={
          <span className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl dark:text-foreground">
            Заявки на оплату экспедиторов
          </span>
        }
        description="Подтверждение заявок в кассе; отклонение или архив (admin) — внизу страницы."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex flex-wrap justify-end gap-2">
              {tabBtn("expeditor", "Экспедиторы")}
              {tabBtn("collector", "Инкассатор")}
              {tabBtn("van", "Van-selling")}
              {tabBtn("bank", "Банковские оплаты")}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-2 border-slate-200 shadow-sm dark:border-input"
              onClick={() => setPageSettingsOpen(true)}
            >
              <Settings className="size-4" />
              Настройки
            </Button>
          </div>
        }
      />

      {/* Blok 1: faqat filtr — jadvaldan mustaqil chegarada */}
      <section className={cn(blockCardClass, "overflow-hidden")} aria-labelledby="epr-filter-heading">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-start sm:justify-between dark:border-border">
          <h2 id="epr-filter-heading" className="text-sm font-semibold text-slate-800 dark:text-foreground">
            Фильтр
          </h2>
          <div className="flex flex-wrap items-end justify-start gap-2 sm:justify-end">
            <div className={cn(filterFieldShellStacked, "min-w-0 sm:max-w-md")}>
              <span className={filterFieldCaption}>Тип заявки</span>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="deal_type"
                    className="size-4 accent-teal-600"
                    checked={draft.dealType === "regular"}
                    onChange={() => setDraft((d) => ({ ...d, dealType: "regular" }))}
                  />
                  Обычная
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="deal_type"
                    className="size-4 accent-teal-600"
                    checked={draft.dealType === "consignment"}
                    onChange={() => setDraft((d) => ({ ...d, dealType: "consignment" }))}
                  />
                  Для консигнации
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="deal_type"
                    className="size-4 accent-teal-600"
                    checked={draft.dealType === "both"}
                    onChange={() => setDraft((d) => ({ ...d, dealType: "both" }))}
                  />
                  Обе
                </label>
              </div>
            </div>
            <div className="flex h-10 w-full min-w-[12rem] items-center rounded-lg border border-slate-200 bg-white px-2 dark:border-input dark:bg-background sm:w-auto sm:min-w-[220px]">
              <Button
                ref={dateRef}
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-full justify-start gap-2 px-0 font-normal hover:bg-transparent"
                onClick={() => setDateOpen((o) => !o)}
                aria-label="Период дат"
              >
                <CalendarDays className="size-4 shrink-0 text-slate-500" />
                <span className="truncate">{formatDateRangeButton(draft.dateFrom, draft.dateTo)}</span>
              </Button>
              <DateRangePopover
                open={dateOpen}
                onOpenChange={setDateOpen}
                anchorRef={dateRef}
                dateFrom={draft.dateFrom}
                dateTo={draft.dateTo}
                onApply={({ dateFrom: f, dateTo: t }) => setDraft((d) => ({ ...d, dateFrom: f, dateTo: t }))}
              />
            </div>
            <details className="relative">
              <summary
                className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 dark:border-input dark:bg-background dark:text-muted-foreground [&::-webkit-details-marker]:hidden"
                title="Подсказка"
              >
                <Filter className="size-4" />
              </summary>
              <div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-lg dark:border-border dark:bg-popover">
                Канал — вкладки в шапке. После изменения фильтров нажмите «Применить» внизу блока.
              </div>
            </details>
          </div>
        </div>

        <div id="epr-filter-grid" className="space-y-4 p-4 sm:p-5">
            <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <div className="min-w-0">
                <SearchableMultiSelectPanel<number>
                  hideOuterLabel
                  label="Экспедитор"
                  triggerPlaceholder="Экспедитор"
                  triggerClassName={eprFilterTriggerTint}
                  closeToken={filterCloseTok}
                  loading={expeditorsQ.isLoading}
                  items={expeditorMultiItems}
                  selected={new Set(draft.expeditorIds)}
                  onSelectedChange={(action) => {
                    setDraft((d) => {
                      const prev = new Set(d.expeditorIds);
                      const next = typeof action === "function" ? action(prev) : action;
                      return { ...d, expeditorIds: Array.from(next).sort((a, b) => a - b) };
                    });
                  }}
                  search={exMultiSearch}
                  onSearchChange={setExMultiSearch}
                  emptyMessage="Нет экспедиторов"
                />
              </div>
              <div className="min-w-0">
                <FilterSearchableSelect
                  emptyLabel="Направление торговли"
                  value={draft.tradeDirection}
                  onValueChange={(v) => setDraft((d) => ({ ...d, tradeDirection: v }))}
                  options={tradeDirectionFilterOptions}
                  closeToken={filterCloseTok}
                  className={eprFilterTriggerTint}
                />
              </div>
              <div className="min-w-0">
                <FilterSearchableSelect
                  emptyLabel="Способ оплаты"
                  value={draft.paymentType}
                  onValueChange={(v) => setDraft((d) => ({ ...d, paymentType: v }))}
                  options={payFilterOpts.map((o) => ({ value: o.value, label: o.label }))}
                  closeToken={filterCloseTok}
                  className={eprFilterTriggerTint}
                />
              </div>
              <div className="min-w-0">
                <FilterSearchableSelect
                  emptyLabel="Статус"
                  searchable={false}
                  value={draft.status}
                  onValueChange={(v) => setDraft((d) => ({ ...d, status: v as StatusFilter }))}
                  options={[
                    { value: "pending_confirmation", label: "Ожидание подтверждения" },
                    { value: "confirmed", label: "Подтверждена" },
                    { value: "rejected", label: "Отклонена" }
                  ]}
                  closeToken={filterCloseTok}
                  className={eprFilterTriggerTint}
                />
              </div>
              <div className="min-w-0">
                <SearchableMultiSelectPanel<number>
                  hideOuterLabel
                  label="Агент"
                  triggerPlaceholder="Агент"
                  triggerClassName={eprFilterTriggerTint}
                  closeToken={filterCloseTok}
                  loading={agentsQ.isLoading}
                  items={agentMultiItems}
                  selected={new Set(draft.agentIds)}
                  onSelectedChange={(action) => {
                    setDraft((d) => {
                      const prev = new Set(d.agentIds);
                      const next = typeof action === "function" ? action(prev) : action;
                      return { ...d, agentIds: Array.from(next).sort((a, b) => a - b) };
                    });
                  }}
                  search={agMultiSearch}
                  onSearchChange={setAgMultiSearch}
                  emptyMessage="Нет агентов"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 lg:flex-row lg:items-end lg:justify-between dark:border-border">
              <div
                className={cn(
                  "grid min-w-0 flex-1 gap-2",
                  territoryFilterSpecs.length <= 2 && "sm:grid-cols-2",
                  territoryFilterSpecs.length === 3 && "sm:grid-cols-2 lg:grid-cols-3",
                  territoryFilterSpecs.length >= 4 && "sm:grid-cols-2 lg:grid-cols-4"
                )}
              >
                {territoryFilterSpecs.map((spec) => {
                  const opts = buildPaymentTerritorySelectOptions(
                    spec.field,
                    clientRefsQ.data,
                    territoryOptsQ.data,
                    profileQ.data?.territory_nodes,
                    readTerritoryFilter(draft, spec.field)
                  );
                  const territorySelectOptions = opts.map((o) => ({ value: o.value, label: o.label }));
                  return (
                    <div key={`${spec.field}-${spec.visIndex}`} className="min-w-0">
                      <FilterSearchableSelect
                        emptyLabel={spec.label}
                        value={readTerritoryFilter(draft, spec.field)}
                        onValueChange={(v) => setDraft((d) => patchTerritoryFilter(d, spec.field, v))}
                        options={territorySelectOptions}
                        closeToken={filterCloseTok}
                        className={eprFilterTriggerTint}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0 border-slate-200 shadow-sm dark:border-input"
                  title="Сброс фильтров"
                  onClick={resetFilters}
                >
                  <RotateCcw className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-10 min-w-[10rem] bg-teal-600 px-6 font-medium text-white shadow-sm hover:bg-teal-700"
                  onClick={applyFilters}
                >
                  Применить
                </Button>
              </div>
            </div>
        </div>
      </section>

      <section className={cn(blockCardClass, "overflow-hidden")} aria-label="Таблица заявок">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between dark:border-border dark:bg-card">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 text-slate-500"
                title="Колонки таблицы"
                onClick={() => setColumnDialogOpen(true)}
              >
                <Columns3 className="size-4" />
              </Button>
              <select
                className={cn(
                  filterPanelSelectClassName,
                  "h-9 w-[4.5rem] min-w-0 max-w-none shrink-0 bg-white text-sm dark:bg-background"
                )}
                value={String(tablePrefs.pageSize)}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10) || 10;
                  tablePrefs.setPageSize(n);
                  setPage(1);
                }}
                aria-label="Строк на странице"
              >
                {[10, 20, 30, 50].map((n) => (
                  <option key={n} value={String(n)}>
                    {n}
                  </option>
                ))}
              </select>
              <div className="relative min-w-0 w-full max-w-xl flex-1 sm:min-w-[12rem]">
                <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                <Input
                  className="h-9 pl-9"
                  placeholder="Поиск"
                  value={draft.search}
                  onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyFilters();
                  }}
                />
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                size="sm"
                className="h-9 gap-1 bg-green-600 px-3 text-white hover:bg-green-700"
                onClick={() => void exportXlsx()}
              >
                <Download className="size-3.5" />
                Excel
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9 shrink-0"
                title="Обновить"
                onClick={() => void listQ.refetch()}
              >
                <RefreshCw className={cn("size-4", listQ.isFetching && "animate-spin")} />
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto bg-white dark:bg-card">
            <table className="w-full min-w-[1280px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:border-border dark:bg-muted/40 dark:text-muted-foreground">
                  <th className="w-10 px-2 py-2.5">
                    <input
                      type="checkbox"
                      checked={allPendingSelected}
                      onChange={toggleAllPage}
                      disabled={!canAct || pendingOnPage.length === 0}
                      aria-label="Выбрать все на странице"
                    />
                  </th>
                  {visibleDataColumns.map((colId) => {
                    const def = EXPEDITOR_PAYMENT_REQUEST_COLUMNS.find((c) => c.id === colId);
                    const sortable = EPR_SORTABLE_COLUMN_IDS.has(colId);
                    const active = sortable && sortBy === colId;
                    return (
                      <th key={colId} className={cn(thClassForCol(colId), sortable && "p-0")}>
                        {sortable ? (
                          <button
                            type="button"
                            className={cn(
                              "group flex w-full min-w-0 items-center gap-1 px-2 py-2.5 text-[11px] font-semibold uppercase tracking-wide",
                              colId === "amount" ? "justify-end text-right" : "text-left",
                              "text-slate-600 hover:bg-slate-200/90 dark:text-muted-foreground dark:hover:bg-muted/70"
                            )}
                            onClick={() => handleSortColumnClick(colId)}
                          >
                            <span className="min-w-0 flex-1 truncate">{def?.label ?? colId}</span>
                            {active ? (
                              sortDir === "asc" ? (
                                <ArrowUp className="size-3.5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
                              ) : (
                                <ArrowDown className="size-3.5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
                              )
                            ) : (
                              <ArrowUpDown
                                className="size-3.5 shrink-0 opacity-35 group-hover:opacity-70"
                                aria-hidden
                              />
                            )}
                          </button>
                        ) : (
                          <span className="block px-2 py-2.5">{def?.label ?? colId}</span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {listQ.isFetching && !listQ.data ? (
                  <tr>
                    <td colSpan={dataColSpan} className="px-3 py-10 text-center text-muted-foreground">
                      Загрузка…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={dataColSpan} className="px-3 py-10 text-center text-muted-foreground">
                      Пусто
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-slate-100 hover:bg-slate-50/60 dark:border-border dark:hover:bg-muted/20"
                    >
                      <td className="px-2 py-2">
                        {r.workflow_status === "pending_confirmation" && canAct ? (
                          <input
                            type="checkbox"
                            checked={selected.has(r.id)}
                            onChange={() => toggleRow(r.id)}
                            aria-label={`Выбрать ${r.id}`}
                          />
                        ) : (
                          <span className="inline-block w-4" />
                        )}
                      </td>
                      {visibleDataColumns.map((colId) => renderPaymentRequestDataCell(r, colId))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 || total > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2 text-xs text-muted-foreground dark:border-border">
              <span>
                Стр. {page} из {totalPages} · записей: {total}
              </span>
              <div className="flex gap-1">
                <Button type="button" variant="outline" size="sm" className="h-8" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Назад
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Вперёд
                </Button>
              </div>
            </div>
          ) : null}
      </section>

      <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              type="button"
              size="sm"
              disabled={!canAct || !allSelectedPending || batchConfirmMut.isPending}
              className={cn(
                "h-10 min-w-[10rem] border-teal-600 bg-teal-50 font-medium text-teal-900 shadow-sm hover:bg-teal-100 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-teal-700 dark:bg-teal-950/40 dark:text-teal-100 dark:hover:bg-teal-950/60 dark:disabled:opacity-50"
              )}
              variant="outline"
              onClick={() => {
                if (!window.confirm(`Подтвердить ${selected.size} оплат? Баланс клиента будет увеличен.`)) return;
                batchConfirmMut.mutate(Array.from(selected));
              }}
            >
              {batchConfirmMut.isPending ? "…" : "Подтверждение"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!deleteActionEnabled}
              title={
                allSelectedPending
                  ? "Отклонить выбранные заявки"
                  : isAdmin && allSelectedConfirmed
                    ? "В архив (сторно по балансу)"
                    : "Выберите строки одного статуса: ожидание или подтверждена (admin)"
              }
              className="h-10 min-w-[8rem] border-rose-300 bg-rose-50/90 font-medium text-rose-900 hover:bg-rose-100 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-100 dark:hover:bg-rose-950/50 dark:disabled:opacity-50"
              onClick={() => {
                if (allSelectedPending) {
                  const reason = window.prompt("Причина отклонения (необязательно):") ?? "";
                  if (!window.confirm(`Отклонить ${selected.size} заявок?`)) return;
                  void (async () => {
                    setRejectBusy(true);
                    try {
                      for (const id of Array.from(selected)) {
                        await api.post(`/api/${tenantSlug}/payments/${id}/reject`, {
                          reason: reason.trim() || undefined
                        });
                      }
                      setSelected(new Set());
                      void qc.invalidateQueries({ queryKey: ["expeditor-payment-requests", tenantSlug] });
                      void qc.invalidateQueries({ queryKey: ["payments", tenantSlug] });
                    } finally {
                      setRejectBusy(false);
                    }
                  })();
                  return;
                }
                if (isAdmin && allSelectedConfirmed) {
                  const reason = window.prompt("Причина удаления в архив (обязательно для аудита):") ?? "";
                  if (!reason.trim()) {
                    window.alert("Укажите причину.");
                    return;
                  }
                  if (
                    !window.confirm(
                      `В архив (удаление) ${selected.size} подтверждённых оплат? Будет сторно по балансу клиента.`
                    )
                  )
                    return;
                  void (async () => {
                    setDeleteBusy(true);
                    try {
                      for (const id of Array.from(selected)) {
                        const sp = new URLSearchParams();
                        sp.set("cancel_reason_ref", reason.trim().slice(0, 128));
                        await api.delete(`/api/${tenantSlug}/payments/${id}?${sp.toString()}`);
                      }
                      setSelected(new Set());
                      void qc.invalidateQueries({ queryKey: ["expeditor-payment-requests", tenantSlug] });
                      void qc.invalidateQueries({ queryKey: ["payments", tenantSlug] });
                    } finally {
                      setDeleteBusy(false);
                    }
                  })();
                }
              }}
            >
              {rejectBusy || deleteBusy ? "…" : "Удалить"}
            </Button>
            <Link href="/payments" className="ml-auto text-xs text-teal-700 underline dark:text-teal-400">
              Все оплаты
            </Link>
      </div>

      {batchConfirmMut.data?.failed?.length ? (
        <p className="text-sm text-destructive">
          Не подтверждены: {batchConfirmMut.data.failed.map((f) => `${f.id} (${f.error})`).join(", ")}
        </p>
      ) : null}

      {draft.tab !== "expeditor" ? (
        <p className="text-xs text-muted-foreground">
          Канал «{draft.tab}» — серверная эвристика по полям оплаты / агента / примечания.
        </p>
      ) : null}

      <Dialog open={pageSettingsOpen} onOpenChange={setPageSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Настройки страницы</DialogTitle>
            <DialogDescription>
              Размер страницы и столбцы таблицы сохраняются для вашей учётной записи.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="epr-page-size" className="text-xs text-muted-foreground">
                Строк на странице
              </Label>
              <select
                id="epr-page-size"
                className={cn(filterPanelSelectClassName, "h-10 w-full max-w-none bg-background")}
                value={String(tablePrefs.pageSize)}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10) || 10;
                  tablePrefs.setPageSize(n);
                  setPage(1);
                }}
              >
                {[10, 20, 30, 50].map((n) => (
                  <option key={n} value={String(n)}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => {
                setPageSettingsOpen(false);
                setColumnDialogOpen(true);
              }}
            >
              Управление столбцами…
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <TableColumnSettingsDialog
        open={columnDialogOpen}
        onOpenChange={setColumnDialogOpen}
        title="Управление столбцами"
        description="Видимые столбцы и порядок сохраняются для вашей учётной записи."
        columns={EXPEDITOR_PAYMENT_REQUEST_COLUMNS}
        columnOrder={tablePrefs.columnOrder}
        hiddenColumnIds={tablePrefs.hiddenColumnIds}
        saving={tablePrefs.saving}
        onSave={(next) => tablePrefs.saveColumnLayout(next)}
        onReset={() => tablePrefs.resetColumnLayout()}
      />
    </PageShell>
  );
}
