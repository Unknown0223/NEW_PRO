"use client";

import { AddOpeningBalanceDialog } from "@/components/opening-balances/add-opening-balance-dialog";
import { OpeningBalanceImportDialog } from "@/components/opening-balances/opening-balance-import-dialog";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { TableColumnSettingsDialog, type ColumnDefItem } from "@/components/data-table/table-column-settings-dialog";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { FilterSelect, filterPanelSelectClassName } from "@/components/ui/filter-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableMultiSelectPanel } from "@/components/ui/searchable-multi-select-panel";
import { api } from "@/lib/api";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import type { ClientRow } from "@/lib/client-types";
import { getUserFacingError } from "@/lib/error-utils";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { paymentMethodSelectOptions, type ProfilePaymentMethodEntry } from "@/lib/payment-method-options";
import { formatNumberGrouped } from "@/lib/format-numbers";
import type { OpeningBalanceListResponse, OpeningBalanceListRow } from "@/lib/opening-balance-types";
import { STALE } from "@/lib/query-stale";
import { DEFAULT_TABLE_PAGE_SIZES } from "@/lib/table-page-sizes";
import { useActiveTradeDirectionsCatalog } from "@/hooks/use-active-trade-directions-catalog";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, LayoutGrid, RefreshCw, RotateCcw, Search, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type StaffPick = { id: number; fio: string; code?: string | null };
type CashDeskRow = { id: number; name: string; is_active: boolean };

type DateFieldFilter = "created_at" | "paid_at";

type FilterForm = {
  date_from: string;
  date_to: string;
  date_field: DateFieldFilter;
  client_ids: number[];
  payment_type: string;
  trade_direction: string;
  agent_id: string;
  cash_desk_ids: number[];
  balance_type: "" | "debt" | "surplus";
  search: string;
  territory_region: string;
  /** active — faol yozuvlar; archive — yumshoq o‘chirilganlar */
  list_mode: "active" | "archive";
};

const TABLE_ID = "opening-balances.initial.v1";
const PAGE_SIZES = DEFAULT_TABLE_PAGE_SIZES.filter((n) => n <= 100);

const COLUMN_META: ColumnDefItem[] = [
  { id: "created_at", label: "Дата создания" },
  { id: "client_name", label: "Клиенты" },
  { id: "agent_name", label: "Агент" },
  { id: "trade_direction", label: "Направление торговли" },
  { id: "cash_desk", label: "Касса" },
  { id: "balance_type", label: "Тип остатка" },
  { id: "payment_type", label: "Способ оплаты" },
  { id: "amount", label: "Сумма" },
  { id: "note", label: "Комментарий" },
  { id: "deleted_at", label: "Архив" }
];
const DEFAULT_COLUMN_ORDER = COLUMN_META.map((c) => c.id);

function monthBoundsUtcIso(): { from: string; to: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return {
    from: `${y}-${pad(m + 1)}-01`,
    to: `${y}-${pad(m + 1)}-${pad(last)}`
  };
}

const defaultForm = (): FilterForm => {
  const { from, to } = monthBoundsUtcIso();
  return {
    date_from: from,
    date_to: to,
    date_field: "created_at",
    client_ids: [],
    payment_type: "",
    trade_direction: "",
    agent_id: "",
    cash_desk_ids: [],
    balance_type: "",
    search: "",
    territory_region: "",
    list_mode: "active"
  };
};

