"use client";

import { TableColumnSettingsDialog, type ColumnDefItem } from "@/components/data-table/table-column-settings-dialog";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { api } from "@/lib/api";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { isAdminOrOperatorLikeRole } from "@/lib/distribution-roles";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { STALE } from "@/lib/query-stale";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, LayoutGrid, Pencil, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type BalanceRow = {
  id: number;
  name: string;
  code: string | null;
  opening_balance: string;
  purchases_total: string;
  payments_total: string;
  balance: string;
  opening_balance_note: string | null;
};

const BAL_TABLE_ID = "suppliers.balances.v1";
const BAL_COL_DEFS: ColumnDefItem[] = [
  { id: "name", label: "Поставщик" },
  { id: "code", label: "Код" },
  { id: "opening", label: "Начальный" },
  { id: "purchases", label: "Закупки" },
  { id: "payments", label: "Оплаты" },
  { id: "balance", label: "Баланс" },
  { id: "actions", label: " " }
];
const BAL_DEFAULT_ORDER = BAL_COL_DEFS.map((c) => c.id);

type BalanceSortKey = "name" | "code" | "opening_balance" | "purchases_total" | "payments_total" | "balance";

const BAL_SORT_BY_COL: Partial<Record<string, BalanceSortKey>> = {
  name: "name",
  code: "code",
  opening: "opening_balance",
  purchases: "purchases_total",
  payments: "payments_total",
  balance: "balance"
};

const BAL_NUMERIC_COLS = new Set(["opening", "purchases", "payments", "balance"]);

function balColLabel(id: string): string {
  return BAL_COL_DEFS.find((c) => c.id === id)?.label ?? id;
}

function parseBalAmount(v: string): number {
  return Number(String(v).replace(/\s/g, "").replace(",", ".")) || 0;
}

