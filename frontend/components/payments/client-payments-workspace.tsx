"use client";

import { AddClientExpenseDialog } from "@/components/client-expenses/add-client-expense-dialog";
import { AddPaymentDialog } from "@/components/payments/add-payment-dialog";
import { DeletePaymentModal } from "@/components/payments/client-payments/delete-payment-modal";
import { EditPaymentModal } from "@/components/payments/client-payments/edit-payment-modal";
import {
  formatPaymentDt,
  formatPaymentMoney,
  PaymentMethodBadge,
  Td,
  Th
} from "@/components/payments/client-payments/template-ui";
import { PaymentRowActionBar } from "@/components/payments/client-payments/payment-row-action-bar";
import { EprBulkDeleteModal } from "@/components/payments/expeditor-payment-requests/epr-bulk-delete-modal";
import { ClientsListPagination } from "@/components/clients/clients-table-toolbar";
import { PageShell } from "@/components/dashboard/page-shell";
import { PaymentFiltersVisibilityDialog } from "@/components/payments/payment-filters-visibility-dialog";
import { PaymentsTemplateFiltersPanel } from "@/components/payments/payments-template-filters-panel";
import { PaymentsTemplateListToolbar } from "@/components/payments/payments-template-list-toolbar";
import { api } from "@/lib/api";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { getUserFacingError } from "@/lib/error-utils";
import { staffPickerDisplayName, staffPickerSearchText } from "@/lib/person-display";
import { paymentMethodSelectOptions, type ProfilePaymentMethodEntry } from "@/lib/payment-method-options";
import type { ClientBalanceTerritoryOptions } from "@/lib/client-balances-types";
import type { PaymentListApiResponse, PaymentListApiRow } from "@/lib/payment-list-types";
import type { TerritoryNode } from "@/lib/territory-tree";
import { buildClientTerritoryFilterLevels, buildZoneRegionCityCascadeOptions } from "@/lib/territory-client-filters";
import { appendPositiveIntListParam, splitMultiFilterValues } from "@/lib/client-filter-select-value";
import {
  clampPaymentFilterVisibilityToTerritoryLevels,
  DEFAULT_PAYMENT_FILTER_VISIBILITY,
  loadPaymentFilterVisibility,
  savePaymentFilterVisibility,
  type PaymentFilterVisibility
} from "@/lib/payment-filters-visibility";
import { useActiveTradeDirectionsCatalog } from "@/hooks/use-active-trade-directions-catalog";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type DealType = "regular" | "consignment" | "both";
export type ClientPaymentsWorkspaceVariant = "payments" | "client_expenses";

type StaffPick = { id: number; fio: string; code?: string | null };
type PaymentStatusFilter = "" | "pending_confirmation" | "confirmed" | "deleted";
type DateFieldFilter = "created_at" | "paid_at" | "confirmed_at";

type FilterForm = {
  deal_type: DealType;
  date_from: string;
  date_to: string;
  date_field: DateFieldFilter;
  client_id: string;
  payment_status: PaymentStatusFilter;
  cash_desk_id: string;
  agent_id: string;
  expeditor_user_id: string;
  payment_type: string;
  trade_direction: string;
  territory_zone: string;
  territory_region: string;
  territory_city: string;
  territory_district: string;
  amount_min: string;
  amount_max: string;
  search: string;
};

type CashDeskRow = { id: number; name: string; is_active: boolean };

/** Jadval ichida scroll — maksimum 15 qator balandligi (kam ma'lumotda blok qisqaradi) */
const PAYMENTS_TABLE_VISIBLE_ROWS = 15;
const PAYMENTS_TABLE_BODY_MAX_PX = 36 + PAYMENTS_TABLE_VISIBLE_ROWS * 36;

function monthBoundsUtcIso(): { from: string; to: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return { from: `${y}-${pad(m + 1)}-01`, to: `${y}-${pad(m + 1)}-${pad(last)}` };
}

const defaultForm = (): FilterForm => {
  const { from, to } = monthBoundsUtcIso();
  return {
    deal_type: "both",
    date_from: from,
    date_to: to,
    date_field: "created_at",
    client_id: "",
    payment_status: "",
    cash_desk_id: "",
    agent_id: "",
    expeditor_user_id: "",
    payment_type: "",
    trade_direction: "",
    territory_zone: "",
    territory_region: "",
    territory_city: "",
    territory_district: "",
    amount_min: "",
    amount_max: "",
    search: ""
  };
};

