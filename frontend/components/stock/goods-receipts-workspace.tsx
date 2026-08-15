"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { TableColumnSettingsDialog } from "@/components/data-table/table-column-settings-dialog";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { ExcelDropTarget } from "@/components/ui/excel-file-drop-zone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { cn } from "@/lib/utils";
import { formatGroupedDecimal } from "@/lib/format-numbers";
import { pickFirstExcelFile } from "@/lib/excel-file-pick";
import { api } from "@/lib/api";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { STALE } from "@/lib/query-stale";
import { useEffectiveRole } from "@/lib/auth-store";
import { isAdminOrOperatorLikeRole } from "@/lib/distribution-roles";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Download, FileSpreadsheet, LayoutGrid, ListFilter, Pencil, RefreshCw, Search, Upload, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useMemo, useRef, useState } from "react";

const TABLE_ID = "goods_receipts.list.v1";
const COLS = [
  { id: "created_at", label: "Дата создания" },
  { id: "receipt_at", label: "Дата прихода" },
  { id: "total_qty", label: "Кол-во" },
  { id: "total_sum", label: "Сумма" },
  { id: "total_volume_m3", label: "Объём" },
  { id: "total_weight_kg", label: "Вес" },
  { id: "status", label: "Статус" },
  { id: "warehouse_name", label: "Склад" },
  { id: "comment", label: "Комментарий" },
  { id: "external_ref", label: "Номер прихода 1С" },
  { id: "supplier_name", label: "Поставщики" },
  { id: "number", label: "Номер" },
  { id: "price_type", label: "Тип цены" }
] as const;
const DEFAULT_ORDER = COLS.map((c) => c.id);
const NUMERIC = new Set(["total_qty", "total_sum", "total_volume_m3", "total_weight_kg"]);

export type GoodsReceiptRow = {
  id: number;
  number: string;
  status: string;
  created_at: string;
  receipt_at: string | null;
  total_qty: string;
  total_sum: string;
  total_volume_m3: string;
  total_weight_kg: string;
  comment: string | null;
  price_type: string;
  external_ref: string | null;
  warehouse_id: number;
  warehouse_name: string;
  supplier_id: number | null;
  supplier_name: string | null;
  deleted_at?: string | null;
};

function colLabel(id: string): string {
  return COLS.find((c) => c.id === id)?.label ?? id;
}

function fmtDt(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(d);
  } catch {
    return iso;
  }
}

function statusLabel(s: string): string {
  switch (s) {
    case "draft":
      return "Новый";
    case "editing":
      return "Редактирование";
    case "posted":
      return "Одобренный";
    case "cancelled":
      return "Отменен";
    default:
      return s;
  }
}

function canChangeReceiptStatus(current: string): boolean {
  return current !== "cancelled";
}

function statusOptionsForRow(current: string): Array<{ value: string; label: string }> {
  if (current === "draft") {
    return [
      { value: "editing", label: "Редактирование" },
      { value: "posted", label: "Одобренный" },
      { value: "cancelled", label: "Отменен" }
    ];
  }
  if (current === "editing") {
    return [
      { value: "draft", label: "Новый" },
      { value: "posted", label: "Одобренный" },
      { value: "cancelled", label: "Отменен" }
    ];
  }
  if (current === "posted") {
    return [{ value: "cancelled", label: "Отменен" }];
  }
  if (current === "cancelled") {
    return [];
  }
  return [];
}