function buildQuery(form: FilterForm, page: number, limit: number): string {
  const p = new URLSearchParams();
  p.set("page", String(page));
  p.set("limit", String(limit));
  if (form.date_from.trim()) p.set("date_from", form.date_from.trim());
  if (form.date_to.trim()) p.set("date_to", form.date_to.trim());
  if (form.date_field !== "created_at") p.set("date_field", form.date_field);
  if (form.client_ids.length > 0) p.set("client_ids", form.client_ids.join(","));
  if (form.payment_type.trim()) p.set("payment_type", form.payment_type.trim());
  if (form.trade_direction.trim()) p.set("trade_direction", form.trade_direction.trim());
  if (form.agent_id.trim()) p.set("agent_id", form.agent_id.trim());
  if (form.cash_desk_ids.length > 0) p.set("cash_desk_ids", form.cash_desk_ids.join(","));
  if (form.balance_type) p.set("balance_type", form.balance_type);
  if (form.search.trim()) p.set("search", form.search.trim());
  if (form.territory_region.trim()) p.set("territory_region", form.territory_region.trim());
  if (form.list_mode === "archive") p.set("archive", "true");
  return p.toString();
}

function formatDt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function colHeaderClass(colId: string): string {
  return cn("whitespace-nowrap px-2 py-2.5", colId === "amount" && "text-right");
}

function OpeningBalanceDataCell({ colId, row }: { colId: string; row: OpeningBalanceListRow }) {
  switch (colId) {
    case "created_at":
      return <td className="whitespace-nowrap px-2 py-2 text-xs">{formatDt(row.created_at)}</td>;
    case "client_name":
      return <td className="max-w-[12rem] truncate px-2 py-2">{row.client_name}</td>;
    case "agent_name":
      return <td className="max-w-[8rem] truncate px-2 py-2 text-xs">{row.agent_name ?? "—"}</td>;
    case "trade_direction":
      return <td className="max-w-[8rem] truncate px-2 py-2 text-xs">{row.trade_direction ?? "—"}</td>;
    case "cash_desk":
      return <td className="whitespace-nowrap px-2 py-2 text-xs">{row.cash_desk_name ?? "—"}</td>;
    case "balance_type":
      return <td className="whitespace-nowrap px-2 py-2 text-xs">{row.balance_type_label}</td>;
    case "payment_type":
      return <td className="whitespace-nowrap px-2 py-2 text-xs">{row.payment_type}</td>;
    case "amount":
      return (
        <td className="whitespace-nowrap px-2 py-2 text-right font-mono text-xs tabular-nums">
          {formatNumberGrouped(row.amount, { maxFractionDigits: 2 })}
        </td>
      );
    case "note":
      return (
        <td className="max-w-[14rem] truncate px-2 py-2 text-xs text-muted-foreground">{row.note ?? "—"}</td>
      );
    case "deleted_at":
      return (
        <td className="whitespace-nowrap px-2 py-2 text-xs text-muted-foreground">
          {formatDt(row.deleted_at)}
          {row.deleted_by_name ? ` · ${row.deleted_by_name}` : ""}
        </td>
      );
    default:
      return <td className="px-2 py-2" />;
  }
}

