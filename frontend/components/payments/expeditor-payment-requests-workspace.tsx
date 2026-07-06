"use client";

import { TableColumnSettingsDialog } from "@/components/data-table/table-column-settings-dialog";
import { TemplatePagination } from "@/components/payments/client-payments/template-pagination";
import { EprBulkDeleteModal } from "@/components/payments/expeditor-payment-requests/epr-bulk-delete-modal";
import { EprFiltersPanel } from "@/components/payments/expeditor-payment-requests/epr-filters-panel";
import { EprFloatingActionBar } from "@/components/payments/expeditor-payment-requests/epr-floating-action-bar";
import { EprPageLayout } from "@/components/payments/expeditor-payment-requests/epr-page-layout";
import { EprRestoreActionBar } from "@/components/payments/expeditor-payment-requests/epr-restore-action-bar";
import { EprTabBar } from "@/components/payments/expeditor-payment-requests/epr-tab-bar";
import {
  defaultEprFilters,
  type EprFilterState,
  type SourceTab
} from "@/components/payments/expeditor-payment-requests/expeditor-payment-requests-types";
import {
  DEFAULT_EXPEDITOR_PAYMENT_REQUEST_COLUMN_ORDER,
  DEFAULT_HIDDEN_EXPEDITOR_PAYMENT_REQUEST_COLUMNS,
  EXPEDITOR_PAYMENT_REQUEST_COLUMNS,
  EXPEDITOR_PAYMENT_REQUESTS_TABLE_ID
} from "@/components/payments/expeditor-payment-requests-table-config";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { filterPanelSelectClassName } from "@/components/ui/filter-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { api } from "@/lib/api";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import type { ClientBalanceTerritoryOptions } from "@/lib/client-balances-types";
import { isAdminOrOperatorLikeRole } from "@/lib/distribution-roles";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { staffPickerDisplayName, staffPickerSearchText } from "@/lib/person-display";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { paymentMethodSelectOptions, type ProfilePaymentMethodEntry } from "@/lib/payment-method-options";
import type { PaymentListApiResponse, PaymentListApiRow } from "@/lib/payment-list-types";
import { STALE } from "@/lib/query-stale";
import { useActiveTradeDirectionsCatalog } from "@/hooks/use-active-trade-directions-catalog";
import {
  buildClientTerritoryFilterLevels,
  buildPaymentTerritorySelectOptions,
  type ClientTerritoryFilterField
} from "@/lib/territory-client-filters";
import type { TerritoryNode } from "@/lib/territory-tree";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Clock,
  Columns3,
  Download,
  ExternalLink,
  RefreshCw,
  Search,
  Settings,
  Smartphone,
  Trash2
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type StaffPick = { id: number; fio: string; code?: string | null };

function readTerritoryFilter(f: EprFilterState, field: ClientTerritoryFilterField): string {
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
  f: EprFilterState,
  args: {
    page: number;
    limit: number;
    sortBy: EprPaymentRequestSortKey;
    sortDir: "asc" | "desc";
    archive: boolean;
  }
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
  if (args.archive) p.set("payment_status", "deleted");
  else if (f.status) p.set("payment_status", f.status);
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

function workflowStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "pending_confirmation":
      return "Ожидание подтверждения";
    case "confirmed":
      return "Подтверждено";
    case "rejected":
      return "Отклонено";
    case "deleted":
      return "Удалено";
    default:
      return status?.trim() || "—";
  }
}

function isEprRowSelectable(row: PaymentListApiRow, isAdmin: boolean, archiveView: boolean): boolean {
  if (archiveView) {
    // Arxivda faqat admin va faqat «удалённые» (deleted_at bor) qatorlar tiklanadi.
    return isAdmin && (row.workflow_status === "deleted" || row.deleted_at != null);
  }
  if (row.workflow_status === "pending_confirmation") return true;
  if (isAdmin && row.workflow_status === "confirmed") return true;
  return false;
}

function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

