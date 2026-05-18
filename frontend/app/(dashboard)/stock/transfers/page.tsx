"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TableColumnSettingsDialog } from "@/components/data-table/table-column-settings-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";
import { Eye, FileSpreadsheet, FileText, LayoutGrid, RefreshCw, Search } from "lucide-react";
import { apiFetch, useTenant } from "@/lib/api-client";
import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { cn } from "@/lib/utils";
import { formatNumberGrouped } from "@/lib/format-numbers";

interface Transfer {
  id: number;
  number: string;
  source_warehouse_name: string;
  destination_warehouse_name: string;
  status: string;
  total_qty: string;
  planned_date: string | null;
  started_at?: string | null;
  received_at?: string | null;
  created_at: string;
  comment: string | null;
  created_by_user_id: number | null;
  created_by_name: string | null;
  created_by_login: string | null;
  received_by_user_id: number | null;
  received_by_name: string | null;
  received_by_login: string | null;
}
interface WarehouseOption {
  id: number;
  name: string;
}

interface TransferDetailLine {
  id: number;
  product_sku: string;
  product_name: string;
  qty: string;
  received_qty: string | null;
  batch_no: string | null;
  comment: string | null;
  sort_order: number;
}

interface TransferDetail {
  id: number;
  number: string;
  status: string;
  source_warehouse_name: string;
  destination_warehouse_name: string;
  comment: string | null;
  planned_date: string | null;
  started_at: string | null;
  received_at: string | null;
  created_at: string;
  created_by_user_id: number | null;
  created_by_name: string | null;
  created_by_login: string | null;
  received_by_user_id: number | null;
  received_by_name: string | null;
  received_by_login: string | null;
  lines: TransferDetailLine[];
}

const statusLabels: Record<string, string> = {
  draft: "Qoralama",
  in_transit: "Yo'lda",
  received: "Qabul qilindi",
  cancelled: "Bekor qilindi",
};

const statusColors: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  in_transit: "bg-blue-100 text-blue-800",
  received: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const TABLE_ID = "stock.transfers.list.v1";
const COLS = [
  { id: "move_date", label: "Дата перемещения" },
  { id: "source_warehouse_name", label: "Со склада" },
  { id: "destination_warehouse_name", label: "На склад" },
  { id: "total_qty", label: "Кол-во" },
  { id: "created_at", label: "Дата создания" },
  { id: "comment", label: "Комментарий" },
  { id: "status", label: "Статус" },
  { id: "actions", label: "Действие" }
] as const;
const DEFAULT_ORDER = COLS.map((c) => c.id);

