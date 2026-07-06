"use client";

import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { TableColumnSettingsDialog } from "@/components/data-table/table-column-settings-dialog";
import { TableRowActionGroup } from "@/components/data-table/table-row-actions";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { TableSearchField } from "@/components/ui/table-search-field";
import { DEFAULT_TABLE_PAGE_SIZES } from "@/lib/table-page-sizes";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import { cn } from "@/lib/utils";
import type { AxiosError } from "axios";
import { ArrowDown, ArrowUp, ArrowUpDown, Info, Pencil, RefreshCw, Trash2 } from "lucide-react";

const TABLE_ID = "warehouse-blocks.v1";

const COLUMN_IDS = ["name", "warehouse", "expeditors", "gruzchik", "code", "sort_order", "comment"] as const;

const COLUMN_META = COLUMN_IDS.map((id) => ({
  id,
  label:
    {
      name: "Названия",
      warehouse: "Склад",
      expeditors: "Доставщик",
      gruzchik: "Грузчик",
      code: "Код",
      sort_order: "Сортировка",
      comment: "Комментарий"
    }[id] ?? id
}));

type BlockRow = {
  id: number;
  name: string;
  warehouse_id: number;
  warehouse_name: string;
  code: string | null;
  sort_order: number;
  is_active: boolean;
  comment: string | null;
  empty_stock_confirmed_at: string | null;
  gruzchik_user_id: number | null;
  gruzchik_user_name: string | null;
  expeditors: { id: number; name: string }[];
};

type FormOptions = {
  warehouses: { id: number; name: string }[];
  expeditorCandidates: { id: number; name: string; login: string }[];
  gruzchikCandidates: { id: number; name: string; login: string }[];
};

type BlockSort = "sort_asc" | "sort_desc" | "name_asc" | "name_desc";

function blockMutationError(err: unknown): string {
  const ax = err as AxiosError<{ error?: string }>;
  const status = ax.response?.status;
  const code = ax.response?.data?.error;
  if (status === 401) return withApiSupportLine("Сессия истекла — войдите снова.", err);
  if (status === 403 || code === "ForbiddenRole" || code === "CrossTenantDenied") {
    return withApiSupportLine("Нет доступа.", err);
  }
  if (code === "BadWarehouse") return withApiSupportLine("Выберите действующий склад.", err);
  if (code === "BadExpeditorUser") {
    return withApiSupportLine("Выберите действующего доставщика (роль «Экспедитор» в справочнике).", err);
  }
  if (code === "TooManyExpeditors") {
    return withApiSupportLine("В одном блоке может быть только один доставщик.", err);
  }
  if (code === "BadGruzchikUser") {
    return withApiSupportLine("Выберите действующего грузчика (роль «gruzchik»).", err);
  }
  if (code === "EmptyName") return withApiSupportLine("Укажите название блока.", err);
  if (status === 404) return withApiSupportLine("Блок не найден.", err);
  if (status === 400) return withApiSupportLine("Проверьте данные.", err);
  return getUserFacingError(err, "Ошибка запроса.");
}

type BlockFormState = {
  name: string;
  warehouse_id: string;
  expeditor_user_id: string;
  gruzchik_user_id: string;
  code: string;
  sort_order: string;
  comment: string;
  is_active: boolean;
};

function emptyForm(): BlockFormState {
  return {
    name: "",
    warehouse_id: "",
    expeditor_user_id: "",
    gruzchik_user_id: "",
    code: "",
    sort_order: "",
    comment: "",
    is_active: true
  };
}

function rowToForm(r: BlockRow): BlockFormState {
  const firstExp = r.expeditors[0];
  return {
    name: r.name,
    warehouse_id: String(r.warehouse_id),
    expeditor_user_id: firstExp ? String(firstExp.id) : "",
    gruzchik_user_id: r.gruzchik_user_id != null ? String(r.gruzchik_user_id) : "",
    code: r.code ?? "",
    sort_order: String(r.sort_order ?? ""),
    comment: r.comment ?? "",
    is_active: r.is_active
  };
}