export function ExpeditorPaymentRequestsWorkspace() {
  const router = useRouter();
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const role = useEffectiveRole();
  const qc = useQueryClient();
  const canAct = isAdminOrOperatorLikeRole(role);
  const isAdmin = role === "admin";

  const [applied, setApplied] = useState<EprFilterState>(() => defaultEprFilters());
  const [draft, setDraft] = useState<EprFilterState>(() => defaultEprFilters());
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<EprPaymentRequestSortKey>(EPR_SORT_DEFAULT.sortBy);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(EPR_SORT_DEFAULT.sortDir);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [archiveView, setArchiveView] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [restoreComment, setRestoreComment] = useState("");
  const [nowTick, setNowTick] = useState(() => Date.now());
  const headerCheckboxRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const h = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(h);
  }, []);

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

  const paymentTypeLabelByValue = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of payFilterOpts) m.set(o.value, o.label);
    return m;
  }, [payFilterOpts]);

  const tradeDirectionsCatalog = useActiveTradeDirectionsCatalog(tenantSlug, "epr-workspace");
  const tradeDirectionOptions = tradeDirectionsCatalog.labels;

  const tradeDirectionFilterOptions = useMemo(
    () => tradeDirectionOptions.map((td) => ({ value: td, label: td })),
    [tradeDirectionOptions]
  );

  const expeditorFilterOptions = useMemo(
    () =>
      (expeditorsQ.data ?? []).map((e) => ({
        value: String(e.id),
        label: staffPickerDisplayName(e),
        searchText: staffPickerSearchText(e)
      })),
    [expeditorsQ.data]
  );

  const agentFilterOptions = useMemo(
    () =>
      (agentsQ.data ?? []).map((a) => ({
        value: String(a.id),
        label: staffPickerDisplayName(a),
        searchText: staffPickerSearchText(a)
      })),
    [agentsQ.data]
  );

  const listQ = useQuery({
    queryKey: [
      "expeditor-payment-requests",
      tenantSlug,
      applied,
      page,
      tablePrefs.pageSize,
      sortBy,
      sortDir,
      archiveView
    ],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.list,
    queryFn: async () => {
      const qs = buildListQuery(applied, {
        page,
        limit: tablePrefs.pageSize,
        sortBy,
        sortDir,
        archive: archiveView
      });
      const { data } = await api.get<PaymentListApiResponse>(`/api/${tenantSlug}/payments?${qs}`);
      return data;
    }
  });

  const switchArchiveView = useCallback((next: boolean) => {
    setArchiveView(next);
    setPage(1);
    setSelected(new Set());
  }, []);

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

  const [rejectBusy, setRejectBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [returnBusy, setReturnBusy] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnDurationMin, setReturnDurationMin] = useState(30);

  const applyFilters = useCallback(() => {
    setApplied({ ...draft });
    setPage(1);
    setSelected(new Set());
  }, [draft]);

  const resetFilters = useCallback(() => {
    const d = defaultEprFilters();
    setDraft(d);
    setApplied(d);
    setPage(1);
    setSelected(new Set());
    setSortBy(EPR_SORT_DEFAULT.sortBy);
    setSortDir(EPR_SORT_DEFAULT.sortDir);
  }, []);

  const setTab = (tab: SourceTab) => {
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

  const rows = useMemo(() => listQ.data?.data ?? [], [listQ.data?.data]);
  const total = listQ.data?.total ?? 0;
  const selectableOnPage = useMemo(
    () => rows.filter((r) => isEprRowSelectable(r, isAdmin, archiveView)).map((r) => r.id),
    [rows, isAdmin, archiveView]
  );
  const allSelectableSelected =
    selectableOnPage.length > 0 && selectableOnPage.every((id) => selected.has(id));

  const toggleAllPage = () => {
    if (selectableOnPage.length === 0) return;
    const allSel = selectableOnPage.every((id) => selected.has(id));
    setSelected((prev) => {
      const n = new Set(prev);
      if (allSel) for (const id of selectableOnPage) n.delete(id);
      else for (const id of selectableOnPage) n.add(id);
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

  const pageTotalAmount = useMemo(() => {
    let sum = 0;
    for (const r of rows) {
      sum += Number.parseFloat(r.amount) || 0;
    }
    return sum;
  }, [rows]);

  const isPartialSelected =
    selected.size > 0 && !allSelectableSelected && selectableOnPage.some((id) => selected.has(id));

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isPartialSelected;
    }
  }, [isPartialSelected]);

  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const valid = new Set(rows.map((r) => r.id));
      let changed = false;
      const next = new Set<number>();
      for (const id of prev) {
        if (valid.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [rows]);

  const territoryFilterOptions = useMemo(
    () =>
      territoryFilterSpecs.map((spec) => {
        const opts = buildPaymentTerritorySelectOptions(
          spec.field,
          clientRefsQ.data,
          territoryOptsQ.data,
          profileQ.data?.territory_nodes,
          readTerritoryFilter(draft, spec.field)
        );
        return {
          key:
            spec.field === "zone"
              ? "territoryZone"
              : spec.field === "region"
                ? "territoryRegion"
                : spec.field === "city"
                  ? "territoryCity"
                  : "territoryDistrict",
          label: spec.label,
          options: opts.map((o) => ({ value: o.value, label: o.label })),
          value: readTerritoryFilter(draft, spec.field)
        };
      }),
    [territoryFilterSpecs, clientRefsQ.data, territoryOptsQ.data, profileQ.data?.territory_nodes, draft]
  );

  const handleBulkDelete = useCallback(() => {
    if (allSelectedPending) {
      const reason = window.prompt("Причина отклонения (необязательно):") ?? "";
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
          setDeleteModalOpen(false);
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
          setDeleteModalOpen(false);
        }
      })();
    }
  }, [
    allSelectedConfirmed,
    allSelectedPending,
    isAdmin,
    qc,
    selected,
    tenantSlug
  ]);

  // Xato to'lovni ekspeditorga qaytarish (pending → rad; tasdiqlangan → bekor + qarz qayta ochiladi).
  const returnActionEnabled =
    canAct &&
    selected.size > 0 &&
    !rejectBusy &&
    !deleteBusy &&
    !returnBusy &&
    (allSelectedPending || (isAdmin && allSelectedConfirmed));

  const handleReturnToExpeditor = useCallback(() => {
    if (!returnActionEnabled) return;
    setReturnReason("");
    setReturnDurationMin(30);
    setReturnModalOpen(true);
  }, [returnActionEnabled]);

  const confirmReturnToExpeditor = useCallback(() => {
    if (!returnActionEnabled) return;
    const reason = returnReason.trim();
    const duration = Math.min(1440, Math.max(1, Math.round(returnDurationMin) || 30));
    void (async () => {
      setReturnBusy(true);
      try {
        for (const id of Array.from(selected)) {
          await api.post(`/api/${tenantSlug}/payments/${id}/return-to-expeditor`, {
            reason: reason || undefined,
            duration_minutes: duration
          });
        }
        setSelected(new Set());
        setReturnModalOpen(false);
        void qc.invalidateQueries({ queryKey: ["expeditor-payment-requests", tenantSlug] });
        void qc.invalidateQueries({ queryKey: ["payments", tenantSlug] });
      } finally {
        setReturnBusy(false);
      }
    })();
  }, [returnActionEnabled, returnReason, returnDurationMin, selected, tenantSlug, qc]);

  // Arxivdagi (удалённые) to'lovlarni tiklash — faqat admin.
  const restoreActionEnabled =
    isAdmin && archiveView && selected.size > 0 && !restoreBusy;

  const handleRestore = useCallback(() => {
    if (!restoreActionEnabled) return;
    setRestoreComment("");
    setRestoreModalOpen(true);
  }, [restoreActionEnabled]);

  const confirmRestore = useCallback(() => {
    const comment = restoreComment.trim();
    if (!comment) return;
    void (async () => {
      setRestoreBusy(true);
      try {
        for (const id of Array.from(selected)) {
          await api.post(`/api/${tenantSlug}/payments/${id}/restore`, { comment });
        }
        setSelected(new Set());
        setRestoreModalOpen(false);
        void qc.invalidateQueries({ queryKey: ["expeditor-payment-requests", tenantSlug] });
        void qc.invalidateQueries({ queryKey: ["payments", tenantSlug] });
      } finally {
        setRestoreBusy(false);
      }
    })();
  }, [restoreComment, selected, tenantSlug, qc]);

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
        "Статус",
        "Срок",
        "Направление торговли",
        "Комментарий",
        "Дата последнего изменения",
        "Кто изменил"
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
        paymentTypeLabelByValue.get(r.payment_type) ?? r.payment_type,
        workflowStatusLabel(r.workflow_status),
        "—",
        r.trade_direction ?? "",
        r.note ?? "",
        r.confirmed_at ?? r.created_at ?? "",
        r.deleted_by_name ?? "—"
      ]),
      { colWidths: [10, 12, 16, 22, 22, 14, 10, 12, 12, 14, 18, 8, 16, 28, 18, 14] }
    );
  }, [applied.dateFrom, applied.dateTo, paymentTypeLabelByValue, rows]);

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
          <td key={colId} className="whitespace-nowrap border-b border-border px-2 py-2 font-medium text-slate-700">
            <Link href={`/payments/${r.id}`} className="text-[#063b36] hover:underline">
              {r.id}
            </Link>
          </td>
        );
      case "paid_at":
        return (
          <td key={colId} className="whitespace-nowrap border-b border-border px-2 py-2 text-slate-600">
            {fmtDateShort(r.paid_at)}
          </td>
        );
      case "expeditor":
        return (
          <td key={colId} className="max-w-[140px] px-2 py-2 text-xs">
            <span className="flex items-center gap-1">
              {r.created_via_mobile ? (
                <Smartphone
                  className="size-3.5 shrink-0 text-teal-600"
                  aria-label="Создано в мобильном приложении"
                />
              ) : null}
              <span className="truncate">{r.expeditor_name ?? "—"}</span>
            </span>
          </td>
        );
      case "client_name":
        return (
          <td key={colId} className="max-w-[140px] truncate whitespace-nowrap border-b border-border px-2 py-2">
            <Link
              href={`/clients/${r.client_id}`}
              className="inline-flex items-center gap-1 text-[#063b36] hover:underline"
            >
              {r.client_name}
              <ExternalLink className="size-3 text-slate-400" />
            </Link>
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
          <td key={colId} className="whitespace-nowrap border-b border-border px-2 py-2 text-xs">
            {r.consignment ? (
              <span className="font-medium text-amber-600">Да</span>
            ) : (
              <span className="text-slate-500">Нет</span>
            )}
          </td>
        );
      case "order_id":
        return (
          <td key={colId} className="whitespace-nowrap border-b border-border px-2 py-2 text-xs">
            {r.order_number ? (
              <Link
                href={r.order_id ? `/orders/${r.order_id}` : "#"}
                className="inline-flex items-center gap-1 text-[#063b36] hover:underline"
              >
                {r.order_number}
                <ExternalLink className="size-3 text-slate-400" />
              </Link>
            ) : (
              <span className="text-slate-300">—</span>
            )}
          </td>
        );
      case "amount":
        return (
          <td key={colId} className="whitespace-nowrap border-b border-border px-2 py-2 text-right tabular-nums font-semibold text-slate-800">
            {formatNumberGrouped(r.amount, { minFractionDigits: 0, maxFractionDigits: 0 })}
          </td>
        );
      case "payment_type":
        return (
          <td key={colId} className="max-w-[100px] truncate border-b border-border px-2 py-2 text-xs text-slate-600">
            {paymentTypeLabelByValue.get(r.payment_type) ?? r.payment_type}
          </td>
        );
      case "workflow_status": {
        const pending = r.workflow_status === "pending_confirmation";
        const rejected = r.workflow_status === "rejected";
        return (
          <td key={colId} className="whitespace-nowrap border-b border-border px-2 py-2 text-xs">
            <span
              className={cn(
                "inline-flex rounded-full px-2 py-0.5 font-medium",
                pending && "bg-amber-50 text-amber-700",
                r.workflow_status === "confirmed" && "bg-emerald-50 text-emerald-700",
                rejected && "bg-red-50 text-red-700",
                !pending && r.workflow_status !== "confirmed" && !rejected && "bg-muted text-slate-600"
              )}
            >
              {workflowStatusLabel(r.workflow_status)}
            </span>
          </td>
        );
      }
      case "term": {
        const expMs = r.return_expires_at ? new Date(r.return_expires_at).getTime() : null;
        if (r.workflow_status === "rejected" && expMs != null) {
          const remMin = Math.ceil((expMs - nowTick) / 60_000);
          if (remMin > 0) {
            return (
              <td key={colId} className="whitespace-nowrap px-2 py-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
                  <Clock className="size-3" />
                  {remMin} мин
                </span>
              </td>
            );
          }
          return (
            <td key={colId} className="whitespace-nowrap px-2 py-2 text-xs text-slate-400">
              истекает…
            </td>
          );
        }
        return (
          <td key={colId} className="px-2 py-2 text-xs text-muted-foreground">
            —
          </td>
        );
      }
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

  const amountColIndex = visibleDataColumns.indexOf("amount");

  return (
    <EprPageLayout>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-slate-800">Заявки на оплату экспедиторов</h1>
        <div className="flex flex-wrap items-center gap-2">
          <EprTabBar active={draft.tab} onChange={setTab} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-2 border-border shadow-sm"
            onClick={() => setPageSettingsOpen(true)}
          >
            <Settings className="size-4" />
            Настройки
          </Button>
        </div>
      </div>

      <EprFiltersPanel
        draft={draft}
        expeditorOptions={expeditorFilterOptions}
        agentOptions={agentFilterOptions}
        paymentMethodOptions={payFilterOpts.map((o) => ({ value: o.value, label: o.label }))}
        tradeDirectionOptions={tradeDirectionFilterOptions}
        territoryOptions={territoryFilterOptions}
        onDraftChange={(patch) => {
          setDraft((d) => {
            let next = { ...d, ...patch };
            if ("territoryZone" in patch) {
              next = { ...next, territoryRegion: "", territoryCity: "", territoryDistrict: "" };
            } else if ("territoryRegion" in patch) {
              next = { ...next, territoryCity: "", territoryDistrict: "" };
            } else if ("territoryCity" in patch) {
              next = { ...next, territoryDistrict: "" };
            }
            return next;
          });
        }}
        onApply={applyFilters}
        onReset={resetFilters}
      />

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm" aria-label="Таблица заявок">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <div className="flex items-center rounded-lg border border-border bg-card p-0.5 text-xs shadow-sm">
                <button
                  type="button"
                  onClick={() => switchArchiveView(false)}
                  className={cn(
                    "rounded-md px-3 py-1.5 font-medium transition",
                    !archiveView ? "bg-[#063b36] text-white shadow" : "text-slate-600 hover:bg-muted"
                  )}
                >
                  Заявки
                </button>
                <button
                  type="button"
                  onClick={() => switchArchiveView(true)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-3 py-1.5 font-medium transition",
                    archiveView ? "bg-[#063b36] text-white shadow" : "text-slate-600 hover:bg-muted"
                  )}
                  title="Удалённые оплаты (архив)"
                >
                  <Trash2 className="size-3.5" />
                  Удалённые
                </button>
              </div>
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
                  "h-9 w-[4.5rem] min-w-0 max-w-none shrink-0 bg-card text-sm dark:bg-background"
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

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px] border-collapse text-xs">
              <thead className="bg-muted text-slate-500">
                <tr className="h-[74px]">
                  <th className="sticky left-0 w-8 border-b border-border bg-muted px-2 py-2">
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      checked={allSelectableSelected}
                      onChange={toggleAllPage}
                      disabled={!canAct || selectableOnPage.length === 0}
                      className="accent-teal-600"
                      aria-label="Выбрать все на странице"
                    />
                  </th>
                  {visibleDataColumns.map((colId) => {
                    const def = EXPEDITOR_PAYMENT_REQUEST_COLUMNS.find((c) => c.id === colId);
                    const sortable = EPR_SORTABLE_COLUMN_IDS.has(colId);
                    const active = sortable && sortBy === colId;
                    return (
                      <th
                        key={colId}
                        className={cn(
                          "border-b border-border px-2 py-2 text-left font-medium whitespace-nowrap",
                          thClassForCol(colId),
                          sortable && "p-0"
                        )}
                      >
                        {sortable ? (
                          <button
                            type="button"
                            className={cn(
                              "group flex h-[74px] w-full min-w-0 items-center gap-1 px-2 py-2 text-left font-medium",
                              colId === "amount" && "justify-end text-right"
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
                          <span className="block px-2 py-2">{def?.label ?? colId}</span>
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
                    <td colSpan={dataColSpan} className="px-4 py-10 text-center text-slate-400">
                      {archiveView
                        ? "Удалённых оплат за выбранный период нет."
                        : "Нет данных. Измените фильтр или создайте новую заявку."}
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const isSelected = selected.has(r.id);
                    const isSelectable = canAct && isEprRowSelectable(r, isAdmin, archiveView);
                    return (
                      <tr
                        key={r.id}
                        className={cn(
                          "group h-[76px] hover:bg-muted",
                          isSelected && isSelectable && "bg-cyan-50/70"
                        )}
                      >
                        <td className="sticky left-0 bg-inherit border-b border-border px-2 py-2">
                          {isSelectable ? (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleRow(r.id)}
                              className="accent-[#063b36]"
                              aria-label={`Выбрать ${r.id}`}
                            />
                          ) : (
                            <span className="inline-block w-4" />
                          )}
                        </td>
                        {visibleDataColumns.map((colId) => renderPaymentRequestDataCell(r, colId))}
                      </tr>
                    );
                  })
                )}
                {rows.length > 0 && amountColIndex >= 0 ? (
                  <tr className="bg-muted font-semibold text-slate-700">
                    <td colSpan={amountColIndex + 1} className="border-t border-border px-2 py-2 text-right">
                      Итого
                    </td>
                    <td className="border-t border-border px-2 py-2 text-right tabular-nums">
                      {formatNumberGrouped(pageTotalAmount, { minFractionDigits: 0, maxFractionDigits: 0 })} UZS
                    </td>
                    <td
                      colSpan={Math.max(0, visibleDataColumns.length - amountColIndex - 1)}
                      className="border-t border-border"
                    />
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {!archiveView && applied.status === "pending_confirmation" && total === 0 && !listQ.isFetching ? (
            <div className="border-t border-amber-100 bg-amber-50/80 px-4 py-3 text-xs text-amber-800">
              Нет заявок в статусе «Ожидание подтверждения». Экспедитор создаёт их в мобильном приложении при
              приёме оплаты; после подтверждения они переходят в «Подтверждено».
            </div>
          ) : null}

          {total > 0 ? (
            <div className="border-t border-border px-4 py-3">
              <TemplatePagination
                page={page}
                pageSize={tablePrefs.pageSize}
                total={total}
                onPageChange={setPage}
                onPageSizeChange={(n) => {
                  tablePrefs.setPageSize(n);
                  setPage(1);
                }}
                pageSizeOptions={[10, 20, 30, 50]}
              />
            </div>
          ) : null}
      </section>

      {archiveView ? (
        <EprRestoreActionBar
          selectedCount={selected.size}
          total={total}
          restoreDisabled={!restoreActionEnabled}
          restoreHint={!isAdmin ? "Восстановление доступно только администратору" : undefined}
          onRestore={handleRestore}
          onClear={() => setSelected(new Set())}
        />
      ) : (
        <EprFloatingActionBar
          selectedCount={selected.size}
          total={total}
          confirmDisabled={!canAct || !allSelectedPending || selected.size === 0}
          deleteDisabled={!deleteActionEnabled}
          returnDisabled={!returnActionEnabled}
          confirmHint={
            !allSelectedPending && selected.size > 0
              ? "Подтверждение только для статуса «Ожидание подтверждения»"
              : undefined
          }
          returnHint={
            selected.size > 0 && !allSelectedPending && !(isAdmin && allSelectedConfirmed)
              ? "Возврат доступен для «Ожидание подтверждения» (и подтверждённых — для админа)"
              : undefined
          }
          onConfirm={() => {
            if (!allSelectedPending || selected.size === 0) return;
            router.push(`/expeditor-payment-requests/confirm?ids=${Array.from(selected).join(",")}`);
          }}
          onDelete={() => {
            if (!deleteActionEnabled) return;
            setDeleteModalOpen(true);
          }}
          onReturn={handleReturnToExpeditor}
          onClear={() => setSelected(new Set())}
        />
      )}

      <EprBulkDeleteModal
        open={deleteModalOpen}
        count={selected.size}
        busy={rejectBusy || deleteBusy}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleBulkDelete}
      />

      <Dialog open={returnModalOpen} onOpenChange={(o) => !returnBusy && setReturnModalOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Вернуть экспедитору на исправление</DialogTitle>
            <DialogDescription>
              Оплата ({selected.size}) будет возвращена экспедитору. Долг по заказу снова откроется,
              а у экспедитора появится таймер на исправление. Если он не исправит оплату за
              отведённое время, возврат отменяется.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="epr-return-reason" className="text-xs text-muted-foreground">
                Причина (необязательно)
              </Label>
              <textarea
                id="epr-return-reason"
                rows={3}
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Например: неверная сумма или способ оплаты"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="epr-return-duration" className="text-xs text-muted-foreground">
                Время на исправление
              </Label>
              <select
                id="epr-return-duration"
                className={cn(filterPanelSelectClassName, "h-10 w-full max-w-none bg-background")}
                value={String(returnDurationMin)}
                onChange={(e) => setReturnDurationMin(Number(e.target.value) || 30)}
              >
                <option value="5">5 минут</option>
                <option value="10">10 минут</option>
                <option value="15">15 минут</option>
                <option value="30">30 минут</option>
                <option value="60">1 час</option>
                <option value="120">2 часа</option>
                <option value="240">4 часа</option>
                <option value="480">8 часов</option>
                <option value="1440">24 часа</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={returnBusy}
              onClick={() => setReturnModalOpen(false)}
            >
              Отмена
            </Button>
            <Button
              type="button"
              className="bg-amber-500 text-white hover:bg-amber-600"
              disabled={returnBusy || selected.size === 0}
              onClick={confirmReturnToExpeditor}
            >
              {returnBusy ? "Возврат…" : "Вернуть экспедитору"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={restoreModalOpen} onOpenChange={(o) => !restoreBusy && setRestoreModalOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Восстановить оплату</DialogTitle>
            <DialogDescription>
              Выбранные оплаты ({selected.size}) будут восстановлены из архива. Баланс клиента и
              распределения будут пересчитаны. Укажите причину восстановления — она сохранится в истории.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="epr-restore-comment" className="text-xs text-muted-foreground">
                Причина восстановления
              </Label>
              <textarea
                id="epr-restore-comment"
                rows={3}
                value={restoreComment}
                onChange={(e) => setRestoreComment(e.target.value)}
                placeholder="Например: оплата удалена по ошибке"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={restoreBusy}
              onClick={() => setRestoreModalOpen(false)}
            >
              Отмена
            </Button>
            <Button
              type="button"
              className="bg-teal-700 text-white hover:bg-teal-800"
              disabled={restoreBusy || selected.size === 0 || !restoreComment.trim()}
              onClick={confirmRestore}
            >
              {restoreBusy ? "Восстановление…" : "Восстановить"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="text-right">
        <Link href="/payments" className="text-xs text-[#063b36] hover:underline">
          Все оплаты
        </Link>
      </div>

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
    </EprPageLayout>
  );
}
