"use client";

import { TableColumnSettingsDialog, type ColumnDefItem } from "@/components/data-table/table-column-settings-dialog";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { filterSelectClassName } from "@/components/ui/filter-select";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { paymentMethodSelectOptions, type ProfilePaymentMethodEntry } from "@/lib/payment-method-options";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Download, LayoutGrid, RefreshCw, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";

type SupplierOpt = { id: number; name: string; code: string | null };

type TenantProfile = {
  payment_method_entries?: ProfilePaymentMethodEntry[];
  payment_types?: string[];
};

type RecLine = {
  date: string;
  kind: string;
  type_label: string;
  label: string;
  ref: string;
  payment_method: string | null;
  comment: string | null;
  debit: string;
  credit: string;
  balance: string;
};

type RecPayload = {
  supplier: { id: number; name: string; code: string | null; opening_balance_note: string | null };
  opening_balance: string;
  supplier_opening_balance?: string;
  purchases_total: string;
  payments_total: string;
  closing_balance: string;
  lines: RecLine[];
};

/** v2: «Поставщик» в таблице, новый порядок столбцов по умолчанию */
const REC_TABLE_ID = "suppliers.reconciliation.v2";
const REC_COL_DEFS: ColumnDefItem[] = [
  { id: "supplier_name", label: "Поставщик" },
  { id: "date", label: "Дата" },
  { id: "type_label", label: "Тип" },
  { id: "payment_method", label: "Способ оплаты" },
  { id: "debit", label: "Долг" },
  { id: "credit", label: "Кредит" },
  { id: "balance", label: "Баланс" },
  { id: "memo", label: "Документ / комментарий" }
];
const REC_DEFAULT_ORDER = REC_COL_DEFS.map((c) => c.id);
const REC_NUMERIC_COLS = new Set(["debit", "credit", "balance"]);

function recColLabel(id: string): string {
  return REC_COL_DEFS.find((c) => c.id === id)?.label ?? id;
}

function monthRangeStrings(d: Date): { from: string; to: string } {
  const y = d.getFullYear();
  const m = d.getMonth();
  const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const to = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

function isSummaryRow(kind: string): boolean {
  return kind === "turnover" || kind === "total";
}

function fmtCell(v: string, opts?: { minFractionDigits?: number; maxFractionDigits?: number }): string {
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n === 0) return "—";
  return formatNumberGrouped(v, {
    minFractionDigits: opts?.minFractionDigits ?? 2,
    maxFractionDigits: opts?.maxFractionDigits ?? 2
  });
}