function BlockFormDialog({
  open,
  onOpenChange,
  initial,
  canWrite,
  tenantSlug,
  formOptions,
  optionsLoading,
  onSaved
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: BlockRow | null;
  canWrite: boolean;
  tenantSlug: string;
  formOptions: FormOptions | undefined;
  optionsLoading: boolean;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<BlockFormState>(() => emptyForm());
  const qc = useQueryClient();

  useEffect(() => {
    if (!open) return;
    setForm(initial ? rowToForm(initial) : emptyForm());
  }, [open, initial]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const wid = Number.parseInt(form.warehouse_id, 10);
      if (!Number.isFinite(wid) || wid <= 0) throw new Error("warehouse");
      const sortRaw = form.sort_order.trim();
      const sort_order = sortRaw === "" ? 0 : Number.parseInt(sortRaw, 10);
      const expId = Number.parseInt(form.expeditor_user_id, 10);
      const expeditor_user_ids =
        form.expeditor_user_id.trim() !== "" && Number.isFinite(expId) && expId > 0 ? [expId] : [];
      const gruzchikId = Number.parseInt(form.gruzchik_user_id, 10);
      const body = {
        warehouse_id: wid,
        name: form.name.trim(),
        code: form.code.trim() || null,
        sort_order: Number.isFinite(sort_order) ? sort_order : 0,
        is_active: form.is_active,
        comment: form.comment.trim() || null,
        expeditor_user_ids,
        gruzchik_user_id:
          form.gruzchik_user_id.trim() !== "" && Number.isFinite(gruzchikId) && gruzchikId > 0
            ? gruzchikId
            : null
      };
      if (initial) {
        await api.patch(`/api/${tenantSlug}/warehouse-blocks/${initial.id}`, body);
      } else {
        await api.post(`/api/${tenantSlug}/warehouse-blocks`, body);
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["warehouse-blocks", tenantSlug] });
      onOpenChange(false);
      onSaved();
    }
  });

  if (!canWrite) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {initial ? "Редактировать" : "Добавить"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          <div className="grid gap-2">
            <Label className="text-sm font-medium">Название</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={cn(!form.name.trim() && "border-destructive/50")}
            />
          </div>
          <div className="grid gap-2">
            <Label className="text-sm font-medium">Склад</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              value={form.warehouse_id}
              onChange={(e) => setForm((f) => ({ ...f, warehouse_id: e.target.value }))}
            >
              <option value="">—</option>
              {(formOptions?.warehouses ?? []).map((w) => (
                <option key={w.id} value={String(w.id)}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label className="text-sm font-medium">Доставщик (экспедитор)</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              value={form.expeditor_user_id}
              disabled={optionsLoading}
              onChange={(e) => setForm((f) => ({ ...f, expeditor_user_id: e.target.value }))}
            >
              <option value="">— не назначен —</option>
              {(formOptions?.expeditorCandidates ?? []).map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.name}
                  {u.login ? ` (${u.login})` : ""}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Один блок — один доставщик; сюда складывают только его заказы до отгрузки.
            </p>
          </div>
          <div className="grid gap-2">
            <Label className="text-sm font-medium">Грузчик (сборка блока)</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              value={form.gruzchik_user_id}
              disabled={optionsLoading}
              onChange={(e) => setForm((f) => ({ ...f, gruzchik_user_id: e.target.value }))}
            >
              <option value="">— не назначен —</option>
              {(formOptions?.gruzchikCandidates ?? []).map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.name}
                  {u.login ? ` (${u.login})` : ""}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Складчик привязывает грузчика к блоку; задания по сборке маршрутизируются ему автоматически.
            </p>
          </div>
          <div className="grid gap-2">
            <Label className="text-sm font-medium">Код</Label>
            <Input
              value={form.code}
              maxLength={20}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              {form.code.length} / 20
            </p>
          </div>
          <div className="grid gap-2">
            <Label className="text-sm font-medium">Сортировка</Label>
            <Input
              value={form.sort_order}
              inputMode="numeric"
              onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <Label className="text-sm font-medium">Комментарий</Label>
            <textarea
              className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
              value={form.comment}
              onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="size-4 cursor-pointer accent-teal-600"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
            <span className="font-medium">Активный</span>
          </label>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            type="button"
            className="bg-teal-600 text-white hover:bg-teal-700"
            disabled={saveMut.isPending || !form.name.trim() || !form.warehouse_id}
            onClick={() => saveMut.mutate()}
          >
            {initial ? "Сохранить" : "Добавить"}
          </Button>
        </DialogFooter>
        {saveMut.isError ? (
          <p className="text-sm text-destructive">{blockMutationError(saveMut.error)}</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

type Props = { tenantSlug: string; canWrite: boolean };

export function WarehouseBlocksWorkspace({ tenantSlug, canWrite }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [columnOpen, setColumnOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BlockRow | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BlockRow | null>(null);
  const [draftWarehouseId, setDraftWarehouseId] = useState<string>("");
  const [appliedWarehouseId, setAppliedWarehouseId] = useState<string>("");
  const [sort, setSort] = useState<BlockSort>("sort_asc");

  const tablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: TABLE_ID,
    defaultColumnOrder: [...COLUMN_IDS],
    defaultPageSize: 10,
    allowedPageSizes: DEFAULT_TABLE_PAGE_SIZES
  });
  const limit = tablePrefs.pageSize;

  useEffect(() => {
    setPage(1);
  }, [tab, search, limit, appliedWarehouseId, sort]);

  const listQ = useQuery({
    queryKey: [
      "warehouse-blocks",
      tenantSlug,
      tab,
      page,
      limit,
      search,
      appliedWarehouseId,
      sort
    ],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("is_active", tab === "active" ? "true" : "false");
      params.set("page", String(page));
      params.set("limit", String(limit));
      params.set("sort", sort);
      if (search) params.set("q", search);
      if (appliedWarehouseId) params.set("warehouse_id", appliedWarehouseId);
      const { data } = await api.get<{
        data: BlockRow[];
        total: number;
        page: number;
        limit: number;
      }>(`/api/${tenantSlug}/warehouse-blocks?${params.toString()}`);
      return data;
    }
  });

  const optionsQ = useQuery({
    queryKey: ["warehouse-blocks-form-options", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<FormOptions>(`/api/${tenantSlug}/warehouse-blocks/form-options`);
      return data;
    }
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/${tenantSlug}/warehouse-blocks/${id}`);
    },
    onSuccess: async () => {
      setDeleteTarget(null);
      setFeedback(null);
      await qc.invalidateQueries({ queryKey: ["warehouse-blocks", tenantSlug] });
    },
    onError: (err) => {
      setDeleteTarget(null);
      setFeedback(blockMutationError(err));
    }
  });

  const confirmEmptyMut = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/api/${tenantSlug}/warehouse-blocks/${id}/confirm-empty`);
    },
    onSuccess: async () => {
      setFeedback(null);
      await qc.invalidateQueries({ queryKey: ["warehouse-blocks", tenantSlug] });
    },
    onError: (err) => setFeedback(blockMutationError(err))
  });

  const rows = listQ.data?.data ?? [];
  const total = listQ.data?.total ?? 0;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const exportExcel = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("is_active", tab === "active" ? "true" : "false");
      params.set("sort", sort);
      if (search) params.set("q", search);
      if (appliedWarehouseId) params.set("warehouse_id", appliedWarehouseId);
      const res = await api.get<Blob>(`/api/${tenantSlug}/warehouse-blocks/export?${params.toString()}`, {
        responseType: "blob"
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `warehouse-blocks-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setFeedback(blockMutationError(e));
    }
  }, [tenantSlug, tab, sort, search, appliedWarehouseId]);

  const toggleNameSort = () => {
    setSort((s) => (s === "name_asc" ? "name_desc" : "name_asc"));
  };

  return (
    <PageShell>
      <PageHeader
        title="Блок склада"
        actions={
          canWrite ? (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => setColumnOpen(true)}>
                Столбцы
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-teal-600 text-white hover:bg-teal-700"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                Добавить блок
              </Button>
            </>
          ) : null
        }
      />

      <TableColumnSettingsDialog
        open={columnOpen}
        onOpenChange={setColumnOpen}
        title="Управление столбцами"
        description="Видимые столбцы и порядок сохраняются для вашей учётной записи."
        columns={COLUMN_META}
        columnOrder={tablePrefs.columnOrder}
        hiddenColumnIds={tablePrefs.hiddenColumnIds}
        saving={tablePrefs.saving}
        onSave={(next) => tablePrefs.saveColumnLayout(next)}
        onReset={() => tablePrefs.resetColumnLayout()}
      />

      <div className="orders-hub-section orders-hub-section--table">
        <Card className="overflow-hidden rounded-none border-0 bg-transparent shadow-none hover:shadow-none">
          <CardContent className="space-y-0 p-0">
            <div className="flex flex-wrap items-end gap-3 border-b border-border bg-muted/25 px-3 py-3 sm:px-4">
              <div className="grid min-w-[12rem] gap-1.5">
                <Label className="text-xs text-muted-foreground">Склад</Label>
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={draftWarehouseId}
                  onChange={(e) => setDraftWarehouseId(e.target.value)}
                >
                  <option value="">Все склады</option>
                  {(optionsQ.data?.warehouses ?? []).map((w) => (
                    <option key={w.id} value={String(w.id)}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                size="sm"
                className="h-9 bg-teal-600 text-white hover:bg-teal-700"
                onClick={() => setAppliedWarehouseId(draftWarehouseId)}
              >
                Применить
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/25 px-3 py-0 sm:px-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  className={cn(
                    "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
                    tab === "active" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
                  )}
                  onClick={() => setTab("active")}
                >
                  Активный
                </button>
                <button
                  type="button"
                  className={cn(
                    "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
                    tab === "inactive"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground"
                  )}
                  onClick={() => setTab("inactive")}
                >
                  Не активный
                </button>
              </div>
            </div>

            <div className="table-toolbar flex flex-wrap items-end gap-2 border-b border-border/80 bg-muted/30 px-3 py-2 sm:px-4">
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                value={limit}
                onChange={(e) => tablePrefs.setPageSize(Number.parseInt(e.target.value, 10))}
              >
                {DEFAULT_TABLE_PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <TableSearchField
                className="flex-1 basis-[200px] sm:max-w-xs"
                onSearch={(q) => {
                  setSearch(q);
                  setPage(1);
                }}
              />
              <Button type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={() => void exportExcel()}>
                Excel
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="h-9 w-9"
                onClick={() => void listQ.refetch()}
              >
                <RefreshCw className={cn("size-4", listQ.isFetching && "animate-spin")} />
              </Button>
            </div>

            {feedback ? (
              <p className="border-b border-border/60 px-3 py-2 text-sm text-destructive sm:px-4">{feedback}</p>
            ) : null}

            <div className="overflow-x-auto">
              <table
                className={cn(
                  "w-full min-w-[960px] border-collapse text-sm",
                  tab === "inactive" && "opacity-80"
                )}
              >
                <thead className="app-table-thead">
                  <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                    {tablePrefs.visibleColumnOrder.map((colId) => (
                      <th key={colId} className="whitespace-nowrap px-3 py-2.5">
                        {colId === "name" ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary"
                            onClick={toggleNameSort}
                          >
                            {COLUMN_META.find((c) => c.id === colId)?.label}
                            {sort === "name_desc" ? (
                              <ArrowDown className="size-3 opacity-60" />
                            ) : sort === "name_asc" ? (
                              <ArrowUp className="size-3 opacity-60" />
                            ) : (
                              <ArrowUpDown className="size-3 opacity-50" />
                            )}
                          </button>
                        ) : (
                          COLUMN_META.find((c) => c.id === colId)?.label
                        )}
                      </th>
                    ))}
                    <th className="min-w-[14rem] px-3 py-2.5"> </th>
                    {canWrite ? <th className="w-24 px-2 py-2.5 text-right"> </th> : null}
                  </tr>
                </thead>
                <tbody>
                  {listQ.isLoading ? (
                    <tr>
                      <td
                        colSpan={tablePrefs.visibleColumnOrder.length + 1 + (canWrite ? 1 : 0)}
                        className="px-3 py-10 text-center text-muted-foreground"
                      >
                        Загрузка…
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={tablePrefs.visibleColumnOrder.length + 1 + (canWrite ? 1 : 0)}
                        className="px-3 py-10 text-center text-muted-foreground"
                      >
                        Нет данных
                      </td>
                    </tr>
                  ) : (
                    rows.map((r, idx) => (
                      <tr
                        key={r.id}
                        className={cn(
                          "border-b border-border/80 transition-colors",
                          idx % 2 === 1 ? "bg-muted/20" : "bg-background",
                          "hover:bg-muted/35",
                          tab === "inactive" && "text-muted-foreground"
                        )}
                      >
                        {tablePrefs.visibleColumnOrder.map((colId) => (
                          <td key={colId} className="px-3 py-2 align-top text-xs">
                            {colId === "name" ? (
                              <span className="font-medium text-foreground">{r.name}</span>
                            ) : colId === "warehouse" ? (
                              r.warehouse_name
                            ) : colId === "expeditors" ? (
                              <div className="flex max-w-[18rem] flex-wrap gap-1">
                                {r.expeditors.length === 0 ? (
                                  "—"
                                ) : (
                                  r.expeditors.map((e) => (
                                    <span
                                      key={e.id}
                                      className="inline-flex rounded-md border border-border/80 bg-muted/40 px-1.5 py-0.5 text-[11px]"
                                    >
                                      {e.name}
                                    </span>
                                  ))
                                )}
                              </div>
                            ) : colId === "code" ? (
                              r.code ?? "—"
                            ) : colId === "gruzchik" ? (
                              r.gruzchik_user_name ?? "—"
                            ) : colId === "sort_order" ? (
                              <span className="tabular-nums">{r.sort_order}</span>
                            ) : colId === "comment" ? (
                              r.comment ? (
                                <span className="line-clamp-2 max-w-[14rem]">{r.comment}</span>
                              ) : (
                                "—"
                              )
                            ) : null}
                          </td>
                        ))}
                        <td className="px-3 py-2 align-top">
                          {canWrite && tab === "active" && !r.empty_stock_confirmed_at ? (
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 whitespace-normal bg-teal-600 px-2 text-[11px] leading-tight text-white hover:bg-teal-700"
                              disabled={confirmEmptyMut.isPending}
                              onClick={() => confirmEmptyMut.mutate(r.id)}
                            >
                              Подтвердить отсутствие товаров в блоке
                            </Button>
                          ) : r.empty_stock_confirmed_at ? (
                            <span
                              className="inline-flex items-center gap-1 text-muted-foreground"
                              title={new Date(r.empty_stock_confirmed_at).toLocaleString("ru-RU")}
                            >
                              <Info className="size-4 shrink-0" aria-hidden />
                              <span className="sr-only">Пустой блок подтверждён</span>
                            </span>
                          ) : null}
                        </td>
                        {canWrite ? (
                          <td className="px-2 py-2 text-right align-top">
                            <TableRowActionGroup className="justify-end" ariaLabel="Действия">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                className="text-amber-700 hover:bg-amber-500/10 hover:text-amber-800 dark:text-amber-400"
                                title="Редактировать"
                                onClick={() => {
                                  setEditing(r);
                                  setFormOpen(true);
                                }}
                              >
                                <Pencil className="size-3.5" aria-hidden />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive hover:bg-destructive/10"
                                title="Удалить"
                                onClick={() => setDeleteTarget(r)}
                              >
                                <Trash2 className="size-3.5" aria-hidden />
                              </Button>
                            </TableRowActionGroup>
                          </td>
                        ) : null}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="table-content-footer flex flex-wrap items-center justify-between gap-2 border-t border-border/80 bg-muted/25 px-3 py-3 text-xs text-muted-foreground sm:px-4">
              <span>
                Показано {from} - {to} / {total}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ←
                </Button>
                {(() => {
                  const buttons: number[] = [];
                  const windowSize = 5;
                  let start = Math.max(1, page - Math.floor(windowSize / 2));
                  const end = Math.min(totalPages, start + windowSize - 1);
                  start = Math.max(1, end - windowSize + 1);
                  for (let p = start; p <= end; p++) buttons.push(p);
                  return buttons.map((p) => (
                    <Button
                      key={p}
                      type="button"
                      variant={page === p ? "default" : "outline"}
                      size="sm"
                      className="h-7 min-w-7 px-2"
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  ));
                })()}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  →
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <BlockFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
        initial={editing}
        canWrite={canWrite}
        tenantSlug={tenantSlug}
        formOptions={optionsQ.data}
        optionsLoading={optionsQ.isLoading}
        onSaved={() => setFeedback(null)}
      />

      <Dialog open={deleteTarget != null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm" showCloseButton>
          <DialogHeader>
            <DialogTitle>Удалить блок?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {deleteTarget
              ? `«${deleteTarget.name}» будет удалён. Это действие нельзя отменить.`
              : null}
          </p>
          <DialogFooter className="flex flex-row justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Отмена
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMut.isPending}
              onClick={() => {
                if (deleteTarget) deleteMut.mutate(deleteTarget.id);
              }}
            >
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
