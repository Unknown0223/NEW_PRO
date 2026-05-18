"use client";

import { TableColumnSettingsDialog, type ColumnDefItem } from "@/components/data-table/table-column-settings-dialog";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { TableRowActionGroup } from "@/components/data-table/table-row-actions";
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
import { api } from "@/lib/api";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { isAdminOrOperatorLikeRole } from "@/lib/distribution-roles";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { STALE } from "@/lib/query-stale";
import {
  firstMessagePerField,
  firstValidationUserHint,
  getZodFlattenFromApiErrorBody
} from "@/lib/api-validation-details";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, LayoutGrid, Pencil, RefreshCw, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

export type SupplierRow = {
  id: number;
  name: string;
  code: string | null;
  phone: string | null;
  address: string | null;
  sort_order: number;
  comment: string | null;
  is_active: boolean;
  /** API: Decimal → string */
  opening_balance?: string | number | null;
  opening_balance_note?: string | null;
};

const REG_TABLE_ID = "suppliers.registry.v1";
const REG_COL_DEFS: ColumnDefItem[] = [
  { id: "name", label: "Названия" },
  { id: "phone", label: "Номер телефона" },
  { id: "address", label: "Адрес" },
  { id: "code", label: "Код" },
  { id: "opening_balance", label: "Нач. баланс" },
  { id: "sort_order", label: "Сортировка" },
  { id: "comment", label: "Комментарий" },
  { id: "actions", label: " " }
];
const REG_DEFAULT_ORDER = REG_COL_DEFS.map((c) => c.id);

type SupplierSortKey = "sort_order" | "name" | "code" | "phone" | "opening_balance" | "created_at";

const REG_SORT_BY_COL: Partial<Record<string, SupplierSortKey>> = {
  name: "name",
  phone: "phone",
  code: "code",
  opening_balance: "opening_balance",
  sort_order: "sort_order"
};

const REG_NUMERIC_COLS = new Set(["opening_balance", "sort_order"]);

function regColLabel(id: string): string {
  return REG_COL_DEFS.find((c) => c.id === id)?.label ?? id;
}

function pickZodLeaf(per: Record<string, string>, leaf: string): string | undefined {
  for (const [k, v] of Object.entries(per)) {
    if (k === leaf || k.endsWith(`.${leaf}`)) return v;
  }
  return undefined;
}