function renderCell(row: GoodsReceiptRow, colId: string): ReactNode {
  switch (colId) {
    case "created_at":
      return fmtDt(row.created_at);
    case "receipt_at":
      return fmtDt(row.receipt_at);
    case "total_qty": {
      const raw = row.total_qty;
      const n = Number.parseFloat(String(raw).replace(",", "."));
      if (!Number.isFinite(n)) return <span className="tabular-nums">{raw}</span>;
      return <span className="tabular-nums">{formatGroupedDecimal(n, 0)}</span>;
    }
    case "total_sum": {
      const raw = row.total_sum;
      const n = Number.parseFloat(String(raw).replace(",", "."));
      if (!Number.isFinite(n)) return <span className="tabular-nums">{raw}</span>;
      return <span className="tabular-nums">{formatGroupedDecimal(n, 2)}</span>;
    }
    case "total_volume_m3":
    case "total_weight_kg": {
      const raw = row[colId as keyof GoodsReceiptRow] as string;
      const n = Number.parseFloat(String(raw).replace(",", "."));
      if (!Number.isFinite(n)) return <span className="tabular-nums">{raw}</span>;
      return <span className="tabular-nums">{formatGroupedDecimal(n, 4)}</span>;
    }
    case "status":
      return statusLabel(row.status);
    case "warehouse_name":
      return row.warehouse_name;
    case "comment":
      return row.comment ? <span className="max-w-[200px] truncate">{row.comment}</span> : "—";
    case "external_ref":
      return row.external_ref ?? "—";
    case "supplier_name":
      return row.supplier_name ?? "—";
    case "number":
      return <span className="font-mono text-xs">{row.number}</span>;
    case "price_type":
      return row.price_type;
    default:
      return "—";
  }
}

type Props = { tenantSlug: string };