export function SuppliersBalancesWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const role = useEffectiveRole();
  const qc = useQueryClient();
  const isAdmin = isAdminOrOperatorLikeRole(role);

  const prefs = useUserTablePrefs({
    tenantSlug,
    tableId: BAL_TABLE_ID,
    defaultColumnOrder: BAL_DEFAULT_ORDER,
    defaultPageSize: 20,
    allowedPageSizes: [10, 20, 50, 100]
  });

  const [searchDraft, setSearchDraft] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<BalanceSortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setSearchApplied(searchDraft.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchDraft]);

  useEffect(() => {
    setPage(1);
  }, [searchApplied, sortBy, sortDir, prefs.pageSize]);

  const listQ = useQuery({
    queryKey: ["suppliers-balances", tenantSlug, searchApplied],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.list,
    queryFn: async () => {
      const p = new URLSearchParams();
      if (searchApplied) p.set("search", searchApplied);
      const { data } = await api.get<{ data: BalanceRow[] }>(
        `/api/${tenantSlug}/suppliers/accounting/balances?${p.toString()}`
      );
      return data.data ?? [];
    }
  });

  const sortedRows = useMemo(() => {
    const raw = listQ.data ?? [];
    const dir = sortDir === "asc" ? 1 : -1;
    const copy = [...raw];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "name":
          cmp = a.name.localeCompare(b.name, "ru");
          break;
        case "code":
          cmp = (a.code ?? "").localeCompare(b.code ?? "", "ru");
          break;
        case "opening_balance":
          cmp = parseBalAmount(a.opening_balance) - parseBalAmount(b.opening_balance);
          break;
        case "purchases_total":
          cmp = parseBalAmount(a.purchases_total) - parseBalAmount(b.purchases_total);
          break;
        case "payments_total":
          cmp = parseBalAmount(a.payments_total) - parseBalAmount(b.payments_total);
          break;
        case "balance":
          cmp = parseBalAmount(a.balance) - parseBalAmount(b.balance);
          break;
        default:
          cmp = 0;
      }
      if (cmp !== 0) return cmp * dir;
      return a.id - b.id;
    });
    return copy;
  }, [listQ.data, sortBy, sortDir]);

  const total = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(total / prefs.pageSize));
  const pagedRows = useMemo(() => {
    const start = (page - 1) * prefs.pageSize;
    return sortedRows.slice(start, start + prefs.pageSize);
  }, [sortedRows, page, prefs.pageSize]);

  const fromIdx = total === 0 ? 0 : (page - 1) * prefs.pageSize + 1;
  const toIdx = Math.min(page * prefs.pageSize, total);

  const [editRow, setEditRow] = useState<BalanceRow | null>(null);
  const [opening, setOpening] = useState("");
  const [openingNote, setOpeningNote] = useState("");

  const patchMut = useMutation({
    mutationFn: async (body: { opening_balance: number; opening_balance_note: string | null }) => {
      const { data } = await api.patch(`/api/${tenantSlug}/suppliers/${editRow!.id}`, body);
      return data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["suppliers-balances", tenantSlug] });
      await qc.invalidateQueries({ queryKey: ["suppliers-module", tenantSlug] });
      await qc.invalidateQueries({ queryKey: ["suppliers-reconciliation", tenantSlug] });
      setEditRow(null);
    }
  });

  const openEdit = useCallback((r: BalanceRow) => {
    setEditRow(r);
    setOpening(r.opening_balance.replace(",", "."));
    setOpeningNote(r.opening_balance_note ?? "");
  }, []);

  const exportXlsx = useCallback(async () => {
    setExporting(true);
    try {
      const p = new URLSearchParams();
      if (searchApplied) p.set("search", searchApplied);
      const { data } = await api.get<{ data: BalanceRow[] }>(
        `/api/${tenantSlug}/suppliers/accounting/balances?${p.toString()}`
      );
      const rows = data.data ?? [];
      await downloadXlsxSheet(
        `supplier-balances-${new Date().toISOString().slice(0, 10)}.xlsx`,
        "Балансы",
        ["Поставщик", "Код", "Начальный", "Закупки", "Оплаты", "Баланс", "Примечание"],
        rows.map((r) => [
          r.name,
          r.code ?? "",
          r.opening_balance,
          r.purchases_total,
          r.payments_total,
          r.balance,
          r.opening_balance_note ?? ""
        ])
      );
    } finally {
      setExporting(false);
    }
  }, [tenantSlug, searchApplied]);

  const payColRender = useMemo(
    () => ({
      name: (r: BalanceRow) => <span className="font-medium">{r.name}</span>,
      code: (r: BalanceRow) => <span className="font-mono text-xs">{r.code ?? "—"}</span>,
      opening: (r: BalanceRow) => formatNumberGrouped(r.opening_balance),
      purchases: (r: BalanceRow) => formatNumberGrouped(r.purchases_total),
      payments: (r: BalanceRow) => formatNumberGrouped(r.payments_total),
      balance: (r: BalanceRow) => formatNumberGrouped(r.balance),
      actions: (r: BalanceRow) =>
        isAdmin ? (
          <Button type="button" variant="outline" size="icon-sm" title="Начальный баланс" onClick={() => openEdit(r)}>
            <Pencil className="size-3.5" />
          </Button>
        ) : null
    }),
    [isAdmin, openEdit]
  );

  function toggleBalSort(colId: string) {
    const mapped = BAL_SORT_BY_COL[colId];
    if (!mapped) return;
    setPage(1);
    if (sortBy === mapped) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(mapped);
    setSortDir("asc");
  }

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

  const visibleCols = prefs.visibleColumnOrder;

  return (
    <PageShell className="space-y-4">
      <PageHeader
        title="Балансы с поставщиками"
        description="Начальный остаток + сумма приходов (posted) − оплаты. Положительный баланс — долг перед поставщиком."
      />

      <div className="orders-hub-section orders-hub-section--filters orders-hub-section--stack-tight">
        <Card className="rounded-none border-0 bg-transparent shadow-none hover:shadow-none">
          <CardContent className="space-y-3 p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground/80">Поиск</p>
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 pl-9"
                placeholder="По названию или коду"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <TableColumnSettingsDialog
        open={columnDialogOpen}
        onOpenChange={setColumnDialogOpen}
        title="Управление столбцами"
        description="Видимые столбцы и порядок сохраняются для вашей учётной записи."
        columns={[...BAL_COL_DEFS]}
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
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
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
            <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" title="Столбцы" onClick={() => setColumnDialogOpen(true)}>
              <LayoutGrid className="size-4" />
            </Button>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={exporting}
              className="h-9 gap-1 border-green-600/40 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/30"
              onClick={() => void exportXlsx()}
            >
              <Download className="size-3.5" />
              {exporting ? "…" : "Excel"}
            </Button>
            <Button type="button" variant="outline" size="icon" className="h-9 w-9" title="Обновить" onClick={() => void listQ.refetch()}>
              <RefreshCw className={cn("size-4", listQ.isFetching && "animate-spin")} />
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse text-sm">
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
                      const mapped = BAL_SORT_BY_COL[colId];
                      const active = mapped != null && sortBy === mapped;
                      return (
                        <th
                          key={colId}
                          className={cn("px-3 py-2.5", BAL_NUMERIC_COLS.has(colId) && "text-right", colId === "actions" && "w-24")}
                        >
                          {mapped ? (
                            <button
                              type="button"
                              onClick={() => toggleBalSort(colId)}
                              className={cn(
                                "inline-flex items-center gap-1 hover:text-foreground",
                                BAL_NUMERIC_COLS.has(colId) && "ml-auto"
                              )}
                              title="Сортировка"
                            >
                              <span>{balColLabel(colId)}</span>
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
                            balColLabel(colId)
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
                  ) : pagedRows.length === 0 ? (
                    <tr>
                      <td colSpan={visibleCols.length} className="px-3 py-10 text-center text-muted-foreground">
                        Нет данных
                      </td>
                    </tr>
                  ) : (
                    pagedRows.map((r) => (
                      <tr key={r.id} className="border-t even:bg-muted/20">
                        {visibleCols.map((colId) => {
                          const render = payColRender[colId as keyof typeof payColRender];
                          return (
                            <td
                              key={colId}
                              className={cn(
                                "px-3 py-2",
                                BAL_NUMERIC_COLS.has(colId) && "text-right tabular-nums",
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

      <Dialog open={editRow != null} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Начальный баланс</DialogTitle>
            <DialogDescription>{editRow?.name}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Сумма (+ долг перед поставщиком)</Label>
              <Input value={opening} onChange={(e) => setOpening(e.target.value.replace(/[^\d.,-]/g, ""))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Примечание</Label>
              <Input value={openingNote} onChange={(e) => setOpeningNote(e.target.value)} />
            </div>
            <Button
              disabled={patchMut.isPending || !isAdmin}
              onClick={() => {
                const n = Number.parseFloat(opening.replace(",", "."));
                if (!Number.isFinite(n)) return;
                patchMut.mutate({ opening_balance: n, opening_balance_note: openingNote.trim() || null });
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