export function SuppliersReconciliationWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const defaultRange = useMemo(() => monthRangeStrings(new Date()), []);

  const [draftSupplier, setDraftSupplier] = useState("");
  const [draftPaymentMethod, setDraftPaymentMethod] = useState("");
  const [draftFrom, setDraftFrom] = useState(defaultRange.from);
  const [draftTo, setDraftTo] = useState(defaultRange.to);
  const [appliedSupplier, setAppliedSupplier] = useState("");
  const [appliedPaymentMethod, setAppliedPaymentMethod] = useState("");
  const [appliedFrom, setAppliedFrom] = useState(defaultRange.from);
  const [appliedTo, setAppliedTo] = useState(defaultRange.to);

  const [dateOpen, setDateOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const dateAnchorRef = useRef<HTMLButtonElement | null>(null);

  const prefs = useUserTablePrefs({
    tenantSlug,
    tableId: REC_TABLE_ID,
    defaultColumnOrder: REC_DEFAULT_ORDER,
    defaultPageSize: 10,
    allowedPageSizes: [10, 20, 50, 100]
  });

  const profileQ = useQuery({
    queryKey: ["settings-profile", tenantSlug, "supplier-reconciliation"],
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
    queryKey: ["suppliers", tenantSlug, "reconciliation-pick"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: SupplierOpt[] }>(`/api/${tenantSlug}/suppliers?status=active`);
      return data.data ?? [];
    }
  });

  const sid = useMemo(() => {
    const n = Number.parseInt(appliedSupplier, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [appliedSupplier]);

  const recQ = useQuery({
    queryKey: ["suppliers-reconciliation", tenantSlug, sid, appliedFrom, appliedTo, appliedPaymentMethod],
    enabled: Boolean(tenantSlug) && hydrated && sid > 0,
    staleTime: STALE.list,
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set("supplier_id", String(sid));
      if (appliedFrom.trim()) p.set("date_from", appliedFrom.trim());
      if (appliedTo.trim()) p.set("date_to", appliedTo.trim());
      if (appliedPaymentMethod.trim()) p.set("payment_method", appliedPaymentMethod.trim());
      const { data } = await api.get<{ data: RecPayload }>(
        `/api/${tenantSlug}/suppliers/accounting/reconciliation?${p.toString()}`
      );
      return data.data;
    }
  });

  const applyFilters = useCallback(() => {
    setAppliedSupplier(draftSupplier);
    setAppliedPaymentMethod(draftPaymentMethod);
    setAppliedFrom(draftFrom);
    setAppliedTo(draftTo);
    setTableSearch("");
  }, [draftSupplier, draftPaymentMethod, draftFrom, draftTo]);

  const resetFilters = useCallback(() => {
    const r = monthRangeStrings(new Date());
    setDraftSupplier("");
    setDraftPaymentMethod("");
    setDraftFrom(r.from);
    setDraftTo(r.to);
    setAppliedSupplier("");
    setAppliedPaymentMethod("");
    setAppliedFrom(r.from);
    setAppliedTo(r.to);
    setTableSearch("");
  }, []);

  const exportXlsx = useCallback(async () => {
    const rec = recQ.data;
    if (!rec || sid <= 0) return;
    setExporting(true);
    try {
      const supplierLabel = rec.supplier.code
        ? `${rec.supplier.name} (${rec.supplier.code})`
        : rec.supplier.name;
      await downloadXlsxSheet(
        `supplier-reconciliation-${sid}-${appliedFrom}-${appliedTo}.xlsx`,
        "Акт сверки",
        ["Поставщик", "Дата", "Тип", "Способ оплаты", "Долг", "Кредит", "Баланс", "Документ", "Комментарий"],
        (rec.lines ?? []).map((row) => [
          supplierLabel,
          row.date ? row.date.slice(0, 19).replace("T", " ") : "—",
          row.type_label,
          row.payment_method ?? "",
          row.debit,
          row.credit,
          row.balance,
          row.label,
          row.comment ?? ""
        ]),
        { colWidths: [26, 20, 28, 14, 14, 14, 14, 28, 28] }
      );
    } finally {
      setExporting(false);
    }
  }, [recQ.data, sid, appliedFrom, appliedTo]);

  const supplierTableLabel = useMemo(() => {
    const r = recQ.data;
    if (!r?.supplier) return "—";
    return r.supplier.code ? `${r.supplier.name} (${r.supplier.code})` : r.supplier.name;
  }, [recQ.data]);

  const filteredLines = useMemo(() => {
    const rows = recQ.data?.lines ?? [];
    const q = tableSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      if (isSummaryRow(row.kind) || row.kind === "period_opening") return true;
      const hay = [
        supplierTableLabel,
        row.type_label,
        row.label,
        row.payment_method ?? "",
        row.comment ?? ""
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [recQ.data?.lines, tableSearch, supplierTableLabel]);

  const recColRender = useMemo(
    () => ({
      supplier_name: (_row: RecLine) => (
        <span className="block max-w-[min(100%,14rem)] truncate sm:max-w-[18rem]" title={supplierTableLabel}>
          {supplierTableLabel}
        </span>
      ),
      date: (row: RecLine) => (row.date ? row.date.slice(0, 19).replace("T", " ") : "—"),
      type_label: (row: RecLine) => row.type_label,
      payment_method: (row: RecLine) => row.payment_method?.trim() || "—",
      debit: (row: RecLine) => fmtCell(row.debit),
      credit: (row: RecLine) => fmtCell(row.credit),
      balance: (row: RecLine) =>
        formatNumberGrouped(row.balance, { minFractionDigits: 2, maxFractionDigits: 2 }),
      memo: (row: RecLine) => (
        <span className="max-w-[240px] truncate">{[row.comment, row.label].filter(Boolean).join(" · ") || "—"}</span>
      )
    }),
    [supplierTableLabel]
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

  const rec = recQ.data;
  const visibleCols = prefs.visibleColumnOrder;

  return (
    <PageShell className="space-y-4">
      <PageHeader
        title="Акт сверки с поставщиком"
        description="Остаток на начало периода, приходы и оплаты; баланс = долг − кредит по строкам. Способ оплаты фильтрует только строки оплат в периоде."
      />

      <div className="orders-hub-section orders-hub-section--filters orders-hub-section--stack-tight">
        <Card className="rounded-none border-0 bg-transparent shadow-none hover:shadow-none">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-4">
              <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <label className="orders-filter-field-label min-w-0 w-full sm:w-[min(100%,17rem)] sm:max-w-[20rem]">
                  Период
                  <button
                    ref={dateAnchorRef}
                    type="button"
                    className={cn(
                      filterSelectClassName,
                      "inline-flex max-w-none min-w-0 items-center justify-between text-left font-medium"
                    )}
                    onClick={() => setDateOpen((v) => !v)}
                  >
                    <span className="min-w-0 flex-1 truncate">{formatDateRangeButton(draftFrom, draftTo)}</span>
                    <CalendarDays className="ml-1 size-3.5 shrink-0 text-muted-foreground" />
                  </button>
                </label>

                <label className="orders-filter-field-label min-w-0 w-full sm:w-[min(100%,17rem)] sm:max-w-[20rem]">
                  Поставщик
                  <select
                    className={cn(filterSelectClassName, "max-w-none")}
                    value={draftSupplier}
                    onChange={(e) => setDraftSupplier(e.target.value)}
                  >
                    <option value="">Не выбран</option>
                    {(suppliersQ.data ?? []).map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.name}
                        {s.code ? ` (${s.code})` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="orders-filter-field-label min-w-0 w-full sm:w-[min(100%,17rem)] sm:max-w-[20rem]">
                  Способ оплаты
                  <select
                    className={cn(filterSelectClassName, "max-w-none")}
                    value={draftPaymentMethod}
                    onChange={(e) => setDraftPaymentMethod(e.target.value)}
                  >
                    <option value="">Все способы</option>
                    {payMethodOpts.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border/50 pt-3 lg:border-t-0 lg:pt-0">
                <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" title="Сброс" onClick={resetFilters}>
                  <RotateCcw className="size-4" />
                </Button>
                <Button type="button" size="sm" className="h-9 min-w-[7rem] bg-teal-600 px-4 hover:bg-teal-700" onClick={applyFilters}>
                  Применить
                </Button>
              </div>
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
          </CardContent>
        </Card>
      </div>

      <TableColumnSettingsDialog
        open={columnDialogOpen}
        onOpenChange={setColumnDialogOpen}
        title="Управление столбцами"
        description="Видимые столбцы и порядок сохраняются для вашей учётной записи. Порядок строк акта фиксирован (сортировка по данным отключена)."
        columns={[...REC_COL_DEFS]}
        columnOrder={prefs.columnOrder}
        hiddenColumnIds={prefs.hiddenColumnIds}
        saving={prefs.saving}
        onSave={(next) => prefs.saveColumnLayout(next)}
        onReset={() => prefs.resetColumnLayout()}
      />

      {rec ? (
        <div className="mt-6 min-w-0 space-y-4 sm:mb-10 sm:space-y-5">
          {rec.supplier.opening_balance_note ? (
            <p className="text-balance break-words text-xs leading-relaxed text-muted-foreground">
              Примечание к нач. балансу (справочник): {rec.supplier.opening_balance_note}
            </p>
          ) : null}

          <div className="grid gap-4 sm:gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,15.5rem),1fr))] sm:[grid-template-columns:repeat(auto-fit,minmax(min(100%,17rem),1fr))]">
            <Card className="min-w-0 overflow-hidden shadow-sm">
              <CardHeader className="gap-2 border-0 px-4 py-4 sm:px-5 sm:py-5">
                <CardDescription className="text-balance text-xs leading-snug text-muted-foreground">
                  Остаток на начало периода
                </CardDescription>
                <CardTitle className="min-w-0 break-words text-balance text-base font-semibold leading-snug tabular-nums tracking-normal sm:text-lg">
                  {formatNumberGrouped(rec.opening_balance, { minFractionDigits: 2, maxFractionDigits: 2 })}
                </CardTitle>
              </CardHeader>
            </Card>

            {rec.supplier_opening_balance != null ? (
              <Card className="min-w-0 overflow-hidden shadow-sm">
                <CardHeader className="gap-2 border-0 px-4 py-4 sm:px-5 sm:py-5">
                  <CardDescription className="text-balance text-xs leading-snug text-muted-foreground">
                    Нач. баланс (карточка)
                  </CardDescription>
                  <CardTitle className="min-w-0 break-words text-balance text-base font-semibold leading-snug tabular-nums tracking-normal text-muted-foreground sm:text-lg">
                    {formatNumberGrouped(rec.supplier_opening_balance, { minFractionDigits: 2, maxFractionDigits: 2 })}
                  </CardTitle>
                </CardHeader>
              </Card>
            ) : null}

            <Card className="min-w-0 overflow-hidden shadow-sm">
              <CardHeader className="gap-2 border-0 px-4 py-4 sm:px-5 sm:py-5">
                <CardDescription className="text-balance text-xs leading-snug text-muted-foreground">
                  Приходы за период
                </CardDescription>
                <CardTitle className="min-w-0 break-words text-balance text-base font-semibold leading-snug tabular-nums tracking-normal sm:text-lg">
                  {formatNumberGrouped(rec.purchases_total, { minFractionDigits: 2, maxFractionDigits: 2 })}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card className="min-w-0 overflow-hidden shadow-sm">
              <CardHeader className="gap-2 border-0 px-4 py-4 sm:px-5 sm:py-5">
                <CardDescription className="text-balance text-xs leading-snug text-muted-foreground">Оплаты за период</CardDescription>
                <CardTitle className="min-w-0 break-words text-balance text-base font-semibold leading-snug tabular-nums tracking-normal sm:text-lg">
                  {formatNumberGrouped(rec.payments_total, { minFractionDigits: 2, maxFractionDigits: 2 })}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card className="min-w-0 overflow-hidden border-2 border-green-600/70 bg-card shadow-md ring-1 ring-green-600/15 dark:border-green-500/75 dark:ring-green-500/20">
              <CardHeader className="gap-2 border-0 px-4 py-4 sm:px-5 sm:py-5">
                <CardDescription className="text-balance text-xs font-medium leading-snug text-muted-foreground">
                  Итог на конец
                </CardDescription>
                <CardTitle className="min-w-0 break-words text-balance text-base font-semibold leading-snug tabular-nums tracking-normal text-green-700 dark:text-green-400 sm:text-lg">
                  {formatNumberGrouped(rec.closing_balance, { minFractionDigits: 2, maxFractionDigits: 2 })}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
        </div>
      ) : null}

      {sid > 0 ? (
        <div className="orders-hub-section orders-hub-section--table mt-2 min-w-0 sm:mt-4">
          <Card className="overflow-hidden rounded-none border-0 bg-transparent shadow-none hover:shadow-none">
            <CardContent className="p-0">
          <div className="table-toolbar flex flex-wrap items-center justify-between gap-2 border-b border-border/80 bg-muted/30 px-3 py-2 sm:px-4">
            <div className="relative min-w-0 max-w-xs flex-1">
              <Input
                className="h-9 text-sm"
                placeholder="Поиск по таблице"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
              />
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                title="Столбцы"
                onClick={() => setColumnDialogOpen(true)}
              >
                <LayoutGrid className="size-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={exporting || !rec}
                className="h-9 gap-1 border-green-600/40 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/30"
                onClick={() => void exportXlsx()}
              >
                <Download className="size-3.5" />
                {exporting ? "…" : "Excel"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                title="Обновить"
                onClick={() => void recQ.refetch()}
              >
                <RefreshCw className={cn("size-4", recQ.isFetching && "animate-spin")} />
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse text-sm sm:min-w-[1040px]">
              {visibleCols.length === 0 ? (
                <tbody>
                  <tr>
                    <td className="px-3 py-8 text-center text-muted-foreground">Нет видимых столбцов.</td>
                  </tr>
                </tbody>
              ) : (
                <>
                  <thead className="app-table-thead text-left">
                    <tr>
                      {visibleCols.map((colId) => (
                        <th
                          key={colId}
                          className={cn(
                            "px-3 py-2.5",
                            REC_NUMERIC_COLS.has(colId) && "text-right",
                            colId === "date" && "whitespace-nowrap",
                            colId === "supplier_name" && "min-w-[10rem] max-w-[14rem] sm:max-w-[18rem]"
                          )}
                        >
                          {recColLabel(colId)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recQ.isLoading ? (
                      <tr>
                        <td colSpan={visibleCols.length} className="px-3 py-8 text-center text-muted-foreground">
                          Загрузка…
                        </td>
                      </tr>
                    ) : !rec || (rec.lines?.length ?? 0) === 0 ? (
                      <tr>
                        <td colSpan={visibleCols.length} className="px-3 py-8 text-center text-muted-foreground">
                          Нет данных
                        </td>
                      </tr>
                    ) : (
                      filteredLines.map((row, idx) => (
                        <tr
                          key={`${row.kind}-${row.ref}-${idx}`}
                          className={cn(
                            "border-t even:bg-muted/20",
                            isSummaryRow(row.kind) && "bg-muted/40 font-semibold",
                            row.kind === "period_opening" && "bg-muted/20"
                          )}
                        >
                          {visibleCols.map((colId) => {
                            const render = recColRender[colId as keyof typeof recColRender];
                            return (
                              <td
                                key={colId}
                                className={cn(
                                  "px-3 py-2",
                                  colId === "date" && "whitespace-nowrap text-muted-foreground",
                                  colId === "supplier_name" && "max-w-[14rem] sm:max-w-[18rem]",
                                  colId === "payment_method" && "text-muted-foreground",
                                  REC_NUMERIC_COLS.has(colId) && "text-right tabular-nums",
                                  colId === "balance" && "font-medium"
                                )}
                              >
                                {render ? render(row) : null}
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
            </CardContent>
          </Card>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Выберите поставщика и нажмите «Применить», чтобы построить акт.</p>
      )}

      {recQ.isError ? (
        <p className="text-sm text-destructive">Не удалось загрузить акт (проверьте доступ и поставщика).</p>
      ) : null}
    </PageShell>
  );
}