export function GoodsReceiptsWorkspace({ tenantSlug }: Props) {
  const role = useEffectiveRole();
  const canWrite = isAdminOrOperatorLikeRole(role);
  const qc = useQueryClient();

  const [draftWh, setDraftWh] = useState("");
  const [draftSupplier, setDraftSupplier] = useState("");
  const [draftStatus, setDraftStatus] = useState("");
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [draftRangeOpen, setDraftRangeOpen] = useState(false);
  const draftRangeAnchorRef = useRef<HTMLButtonElement>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadReport, setUploadReport] = useState<{ applied: number; errors: string[] } | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);
  const [applied, setApplied] = useState({
    warehouseId: "",
    supplierId: "",
    status: "",
    dateFrom: "",
    dateTo: "",
    q: ""
  });
  const [page, setPage] = useState(1);
  const [columnOpen, setColumnOpen] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  const tablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: TABLE_ID,
    defaultColumnOrder: DEFAULT_ORDER,
    defaultPageSize: 25,
    allowedPageSizes: [10, 25, 50, 100]
  });
  const visible = tablePrefs.visibleColumnOrder;

  const applyFilters = useCallback(() => {
    setApplied({
      warehouseId: draftWh,
      supplierId: draftSupplier,
      status: draftStatus,
      dateFrom: draftFrom,
      dateTo: draftTo,
      q: searchDraft.trim()
    });
    setPage(1);
  }, [draftWh, draftSupplier, draftStatus, draftFrom, draftTo, searchDraft]);

  const resetFilters = useCallback(() => {
    setDraftWh("");
    setDraftSupplier("");
    setDraftStatus("");
    setDraftFrom("");
    setDraftTo("");
    setSearchDraft("");
    setApplied({
      warehouseId: "",
      supplierId: "",
      status: "",
      dateFrom: "",
      dateTo: "",
      q: ""
    });
    setPage(1);
  }, []);

  const warehousesQ = useQuery({
    queryKey: ["warehouses", tenantSlug],
    queryFn: async () => {
      const { data } = await api.get<{ data: { id: number; name: string }[] }>(
        `/api/${tenantSlug}/warehouses`
      );
      return data.data;
    },
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference
  });

  const suppliersQ = useQuery({
    queryKey: ["suppliers", tenantSlug],
    queryFn: async () => {
      const { data } = await api.get<{ data: { id: number; name: string }[] }>(
        `/api/${tenantSlug}/suppliers`
      );
      return data.data;
    },
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference
  });

  const listQ = useQuery({
    queryKey: [
      "goods-receipts",
      tenantSlug,
      applied,
      page,
      tablePrefs.pageSize
    ],
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set("page", String(page));
      p.set("limit", String(tablePrefs.pageSize));
      if (applied.warehouseId) p.set("warehouse_id", applied.warehouseId);
      if (applied.supplierId) p.set("supplier_id", applied.supplierId);
      if (applied.status) p.set("status", applied.status);
      if (applied.dateFrom) p.set("date_from", applied.dateFrom);
      if (applied.dateTo) p.set("date_to", applied.dateTo);
      if (applied.q) p.set("q", applied.q);
      const { data } = await api.get<{ data: GoodsReceiptRow[]; total: number }>(
        `/api/${tenantSlug}/goods-receipts?${p.toString()}`
      );
      return data;
    },
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list
  });

  const rows = useMemo(() => listQ.data?.data ?? [], [listQ.data?.data]);
  const total = listQ.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / tablePrefs.pageSize));

  const exportExcelSummary = useCallback(() => {
    const headers = visible.map(colLabel);
    const data = rows.map((row) =>
      visible.map((cid) => {
        switch (cid) {
          case "created_at":
            return fmtDt(row.created_at);
          case "receipt_at":
            return fmtDt(row.receipt_at);
          case "status":
            return statusLabel(row.status);
          case "comment":
            return row.comment ?? "";
          case "supplier_name":
            return row.supplier_name ?? "";
          case "external_ref":
            return row.external_ref ?? "";
          default:
            return String((row as Record<string, unknown>)[cid] ?? "");
        }
      })
    );
    downloadXlsxSheet(
      `postupleniya_${new Date().toISOString().slice(0, 10)}`,
      "Поступление",
      headers,
      data
    );
    setExportOpen(false);
  }, [rows, visible]);

  const exportExcelDetailed = useCallback(async () => {
    if (!rows.length) return;
    setExportBusy(true);
    try {
      const detailRows = await Promise.all(
        rows.map(async (row) => {
          const { data } = await api.get<{
            data: {
              id: number;
              number: string;
              status: string;
              created_at: string;
              receipt_at: string | null;
              warehouse: { id: number; name: string };
              supplier: { id: number; name: string } | null;
              price_type: string;
              external_ref: string | null;
              comment: string | null;
              lines: {
                product_id: number;
                sku: string;
                product_name: string;
                qty: string;
                unit_price: string;
                line_total: string;
              }[];
            };
          }>(`/api/${tenantSlug}/goods-receipts/${row.id}`);
          return data.data;
        })
      );

      const headers = [
        "Номер документа",
        "Статус",
        "Дата прихода",
        "Дата создания",
        "Склад",
        "Поставщик",
        "Тип цены",
        "Номер прихода 1С",
        "Комментарий",
        "SKU",
        "Товар",
        "Кол-во",
        "Цена",
        "Сумма строки"
      ];
      const data = detailRows.flatMap((doc) =>
        doc.lines.map((ln) => [
          doc.number,
          statusLabel(doc.status),
          fmtDt(doc.receipt_at),
          fmtDt(doc.created_at),
          doc.warehouse.name,
          doc.supplier?.name ?? "",
          doc.price_type,
          doc.external_ref ?? "",
          doc.comment ?? "",
          ln.sku,
          ln.product_name,
          ln.qty,
          ln.unit_price,
          ln.line_total
        ])
      );

      downloadXlsxSheet(
        `postupleniya_batafsil_${new Date().toISOString().slice(0, 10)}`,
        "Поступление (строки)",
        headers,
        data
      );
      setExportOpen(false);
    } finally {
      setExportBusy(false);
    }
  }, [rows, tenantSlug]);

  const colCount = Math.max(1, visible.length);

  async function importFromExcel(file: File) {
    if (!tenantSlug) return;
    setUploading(true);
    setUploadReport(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post<{ applied: number; errors: string[] }>(
        `/api/${tenantSlug}/stock/import`,
        fd
      );
      setUploadReport(data);
      if (data.errors.length > 0) {
        setNotice({ kind: "error", text: `Импорт: есть ошибки (${data.errors.length}).` });
      } else {
        setNotice({ kind: "success", text: `Импорт завершён: применено ${data.applied} строк.` });
      }
      await qc.invalidateQueries({ queryKey: ["goods-receipts", tenantSlug] });
      await qc.invalidateQueries({ queryKey: ["stock", tenantSlug] });
      await listQ.refetch();
    } finally {
      setUploading(false);
    }
  }

  async function changeStatus(id: number, status: "draft" | "editing" | "posted" | "cancelled") {
    setStatusBusyId(id);
    try {
      await api.post(`/api/${tenantSlug}/goods-receipts/${id}/status`, { status });
      await qc.invalidateQueries({ queryKey: ["goods-receipts", tenantSlug] });
      await qc.invalidateQueries({ queryKey: ["stock", tenantSlug] });
    } catch {
      setNotice({ kind: "error", text: "Статусni o‘zgartirib bo‘lmadi (workflow cheklovi yoki ruxsat)." });
    } finally {
      setStatusBusyId(null);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Поступление"
        description="Документы оприходования на склад: связь со складом, остатками и каталогом (тип цены, номенклатура)."
        actions={
          canWrite ? (
            <div className="flex flex-wrap items-center gap-2">
              <ExcelDropTarget disabled={uploading} onFile={(f) => void importFromExcel(f)}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => importFileRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="mr-1 size-3.5" />
                  {uploading ? "Импорт..." : "Импортировать с excel"}
                </Button>
              </ExcelDropTarget>
              <Link
                href="/stock/receipts/new"
                className={cn(buttonVariants({ size: "sm" }), "bg-teal-600 text-white hover:bg-teal-700")}
              >
                Добавить
              </Link>
              <Button type="button" variant="outline" size="sm" onClick={() => setExportOpen(true)}>
                <Download className="mr-1 size-3.5" />
                Excel
              </Button>
              <input
                ref={importFileRef}
                type="file"
                accept=".xlsx,.xlsm"
                className="hidden"
                onChange={(e) => {
                  const f = pickFirstExcelFile(e.target.files);
                  e.target.value = "";
                  if (f) void importFromExcel(f);
                }}
              />
            </div>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href="/stock">
          ← Kirim / qoldiq
        </Link>
        <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href="/stock/balances">
          Остатки товаров
        </Link>
        <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href="/stock/warehouses">
          Склады
        </Link>
      </div>

      {notice ? (
        <div
          className={cn(
            "mb-3 flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm",
            notice.kind === "error"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          )}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            className="rounded p-0.5 opacity-80 hover:opacity-100"
            onClick={() => setNotice(null)}
            aria-label="Закрыть уведомление"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      <Card className="border-border/60 shadow-sm">
        <CardContent className="space-y-4 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filter Panel</p>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
            <div className="grid min-w-[9rem] gap-1.5">
              <Label className="text-xs">Склад</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={draftWh}
                onChange={(e) => setDraftWh(e.target.value)}
              >
                <option value="">Все</option>
                {(warehousesQ.data ?? []).map((w) => (
                  <option key={w.id} value={String(w.id)}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid min-w-[9rem] gap-1.5">
              <Label className="text-xs">Поставщики</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
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
            <div className="grid min-w-[9rem] gap-1.5">
              <Label className="text-xs">Статус</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={draftStatus}
                onChange={(e) => setDraftStatus(e.target.value)}
              >
                <option value="">Все</option>
                <option value="draft">Новый</option>
                <option value="editing">Редактирование</option>
                <option value="posted">Одобренный</option>
                <option value="cancelled">Отменен</option>
              </select>
            </div>
            <div className="grid min-w-[11rem] max-w-[16rem] gap-1.5">
              <Label className="text-xs">Период</Label>
              <button
                ref={draftRangeAnchorRef}
                type="button"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "h-9 w-full justify-start gap-2 font-normal",
                  draftRangeOpen && "border-primary/60 bg-primary/5"
                )}
                aria-expanded={draftRangeOpen}
                aria-haspopup="dialog"
                onClick={() => setDraftRangeOpen((o) => !o)}
              >
                <CalendarDays className="h-4 w-4 shrink-0" />
                <span className="truncate text-sm">{formatDateRangeButton(draftFrom, draftTo)}</span>
              </button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              title="Сбросить фильтры"
              onClick={() => resetFilters()}
            >
              <ListFilter className="size-4" />
            </Button>
            </div>
            <div className="flex shrink-0 items-end">
            <Button
              type="button"
              className="h-9 min-w-[7.5rem] shrink-0 bg-teal-600 px-4 text-white hover:bg-teal-700"
              onClick={() => applyFilters()}
            >
              Применить
            </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-end gap-2 border-b border-border/50 pb-3">
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={String(tablePrefs.pageSize)}
          onChange={(e) => {
            tablePrefs.setPageSize(Number(e.target.value));
            setPage(1);
          }}
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9"
          title="Управление столбцами"
          onClick={() => setColumnOpen(true)}
        >
          <LayoutGrid className="size-4" />
        </Button>
        <div className="relative min-w-[180px] max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-8"
            placeholder="Поиск"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyFilters();
            }}
          />
        </div>
        <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setExportOpen(true)}>
          <Download className="mr-1 size-3.5" />
          Excel
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9"
          title="Обновить"
          onClick={() => void listQ.refetch()}
        >
          <RefreshCw className={cn("size-4", listQ.isFetching && "animate-spin")} />
        </Button>
      </div>

      <TableColumnSettingsDialog
        open={columnOpen}
        onOpenChange={setColumnOpen}
        title="Управление столбцами"
        description="Видимые столбцы и порядок сохраняются для вашей учётной записи."
        columns={[...COLS]}
        columnOrder={tablePrefs.columnOrder}
        hiddenColumnIds={tablePrefs.hiddenColumnIds}
        saving={tablePrefs.saving}
        onSave={(next) => tablePrefs.saveColumnLayout(next)}
        onReset={() => tablePrefs.resetColumnLayout()}
      />

      <div className="overflow-x-auto rounded-lg border border-border/60 bg-card shadow-sm">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          {visible.length === 0 ? (
            <tbody>
              <tr>
                <td className="p-8 text-center text-muted-foreground">
                  Нет видимых столбцов. Откройте «Управление столбцами».
                </td>
              </tr>
            </tbody>
          ) : (
            <>
              <thead className="app-table-thead">
                <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                  {visible.map((colId) => (
                    <th
                      key={colId}
                      className={cn(
                        "whitespace-nowrap px-3 py-2.5",
                        NUMERIC.has(colId) && "text-right"
                      )}
                    >
                      {colLabel(colId)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listQ.isLoading ? (
                  <tr>
                    <td colSpan={colCount} className="p-8 text-center text-muted-foreground">
                      Загрузка…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={colCount} className="p-8 text-center text-muted-foreground">
                      Пусто
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-b border-border/70 hover:bg-muted/20">
                      {visible.map((colId) => (
                        <td
                          key={colId}
                          className={cn("px-3 py-2", NUMERIC.has(colId) && "text-right")}
                        >
                          {colId === "status" && canWrite ? (
                            <div className="flex items-center gap-1">
                              <select
                                className="h-8 min-w-[8rem] rounded-md border border-input bg-background px-2 text-xs"
                                value={row.status}
                                disabled={statusBusyId === row.id || !canChangeReceiptStatus(row.status)}
                                onChange={(e) => {
                                  const next = e.target.value as "draft" | "editing" | "posted" | "cancelled";
                                  if (next === row.status) return;
                                  void changeStatus(row.id, next);
                                }}
                              >
                                <option value={row.status} hidden>
                                  {statusLabel(row.status)}
                                </option>
                                {statusOptionsForRow(row.status).map((opt) => (
                                  <option key={`${row.id}-${opt.value}`} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              {(row.status === "draft" || row.status === "editing") && canWrite ? (
                                <Link
                                  href={`/stock/receipts/new?source_receipt_id=${row.id}`}
                                  className={cn(
                                    buttonVariants({ variant: "outline", size: "icon" }),
                                    "h-8 w-8"
                                  )}
                                  title="Редактировать"
                                >
                                  <Pencil className="size-3.5" />
                                </Link>
                              ) : null}
                            </div>
                          ) : (
                            renderCell(row, colId)
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </>
          )}
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Всего: {total} · стр. {page} / {totalPages}
        </span>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ←
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            →
          </Button>
        </div>
      </div>
      {uploadReport ? (
        <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          Импорт завершён: применено {uploadReport.applied} строк, ошибок: {uploadReport.errors.length}
        </div>
      ) : null}
      <DateRangePopover
        open={draftRangeOpen}
        onOpenChange={setDraftRangeOpen}
        anchorRef={draftRangeAnchorRef}
        dateFrom={draftFrom}
        dateTo={draftTo}
        onApply={({ dateFrom, dateTo }) => {
          setDraftFrom(dateFrom);
          setDraftTo(dateTo);
        }}
      />
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="gap-0 overflow-hidden border-0 p-0 shadow-lg sm:max-w-lg" showCloseButton>
          <div className="border-b bg-gradient-to-br from-primary/12 via-primary/5 to-background px-5 py-4">
            <div className="flex gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
                <FileSpreadsheet className="size-5" />
              </div>
              <div className="min-w-0 space-y-1 pr-6">
                <DialogTitle className="text-base font-semibold leading-tight">Excel eksport</DialogTitle>
                <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
                  Joriy sahifa va filtrlangan qatorlar eksport qilinadi. Fayl{" "}
                  <span className="font-medium text-foreground/80">.xlsx</span> formatida.
                </DialogDescription>
              </div>
            </div>
          </div>
          <div className="space-y-2.5 p-4">
            <button
              type="button"
              disabled={exportBusy || rows.length === 0}
              onClick={() => exportExcelSummary()}
              className={cn(
                "flex w-full flex-col gap-0.5 rounded-xl border border-border/80 bg-card px-4 py-3.5 text-left shadow-sm transition-colors",
                "hover:border-primary/35 hover:bg-muted/35",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:pointer-events-none disabled:opacity-45"
              )}
            >
              <span className="text-sm font-medium">Umumiy ro‘yxat</span>
              <span className="text-xs text-muted-foreground">
                Hujjatlar ro‘yxati: status, sana, sklad, summalar va izoh
              </span>
            </button>
            <button
              type="button"
              disabled={exportBusy || rows.length === 0}
              onClick={() => void exportExcelDetailed()}
              className={cn(
                "flex w-full flex-col gap-0.5 rounded-xl border border-border/80 bg-card px-4 py-3.5 text-left shadow-sm transition-colors",
                "hover:border-primary/35 hover:bg-muted/35",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:pointer-events-none disabled:opacity-45"
              )}
            >
              <span className="text-sm font-medium">
                {exportBusy ? "Загрузка…" : "Batafsil (mahsulot qatorlari)"}
              </span>
              <span className="text-xs text-muted-foreground">
                Har hujjat ichidagi barcha product qatorlari bilan eksport
              </span>
            </button>
            {rows.length === 0 ? (
              <p className="rounded-lg bg-muted/50 px-3 py-2 text-center text-xs text-muted-foreground">
                Eksport uchun jadvalda kamida bitta qator bo‘lishi kerak.
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