function formatDateDdMmYyyy(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** Mahalliy vaqt: DD.MM.YYYY HH:mm:ss */
function formatDateTimeLocal(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Excel/filtirlash uchun aniq vaqt (UTC, ISO 8601 matn) */
function toIsoUtcText(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

function transferDisplayDate(t: Transfer): string | null {
  return (
    t.planned_date ??
    t.started_at ??
    t.received_at ??
    null
  );
}

function actorSummary(
  name: string | null | undefined,
  login: string | null | undefined,
  userId: number | null | undefined
): string {
  const n = name?.trim();
  const l = login?.trim();
  if (n && l) return `${n} (${l})`;
  if (n) return n;
  if (l) return l;
  if (userId != null) return `#${userId}`;
  return "—";
}

function parseFilenameFromDisposition(cd: string | undefined): string | null {
  if (!cd) return null;
  const m = /filename="([^"]+)"/.exec(cd) ?? /filename=([^;\s]+)/.exec(cd);
  return m?.[1] ? m[1].replace(/"/g, "") : null;
}

export default function TransfersPage() {
  const tenant = useTenant();
  const [loading, setLoading] = useState(true);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [rawTransfers, setRawTransfers] = useState<Transfer[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceWarehouseId, setSourceWarehouseId] = useState("all");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("all");
  const [draftStatusFilter, setDraftStatusFilter] = useState<string>("all");
  const [draftSourceWarehouseId, setDraftSourceWarehouseId] = useState("all");
  const [draftDestinationWarehouseId, setDraftDestinationWarehouseId] = useState("all");
  const [searchDraft, setSearchDraft] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [columnOpen, setColumnOpen] = useState(false);

  const [exportOpen, setExportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  const [viewTransferId, setViewTransferId] = useState<number | null>(null);
  const [viewDetail, setViewDetail] = useState<TransferDetail | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewPdfLoading, setViewPdfLoading] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);
  const viewTransferIdRef = useRef<number | null>(null);
  viewTransferIdRef.current = viewTransferId;
  const tablePrefs = useUserTablePrefs({
    tenantSlug: tenant,
    tableId: TABLE_ID,
    defaultColumnOrder: DEFAULT_ORDER,
    defaultPageSize: 20,
    allowedPageSizes: [10, 20, 50, 100]
  });
  const visible = tablePrefs.visibleColumnOrder;

  const openTransferView = (id: number) => {
    setViewTransferId(id);
    setViewDetail(null);
    setViewError(null);
  };

  const closeTransferView = () => {
    setViewTransferId(null);
    setViewDetail(null);
    setViewError(null);
    setViewLoading(false);
  };

  const downloadViewPdf = useCallback(async () => {
    if (!tenant || viewTransferId == null) return;
    setViewPdfLoading(true);
    try {
      const res = await api.get<Blob>(`/api/${tenant}/transfers/${viewTransferId}/pdf`, {
        responseType: "blob",
      });
      const ct = String(res.headers["content-type"] ?? "").toLowerCase();
      if (!ct.includes("pdf")) throw new Error("PDF tayyor bo‘lmadi");
      const blob = res.data as Blob;
      const filename =
        parseFilenameFromDisposition(res.headers["content-disposition"]) ??
        `warehouse_transfer_${viewTransferId}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setViewError(getUserFacingError(e, "PDF yuklashda xatolik"));
    } finally {
      setViewPdfLoading(false);
    }
  }, [tenant, viewTransferId]);

  const fetchTransfers = useCallback(async () => {
    if (!tenant) {
      setRawTransfers([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(tablePrefs.pageSize),
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
        ...(sourceWarehouseId !== "all" ? { sourceWarehouseId } : {}),
        ...(destinationWarehouseId !== "all" ? { destinationWarehouseId } : {}),
      });
      const data = await apiFetch<{ data?: Transfer[]; total?: number }>(
        `/api/${tenant}/transfers?${params}`
      );
      setRawTransfers(data.data ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      console.error("Failed to fetch transfers:", err);
    } finally {
      setLoading(false);
    }
  }, [tenant, page, tablePrefs.pageSize, statusFilter, sourceWarehouseId, destinationWarehouseId]);

  useEffect(() => {
    if (!tenant) return;
    void fetchTransfers();
  }, [fetchTransfers, tenant]);

  useEffect(() => {
    if (!tenant) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch<{ data?: WarehouseOption[] }>(`/api/${tenant}/warehouses`);
        if (!cancelled) setWarehouses(res.data ?? []);
      } catch {
        if (!cancelled) setWarehouses([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenant]);

  useEffect(() => {
    if (viewTransferId == null || !tenant) return;
    let cancelled = false;
    setViewLoading(true);
    setViewError(null);
    void (async () => {
      try {
        const d = await apiFetch<TransferDetail>(`/api/${tenant}/transfers/${viewTransferId}`);
        if (!cancelled) {
          setViewDetail(d);
          setViewError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setViewDetail(null);
          setViewError(getUserFacingError(e, "Yuklashda xatolik"));
        }
      } finally {
        if (!cancelled) setViewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewTransferId, tenant]);

  const reloadOpenTransferDetail = useCallback(
    async (actedId: number) => {
      if (viewTransferIdRef.current !== actedId || !tenant) return;
      try {
        const d = await apiFetch<TransferDetail>(`/api/${tenant}/transfers/${actedId}`);
        setViewDetail(d);
        setViewError(null);
      } catch {
        /* holat o‘zgarganda 404 bo‘lishi mumkin */
      }
    },
    [tenant]
  );

  const transfers = useMemo(() => {
    const q = searchApplied.trim().toLowerCase();
    if (!q) return rawTransfers;
    return rawTransfers.filter((t) => {
      const hay = [
        t.number,
        t.source_warehouse_name,
        t.destination_warehouse_name,
        t.total_qty,
        t.comment ?? "",
        t.created_by_name ?? "",
        t.created_by_login ?? "",
        t.received_by_name ?? "",
        t.received_by_login ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rawTransfers, searchApplied]);

  const exportStamp = () => new Date().toISOString().slice(0, 10);

  const runGeneralExport = () => {
    if (transfers.length === 0) return;
    const headers = [
      "Raqam",
      "Holat",
      "Ko‘chirish (sana, mahalliy vaqt)",
      "Ko‘chirish (ISO UTC)",
      "Manba ombor",
      "Qabul ombori",
      "Jami miqdor",
      "Yaratilgan (sana, mahalliy vaqt)",
      "Yaratilgan (ISO UTC)",
      "Kim yaratgan (ism)",
      "Kim yaratgan (login)",
      "Qabul qilgan (ism)",
      "Qabul qilgan (login)",
      "Izoh",
    ];
    const rows = transfers.map((t) => {
      const primary = transferDisplayDate(t);
      return [
        t.number,
        statusLabels[t.status] ?? t.status,
        formatDateTimeLocal(primary),
        toIsoUtcText(primary),
        t.source_warehouse_name,
        t.destination_warehouse_name,
        t.total_qty,
        formatDateTimeLocal(t.created_at),
        toIsoUtcText(t.created_at),
        t.created_by_name ?? "",
        t.created_by_login ?? "",
        t.received_by_name ?? "",
        t.received_by_login ?? "",
        t.comment ?? "",
      ];
    });
    downloadXlsxSheet(`transfers_umumiy_${exportStamp()}`, "Ko‘chirishlar", headers, rows, {
      colWidths: [14, 12, 22, 24, 18, 18, 12, 22, 24, 18, 16, 18, 16, 28],
    });
    setExportOpen(false);
  };

  const runDetailedExport = async () => {
    if (!tenant || transfers.length === 0) return;
    setExportBusy(true);
    try {
      const headers = [
        "Hujjat raqami",
        "Holat",
        "Ko‘chirish (sana, mahalliy vaqt)",
        "Ko‘chirish (ISO UTC)",
        "Yaratilgan (sana, mahalliy vaqt)",
        "Yaratilgan (ISO UTC)",
        "Kim yaratgan (ism)",
        "Kim yaratgan (login)",
        "Qabul qilgan (ism)",
        "Qabul qilgan (login)",
        "Manba ombor",
        "Qabul ombori",
        "Mahsulot kodi (SKU)",
        "Mahsulot nomi",
        "Partiya",
        "Miqdor",
        "Qabul qilingan",
        "Qator izoh",
      ];
      const rows: (string | number)[][] = [];
      for (const t of transfers) {
        const detail = await apiFetch<TransferDetail | null>(`/api/${tenant}/transfers/${t.id}`);
        if (!detail?.lines?.length) continue;
        const primary =
          detail.planned_date ?? detail.started_at ?? detail.received_at ?? null;
        for (const line of detail.lines) {
          rows.push([
            detail.number,
            statusLabels[detail.status] ?? detail.status,
            formatDateTimeLocal(primary),
            toIsoUtcText(primary),
            formatDateTimeLocal(detail.created_at),
            toIsoUtcText(detail.created_at),
            detail.created_by_name ?? "",
            detail.created_by_login ?? "",
            detail.received_by_name ?? "",
            detail.received_by_login ?? "",
            detail.source_warehouse_name,
            detail.destination_warehouse_name,
            line.product_sku,
            line.product_name,
            line.batch_no ?? "",
            line.qty,
            line.received_qty ?? "",
            line.comment ?? "",
          ]);
        }
      }
      downloadXlsxSheet(`transfers_batafsil_${exportStamp()}`, "Qatorlar", headers, rows, {
        colWidths: [14, 12, 22, 24, 22, 24, 18, 16, 18, 16, 16, 16, 14, 28, 12, 10, 12, 20],
      });
      setExportOpen(false);
    } catch (e) {
      console.error("Batafsil eksport xatosi:", e);
    } finally {
      setExportBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Перемещение товара</h1>
          <p className="text-muted-foreground">Журнал перемещений между складами.</p>
        </div>
        <Link href="/stock/transfers/amaliyot" className={cn(buttonVariants({ variant: "default" }))}>
          Rasmiylashtirish
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Filtrlash</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3 items-end justify-between">
            <div className="flex flex-wrap gap-3 items-center">
            <Select
              value={draftSourceWarehouseId}
              onValueChange={(v: string) => {
                setDraftSourceWarehouseId(v);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Со склада" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Со склада</SelectItem>
                {warehouses.map((w) => (
                  <SelectItem key={`src-${w.id}`} value={String(w.id)}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={draftDestinationWarehouseId}
              onValueChange={(v: string) => {
                setDraftDestinationWarehouseId(v);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="На склад" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">На склад</SelectItem>
                {warehouses.map((w) => (
                  <SelectItem key={`dst-${w.id}`} value={String(w.id)}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={draftStatusFilter}
              onValueChange={(v: string) => {
                setDraftStatusFilter(v);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barchasi</SelectItem>
                <SelectItem value="draft">Черновик</SelectItem>
                <SelectItem value="in_transit">В пути</SelectItem>
                <SelectItem value="received">Принят</SelectItem>
                <SelectItem value="cancelled">Отменен</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={String(tablePrefs.pageSize)}
              onValueChange={(v) => {
                tablePrefs.setPageSize(Number(v));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 / sahifa</SelectItem>
                <SelectItem value="20">20 / sahifa</SelectItem>
                <SelectItem value="50">50 / sahifa</SelectItem>
              </SelectContent>
            </Select>
            </div>
            <div className="flex flex-wrap gap-2 items-center justify-end">
              <Button
                type="button"
                size="sm"
                className="min-w-[110px] bg-teal-600 text-white hover:bg-teal-700"
                onClick={() => {
                  setStatusFilter(draftStatusFilter);
                  setSourceWarehouseId(draftSourceWarehouseId);
                  setDestinationWarehouseId(draftDestinationWarehouseId);
                  setSearchApplied(searchDraft.trim());
                  setPage(1);
                }}
              >
                Применить
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setDraftStatusFilter("all");
                  setDraftSourceWarehouseId("all");
                  setDraftDestinationWarehouseId("all");
                  setStatusFilter("all");
                  setSourceWarehouseId("all");
                  setDestinationWarehouseId("all");
                  setSearchDraft("");
                  setSearchApplied("");
                  setPage(1);
                }}
              >
                Сброс
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => void fetchTransfers()}
                disabled={loading || !tenant}
              >
                <RefreshCw className={cn("size-4", loading && "animate-spin")} />
                Обновить
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setExportOpen(true)}
                disabled={!tenant}
              >
                <FileSpreadsheet className="size-4" />
                Excel
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
          {[10, 20, 50, 100].map((n) => (
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
              if (e.key === "Enter") {
                setSearchApplied(searchDraft.trim());
                setPage(1);
              }
            }}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => {
            setSearchApplied(searchDraft.trim());
            setPage(1);
          }}
        >
          Поиск
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

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent
          className="gap-0 overflow-hidden border-0 p-0 shadow-lg sm:max-w-lg"
          showCloseButton
        >
          <div className="border-b bg-gradient-to-br from-primary/12 via-primary/5 to-background px-5 py-4">
            <div className="flex gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
                <FileSpreadsheet className="size-5" />
              </div>
              <div className="min-w-0 space-y-1 pr-6">
                <DialogTitle className="text-base font-semibold leading-tight">
                  Excel eksport
                </DialogTitle>
                <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
                  Joriy sahifa va holat filtri. Qidiruvdan keyin jadvalda qolgan qatorlar eksportga kiradi.
                  Fayl <span className="font-medium text-foreground/80">.xlsx</span> (Unicode UTF-8) — o‘zbek va
                  kirill matnlari Excelda to‘g‘ri ochiladi; vaqtlar mahalliy va{" "}
                  <span className="font-medium text-foreground/80">ISO UTC</span> ustunlarida beriladi.
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 p-4">
            <button
              type="button"
              disabled={exportBusy || transfers.length === 0}
              onClick={() => runGeneralExport()}
              className={cn(
                "flex w-full flex-col gap-0.5 rounded-xl border border-border/80 bg-card px-4 py-3.5 text-left shadow-sm transition-colors",
                "hover:border-primary/35 hover:bg-muted/35",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:pointer-events-none disabled:opacity-45"
              )}
            >
              <span className="text-sm font-medium">Umumiy ro‘yxat</span>
              <span className="text-xs text-muted-foreground">
                Hujjatlar: vaqt, omborlar, miqdor, kim yaratgan / qabul qilgan, izoh
              </span>
            </button>

            <button
              type="button"
              disabled={exportBusy || transfers.length === 0}
              onClick={() => void runDetailedExport()}
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
                Mahsulot qatorlari, yaratgan / qabul qilgan foydalanuvchilar, vaqtlar
              </span>
            </button>

            {transfers.length === 0 && (
              <p className="rounded-lg bg-muted/50 px-3 py-2 text-center text-xs text-muted-foreground">
                Eksport uchun jadvalda kamida bitta qator bo‘lishi kerak.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={viewTransferId != null}
        onOpenChange={(open) => {
          if (!open) closeTransferView();
        }}
      >
        <DialogContent
          showCloseButton
          className="flex max-h-[min(90vh,840px)] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
        >
          <div className="border-b bg-gradient-to-br from-primary/12 via-primary/5 to-background px-5 py-4">
            <div className="flex gap-3 pr-8">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
                <FileText className="size-5" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <DialogTitle className="text-base font-semibold leading-tight">
                  {viewLoading ? "Ko‘chirish" : viewDetail?.number ?? "Ko‘chirish"}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Ombor ko‘chirish hujjati: raqam, holat, omborlar, vaqtlar va mahsulot qatorlari.
                </DialogDescription>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {viewDetail && (
                    <Badge className={statusColors[viewDetail.status]}>
                      {statusLabels[viewDetail.status] ?? viewDetail.status}
                    </Badge>
                  )}
                  <span>Hujjat tafsilotlari va mahsulot qatorlari</span>
                </div>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {viewLoading && (
              <div className="flex justify-center py-12 text-sm text-muted-foreground">Загрузка…</div>
            )}
            {!viewLoading && viewError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {viewError}
              </div>
            )}
            {!viewLoading && viewDetail && (
              <div className="space-y-5">
                <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                    <dt className="text-xs font-medium text-muted-foreground">Manba ombor</dt>
                    <dd className="mt-0.5 font-medium">{viewDetail.source_warehouse_name}</dd>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                    <dt className="text-xs font-medium text-muted-foreground">Qabul ombori</dt>
                    <dd className="mt-0.5 font-medium">{viewDetail.destination_warehouse_name}</dd>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 sm:col-span-2">
                    <dt className="text-xs font-medium text-muted-foreground">Izoh</dt>
                    <dd className="mt-0.5 whitespace-pre-wrap break-words">
                      {viewDetail.comment?.trim() ? viewDetail.comment : "—"}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                    <dt className="text-xs font-medium text-muted-foreground">Reja sanasi</dt>
                    <dd className="mt-0.5 font-mono text-xs">
                      {formatDateTimeLocal(viewDetail.planned_date)}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                    <dt className="text-xs font-medium text-muted-foreground">Boshlangan</dt>
                    <dd className="mt-0.5 font-mono text-xs">
                      {formatDateTimeLocal(viewDetail.started_at)}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                    <dt className="text-xs font-medium text-muted-foreground">Qabul qilingan</dt>
                    <dd className="mt-0.5 font-mono text-xs">
                      {formatDateTimeLocal(viewDetail.received_at)}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                    <dt className="text-xs font-medium text-muted-foreground">Yaratilgan</dt>
                    <dd className="mt-0.5 font-mono text-xs">
                      {formatDateTimeLocal(viewDetail.created_at)}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                    <dt className="text-xs font-medium text-muted-foreground">Kim yaratgan</dt>
                    <dd className="mt-0.5">
                      {actorSummary(
                        viewDetail.created_by_name,
                        viewDetail.created_by_login,
                        viewDetail.created_by_user_id
                      )}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                    <dt className="text-xs font-medium text-muted-foreground">Qabul qilgan</dt>
                    <dd className="mt-0.5">
                      {actorSummary(
                        viewDetail.received_by_name,
                        viewDetail.received_by_login,
                        viewDetail.received_by_user_id
                      )}
                    </dd>
                  </div>
                </dl>

                <div>
                  <h3 className="mb-2 text-sm font-medium text-foreground">Mahsulot qatorlari</h3>
                  {viewDetail.lines.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Qatorlar yo‘q</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-border/80">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="w-10">№</TableHead>
                            <TableHead>Kod</TableHead>
                            <TableHead>Nomi</TableHead>
                            <TableHead>Partiya</TableHead>
                            <TableHead className="text-right">Miqdor</TableHead>
                            <TableHead className="text-right">Qabul</TableHead>
                            <TableHead>Izoh</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {viewDetail.lines.map((line, idx) => (
                            <TableRow key={line.id}>
                              <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                              <TableCell className="font-mono text-xs">{line.product_sku}</TableCell>
                              <TableCell className="max-w-[200px]">{line.product_name}</TableCell>
                              <TableCell className="font-mono text-xs">{line.batch_no ?? "—"}</TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {formatNumberGrouped(line.qty, { maxFractionDigits: 3 })}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {line.received_qty == null
                                  ? "—"
                                  : formatNumberGrouped(line.received_qty, { maxFractionDigits: 3 })}
                              </TableCell>
                              <TableCell className="max-w-[160px] truncate text-xs" title={line.comment ?? ""}>
                                {line.comment?.trim() ? line.comment : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-border/80 bg-muted/40 px-4 py-3">
            <Button type="button" variant="outline" onClick={() => void downloadViewPdf()} disabled={viewPdfLoading}>
              {viewPdfLoading ? "PDF…" : "PDF yuklab olish"}
            </Button>
            <Button type="button" variant="outline" onClick={closeTransferView}>
              Yopish
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="text-center py-8">Загрузка…</div>
          ) : transfers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Hech qanday ko‘chirish topilmadi
            </div>
          ) : visible.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Нет видимых столбцов. Откройте «Управление столбцами».
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {visible.map((colId) => (
                      <TableHead
                        key={colId}
                        className={cn(colId === "total_qty" && "text-right", colId === "actions" && "text-right")}
                      >
                        {COLS.find((c) => c.id === colId)?.label ?? colId}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfers.map((t) => (
                    <TableRow key={t.id}>
                      {visible.map((colId) => (
                        <TableCell
                          key={`${t.id}-${colId}`}
                          className={cn(colId === "total_qty" && "text-right", colId === "actions" && "text-right")}
                        >
                          {colId === "move_date" ? (
                            <span className="whitespace-nowrap">{formatDateDdMmYyyy(transferDisplayDate(t))}</span>
                          ) : null}
                          {colId === "source_warehouse_name" ? t.source_warehouse_name : null}
                          {colId === "destination_warehouse_name" ? t.destination_warehouse_name : null}
                          {colId === "total_qty" ? (
                            <span className="font-mono text-sm">
                              {formatNumberGrouped(t.total_qty, { maxFractionDigits: 3 })}
                            </span>
                          ) : null}
                          {colId === "created_at" ? (
                            <span className="whitespace-nowrap text-muted-foreground text-sm">
                              {formatDateDdMmYyyy(t.created_at)}
                            </span>
                          ) : null}
                          {colId === "comment" ? (
                            <span className="max-w-[200px] truncate text-sm" title={t.comment ?? ""}>
                              {t.comment?.trim() ? t.comment : "—"}
                            </span>
                          ) : null}
                          {colId === "status" ? (
                            <Badge className={statusColors[t.status]}>{statusLabels[t.status] || t.status}</Badge>
                          ) : null}
                          {colId === "actions" ? (
                            <div className="flex gap-2 justify-end flex-wrap">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                onClick={() => openTransferView(t.id)}
                              >
                                <Eye className="size-3.5 opacity-80" />
                                Ko‘rish
                              </Button>
                              {t.status === "draft" && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() =>
                                    apiFetch(`/api/${tenant}/transfers/${t.id}/start`, {
                                      method: "POST",
                                    }).then(async () => {
                                      await fetchTransfers();
                                      await reloadOpenTransferDetail(t.id);
                                    })
                                  }
                                >
                                  Boshlash
                                </Button>
                              )}
                              {t.status === "in_transit" && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() =>
                                    apiFetch(`/api/${tenant}/transfers/${t.id}/receive`, {
                                      method: "POST",
                                      body: JSON.stringify({ adjustments: [] }),
                                      headers: { "Content-Type": "application/json" },
                                    }).then(async () => {
                                      await fetchTransfers();
                                      await reloadOpenTransferDetail(t.id);
                                    })
                                  }
                                >
                                  Qabul qilish
                                </Button>
                              )}
                              {(t.status === "draft" || t.status === "in_transit") && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() =>
                                    apiFetch(`/api/${tenant}/transfers/${t.id}/cancel`, {
                                      method: "POST",
                                    }).then(async () => {
                                      await fetchTransfers();
                                      await reloadOpenTransferDetail(t.id);
                                    })
                                  }
                                >
                                  Bekor qilish
                                </Button>
                              )}
                            </div>
                          ) : null}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {total > 0 && (
            <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
              <span>
                Показано {(page - 1) * tablePrefs.pageSize + 1} – {Math.min(page * tablePrefs.pageSize, total)} / {total}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Oldingi
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * tablePrefs.pageSize >= total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Keyingi
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
