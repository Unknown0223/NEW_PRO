"use client";

import { TableColumnSettingsDialog, type ColumnDefItem } from "@/components/data-table/table-column-settings-dialog";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { DateTimePickerField, localValueToDatetimeInput } from "@/components/ui/datetime-popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { isAdminOrOperatorLikeRole } from "@/lib/distribution-roles";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { paymentMethodSelectOptions, type ProfilePaymentMethodEntry } from "@/lib/payment-method-options";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, Download, LayoutGrid, RefreshCw, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type PaymentRow = {
  id: number;
  supplier_id: number;
  supplier_name: string;
  supplier_code: string | null;
  amount: string;
  paid_at: string;
  created_at: string;
  payment_method: string | null;
  cash_desk_id: number | null;
  cash_desk_name: string | null;
  comment: string | null;
  created_by_user_id: number | null;
  created_by_name: string | null;
  reversed_at: string | null;
};

type SupplierOpt = { id: number; name: string; code: string | null };

type CashDeskRow = { id: number; name: string };

type TenantProfile = {
  payment_method_entries?: ProfilePaymentMethodEntry[];
  payment_types?: string[];
};

const PAY_TABLE_ID = "suppliers.payments.v1";
const PAY_COL_DEFS: ColumnDefItem[] = [
  { id: "id", label: "ИД" },
  { id: "created_at", label: "Дата создания" },
  { id: "paid_at", label: "Дата оплаты" },
  { id: "supplier", label: "Поставщик" },
  { id: "method", label: "Способ оплаты" },
  { id: "cash_desk", label: "Касса" },
  { id: "amount", label: "Сумма платежа" },
  { id: "created_by", label: "Создано" },
  { id: "comment", label: "Комментарий" },
  { id: "actions", label: " " }
];
const PAY_DEFAULT_ORDER = PAY_COL_DEFS.map((c) => c.id);

type PaymentSortKey =
  | "id"
  | "created_at"
  | "paid_at"
  | "supplier_name"
  | "payment_method"
  | "cash_desk_name"
  | "created_by_name"
  | "amount";

const PAY_SORT_BY_COL: Partial<Record<string, PaymentSortKey>> = {
  id: "id",
  created_at: "created_at",
  paid_at: "paid_at",
  supplier: "supplier_name",
  method: "payment_method",
  cash_desk: "cash_desk_name",
  amount: "amount",
  created_by: "created_by_name"
};

const PAY_NUMERIC_COLS = new Set(["amount"]);

function payColLabel(id: string): string {
  return PAY_COL_DEFS.find((c) => c.id === id)?.label ?? id;
}