export function InitialBalancesWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const qc = useQueryClient();
  const { confirm, dialog: confirmDialog } = useAppConfirm();

  const [draft, setDraft] = useState<FilterForm>(() => defaultForm());
  const [applied, setApplied] = useState<FilterForm>(() => defaultForm());
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const dateRangeAnchorRef = useRef<HTMLButtonElement>(null);
  const [cashDeskSearch, setCashDeskSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);

  const tablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: TABLE_ID,
    defaultColumnOrder: DEFAULT_COLUMN_ORDER,
    defaultPageSize: 10,
    allowedPageSizes: PAGE_SIZES,
    defaultHiddenColumnIds: ["deleted_at"]
  });
  const pageSize = tablePrefs.pageSize;

  const queryString = useMemo(
    () => buildQuery(applied, page, pageSize),
    [applied, page, pageSize]
  );

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [queryString]);

  const listQ = useQuery({
    queryKey: ["opening-balances", tenantSlug, queryString],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get<OpeningBalanceListResponse>(
        `/api/${tenantSlug}/opening-balances?${queryString}`
      );
      return data;
    }
  });

  const clientsQ = useQuery({
    queryKey: ["clients", tenantSlug, "initial-balances-filters"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get<{ data: ClientRow[] }>(
        `/api/${tenantSlug}/clients?page=1&limit=500&is_active=true`
      );
      return data.data;
    }
  });

  const agentsQ = useQuery({
    queryKey: ["agents", tenantSlug, "initial-balances-filters"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: StaffPick[] }>(`/api/${tenantSlug}/agents?is_active=true`);
      return data.data;
    }
  });

  const cashDesksQ = useQuery({
    queryKey: ["cash-desks", tenantSlug, "initial-balances"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: CashDeskRow[] }>(
        `/api/${tenantSlug}/cash-desks?is_active=true&limit=200&page=1`
      );
      return data.data.filter((d) => d.is_active);
    }
  });

  const tradeDirectionsCatalog = useActiveTradeDirectionsCatalog(tenantSlug, "initial-balances");
  const tradeDirectionOptions = tradeDirectionsCatalog.labels;

  const profileQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug, "initial-balances-pay"],
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

  const regionRefsQ = useQuery({
    queryKey: ["clients-references", tenantSlug, "initial-balances-region"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{
        regions?: string[];
        region_options?: { value: string; label: string }[];
      }>(`/api/${tenantSlug}/clients/references`);
      return data;
    }
  });

  const clientItems = useMemo(() => {
    const rows = (clientsQ.data ?? []).map((c) => ({ id: c.id, title: c.name }));
    const q = clientSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.title.toLowerCase().includes(q));
  }, [clientsQ.data, clientSearch]);

  const cashDeskItems = useMemo(() => {
    const rows = (cashDesksQ.data ?? []).map((d) => ({ id: d.id, title: d.name }));
    const q = cashDeskSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.title.toLowerCase().includes(q));
  }, [cashDesksQ.data, cashDeskSearch]);

  const applyFilters = useCallback(() => {
    setApplied({ ...draft });
    setPage(1);
  }, [draft]);

  const resetDraftToApplied = useCallback(() => {
    setDraft({ ...applied });
  }, [applied]);

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/${tenantSlug}/opening-balances/${id}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["opening-balances", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["dashboard-stats", tenantSlug] });
    }
  });

  const restoreMut = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/api/${tenantSlug}/opening-balances/${id}/restore`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["opening-balances", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["dashboard-stats", tenantSlug] });
    }
  });

  const listLimit = listQ.data?.limit ?? pageSize;
  const totalPages = listQ.data ? Math.max(1, Math.ceil(listQ.data.total / listLimit)) : 1;

  const visibleColumnOrder = useMemo(() => {
    const order = tablePrefs.visibleColumnOrder;
    if (applied.list_mode === "archive") {
      return order.includes("deleted_at") ? order : [...order, "deleted_at"];
    }
    return order.filter((id) => id !== "deleted_at");
  }, [applied.list_mode, tablePrefs.visibleColumnOrder]);

  const listErrorDetail = useMemo(() => {
    if (!listQ.isError || !listQ.error) return null;
    return getUserFacingError(listQ.error);
  }, [listQ.isError, listQ.error]);

  const paymentTypeFilterOpts = useMemo(
    () => paymentMethodSelectOptions(profileQ.data, profileQ.data?.payment_types),
    [profileQ.data]
  );

  const regionOptions = useMemo(() => {
    const opts = regionRefsQ.data?.region_options ?? [];
    if (opts.length > 0) {
      const seen = new Set<string>();
      const out: Array<{ value: string; label: string }> = [];
      for (const o of opts) {
        const value = (o.value ?? o.label ?? "").trim();
        if (!value || seen.has(value.toLowerCase())) continue;
        seen.add(value.toLowerCase());
        out.push({ value, label: (o.label || o.value).trim() || value });
      }
      return out;
    }
    return [...new Set((regionRefsQ.data?.regions ?? []).map((s) => s.trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "ru"))
      .map((v) => ({ value: v, label: v }));
  }, [regionRefsQ.data]);

  const pageRows = listQ.data?.data ?? [];
  const allPageSelected = pageRows.length > 0 && pageRows.every((r) => selectedIds.has(r.id));
  const somePageSelected = pageRows.some((r) => selectedIds.has(r.id)) && !allPageSelected;

  const toggleRow = (id: number, on: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const togglePage = (on: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const r of pageRows) {
        if (on) next.add(r.id);
        else next.delete(r.id);
      }
      return next;
    });
  };

  const runBulk = async () => {
    if (!tenantSlug || selectedIds.size === 0 || applied.list_mode === "archive") return;
    const n = selectedIds.size;
    const okAsk = await confirm({
      title: "Удалить",
      message: "Вы действительно хотите удалить выбранные начальные балансы?",
      detail: `Будет удалено записей: ${n}. Текущий баланс клиентов будет скорректирован.`,
      confirmLabel: "Да",
      cancelLabel: "Нет",
      destructive: true
    });
    if (!okAsk) return;
    setBulkBusy(true);
    setBulkMsg(null);
    try {
      const { data } = await api.post<{
        data: { ok: number[]; failed: { id: number; error: string }[] };
      }>(`/api/${tenantSlug}/opening-balances/bulk`, {
        ids: Array.from(selectedIds),
        action: "archive"
      });
      const failed = data.data.failed ?? [];
      const ok = data.data.ok ?? [];
      setSelectedIds(new Set());
      void qc.invalidateQueries({ queryKey: ["opening-balances", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["dashboard-stats", tenantSlug] });
      if (failed.length > 0) {
        setBulkMsg(
          `Удалено: ${ok.length}. Ошибок: ${failed.length}${
            failed[0] ? ` (напр. #${failed[0].id})` : ""
          }`
        );
      } else {
        setBulkMsg(`Удалено: ${ok.length}`);
      }
    } catch (e) {
      setBulkMsg(getUserFacingError(e, "Не удалось удалить выбранные записи"));
    } finally {
      setBulkBusy(false);
    }
  };

  const columnSettingsColumns = useMemo(
    () =>
      applied.list_mode === "archive"
        ? COLUMN_META
        : COLUMN_META.filter((c) => c.id !== "deleted_at"),
    [applied.list_mode]
  );

  return (
    <PageShell>
      <TableColumnSettingsDialog
        open={columnDialogOpen}
        onOpenChange={setColumnDialogOpen}
        title="Управление столбцами"
        description="Видимые столбцы и порядок сохраняются для вашей учётной записи."
        columns={columnSettingsColumns}
        columnOrder={tablePrefs.columnOrder.filter((id) =>
          columnSettingsColumns.some((c) => c.id === id)
        )}
        hiddenColumnIds={tablePrefs.hiddenColumnIds}
        saving={tablePrefs.saving}
        onSave={(next) => tablePrefs.saveColumnLayout(next)}
        onReset={() => tablePrefs.resetColumnLayout()}
      />
      <PageHeader
        title="Начальные балансы клиентов"
        description="Стартовые остатки по клиентам (долг или излишек) с учётом кассы и направления."
        actions={
          tenantSlug ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
                onClick={() => setImportOpen(true)}
              >
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Импортировать с excel</span>
              </button>
              <button
                ref={dateRangeAnchorRef}
                type="button"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "h-8 max-w-[14rem] gap-2 font-normal sm:max-w-none",
                  dateRangeOpen && "border-primary/60 bg-primary/5"
                )}
                aria-expanded={dateRangeOpen}
                aria-haspopup="dialog"
                onClick={() => setDateRangeOpen((o) => !o)}
              >
                <CalendarDays className="h-4 w-4 shrink-0" />
                <span className="truncate text-xs sm:text-sm">
                  {formatDateRangeButton(draft.date_from, draft.date_to)}
                </span>
              </button>
              <button
                type="button"
                className={cn(buttonVariants({ size: "sm" }), "gap-1 bg-teal-600 text-white hover:bg-teal-700")}
                onClick={() => setAddOpen(true)}
              >
                + Добавить
              </button>
            </div>
          ) : null
        }
      />

      {!hydrated ? (
        <p className="text-sm text-muted-foreground">Загрузка сессии…</p>
      ) : !tenantSlug ? (
        <p className="text-sm text-destructive">
          <Link href="/login" className="underline">
            Войти
          </Link>
        </p>
      ) : (
        <div className="space-y-4">
          <Card className="border-border/60 shadow-sm">
            <CardContent className="space-y-3 p-3 sm:p-4">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <div className="space-y-1 sm:col-span-2">
                  <SearchableMultiSelectPanel
                    label="Клиенты"
                    className="w-full"
                    items={clientItems}
                    selected={new Set(draft.client_ids)}
                    onSelectedChange={(fn) => {
                      setDraft((d) => {
                        const prev = new Set(d.client_ids);
                        const next = typeof fn === "function" ? fn(prev) : fn;
                        return { ...d, client_ids: Array.from(next).sort((a, b) => a - b) };
                      });
                    }}
                    search={clientSearch}
                    onSearchChange={setClientSearch}
                    triggerPlaceholder="Все клиенты"
                    selectAllLabel="Выбрать все"
                    clearVisibleLabel="Снять выбор"
                    searchPlaceholder="Поиск…"
                    minPopoverWidth={280}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[0.65rem] text-muted-foreground sm:text-xs">Способ оплаты</Label>
                  <FilterSelect
                    emptyLabel="Все"
                    className={cn(filterPanelSelectClassName, "max-w-none bg-background")}
                    value={draft.payment_type}
                    onChange={(e) => setDraft((d) => ({ ...d, payment_type: e.target.value }))}
                  >
                    {paymentTypeFilterOpts.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </FilterSelect>
                </div>
                <div className="space-y-1">
                  <Label className="text-[0.65rem] text-muted-foreground sm:text-xs">
                    Направление торговли
                  </Label>
                  <FilterSelect
                    emptyLabel="Все"
                    className={cn(filterPanelSelectClassName, "max-w-none bg-background")}
                    value={draft.trade_direction}
                    onChange={(e) => setDraft((d) => ({ ...d, trade_direction: e.target.value }))}
                  >
                    {tradeDirectionOptions.map((td) => (
                      <option key={td} value={td}>
                        {td}
                      </option>
                    ))}
                  </FilterSelect>
                </div>
                <div className="space-y-1">
                  <Label className="text-[0.65rem] text-muted-foreground sm:text-xs">Агент</Label>
                  <FilterSelect
                    emptyLabel="Все"
                    className={cn(filterPanelSelectClassName, "max-w-none bg-background")}
                    value={draft.agent_id}
                    onChange={(e) => setDraft((d) => ({ ...d, agent_id: e.target.value }))}
                  >
                    {(agentsQ.data ?? []).map((a) => (
                      <option key={a.id} value={String(a.id)}>
                        {a.fio}
                      </option>
                    ))}
                  </FilterSelect>
                </div>
                <div className="space-y-1">
                  <Label className="text-[0.65rem] text-muted-foreground sm:text-xs">Область</Label>
                  <FilterSelect
                    emptyLabel="Все области"
                    className={cn(filterPanelSelectClassName, "max-w-none bg-background")}
                    value={draft.territory_region}
                    onChange={(e) => setDraft((d) => ({ ...d, territory_region: e.target.value }))}
                  >
                    {regionOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </FilterSelect>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <SearchableMultiSelectPanel
                    label="Касса"
                    className="w-full"
                    items={cashDeskItems}
                    selected={new Set(draft.cash_desk_ids)}
                    onSelectedChange={(fn) => {
                      setDraft((d) => {
                        const prev = new Set(d.cash_desk_ids);
                        const next = typeof fn === "function" ? fn(prev) : fn;
                        return { ...d, cash_desk_ids: Array.from(next).sort((a, b) => a - b) };
                      });
                    }}
                    search={cashDeskSearch}
                    onSearchChange={setCashDeskSearch}
                    triggerPlaceholder="Все кассы"
                    selectAllLabel="Выбрать все"
                    clearVisibleLabel="Снять выбор"
                    searchPlaceholder="Поиск кассы…"
                    minPopoverWidth={260}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[0.65rem] text-muted-foreground sm:text-xs">Тип</Label>
                  <FilterSelect
                    emptyLabel="Все типы"
                    className={cn(filterPanelSelectClassName, "max-w-none bg-background")}
                    value={draft.balance_type}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        balance_type: e.target.value as FilterForm["balance_type"]
                      }))
                    }
                  >
                    <option value="debt">Долг</option>
                    <option value="surplus">Излишек</option>
                  </FilterSelect>
                </div>
                <div className="space-y-1">
                  <Label className="text-[0.65rem] text-muted-foreground sm:text-xs">Период по</Label>
                  <FilterSelect
                    emptyLabel="—"
                    className={cn(filterPanelSelectClassName, "max-w-none bg-background")}
                    value={draft.date_field}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        date_field: e.target.value as DateFieldFilter
                      }))
                    }
                  >
                    <option value="created_at">Дата создания</option>
                    <option value="paid_at">Дата оплаты</option>
                  </FilterSelect>
                </div>
                <div className="space-y-1">
                  <Label className="text-[0.65rem] text-muted-foreground sm:text-xs">Список</Label>
                  <FilterSelect
                    emptyLabel="—"
                    className={cn(filterPanelSelectClassName, "max-w-none bg-background")}
                    value={draft.list_mode}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        list_mode: e.target.value as FilterForm["list_mode"]
                      }))
                    }
                  >
                    <option value="active">Активные</option>
                    <option value="archive">Архив</option>
                  </FilterSelect>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    onClick={resetDraftToApplied}
                  >
                    Сброс
                  </button>
                  <button
                    type="button"
                    className={cn(buttonVariants({ size: "default" }), "min-w-[7.5rem] bg-teal-600 text-white hover:bg-teal-700")}
                    onClick={applyFilters}
                  >
                    Применить
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                  value={String(pageSize)}
                  aria-label="Строк на странице"
                  onChange={(e) => {
                    tablePrefs.setPageSize(Number.parseInt(e.target.value, 10));
                    setPage(1);
                  }}
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 w-9 px-0")}
                  title="Управление столбцами"
                  onClick={() => setColumnDialogOpen(true)}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <div className="relative min-w-[10rem] max-w-xs flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-9 w-full bg-background pl-9"
                    placeholder="Поиск"
                    value={draft.search}
                    onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") applyFilters();
                    }}
                  />
                </div>
                <button
                  type="button"
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-9 w-9 px-0")}
                  onClick={() => void listQ.refetch()}
                  title="Обновить"
                >
                  <RefreshCw className={cn("h-4 w-4", listQ.isFetching && "animate-spin")} />
                </button>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <p className="text-xs text-muted-foreground">Всего: {listQ.data?.total ?? "—"}</p>
                {bulkMsg ? (
                  <p
                    className={cn(
                      "max-w-xs text-right text-xs",
                      bulkMsg.includes("Не удалось") || bulkMsg.includes("Ошибок")
                        ? "text-destructive"
                        : "text-muted-foreground"
                    )}
                  >
                    {bulkMsg}
                  </p>
                ) : null}
                {applied.list_mode !== "archive" ? (
                  <button
                    type="button"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    )}
                    disabled={selectedIds.size === 0 || bulkBusy}
                    onClick={() => void runBulk()}
                  >
                    <Trash2 className="h-4 w-4" />
                    Удалить
                    {selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
                  </button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {listQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка…</p>
          ) : listQ.isError ? (
            <div className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <p className="font-medium text-destructive">Не удалось загрузить список.</p>
              {listErrorDetail ? <p className="text-muted-foreground">{listErrorDetail}</p> : null}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-border/80 bg-card shadow-sm">
                <table className="w-full min-w-[960px] border-collapse text-sm">
                  <thead className="app-table-thead text-left text-xs">
                    <tr>
                      <th className="w-10 px-2 py-2.5">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-teal-600"
                          checked={allPageSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = somePageSelected;
                          }}
                          onChange={(e) => togglePage(e.target.checked)}
                          aria-label="Выбрать все на странице"
                        />
                      </th>
                      {visibleColumnOrder.map((colId) => (
                        <th key={colId} className={colHeaderClass(colId)}>
                          {COLUMN_META.find((c) => c.id === colId)?.label ?? colId}
                        </th>
                      ))}
                      <th className="w-12 px-2 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {(listQ.data?.data ?? []).map((r, idx) => (
                      <tr
                        key={r.id}
                        className={cn(
                          "border-b border-border/60 hover:bg-muted/40",
                          idx % 2 === 1 && "bg-muted/15",
                          selectedIds.has(r.id) && "bg-teal-50/70 dark:bg-teal-950/20"
                        )}
                      >
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-teal-600"
                            checked={selectedIds.has(r.id)}
                            onChange={(e) => toggleRow(r.id, e.target.checked)}
                            aria-label={`Выбрать #${r.id}`}
                          />
                        </td>
                        {visibleColumnOrder.map((colId) => (
                          <OpeningBalanceDataCell key={colId} colId={colId} row={r} />
                        ))}
                        <td className="px-1 py-2">
                          {applied.list_mode === "archive" ? (
                            <button
                              type="button"
                              className="rounded p-1.5 text-primary hover:bg-primary/10"
                              title="Восстановить"
                              disabled={restoreMut.isPending}
                              onClick={() => {
                                void (async () => {
                                  const ok = await confirm({
                                    title: "Восстановить",
                                    message: "Восстановить этот начальный баланс?",
                                    detail: `Запись #${r.id}. Баланс клиента снова будет скорректирован.`,
                                    confirmLabel: "Да",
                                    cancelLabel: "Нет",
                                    destructive: false
                                  });
                                  if (ok) restoreMut.mutate(r.id);
                                })();
                              }}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="rounded p-1.5 text-destructive hover:bg-destructive/10"
                              title="Удалить"
                              disabled={deleteMut.isPending}
                              onClick={() => {
                                void (async () => {
                                  const ok = await confirm({
                                    title: "Удалить",
                                    message: "Вы действительно хотите удалить?",
                                    detail: `Запись #${r.id}. Текущий баланс клиента будет скорректирован.`,
                                    confirmLabel: "Да",
                                    cancelLabel: "Нет",
                                    destructive: true
                                  });
                                  if (ok) deleteMut.mutate(r.id);
                                })();
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(listQ.data?.data.length ?? 0) === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">Пусто</p>
                ) : null}
              </div>

              {totalPages > 1 ? (
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <p className="text-muted-foreground">
                    Стр. {page} из {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Назад
                    </button>
                    <button
                      type="button"
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Вперёд
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}

          <DateRangePopover
            open={dateRangeOpen}
            onOpenChange={setDateRangeOpen}
            anchorRef={dateRangeAnchorRef}
            dateFrom={draft.date_from}
            dateTo={draft.date_to}
            onApply={({ dateFrom, dateTo }) =>
              setDraft((d) => ({
                ...d,
                date_from: dateFrom,
                date_to: dateTo
              }))
            }
          />

          {tenantSlug ? (
            <>
              <AddOpeningBalanceDialog
                open={addOpen}
                onOpenChange={setAddOpen}
                tenantSlug={tenantSlug}
                onCreated={() => {
                  void qc.invalidateQueries({ queryKey: ["opening-balances", tenantSlug] });
                }}
              />
              <OpeningBalanceImportDialog
                open={importOpen}
                onOpenChange={setImportOpen}
                tenantSlug={tenantSlug}
                onImported={() => {
                  void qc.invalidateQueries({ queryKey: ["opening-balances", tenantSlug] });
                }}
              />
            </>
          ) : null}
        </div>
      )}
      {confirmDialog}
    </PageShell>
  );
}