function buildPaymentsQuery(
  form: FilterForm,
  page: number,
  pageSize: number,
  variant: ClientPaymentsWorkspaceVariant
): string {
  const p = new URLSearchParams();
  p.set("page", String(page));
  p.set("limit", String(pageSize));
  p.set("entry_kind", variant === "client_expenses" ? "client_expense" : "payment");
  if (form.date_from.trim()) p.set("date_from", form.date_from.trim());
  if (form.date_to.trim()) p.set("date_to", form.date_to.trim());
  if (form.date_field !== "created_at") p.set("date_field", form.date_field);
  if (form.client_id.trim()) p.set("client_id", form.client_id.trim());
  if (form.search.trim()) p.set("search", form.search.trim());
  if (variant !== "client_expenses") {
    if (form.amount_min.trim()) p.set("amount_min", form.amount_min.trim().replace(/\s/g, "").replace(/,/g, ""));
    if (form.amount_max.trim()) p.set("amount_max", form.amount_max.trim().replace(/\s/g, "").replace(/,/g, ""));
  }
  if (form.agent_id.trim()) appendPositiveIntListParam(p, "agent_id", "agent_ids", form.agent_id);
  if (form.expeditor_user_id.trim()) {
    appendPositiveIntListParam(p, "expeditor_user_id", "expeditor_user_ids", form.expeditor_user_id);
  }
  if (form.payment_type.trim()) p.set("payment_type", form.payment_type.trim());
  if (form.trade_direction.trim()) p.set("trade_direction", form.trade_direction.trim());
  if (form.territory_zone.trim()) p.set("territory_zone", form.territory_zone.trim());
  if (form.territory_region.trim()) p.set("territory_region", form.territory_region.trim());
  if (form.territory_city.trim()) p.set("territory_city", form.territory_city.trim());
  if (form.territory_district.trim()) p.set("territory_district", form.territory_district.trim());
  if (form.deal_type !== "both") p.set("deal_type", form.deal_type);
  if (form.payment_status) p.set("payment_status", form.payment_status);
  if (form.cash_desk_id.trim()) {
    const deskIds = splitMultiFilterValues(form.cash_desk_id)
      .map((s) => Number.parseInt(s, 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    const uniqDesk = [...new Set(deskIds)];
    if (uniqDesk.length > 0) p.set("cash_desk_ids", uniqDesk.join(","));
  }
  return p.toString();
}

function downloadPaymentsExcel(rows: PaymentListApiRow[]) {
  const headers = [
    "ID оплаты",
    "Дата создания",
    "Дата оплаты",
    "Дата получение оплаты",
    "Дата подтверждения оплаты",
    "Клиент(название)",
    "Клиент (юр. название)",
    "Ид клиента",
    "Баланс",
    "Тип",
    "Способ оплаты",
    "Сумма",
    "Агент",
    "Направление торговли",
    "Консигнация",
    "Код агента",
    "Экспедитор",
    "Касса",
    "Комментарий"
  ];
  downloadXlsxSheet(
    `oplata-klientov-${new Date().toISOString().slice(0, 10)}.xlsx`,
    "Оплаты клиентов",
    headers,
    rows.map((r) => [
      r.id,
      r.created_at,
      r.paid_at ?? "",
      r.received_at ?? "",
      r.confirmed_at ?? "",
      r.client_name,
      r.client_legal_name ?? "",
      r.client_code ?? "",
      r.client_balance,
      r.payment_kind,
      r.payment_type,
      r.amount,
      r.agent_name ?? "",
      r.trade_direction ?? "",
      r.consignment ? "Да" : "Нет",
      r.agent_code ?? "",
      r.expeditor_name ?? "",
      r.cash_desk_name ?? "",
      r.note ?? ""
    ])
  );
}

function parseAmount(s: string): number {
  const n = Number.parseFloat(s.replace(/\s/g, "").replace(/,/g, "."));
  return Number.isFinite(n) ? n : 0;
}

function isCashPaymentType(code: string, label: string): boolean {
  const t = `${code} ${label}`.toLowerCase();
  return t.includes("cash") || t.includes("налич") || t.includes("naqd") || t.includes("nakt");
}

export function ClientPaymentsWorkspace({ variant = "payments" }: { variant?: ClientPaymentsWorkspaceVariant }) {
  const isExpenses = variant === "client_expenses";
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const effectiveRole = useEffectiveRole();
  const canVoidPayments = effectiveRole === "admin";
  const qc = useQueryClient();

  const [draft, setDraft] = useState<FilterForm>(() => defaultForm());
  const [applied, setApplied] = useState<FilterForm>(() => defaultForm());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [addPaymentOpen, setAddPaymentOpen] = useState(false);
  const [filterVis, setFilterVis] = useState<PaymentFilterVisibility>(DEFAULT_PAYMENT_FILTER_VISIBILITY);
  const [filterVisDialogOpen, setFilterVisDialogOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectedRow, setSelectedRow] = useState<PaymentListApiRow | null>(null);
  /** Jadvalda belgilangan qatorlar (pastdagi amallar paneli uchun). */
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const queryString = useMemo(
    () => buildPaymentsQuery(applied, page, pageSize, variant),
    [applied, page, pageSize, variant]
  );

  /** Filtr/sahifa o'zgarsa — tanlovni tozalaymiz (panel yopiladi). */
  useEffect(() => {
    setSelected(new Set());
  }, [queryString]);

  const listQ = useQuery({
    queryKey: ["payments", tenantSlug, variant, queryString],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get<PaymentListApiResponse>(`/api/${tenantSlug}/payments?${queryString}`);
      return data;
    }
  });

  useEffect(() => setFilterVis(loadPaymentFilterVisibility()), []);

  const agentsQ = useQuery({
    queryKey: ["agents", tenantSlug, "payments-filters"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: StaffPick[] }>(`/api/${tenantSlug}/agents?is_active=true`);
      return data.data;
    }
  });

  const expeditorsQ = useQuery({
    queryKey: ["expeditors", tenantSlug, "payments-filters"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: StaffPick[] }>(`/api/${tenantSlug}/expeditors?is_active=true`);
      return data.data;
    }
  });

  const cashDesksQ = useQuery({
    queryKey: ["cash-desks", tenantSlug, "payments-page"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: CashDeskRow[] }>(
        `/api/${tenantSlug}/cash-desks?is_active=true&limit=200&page=1`
      );
      return data.data.filter((d) => d.is_active);
    }
  });

  const territoryOptsQ = useQuery({
    queryKey: ["client-balances-territory", tenantSlug, "payments-filters"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: ClientBalanceTerritoryOptions }>(
        `/api/${tenantSlug}/client-balances/territory-options`
      );
      return data.data;
    }
  });

  const clientRefsQ = useQuery({
    queryKey: ["clients-references", tenantSlug, "payments-filters"],
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

  const profileQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug, "payments-methods"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{
        references?: {
          payment_types?: string[];
          payment_method_entries?: ProfilePaymentMethodEntry[];
          territory_levels?: string[];
          territory_nodes?: TerritoryNode[];
          trade_directions?: string[];
          cancel_payment_reason_entries?: { value: string; label: string }[];
        };
      }>(`/api/${tenantSlug}/settings/profile`);
      return data.references ?? {};
    }
  });

  const payFilterOpts = useMemo(
    () => paymentMethodSelectOptions(profileQ.data, profileQ.data?.payment_types),
    [profileQ.data]
  );

  const payMethodLabels = useMemo(() => {
    const m: Record<string, string> = { "": "Способ оплаты" };
    for (const o of payFilterOpts) m[o.value] = o.label;
    return m;
  }, [payFilterOpts]);

  const territoryFilterSpecs = useMemo(
    () => buildClientTerritoryFilterLevels(profileQ.data?.territory_levels),
    [profileQ.data?.territory_levels]
  );

  const paymentFilterTerritoryVisibilityRows = useMemo(
    () =>
      territoryFilterSpecs.map((s) => ({
        key: `territory${s.visIndex}` as keyof PaymentFilterVisibility,
        label: s.label
      })),
    [territoryFilterSpecs]
  );

  useEffect(() => {
    if (!profileQ.isSuccess) return;
    setFilterVis((prev) => {
      const next = clampPaymentFilterVisibilityToTerritoryLevels(prev, territoryFilterSpecs.length);
      for (const k of ["territory1", "territory2", "territory3", "territory4", "territory5"] as const) {
        if (prev[k] !== next[k]) {
          savePaymentFilterVisibility(next);
          return next;
        }
      }
      return prev;
    });
  }, [profileQ.isSuccess, territoryFilterSpecs.length]);

  const tradeDirectionsCatalog = useActiveTradeDirectionsCatalog(tenantSlug, "client-payments");
  const tradeDirectionSelectValues = tradeDirectionsCatalog.labels;

  const sliderCeiling = useMemo(() => {
    let m = 0;
    for (const r of listQ.data?.data ?? []) {
      const v = Number.parseFloat(r.amount) || 0;
      if (v > m) m = v;
    }
    const rounded = Math.max(Math.ceil(m * 1.15), 1_000_000);
    return Math.min(Math.ceil(rounded / 100_000) * 100_000, 999_999_999);
  }, [listQ.data?.data]);

  const amountMaxNumeric = Math.min(parseAmount(draft.amount_max) || sliderCeiling, sliderCeiling);
  const amountMinNumeric = parseAmount(draft.amount_min);

  const pageTotal = useMemo(() => {
    let sum = 0;
    for (const r of listQ.data?.data ?? []) {
      sum += Number.parseFloat(r.amount) || 0;
    }
    return sum;
  }, [listQ.data?.data]);

  const applyFilters = useCallback(() => {
    setApplied({ ...draft });
    setPage(1);
  }, [draft]);

  const resetDraftToApplied = useCallback(() => setDraft({ ...applied }), [applied]);

  const invalidatePayments = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["payments", tenantSlug] });
    void qc.invalidateQueries({ queryKey: ["dashboard-stats", tenantSlug] });
    void qc.invalidateQueries({ queryKey: ["payment-edit-grants", tenantSlug] });
  }, [qc, tenantSlug]);

  const openEdit = (r: PaymentListApiRow) => {
    setSelectedRow(r);
    setEditOpen(true);
  };
  const openDelete = (r: PaymentListApiRow) => {
    setSelectedRow(r);
    setDeleteOpen(true);
  };

  const rows = listQ.data?.data ?? [];

  const selectableOnPage = useMemo(
    () => rows.filter((r) => !r.deleted_at).map((r) => r.id),
    [rows]
  );

  const allSelectableSelected =
    selectableOnPage.length > 0 && selectableOnPage.every((id) => selected.has(id));

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

  const toggleRowSelection = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllOnPage = useCallback(() => {
    if (selectableOnPage.length === 0) return;
    const allSel = selectableOnPage.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSel) {
        for (const id of selectableOnPage) next.delete(id);
      } else {
        for (const id of selectableOnPage) next.add(id);
      }
      return next;
    });
  }, [selectableOnPage, selected]);

  const selectedRows = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected]);

  const allSelectedPending =
    selectedRows.length > 0 &&
    selectedRows.every((r) => r.workflow_status === "pending_confirmation" && !r.deleted_at);

  const handleDeleteAction = useCallback(() => {
    if (selected.size === 1) {
      const row = selectedRows[0];
      if (row) openDelete(row);
      return;
    }
    if (selected.size > 1) setBulkDeleteOpen(true);
  }, [selected.size, selectedRows]);

  const handleBulkDelete = useCallback(async () => {
    if (!tenantSlug || selected.size === 0) return;
    setBulkBusy(true);
    try {
      const ids = Array.from(selected);
      for (const id of ids) {
        await api.delete(`/api/${tenantSlug}/payments/${id}`);
      }
      setSelected(new Set());
      invalidatePayments();
      setFeedback(`В архив перенесено: ${ids.length}`);
      setTimeout(() => setFeedback(null), 5000);
    } catch (e) {
      setFeedback(getUserFacingError(e, "Не удалось удалить выбранные оплаты."));
      setTimeout(() => setFeedback(null), 6000);
    } finally {
      setBulkBusy(false);
      setBulkDeleteOpen(false);
    }
  }, [tenantSlug, selected, invalidatePayments]);

  const handleBulkConfirm = useCallback(async () => {
    if (!tenantSlug || !allSelectedPending) return;
    const ids = Array.from(selected);
    setBulkBusy(true);
    try {
      await api.post(`/api/${tenantSlug}/payments/batch-confirm`, { ids });
      setSelected(new Set());
      invalidatePayments();
      setFeedback(`Подтверждено: ${ids.length}`);
      setTimeout(() => setFeedback(null), 5000);
    } catch (e) {
      setFeedback(getUserFacingError(e, "Не удалось подтвердить выбранные оплаты."));
      setTimeout(() => setFeedback(null), 6000);
    } finally {
      setBulkBusy(false);
    }
  }, [tenantSlug, allSelectedPending, selected, invalidatePayments]);

  const primarySelectedRow = selectedRows.length === 1 ? selectedRows[0]! : null;

  const statusOptions = useMemo(
    () => [
      { value: "pending_confirmation", label: "CREATED" },
      { value: "confirmed", label: "CONFIRMED" },
      { value: "deleted", label: "Архив" }
    ],
    []
  );

  const cashDeskOptions = useMemo(
    () => (cashDesksQ.data ?? []).map((d) => ({ value: String(d.id), label: d.name })),
    [cashDesksQ.data]
  );

  const agentOptions = useMemo(
    () =>
      (agentsQ.data ?? []).map((a) => ({
        value: String(a.id),
        label: staffPickerDisplayName(a),
        searchText: staffPickerSearchText(a)
      })),
    [agentsQ.data]
  );

  const expeditorOptions = useMemo(
    () => (expeditorsQ.data ?? []).map((e) => ({ value: String(e.id), label: e.fio })),
    [expeditorsQ.data]
  );

  const paymentMethodOptions = useMemo(
    () => payFilterOpts.map((o) => ({ value: o.value, label: o.label })),
    [payFilterOpts]
  );

  const tradeDirectionOptions = useMemo(
    () => tradeDirectionSelectValues.map((td) => ({ value: td, label: td })),
    [tradeDirectionSelectValues]
  );

  const territoryCascade = useMemo(
    () =>
      buildZoneRegionCityCascadeOptions(
        clientRefsQ.data,
        territoryOptsQ.data,
        profileQ.data?.territory_nodes,
        {
          zone: draft.territory_zone,
          region: draft.territory_region,
          city: draft.territory_city
        }
      ),
    [
      clientRefsQ.data,
      territoryOptsQ.data,
      profileQ.data?.territory_nodes,
      draft.territory_zone,
      draft.territory_region,
      draft.territory_city
    ]
  );

  const totalPages = listQ.data ? Math.max(1, Math.ceil(listQ.data.total / listQ.data.limit)) : 1;

  const listErrorDetail = listQ.isError && listQ.error ? getUserFacingError(listQ.error) : null;

  if (!hydrated) {
    return <p className="p-6 text-sm text-slate-500">Загрузка сессии…</p>;
  }
  if (!tenantSlug) {
    return (
      <p className="p-6 text-sm text-red-600">
        <Link href="/login" className="underline">
          Войти
        </Link>
      </p>
    );
  }

  return (
    <PageShell className="flex min-h-0 flex-1 flex-col gap-4 p-0 pb-0">
      <div className="shrink-0 px-4 sm:px-6">
        <PaymentsTemplateFiltersPanel
          title={isExpenses ? "Расходы клиента" : "Оплаты клиентов"}
          isExpenses={isExpenses}
          draft={draft}
          filterVis={filterVis}
          statusOptions={statusOptions}
          cashDeskOptions={cashDeskOptions}
          agentOptions={agentOptions}
          expeditorOptions={expeditorOptions}
          paymentMethodOptions={paymentMethodOptions}
          tradeDirectionOptions={tradeDirectionOptions}
          zoneOptions={territoryCascade.zones}
          regionOptions={territoryCascade.regions}
          cityOptions={territoryCascade.cities}
          amountMinDisplay={amountMinNumeric}
          amountMaxDisplay={amountMaxNumeric}
          amountSliderMax={sliderCeiling}
          onDraftChange={(patch) =>
            setDraft((d) => ({ ...d, ...patch }) as FilterForm)
          }
          onApply={applyFilters}
          onReset={resetDraftToApplied}
          onDateRangeApplied={(dateFrom, dateTo) =>
            setDraft((d) => ({ ...d, date_from: dateFrom, date_to: dateTo }))
          }
          onAddPayment={() => setAddPaymentOpen(true)}
          addButtonLabel={isExpenses ? "+ Добавить" : "+ Добавить оплату"}
        />
      </div>

      {feedback ? (
        <p className="mx-4 rounded-md border border-border bg-card px-3 py-2 text-sm text-gray-600 sm:mx-6">
          {feedback}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 sm:px-6 sm:pb-6">
        <PaymentsTemplateListToolbar
          search={draft.search}
          onSearchChange={(v) => {
            setDraft((d) => ({ ...d, search: v }));
            setApplied((a) => ({ ...a, search: v }));
            setPage(1);
          }}
          pageSize={pageSize}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
          onRefresh={() => void listQ.refetch()}
          refreshing={listQ.isFetching}
          onExportExcel={!isExpenses ? () => downloadPaymentsExcel(rows) : undefined}
          exportDisabled={!rows.length}
          onOpenFilterVisibility={() => setFilterVisDialogOpen(true)}
          showEditGrantsLink={!isExpenses}
        />

        {listQ.isLoading ? <p className="mt-3 text-sm text-gray-600">Загрузка…</p> : null}
        {listQ.isError ? (
          <p className="mt-3 text-sm text-red-600">{listErrorDetail ?? "Ошибка загрузки."}</p>
        ) : null}

        <div className="mt-3 shrink-0 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div
            className="scrollbar-none overflow-auto overscroll-contain"
            style={{ maxHeight: rows.length > 0 ? PAYMENTS_TABLE_BODY_MAX_PX : undefined }}
          >
            <table className="min-w-full divide-y divide-border text-[12px]">
              <thead className="sticky top-0 z-10 bg-muted text-left text-[11px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="whitespace-nowrap px-2 py-2.5 font-semibold">
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      checked={allSelectableSelected}
                      onChange={toggleAllOnPage}
                      disabled={selectableOnPage.length === 0}
                      className="size-4 cursor-pointer rounded border-border text-emerald-600 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Выбрать все на странице"
                    />
                  </th>
                  <Th>ID оплаты</Th>
                  <Th>Дата создания</Th>
                  <Th>Дата оплаты</Th>
                  <Th>Дата получение оплаты</Th>
                  <Th>Дата подтверждения оплаты</Th>
                  <Th>Клиент(название)</Th>
                  <Th>Клиент (юр. название)</Th>
                  <Th>Ид клиента</Th>
                  <Th>Баланс</Th>
                  <Th>Тип</Th>
                  <Th>Способ оплаты</Th>
                  <Th>Сумма</Th>
                  <Th>Агент</Th>
                  <Th>Направление торговли</Th>
                  <Th>Консигнация</Th>
                  <Th>Код агента</Th>
                  <Th>Экспедитор</Th>
                  <Th>Касса</Th>
                  <Th>Комментарий</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {rows.map((p) => {
                  const methodLabel = payMethodLabels[p.payment_type] ?? p.payment_type;
                  const balanceNum = parseAmount(p.client_balance);
                  const voided = Boolean(p.deleted_at);
                  const selectable = !voided;
                  const isSelected = selected.has(p.id);
                  return (
                    <tr
                      key={p.id}
                      className={cn(
                        "group transition-colors hover:bg-muted/80",
                        isSelected && "bg-emerald-50/70 hover:bg-emerald-50"
                      )}
                    >
                      <Td className="!px-2">
                        {selectable ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRowSelection(p.id)}
                            className="size-4 cursor-pointer rounded border-border text-emerald-600 focus:ring-emerald-500"
                            aria-label={`Выбрать оплату ${p.id}`}
                          />
                        ) : null}
                      </Td>
                      <Td>
                        <Link
                          href={`/payments/${p.id}`}
                          className="flex items-center gap-1 font-medium text-emerald-700 hover:underline"
                        >
                          {p.id}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </Td>
                      <Td>{formatPaymentDt(p.created_at)}</Td>
                      <Td>{formatPaymentDt(p.paid_at)}</Td>
                      <Td>{formatPaymentDt(p.received_at)}</Td>
                      <Td>{formatPaymentDt(p.confirmed_at)}</Td>
                      <Td>
                        <Link href={`/clients/${p.client_id}`} className="font-medium text-emerald-700 hover:underline">
                          {p.client_name}
                        </Link>
                        <ExternalLink className="ml-1 inline h-3 w-3 text-emerald-600" />
                      </Td>
                      <Td>{p.client_legal_name ?? "—"}</Td>
                      <Td className="font-mono text-gray-500">{p.client_code ?? "—"}</Td>
                      <Td
                        className={cn(
                          "font-medium",
                          balanceNum < 0 ? "text-red-600" : balanceNum > 0 ? "text-green-600" : "text-gray-700"
                        )}
                      >
                        {formatPaymentMoney(balanceNum)}
                      </Td>
                      <Td>{p.payment_kind}</Td>
                      <Td>
                        <PaymentMethodBadge
                          label={methodLabel}
                          isCash={isCashPaymentType(p.payment_type, methodLabel)}
                        />
                      </Td>
                      <Td className="font-semibold text-gray-900">{formatPaymentMoney(p.amount)}</Td>
                      <Td className="max-w-[180px] truncate" title={p.agent_name ?? undefined}>
                        {p.agent_name ?? "—"}
                      </Td>
                      <Td>
                        {p.trade_direction ? (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                            {p.trade_direction}
                          </span>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td>{p.consignment ? "Да" : "Нет"}</Td>
                      <Td className="font-mono text-gray-500">{p.agent_code ?? "—"}</Td>
                      <Td>{p.expeditor_name ?? "—"}</Td>
                      <Td>{p.cash_desk_name ?? "—"}</Td>
                      <Td className="max-w-[150px] whitespace-pre-line text-gray-500">{p.note ?? ""}</Td>
                    </tr>
                  );
                })}
              </tbody>
              {rows.length > 0 ? (
                <tfoot className="border-t border-border bg-muted">
                  <tr>
                    <td colSpan={12} />
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs font-bold text-gray-900">
                      {formatPaymentMoney(pageTotal)}
                    </td>
                    <td colSpan={7} />
                  </tr>
                </tfoot>
              ) : null}
            </table>
            {!listQ.isLoading && rows.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">Нет данных</div>
            ) : null}
          </div>

          {listQ.data ? (
            <ClientsListPagination
              page={page}
              totalPages={totalPages}
              total={listQ.data.total}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          ) : null}
        </div>
      </div>

      <EditPaymentModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        tenantSlug={tenantSlug}
        paymentId={selectedRow?.id ?? null}
        clientId={selectedRow?.client_id ?? null}
        onSaved={invalidatePayments}
      />

      {canVoidPayments ? (
        <DeletePaymentModal
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          tenantSlug={tenantSlug}
          paymentId={selectedRow?.id}
          onConfirmed={() => {
            invalidatePayments();
            setSelected((prev) => {
              if (selectedRow?.id == null) return prev;
              const next = new Set(prev);
              next.delete(selectedRow.id);
              return next;
            });
            setFeedback("Платёж отменён и перенесён в архив.");
            setTimeout(() => setFeedback(null), 5000);
          }}
        />
      ) : null}

      {canVoidPayments ? (
        <EprBulkDeleteModal
          open={bulkDeleteOpen}
          count={selected.size}
          busy={bulkBusy}
          onClose={() => setBulkDeleteOpen(false)}
          onConfirm={() => void handleBulkDelete()}
        />
      ) : null}

      {isExpenses ? (
        <AddClientExpenseDialog
          open={addPaymentOpen}
          onOpenChange={setAddPaymentOpen}
          tenantSlug={tenantSlug}
          onCreated={invalidatePayments}
        />
      ) : (
        <AddPaymentDialog
          open={addPaymentOpen}
          onOpenChange={setAddPaymentOpen}
          tenantSlug={tenantSlug}
          onCreated={invalidatePayments}
        />
      )}

      <PaymentFiltersVisibilityDialog
        open={filterVisDialogOpen}
        onOpenChange={setFilterVisDialogOpen}
        value={filterVis}
        onChange={setFilterVis}
        territoryRows={paymentFilterTerritoryVisibilityRows}
        territoryLevelCount={territoryFilterSpecs.length}
      />

      <PaymentRowActionBar
        open={selected.size > 0}
        selectedCount={selected.size}
        title={
          primarySelectedRow
            ? `${isExpenses ? "Расход" : "Оплата"} #${primarySelectedRow.id} · ${primarySelectedRow.client_name}`
            : ""
        }
        showEdit={selected.size === 1}
        showDelete={canVoidPayments && selected.size > 0}
        showBulkConfirm={!isExpenses && selected.size > 0}
        bulkConfirmDisabled={!allSelectedPending || bulkBusy}
        bulkConfirmHint={
          allSelectedPending
            ? undefined
            : "Подтверждение доступно, когда все выбранные оплаты в статусе «Ожидание подтверждения»"
        }
        onEdit={() => primarySelectedRow && openEdit(primarySelectedRow)}
        onDelete={handleDeleteAction}
        onBulkConfirm={() => void handleBulkConfirm()}
        onClear={() => setSelected(new Set())}
        historyPaymentId={primarySelectedRow?.id ?? null}
      />
    </PageShell>
  );
}