function monthRangeStrings(d: Date): { from: string; to: string } {
  const y = d.getFullYear();
  const m = d.getMonth();
  const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const to = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

export function SuppliersPaymentsWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const role = useEffectiveRole();
  const qc = useQueryClient();
  const isAdmin = isAdminOrOperatorLikeRole(role);

  const prefs = useUserTablePrefs({
    tenantSlug,
    tableId: PAY_TABLE_ID,
    defaultColumnOrder: PAY_DEFAULT_ORDER,
    defaultPageSize: 10,
    allowedPageSizes: [10, 20, 50, 100]
  });

  const defaultRange = useMemo(() => monthRangeStrings(new Date()), []);

  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<PaymentSortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);

  const [draftFrom, setDraftFrom] = useState(defaultRange.from);
  const [draftTo, setDraftTo] = useState(defaultRange.to);
  const [draftSupplier, setDraftSupplier] = useState("");
  const [draftMethod, setDraftMethod] = useState("");
  const [draftCashDesk, setDraftCashDesk] = useState("");
  const [draftSearch, setDraftSearch] = useState("");

  const [appliedFrom, setAppliedFrom] = useState(defaultRange.from);
  const [appliedTo, setAppliedTo] = useState(defaultRange.to);
  const [appliedSupplier, setAppliedSupplier] = useState("");
  const [appliedMethod, setAppliedMethod] = useState("");
  const [appliedCashDesk, setAppliedCashDesk] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [cashDeskId, setCashDeskId] = useState("");
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [method, setMethod] = useState("");
  const [comment, setComment] = useState("");
  const [formMsg, setFormMsg] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const dateAnchorRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (open) setPaidAt(localValueToDatetimeInput(new Date()));
  }, [open]);

  const profileQ = useQuery({
    queryKey: ["settings-profile", tenantSlug, "supplier-payments"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<TenantProfile>(`/api/${tenantSlug}/settings/profile`);
      return data;
    }
  });

  const payMethodOpts = useMemo(
    () => paymentMethodSelectOptions(profileQ.data, profileQ.data?.payment_types),
    [profileQ.data]
  );

  const suppliersQ = useQuery({
    queryKey: ["suppliers", tenantSlug, "payments-form"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: SupplierOpt[] }>(`/api/${tenantSlug}/suppliers?status=active`);
      return data.data ?? [];
    }
  });

  const cashDesksQ = useQuery({
    queryKey: ["cash-desks", tenantSlug, "supplier-payments"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: CashDeskRow[]; total: number }>(
        `/api/${tenantSlug}/cash-desks?page=1&limit=200&is_active=true`
      );
      return data.data ?? [];
    }
  });

  const dialogCashDeskId = useMemo(() => {
    const n = Number.parseInt(cashDeskId, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [cashDeskId]);

  const availableCashQ = useQuery({
    queryKey: ["cash-desk-available-cash", tenantSlug, dialogCashDeskId, open],
    enabled: Boolean(tenantSlug) && hydrated && open && dialogCashDeskId > 0,
    staleTime: 10_000,
    queryFn: async () => {
      const { data } = await api.get<{ data: { available_cash: string } }>(
        `/api/${tenantSlug}/cash-desks/${dialogCashDeskId}/available-cash`
      );
      return data.data.available_cash;
    }
  });

  const listQ = useQuery({
    queryKey: [
      "suppliers-payments",
      tenantSlug,
      page,
      prefs.pageSize,
      sortBy,
      sortDir,
      appliedFrom,
      appliedTo,
      appliedSupplier,
      appliedMethod,
      appliedCashDesk,
      appliedSearch
    ],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.list,
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set("page", String(page));
      p.set("limit", String(prefs.pageSize));
      p.set("sort_by", sortBy);
      p.set("sort_dir", sortDir);
      if (appliedFrom) p.set("from", appliedFrom);
      if (appliedTo) p.set("to", appliedTo);
      const sid = Number.parseInt(appliedSupplier, 10);
      if (Number.isFinite(sid) && sid > 0) p.set("supplier_id", String(sid));
      if (appliedMethod.trim()) p.set("payment_method", appliedMethod.trim());
      const cid = Number.parseInt(appliedCashDesk, 10);
      if (Number.isFinite(cid) && cid > 0) p.set("cash_desk_id", String(cid));
      if (appliedSearch.trim()) p.set("search", appliedSearch.trim());
      const { data } = await api.get<{ data: PaymentRow[]; total: number }>(
        `/api/${tenantSlug}/suppliers/accounting/payments?${p.toString()}`
      );
      return { rows: data.data ?? [], total: data.total ?? 0 };
    }
  });

  const applyFilters = useCallback(() => {
    setAppliedFrom(draftFrom);
    setAppliedTo(draftTo);
    setAppliedSupplier(draftSupplier);
    setAppliedMethod(draftMethod);
    setAppliedCashDesk(draftCashDesk);
    setAppliedSearch(draftSearch);
    setPage(1);
  }, [
    draftFrom,
    draftTo,
    draftSupplier,
    draftMethod,
    draftCashDesk,
    draftSearch
  ]);

  const resetFilters = useCallback(() => {
    const r = monthRangeStrings(new Date());
    setDraftFrom(r.from);
    setDraftTo(r.to);
    setDraftSupplier("");
    setDraftMethod("");
    setDraftCashDesk("");
    setDraftSearch("");
    setAppliedFrom(r.from);
    setAppliedTo(r.to);
    setAppliedSupplier("");
    setAppliedMethod("");
    setAppliedCashDesk("");
    setAppliedSearch("");
    setPage(1);
  }, []);

  const createMut = useMutation({
    mutationFn: async () => {
      const sid = Number.parseInt(supplierId, 10);
      const cid = Number.parseInt(cashDeskId, 10);
      const amt = Number.parseFloat(amount.replace(/\s/g, "").replace(",", "."));
      if (!Number.isFinite(sid) || sid <= 0 || !Number.isFinite(cid) || cid <= 0 || !Number.isFinite(amt) || amt <= 0) {
        throw new Error("validation");
      }
      const pt = method.trim();
      if (!pt) throw new Error("validation");
      const rawPaid = paidAt.trim();
      const d = new Date(rawPaid);
      if (!Number.isFinite(d.getTime())) throw new Error("baddate");
      const paid = d.toISOString();
      await api.post(`/api/${tenantSlug}/suppliers/accounting/payments`, {
        supplier_id: sid,
        cash_desk_id: cid,
        amount: amt,
        paid_at: paid,
        payment_method: pt,
        comment: comment.trim() || null
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["suppliers-payments", tenantSlug] });
      await qc.invalidateQueries({ queryKey: ["suppliers-balances", tenantSlug] });
      await qc.invalidateQueries({ queryKey: ["suppliers-reconciliation", tenantSlug] });
      setOpen(false);
      setFormMsg(null);
      setSupplierId("");
      setCashDeskId("");
      setAmount("");
      setPaidAt(localValueToDatetimeInput(new Date()));
      setMethod("");
      setComment("");
    },
    onError: (err: unknown) => {
      if (err instanceof Error && err.message === "validation") {
        setFormMsg("Заполните поставщика, кассу, способ и сумму.");
        return;
      }
      if (err instanceof Error && err.message === "baddate") {
        setFormMsg("Некорректная дата оплаты.");
        return;
      }
      const d = (err as { response?: { data?: { error?: string } } })?.response?.data;
      if (d?.error === "InsufficientCash") setFormMsg("Недостаточно средств в кассе.");
      else if (d?.error === "DuplicateIdempotency") setFormMsg("Дубликат операции.");
      else if (d?.error === "BadCashDesk") setFormMsg("Касса недоступна.");
      else if (d?.error === "BadSupplier") setFormMsg("Поставщик недоступен.");
      else setFormMsg("Ошибка сохранения.");
    }
  });

  const reverseMut = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/${tenantSlug}/suppliers/accounting/payments/${id}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["suppliers-payments", tenantSlug] });
      await qc.invalidateQueries({ queryKey: ["suppliers-balances", tenantSlug] });
      await qc.invalidateQueries({ queryKey: ["suppliers-reconciliation", tenantSlug] });
    }
  });

  const exportXlsx = useCallback(async () => {
    setExporting(true);
    try {
      const p = new URLSearchParams();
      p.set("page", "1");
      p.set("limit", "10000");
      p.set("sort_by", sortBy);
      p.set("sort_dir", sortDir);
      if (appliedFrom) p.set("from", appliedFrom);
      if (appliedTo) p.set("to", appliedTo);
      const sid = Number.parseInt(appliedSupplier, 10);
      if (Number.isFinite(sid) && sid > 0) p.set("supplier_id", String(sid));
      if (appliedMethod.trim()) p.set("payment_method", appliedMethod.trim());
      const cid = Number.parseInt(appliedCashDesk, 10);
      if (Number.isFinite(cid) && cid > 0) p.set("cash_desk_id", String(cid));
      if (appliedSearch.trim()) p.set("search", appliedSearch.trim());
      const { data } = await api.get<{ data: PaymentRow[] }>(
        `/api/${tenantSlug}/suppliers/accounting/payments?${p.toString()}`
      );
      const list = data.data ?? [];
      await downloadXlsxSheet(
        `supplier-payments-${appliedFrom}-${appliedTo}.xlsx`,
        "Оплаты поставщикам",
        [
          "ИД",
          "Дата создания",
          "Дата оплаты",
          "Поставщик",
          "Способ оплаты",
          "Касса",
          "Сумма",
          "Создано",
          "Комментарий",
          "Сторно"
        ],
        list.map((r) => [
          r.id,
          r.created_at.slice(0, 19).replace("T", " "),
          r.paid_at.slice(0, 19).replace("T", " "),
          r.supplier_name,
          r.payment_method ?? "",
          r.cash_desk_name ?? "",
          r.amount,
          r.created_by_name ?? "",
          r.comment ?? "",
          r.reversed_at ? "да" : ""
        ]),
        { colWidths: [8, 20, 20, 28, 14, 20, 14, 18, 36, 8] }
      );
    } finally {
      setExporting(false);
    }
  }, [
    tenantSlug,
    appliedFrom,
    appliedTo,
    appliedSupplier,
    appliedMethod,
    appliedCashDesk,
    appliedSearch,
    sortBy,
    sortDir
  ]);

  const payColRender = useMemo(
    () => ({
      id: (r: PaymentRow) => <span className="font-mono text-xs">{r.id}</span>,
      created_at: (r: PaymentRow) => r.created_at.slice(0, 19).replace("T", " "),
      paid_at: (r: PaymentRow) => r.paid_at.slice(0, 19).replace("T", " "),
      supplier: (r: PaymentRow) => r.supplier_name,
      method: (r: PaymentRow) => r.payment_method ?? "—",
      cash_desk: (r: PaymentRow) => r.cash_desk_name ?? "—",
      amount: (r: PaymentRow) => formatNumberGrouped(r.amount),
      created_by: (r: PaymentRow) => r.created_by_name ?? "—",
      comment: (r: PaymentRow) => <span className="block max-w-[220px] truncate">{r.comment ?? "—"}</span>,
      actions: (r: PaymentRow) =>
        isAdmin && !r.reversed_at ? (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            title="Сторно"
            onClick={() => {
              if (window.confirm("Сторнировать оплату? Средства вернутся в кассу.")) reverseMut.mutate(r.id);
            }}
          >
            <RotateCcw className="size-3.5" />
          </Button>
        ) : null
    }),
    [isAdmin, reverseMut]
  );

  if (!hydrated) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      </PageShell>
    );
  }
  if (!tenantSlug) {
    return (
      <PageShell>
        <p className="text-sm text-destructive">
          <Link href="/login" className="underline">
            Войти
          </Link>
        </p>
      </PageShell>
    );
  }

  const rows = listQ.data?.rows ?? [];
  const total = listQ.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / prefs.pageSize));
  const visibleCols = prefs.visibleColumnOrder;
  const fromIdx = total === 0 ? 0 : (page - 1) * prefs.pageSize + 1;
  const toIdx = Math.min(page * prefs.pageSize, total);

  function togglePaySort(colId: string) {
    const mapped = PAY_SORT_BY_COL[colId];
    if (!mapped) return;
    setPage(1);
    if (sortBy === mapped) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(mapped);
    setSortDir("asc");
  }

  return (
    <PageShell className="space-y-4">
      <PageHeader
        title="Оплаты поставщикам"
        description="Списание с кассы, уменьшение долга перед поставщиком; сторно вместо удаления."
        actions={
          <Button size="sm" className="bg-teal-600 hover:bg-teal-700" disabled={!isAdmin} onClick={() => setOpen(true)}>
            Добавить
          </Button>
        }
      />

      <div className="orders-hub-section orders-hub-section--filters orders-hub-section--stack-tight">
        <Card className="rounded-none border-0 bg-transparent shadow-none hover:shadow-none">
          <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground/80">Фильтр</p>
          <button
            ref={dateAnchorRef}
            type="button"
            className="inline-flex h-9 min-w-[14rem] max-w-full items-center justify-between rounded-md border border-input bg-background px-2.5 text-left text-xs sm:min-w-[15rem] sm:text-sm"
            onClick={() => setDateOpen((v) => !v)}
          >
            <span className="min-w-0 flex-1 truncate text-left font-medium text-foreground">
              {formatDateRangeButton(draftFrom, draftTo)}
            </span>
            <CalendarDays className="ml-1 size-3.5 shrink-0 text-muted-foreground" />
          </button>
        </div>
        <DateRangePopover
          open={dateOpen}
          onOpenChange={setDateOpen}
          anchorRef={dateAnchorRef}
          dateFrom={draftFrom}
          dateTo={draftTo}
          onApply={({ dateFrom, dateTo }) => {
            setDraftFrom(dateFrom);
            setDraftTo(dateTo);
          }}
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="grid gap-1.5">
            <Label>Поставщики</Label>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={draftSupplier}
              onChange={(e) => setDraftSupplier(e.target.value)}
            >
              <option value="">Все</option>
              {(suppliersQ.data ?? []).map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label>Способ оплаты</Label>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={draftMethod}
              onChange={(e) => setDraftMethod(e.target.value)}
            >
              <option value="">Все</option>
              {payMethodOpts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label>Касса</Label>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={draftCashDesk}
              onChange={(e) => setDraftCashDesk(e.target.value)}
            >
              <option value="">Все</option>
              {(cashDesksQ.data ?? []).map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" title="Сброс фильтров" onClick={resetFilters}>
            <RotateCcw className="size-4" />
          </Button>
          <Button type="button" size="sm" className="h-9 min-w-[7rem] bg-teal-600 px-4 hover:bg-teal-700" onClick={applyFilters}>
            Применить
          </Button>
        </div>
          </CardContent>
        </Card>
      </div>

      <TableColumnSettingsDialog
        open={columnDialogOpen}
        onOpenChange={setColumnDialogOpen}
        title="Управление столбцами"
        description="Видимые столбцы и порядок сохраняются для вашей учётной записи. Размер страницы — в панели над таблицей."
        columns={[...PAY_COL_DEFS]}
        columnOrder={prefs.columnOrder}
        hiddenColumnIds={prefs.hiddenColumnIds}
        saving={prefs.saving}
        onSave={(next) => prefs.saveColumnLayout(next)}
        onReset={() => prefs.resetColumnLayout()}
      />

      <div className="orders-hub-section orders-hub-section--table mt-4">
        <Card className="overflow-hidden rounded-none border-0 bg-transparent shadow-none hover:shadow-none">
          <CardContent className="p-0">
        <div className="table-toolbar flex flex-wrap items-center justify-between gap-2 border-b border-border/80 bg-muted/30 px-3 py-2 sm:px-4">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <select
              className="h-9 shrink-0 rounded-md border border-input bg-background px-2 text-sm"
              value={String(prefs.pageSize)}
              onChange={(e) => {
                prefs.setPageSize(Number.parseInt(e.target.value, 10) || 10);
                setPage(1);
              }}
              aria-label="Строк на странице"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={String(n)}>
                  {n}
                </option>
              ))}
            </select>
            <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" title="Столбцы таблицы" onClick={() => setColumnDialogOpen(true)}>
              <LayoutGrid className="size-4" />
            </Button>
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <Input
                className="h-9 text-sm"
                placeholder="Поиск"
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
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
              variant="outline"
              disabled={exporting}
              className="h-9 gap-1 border-green-600/40 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/30"
              onClick={() => void exportXlsx()}
            >
              <Download className="size-3.5" />
              {exporting ? "…" : "Excel"}
            </Button>
            <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" title="Обновить" onClick={() => void listQ.refetch()}>
              <RefreshCw className={cn("size-4", listQ.isFetching && "animate-spin")} />
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            {visibleCols.length === 0 ? (
              <tbody>
                <tr>
                  <td className="px-3 py-10 text-center text-muted-foreground">Нет видимых столбцов.</td>
                </tr>
              </tbody>
            ) : (
              <>
                <thead className="app-table-thead text-left">
                  <tr>
                    {visibleCols.map((colId) => {
                      const mapped = PAY_SORT_BY_COL[colId];
                      const active = mapped != null && sortBy === mapped;
                      return (
                        <th
                          key={colId}
                          className={cn(
                            "px-3 py-2.5",
                            PAY_NUMERIC_COLS.has(colId) && "text-right",
                            colId === "actions" && "w-12"
                          )}
                        >
                          {mapped ? (
                            <button
                              type="button"
                              onClick={() => togglePaySort(colId)}
                              className={cn(
                                "inline-flex items-center gap-1 hover:text-foreground",
                                PAY_NUMERIC_COLS.has(colId) && "ml-auto"
                              )}
                              title="Сортировка по столбцу"
                            >
                              <span>{payColLabel(colId)}</span>
                              {active ? (
                                sortDir === "asc" ? (
                                  <ArrowUp className="size-3.5" />
                                ) : (
                                  <ArrowDown className="size-3.5" />
                                )
                              ) : (
                                <ArrowUpDown className="size-3.5 text-muted-foreground" />
                              )}
                            </button>
                          ) : (
                            payColLabel(colId)
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {listQ.isLoading ? (
                    <tr>
                      <td colSpan={visibleCols.length} className="px-3 py-10 text-center text-muted-foreground">
                        Загрузка…
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={visibleCols.length} className="px-3 py-10 text-center text-muted-foreground">
                        Пусто
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr
                        key={r.id}
                        className={cn(
                          "border-t even:bg-muted/20",
                          r.reversed_at && "bg-muted/30 text-muted-foreground line-through decoration-1"
                        )}
                      >
                        {visibleCols.map((colId) => {
                          const render = payColRender[colId as keyof typeof payColRender];
                          return (
                            <td
                              key={colId}
                              className={cn(
                                "px-3 py-2",
                                PAY_NUMERIC_COLS.has(colId) && "text-right font-medium tabular-nums",
                                colId === "created_at" || colId === "paid_at" ? "whitespace-nowrap" : null,
                                colId === "actions" && "text-right"
                              )}
                            >
                              {render ? render(r) : null}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </>
            )}
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/80 bg-muted/25 px-3 py-2.5 text-xs text-muted-foreground sm:px-4">
          <span className="text-foreground/80">
            Показано {fromIdx}–{toIdx} / {total}
          </span>
          <div className="flex items-center gap-1">
            <Button type="button" variant="outline" size="sm" className="h-8" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              ←
            </Button>
            <span className="tabular-nums px-2 text-foreground">
              {page} / {totalPages}
            </span>
            <Button type="button" variant="outline" size="sm" className="h-8" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              →
            </Button>
          </div>
        </div>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setFormMsg(null);
        }}
      >
        <DialogContent showCloseButton className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Оплата поставщику</DialogTitle>
            <DialogDescription>Касса, способ оплаты и сумма; проверка остатка в кассе.</DialogDescription>
          </DialogHeader>
          {formMsg ? <p className="text-sm text-destructive">{formMsg}</p> : null}
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Поставщик</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="">—</option>
                {(suppliersQ.data ?? []).map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label>Касса</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={cashDeskId}
                onChange={(e) => setCashDeskId(e.target.value)}
              >
                <option value="">—</option>
                {(cashDesksQ.data ?? []).map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.name}
                  </option>
                ))}
              </select>
              {dialogCashDeskId > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {availableCashQ.isLoading ? (
                    <>Доступно в кассе: …</>
                  ) : availableCashQ.isError ? (
                    <>Не удалось загрузить остаток кассы.</>
                  ) : (
                    <>
                      Доступно в кассе (для оплат поставщикам):{" "}
                      <span
                        className={cn(
                          "font-medium tabular-nums text-foreground",
                          Number(String(availableCashQ.data).replace(/\s/g, "").replace(",", ".")) < 0 &&
                            "text-destructive"
                        )}
                      >
                        {formatNumberGrouped(availableCashQ.data, {
                          minFractionDigits: 2,
                          maxFractionDigits: 2
                        })}
                      </span>
                    </>
                  )}
                </p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label>Способ оплаты</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="">—</option>
                {payMethodOpts.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label>Сумма</Label>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </div>
            <div className="grid gap-1.5">
              <Label>Дата оплаты</Label>
              <DateTimePickerField id="supplier-payment-paid-at" value={paidAt} onChange={setPaidAt} />
            </div>
            <div className="grid gap-1.5">
              <Label>Комментарий</Label>
              <Input value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>
            <Button
              disabled={createMut.isPending || !isAdmin}
              onClick={() => {
                setFormMsg(null);
                createMut.mutate();
              }}
            >
              Сохранить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