export function SuppliersWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const role = useEffectiveRole();
  const qc = useQueryClient();
  const isAdmin = isAdminOrOperatorLikeRole(role);

  const prefs = useUserTablePrefs({
    tenantSlug,
    tableId: REG_TABLE_ID,
    defaultColumnOrder: REG_DEFAULT_ORDER,
    defaultPageSize: 10,
    allowedPageSizes: [10, 20, 30, 50]
  });

  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [sortBy, setSortBy] = useState<SupplierSortKey>("sort_order");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setSearchApplied(searchDraft.trim()), 350);
    return () => window.clearTimeout(t);
  }, [searchDraft]);

  useEffect(() => {
    setPage(1);
  }, [tab, searchApplied, prefs.pageSize, sortBy, sortDir]);

  const listQ = useQuery({
    queryKey: ["suppliers-module", tenantSlug, tab, page, prefs.pageSize, searchApplied, sortBy, sortDir],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.list,
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set("status", tab === "active" ? "active" : "inactive");
      p.set("page", String(page));
      p.set("limit", String(prefs.pageSize));
      p.set("sort_by", sortBy);
      p.set("sort_dir", sortDir);
      if (searchApplied) p.set("search", searchApplied);
      const { data } = await api.get<{ data: SupplierRow[]; total: number }>(
        `/api/${tenantSlug}/suppliers?${p.toString()}`
      );
      return { rows: data.data, total: typeof data.total === "number" ? data.total : data.data.length };
    }
  });

  const total = listQ.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / prefs.pageSize));
  const rows = listQ.data?.rows ?? [];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierRow | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [comment, setComment] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [openingNote, setOpeningNote] = useState("");
  const [active, setActive] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [saveFieldErrs, setSaveFieldErrs] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<SupplierRow | null>(null);
  const [exporting, setExporting] = useState(false);

  const saveMut = useMutation({
    mutationFn: async (body: {
      name: string;
      code?: string | null;
      phone?: string | null;
      address?: string | null;
      sort_order?: number;
      comment?: string | null;
      is_active?: boolean;
      opening_balance?: number | null;
      opening_balance_note?: string | null;
      auto_code?: boolean;
    }) => {
      if (editing) {
        const { data } = await api.patch<{ data: SupplierRow }>(
          `/api/${tenantSlug}/suppliers/${editing.id}`,
          body
        );
        return data.data;
      }
      const { data } = await api.post<{ data: SupplierRow }>(`/api/${tenantSlug}/suppliers`, body);
      return data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["suppliers-module", tenantSlug] });
      await qc.invalidateQueries({ queryKey: ["suppliers", tenantSlug] });
      await qc.invalidateQueries({ queryKey: ["suppliers-balances", tenantSlug] });
      await qc.invalidateQueries({ queryKey: ["suppliers-reconciliation", tenantSlug] });
      setSaveFieldErrs({});
      setMsg("Сохранено.");
      setOpen(false);
      setEditing(null);
    },
    onError: (err: unknown) => {
      const d = (err as { response?: { data?: { error?: string } } })?.response?.data;
      if (d?.error === "DuplicateCode") {
        setSaveFieldErrs({});
        setMsg(withApiSupportLine("Код уже занят.", err));
        return;
      }
      if (d?.error === "BadName") {
        setSaveFieldErrs({});
        setMsg(withApiSupportLine("Укажите название.", err));
        return;
      }
      if (isAxiosError(err)) {
        const flat = getZodFlattenFromApiErrorBody(err.response?.data);
        if (flat) {
          const per = firstMessagePerField(flat);
          setSaveFieldErrs(per);
          const top = flat.formErrors.map((s) => s.trim()).find(Boolean);
          const hint = firstValidationUserHint(flat);
          const line = top ?? hint ?? Object.values(per).find((m) => m.trim() !== "");
          setMsg(line ? withApiSupportLine(line, err) : getUserFacingError(err, "Ошибка сохранения."));
          return;
        }
      }
      setSaveFieldErrs({});
      setMsg(getUserFacingError(err, "Ошибка сохранения."));
    }
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/${tenantSlug}/suppliers/${id}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["suppliers-module", tenantSlug] });
      await qc.invalidateQueries({ queryKey: ["suppliers", tenantSlug] });
      await qc.invalidateQueries({ queryKey: ["suppliers-balances", tenantSlug] });
      setMsg("Удалено.");
      setConfirmDelete(null);
    },
    onError: (err: unknown) => {
      const d = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
      if (d?.error === "HasReceipts") {
        setMsg(withApiSupportLine(d.message ?? "Есть приходы — удаление невозможно.", err));
      } else if (d?.error === "HasPayments") {
        setMsg(withApiSupportLine(d.message ?? "Есть оплаты — удаление невозможно.", err));
      } else {
        setMsg(getUserFacingError(err, "Ошибка удаления."));
      }
    }
  });

  const openAdd = useCallback(() => {
    setMsg(null);
    setSaveFieldErrs({});
    setEditing(null);
    setName("");
    setCode("");
    setPhone("");
    setAddress("");
    setSortOrder("0");
    setComment("");
    setOpeningBalance("0");
    setOpeningNote("");
    setActive(true);
    setOpen(true);
  }, []);

  const openEdit = useCallback((row: SupplierRow) => {
    setMsg(null);
    setSaveFieldErrs({});
    setEditing(row);
    setName(row.name);
    setCode(row.code ?? "");
    setPhone(row.phone ?? "");
    setAddress(row.address ?? "");
    setSortOrder(String(row.sort_order ?? 0));
    setComment(row.comment ?? "");
    const ob = row.opening_balance;
    setOpeningBalance(
      ob == null || ob === "" ? "0" : typeof ob === "number" ? String(ob) : String(ob).replace(",", ".")
    );
    setOpeningNote(row.opening_balance_note ?? "");
    setActive(row.is_active !== false);
    setOpen(true);
  }, []);

  const submitForm = useCallback(() => {
    const n = name.trim();
    if (!n) return;
    const so = Number.parseInt(sortOrder, 10);
    const obParsed = Number.parseFloat(openingBalance.replace(",", "."));
    const opening_balance = Number.isFinite(obParsed) ? obParsed : 0;
    setSaveFieldErrs({});
    saveMut.mutate({
      name: n,
      code: code.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      sort_order: Number.isFinite(so) ? so : 0,
      comment: comment.trim() || null,
      is_active: active,
      opening_balance,
      opening_balance_note: openingNote.trim() || null,
      ...(editing ? {} : { auto_code: !code.trim() })
    });
  }, [name, code, phone, address, sortOrder, comment, openingBalance, openingNote, active, editing, saveMut]);

  const exportXlsx = useCallback(async () => {
    setExporting(true);
    try {
      const p = new URLSearchParams();
      p.set("status", tab === "active" ? "active" : "inactive");
      p.set("page", "1");
      p.set("limit", "5000");
      p.set("sort_by", sortBy);
      p.set("sort_dir", sortDir);
      if (searchApplied) p.set("search", searchApplied);
      const { data } = await api.get<{ data: SupplierRow[] }>(`/api/${tenantSlug}/suppliers?${p.toString()}`);
      const list = data.data ?? [];
      await downloadXlsxSheet(
        `suppliers-${tab}-${new Date().toISOString().slice(0, 10)}.xlsx`,
        "Поставщики",
        ["Название", "Телефон", "Адрес", "Код", "Нач. баланс", "Сортировка", "Комментарий", "Активен"],
        list.map((r) => [
          r.name,
          r.phone ?? "",
          r.address ?? "",
          r.code ?? "",
          formatNumberGrouped(r.opening_balance ?? 0, { minFractionDigits: 2, maxFractionDigits: 2 }),
          r.sort_order,
          r.comment ?? "",
          r.is_active ? "да" : "нет"
        ]),
        { colWidths: [28, 16, 32, 12, 14, 10, 36, 8] }
      );
    } finally {
      setExporting(false);
    }
  }, [tenantSlug, tab, searchApplied, sortBy, sortDir]);

  const tabBtn = (key: "active" | "inactive", label: string) => (
    <button
      key={key}
      type="button"
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        tab === key
          ? "bg-teal-600 text-white shadow-sm dark:bg-teal-600"
          : "bg-muted text-muted-foreground hover:bg-muted/80"
      )}
      onClick={() => setTab(key)}
    >
      {label}
    </button>
  );

  const fromRow = (start: number) => (total === 0 ? 0 : start);
  const toRow = useMemo(() => {
    if (total === 0) return 0;
    return Math.min(total, (page - 1) * prefs.pageSize + rows.length);
  }, [total, page, prefs.pageSize, rows.length]);

  const supColRender = useMemo(
    () => ({
      name: (r: SupplierRow) => <span className="font-medium">{r.name}</span>,
      phone: (r: SupplierRow) => <span className="text-muted-foreground">{r.phone ?? "—"}</span>,
      address: (r: SupplierRow) => (
        <span className="max-w-[200px] truncate text-muted-foreground">{r.address ?? "—"}</span>
      ),
      code: (r: SupplierRow) => <span className="font-mono text-xs">{r.code ?? "—"}</span>,
      opening_balance: (r: SupplierRow) => (
        <span className="text-muted-foreground">
          {formatNumberGrouped(r.opening_balance ?? 0, { minFractionDigits: 2, maxFractionDigits: 2 })}
        </span>
      ),
      sort_order: (r: SupplierRow) => <span className="tabular-nums">{r.sort_order}</span>,
      comment: (r: SupplierRow) => <span className="max-w-[220px] truncate text-muted-foreground">{r.comment ?? "—"}</span>,
      actions: (r: SupplierRow) =>
        isAdmin ? (
          <TableRowActionGroup className="justify-end" ariaLabel="Поставщик">
            <Button variant="outline" size="icon-sm" type="button" title="Удалить" aria-label="Удалить" onClick={() => setConfirmDelete(r)}>
              <Trash2 className="size-3.5" />
            </Button>
            <Button variant="outline" size="icon-sm" type="button" title="Редактировать" aria-label="Редактировать" onClick={() => openEdit(r)}>
              <Pencil className="size-3.5" />
            </Button>
          </TableRowActionGroup>
        ) : null
    }),
    [isAdmin, openEdit]
  );

  function toggleRegSort(colId: string) {
    const mapped = REG_SORT_BY_COL[colId];
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
        <p className="text-sm text-muted-foreground">Загрузка сессии…</p>
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
        title="Поставщики"
        description="Реестр поставщиков: контакты, код, сортировка; неактивные нельзя выбрать в новом приходе."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/stock/receipts"
              className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted"
            >
              Поступления
            </Link>
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700" disabled={!isAdmin} onClick={openAdd}>
              Добавить
            </Button>
          </div>
        }
      />

      <div className="orders-hub-section orders-hub-section--filters orders-hub-section--stack-tight">
        <Card className="rounded-none border-0 bg-transparent shadow-none hover:shadow-none">
          <CardContent className="p-4 sm:p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-foreground/80">Статус</p>
            <div className="flex flex-wrap gap-2">
              {tabBtn("active", "Активный")}
              {tabBtn("inactive", "Не активный")}
            </div>
          </CardContent>
        </Card>
      </div>

      <TableColumnSettingsDialog
        open={columnDialogOpen}
        onOpenChange={setColumnDialogOpen}
        title="Управление столбцами"
        description="Видимые столбцы и порядок сохраняются для вашей учётной записи."
        columns={[...REG_COL_DEFS]}
        columnOrder={prefs.columnOrder}
        hiddenColumnIds={prefs.hiddenColumnIds}
        saving={prefs.saving}
        onSave={(next) => prefs.saveColumnLayout(next)}
        onReset={() => prefs.resetColumnLayout()}
      />

      <div className="orders-hub-section orders-hub-section--table mt-4">
        <Card className="overflow-hidden rounded-none border-0 bg-transparent shadow-none hover:shadow-none">
          <CardContent className="p-0">
        <div className="table-toolbar flex flex-col gap-2 border-b border-border/80 bg-muted/30 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
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
              {[10, 20, 30, 50].map((n) => (
                <option key={n} value={String(n)}>
                  {n}
                </option>
              ))}
            </select>
            <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" title="Столбцы" onClick={() => setColumnDialogOpen(true)}>
              <LayoutGrid className="size-4" />
            </Button>
            <div className="relative min-w-0 flex-1 sm:min-w-[12rem] sm:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 pl-9"
                placeholder="Поиск"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
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
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              title="Обновить"
              onClick={() => void listQ.refetch()}
            >
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
                      const mapped = REG_SORT_BY_COL[colId];
                      const active = mapped != null && sortBy === mapped;
                      return (
                        <th
                          key={colId}
                          className={cn(
                            "px-3 py-2.5",
                            REG_NUMERIC_COLS.has(colId) && colId === "opening_balance" && "text-right w-28",
                            colId === "sort_order" && "w-24",
                            colId === "actions" && "text-right w-24"
                          )}
                        >
                          {mapped ? (
                            <button
                              type="button"
                              onClick={() => toggleRegSort(colId)}
                              className={cn(
                                "inline-flex items-center gap-1 hover:text-foreground",
                                colId === "opening_balance" && "ml-auto"
                              )}
                              title="Сортировка"
                            >
                              <span>{regColLabel(colId)}</span>
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
                            regColLabel(colId)
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
                      <tr key={r.id} className="border-t even:bg-muted/20">
                        {visibleCols.map((colId) => {
                          const render = supColRender[colId as keyof typeof supColRender];
                          return (
                            <td
                              key={colId}
                              className={cn(
                                "px-3 py-2",
                                colId === "opening_balance" && "text-right tabular-nums",
                                colId === "sort_order" && "tabular-nums",
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

        <div className="flex flex-col gap-2 border-t border-border/80 bg-muted/25 px-3 py-2.5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <span className="text-foreground/80">
            Показано {fromRow((page - 1) * prefs.pageSize + 1)} — {toRow} / {total}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ←
            </Button>
            <span className="px-2 tabular-nums text-foreground">
              {page} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              →
            </Button>
          </div>
        </div>
          </CardContent>
        </Card>
      </div>

      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px]" showCloseButton>
          <DialogHeader>
            <DialogTitle>{editing ? "Редактировать" : "Добавить"}</DialogTitle>
            <DialogDescription>
              Название обязательно. Код пустой — будет сгенерирован (SUP-001). Неактивный поставщик недоступен в
              новом приходе.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Названия</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
              {pickZodLeaf(saveFieldErrs, "name") ? (
                <p className="text-xs text-destructive">{pickZodLeaf(saveFieldErrs, "name")}</p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label>Код</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 64))}
                placeholder="Авто, если пусто"
              />
              {pickZodLeaf(saveFieldErrs, "code") ? (
                <p className="text-xs text-destructive">{pickZodLeaf(saveFieldErrs, "code")}</p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label>Номер телефона</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998…" />
              {pickZodLeaf(saveFieldErrs, "phone") ? (
                <p className="text-xs text-destructive">{pickZodLeaf(saveFieldErrs, "phone")}</p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label>Адрес</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
              {pickZodLeaf(saveFieldErrs, "address") ? (
                <p className="text-xs text-destructive">{pickZodLeaf(saveFieldErrs, "address")}</p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label>Сортировка</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value.replace(/[^\d-]/g, ""))}
              />
              {pickZodLeaf(saveFieldErrs, "sort_order") ? (
                <p className="text-xs text-destructive">{pickZodLeaf(saveFieldErrs, "sort_order")}</p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label>Начальный баланс (долг + / предоплата −)</Label>
              <Input value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} placeholder="0" />
              {pickZodLeaf(saveFieldErrs, "opening_balance") ? (
                <p className="text-xs text-destructive">{pickZodLeaf(saveFieldErrs, "opening_balance")}</p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label>Примечание к начальному балансу</Label>
              <Input value={openingNote} onChange={(e) => setOpeningNote(e.target.value)} />
              {pickZodLeaf(saveFieldErrs, "opening_balance_note") ? (
                <p className="text-xs text-destructive">{pickZodLeaf(saveFieldErrs, "opening_balance_note")}</p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label>Комментарий</Label>
              <textarea
                className="min-h-[72px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              {pickZodLeaf(saveFieldErrs, "comment") ? (
                <p className="text-xs text-destructive">{pickZodLeaf(saveFieldErrs, "comment")}</p>
              ) : null}
            </div>
            <label className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-sm">
              <span>Активный</span>
              <input type="checkbox" className="size-4 accent-teal-600" checked={active} onChange={(e) => setActive(e.target.checked)} />
            </label>
            <Button onClick={submitForm} disabled={saveMut.isPending || !isAdmin}>
              {editing ? "Сохранить" : "Добавить"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete != null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-[400px]" showCloseButton>
          <DialogHeader>
            <DialogTitle>Удалить</DialogTitle>
            <DialogDescription>
              {confirmDelete
                ? `Удалить «${confirmDelete.name}»? При наличии приходов или оплат удаление будет отклонено.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMut.isPending}
              onClick={() => confirmDelete && deleteMut.mutate(confirmDelete.id)}
            >
              Удалить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
