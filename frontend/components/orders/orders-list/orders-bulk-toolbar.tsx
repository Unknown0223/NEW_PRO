"use client";

import { BulkToolbarDropdownPortal } from "@/components/orders/orders-list/bulk-toolbar-dropdown-portal";
import { OrdersBulkConsignmentDialog } from "@/components/orders/orders-list/orders-bulk-consignment-dialog";
import { OrdersBulkExpeditorDialog } from "@/components/orders/orders-list/orders-bulk-expeditor-dialog";
import { OrdersBulkStatusDialog } from "@/components/orders/orders-list/orders-bulk-status-dialog";
import { OrdersNakladnoyPreviewModal } from "@/components/orders/orders-list/orders-nakladnoy-preview-modal";
import { OrdersBulkDownloadModal } from "@/components/orders/orders-list/orders-bulk-download-modal";
import { OrdersBulkUploadPanel } from "@/components/orders/orders-list/orders-bulk-upload-panel";
import { downloadBulkExportSelection } from "@/lib/bulk-export-download";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import type { BulkExportTemplateDef } from "@/lib/bulk-export-templates";
import {
  bulkExportTemplateKey,
  getAllVisibleTemplates,
  loadBulkExportPrefsStore,
  resolveNakladnoyPrefsForDownload,
  resolveWarehouseExportApiBody,
  type BulkExportPrefsStore
} from "@/lib/bulk-export-template-prefs";
import { downloadExpeditorLoadingLayoutXlsx } from "@/lib/expeditor-loading-download";
import type { NakladnoyPreviewResponse } from "@/lib/nakladnoy-preview";
import { downloadOrdersNakladnoyXlsx, saveNakladnoyExportPrefs } from "@/lib/order-nakladnoy";
import { downloadStyledXlsxSheet } from "@/lib/download-xlsx-styled";
import { formatGroupedInteger } from "@/lib/format-numbers";
import {
  ORDER_LIST_COLUMNS,
  orderListExportCell
} from "@/lib/orders-list-columns";
import { canPickBulkTargetStatus } from "@/lib/order-status-transitions";
import { usePermissions } from "@/lib/use-permissions";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  FileBarChart,
  FileText,
  Gift,
  Truck,
  Upload,
  Wallet,
  X
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useBulkBonusGiftPicker } from "@/components/orders/orders-list/orders-bulk-bonus-gift-flow";
import { isBulkConsignmentEligible } from "./types";
import type { UseOrdersListPageResult } from "./use-orders-list-page";

type OrdersBulkToolbarProps = Pick<
  UseOrdersListPageResult,
  | "tenantSlug"
  | "selectedOrderIds"
  | "selectedRows"
  | "tablePrefs"
  | "bulkFeedback"
  | "setBulkFeedback"
  | "bulkStatusMut"
  | "bulkExpeditorMut"
  | "bulkExpFeedback"
  | "setBulkExpFeedback"
  | "bulkConsignmentMut"
  | "bulkConsignmentFeedback"
  | "bulkBonusRefreshMut"
  | "bulkBonusRefreshFeedback"
  | "setBulkBonusRefreshFeedback"
  | "canBulkCatalog"
  | "totalsPanelOpen"
  | "setTotalsPanelOpen"
  | "nakladnoyTemplate"
  | "setNakladnoyTemplate"
  | "nakladnoyPrefs"
  | "setNakladnoyPrefs"
  | "nakladnoyMut"
  | "nakladnoyFeedback"
  | "setNakladnoyFeedback"
  | "clearSelection"
  | "authHydrated"
  | "paymentPrefill"
  | "expeditorsQ"
>;

const toolbarBtn =
  "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-muted disabled:opacity-50 dark:border-input dark:bg-background dark:text-foreground dark:hover:bg-muted/50";

/** Pastki panel — shablon dropdown (API status kodlari) */
const BULK_STATUS_QUICK = [
  { value: "new", label: "Новый", color: "#0369a1", dot: "#7dd3fc" },
  { value: "confirmed", label: "Подтвержден к отгрузке", color: "#854d0e", dot: "#fde047" },
  { value: "picking", label: "Комплектация", color: "#3730a3", dot: "#a5b4fc" },
  { value: "delivering", label: "Отгружен", color: "#9a3412", dot: "#fdba74" },
  { value: "delivered", label: "Доставлен", color: "#166534", dot: "#86efac" },
  { value: "cancelled", label: "Отменен", color: "#4b5563", dot: "#d1d5db" }
] as const;

/** Backend `ORDER_LINES_EDITABLE_STATUSES` — ekspeditor faqat shu statuslarda biriktiriladi. */
const EXPEDITOR_ASSIGNABLE_STATUSES = new Set(["new", "confirmed"]);

type ViewMode = "main" | "upload";

export function OrdersBulkToolbar(props: OrdersBulkToolbarProps) {
  const { confirm, dialog: confirmDialog } = useAppConfirm();
  const {
    tenantSlug,
    selectedOrderIds,
    selectedRows,
    tablePrefs,
    bulkFeedback,
    setBulkFeedback,
    bulkStatusMut,
    bulkExpeditorMut,
    bulkExpFeedback,
    setBulkExpFeedback,
    bulkConsignmentMut,
    bulkConsignmentFeedback,
    bulkBonusRefreshMut,
    bulkBonusRefreshFeedback,
    setBulkBonusRefreshFeedback,
    canBulkCatalog,
    setTotalsPanelOpen,
    nakladnoyPrefs,
    setNakladnoyPrefs,
    nakladnoyMut,
    nakladnoyFeedback,
    setNakladnoyFeedback,
    setNakladnoyTemplate,
    clearSelection,
    authHydrated,
    paymentPrefill,
    expeditorsQ
  } = props;

  const bonusPicker = useBulkBonusGiftPicker(tenantSlug);
  const { has } = usePermissions();
  const bulkStatusOptions = useMemo(
    () => BULK_STATUS_QUICK.filter((s) => canPickBulkTargetStatus(s.value, has)),
    [has]
  );

  const [viewMode, setViewMode] = useState<ViewMode>("main");
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusDialogStatus, setStatusDialogStatus] = useState("");
  const [expeditorDialogOpen, setExpeditorDialogOpen] = useState(false);
  const [consignmentOpen, setConsignmentOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<BulkExportTemplateDef | null>(null);
  const [previewPrefs, setPreviewPrefs] = useState(nakladnoyPrefs);
  const [previewWarehouseExport, setPreviewWarehouseExport] = useState<
    Record<string, boolean> | undefined
  >(undefined);
  const [previewInitial, setPreviewInitial] = useState<NakladnoyPreviewResponse | null>(null);
  const [previewDownloading, setPreviewDownloading] = useState(false);
  const [bulkDownloadOpen, setBulkDownloadOpen] = useState(false);
  const [bulkDownloadPending, setBulkDownloadPending] = useState(false);
  const [bulkDownloadError, setBulkDownloadError] = useState<string | null>(null);
  const [bulkPrefsStore, setBulkPrefsStore] = useState<BulkExportPrefsStore>(() =>
    loadBulkExportPrefsStore()
  );
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  const consignmentEligibleIds = useMemo(
    () => selectedRows.filter(isBulkConsignmentEligible).map((o) => o.id),
    [selectedRows]
  );

  const newStatusOrderIds = useMemo(
    () => selectedRows.filter((o) => o.status === "new").map((o) => o.id),
    [selectedRows]
  );

  const expeditorAssignableOrderIds = useMemo(
    () =>
      selectedRows
        .filter((o) => EXPEDITOR_ASSIGNABLE_STATUSES.has(o.status))
        .map((o) => o.id),
    [selectedRows]
  );

  useEffect(() => {
    if (selectedOrderIds.size === 0) {
      setViewMode("main");
      setStatusOpen(false);
    }
  }, [selectedOrderIds.size]);

  const showingExpeditorFeedback = bulkFeedback == null && bulkExpFeedback != null;
  const feedbackTone: "error" | "success" | "neutral" = !showingExpeditorFeedback
    ? "neutral"
    : bulkExpeditorMut.isError || (bulkExpeditorMut.data?.failed.length ?? 0) > 0
      ? "error"
      : bulkExpeditorMut.isSuccess
        ? "success"
        : "neutral";

  useEffect(() => {
    if (feedbackTone !== "success") return;
    const t = window.setTimeout(() => setBulkExpFeedback(null), 5000);
    return () => window.clearTimeout(t);
  }, [feedbackTone, bulkExpFeedback, setBulkExpFeedback]);

  const hasSelection = Boolean(tenantSlug) && selectedOrderIds.size > 0;

  if (!hasSelection) return null;

  const count = selectedOrderIds.size;
  const ids = Array.from(selectedOrderIds);
  const feedback =
    bulkFeedback ??
    bulkExpFeedback ??
    bulkConsignmentFeedback ??
    bulkBonusRefreshFeedback ??
    nakladnoyFeedback;

  const exportSelectedExcel = () => {
    const order = tablePrefs.visibleColumnOrder;
    const headers = order.map((id) => ORDER_LIST_COLUMNS.find((c) => c.id === id)?.label ?? id);
    const dataRows = selectedRows.map((o) => order.map((colId) => orderListExportCell(o, colId)));
    void downloadStyledXlsxSheet(
      `zakazlar_tanlangan_${new Date().toISOString().slice(0, 10)}.xlsx`,
      "Заказы",
      headers,
      dataRows
    );
    setBulkFeedback("Excel: выбранные заказы загружены.");
  };

  const buildRegisterPreview = (template: BulkExportTemplateDef): NakladnoyPreviewResponse => {
    const order = tablePrefs.visibleColumnOrder;
    const headers = order.map((id) => ORDER_LIST_COLUMNS.find((c) => c.id === id)?.label ?? id);
    const dataRows = selectedRows.map((o) => order.map((colId) => orderListExportCell(o, colId)));
    const day = new Date().toISOString().slice(0, 10);
    return {
      label: template.label,
      filename: `zakazlar_tanlangan_${day}.xlsx`,
      pages: [
        {
          sheetName: "Реестр",
          kind: "grid",
          grid: {
            colCount: headers.length,
            rows: [
              headers.map((h) => ({
                v: h,
                bold: true,
                bg: "#d9d9d9",
                align: "left" as const
              })),
              ...dataRows.map((row) =>
                row.map((cell) => {
                  const raw = cell ?? "";
                  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/\s/g, ""));
                  const v =
                    Number.isFinite(n) && String(raw).match(/^-?[\d\s.,]+$/)
                      ? new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n)
                      : String(raw);
                  return { v, align: "left" as const };
                })
              )
            ]
          }
        }
      ]
    };
  };

  const openTemplatePreview = (template: BulkExportTemplateDef) => {
    setNakladnoyFeedback(null);
    if (template.downloadKind === "register") {
      setPreviewInitial(buildRegisterPreview(template));
      setPreviewPrefs(nakladnoyPrefs);
      setPreviewTemplate(template);
      setPreviewOpen(true);
      setBulkFeedback(`Просмотр: ${template.label}`);
      return;
    }
    if (!canBulkCatalog || !template.apiTemplate) {
      setBulkFeedback("Недостаточно прав для загрузки накладных.");
      return;
    }
    setNakladnoyTemplate(template.apiTemplate);
    const prefsStore = loadBulkExportPrefsStore();
    const mergedPrefs = resolveNakladnoyPrefsForDownload(prefsStore, template, nakladnoyPrefs);
    setPreviewInitial(null);
    setPreviewPrefs(mergedPrefs);
    setPreviewWarehouseExport(resolveWarehouseExportApiBody(prefsStore, template));
    setPreviewTemplate(template);
    setPreviewOpen(true);
    setBulkFeedback(`Просмотр: ${template.label}`);
  };

  const downloadTemplate = (template: BulkExportTemplateDef) => {
    openTemplatePreview(template);
  };

  const openBulkDownloadModal = () => {
    const store = loadBulkExportPrefsStore();
    const visible = getAllVisibleTemplates(store);
    if (visible.length === 0) {
      setBulkFeedback("Нет выбранных шаблонов. Включите отчёты в настройках чипов.");
      return;
    }
    if (!canBulkCatalog && visible.some((t) => t.downloadKind === "nakladnoy")) {
      setBulkFeedback("Недостаточно прав для загрузки накладных.");
      return;
    }
    setNakladnoyFeedback(null);
    setBulkPrefsStore(store);
    setBulkDownloadError(null);
    setBulkDownloadOpen(true);
  };

  const downloadBulkSelection = async (selectedKeys: Set<string>) => {
    const store = bulkPrefsStore;
    const items = getAllVisibleTemplates(store)
      .filter((t) => selectedKeys.has(bulkExportTemplateKey(t)))
      .map((template) => ({
          template,
          prefs: resolveNakladnoyPrefsForDownload(store, template, nakladnoyPrefs),
        warehouseExportOptions: resolveWarehouseExportApiBody(store, template)
      }));

    const needsApi = items.some((i) => i.template.downloadKind === "nakladnoy");
    if (needsApi && !tenantSlug) {
      setBulkFeedback("Не удалось скачать: организация не определена.");
      return;
    }
    if (needsApi && !canBulkCatalog) {
      setBulkFeedback("Недостаточно прав для загрузки накладных.");
      return;
    }

    const order = tablePrefs.visibleColumnOrder;
    const headers = order.map((id) => ORDER_LIST_COLUMNS.find((c) => c.id === id)?.label ?? id);
    const dataRows = selectedRows.map((o) => order.map((colId) => orderListExportCell(o, colId)));

    setBulkDownloadPending(true);
    setBulkDownloadError(null);
    setNakladnoyFeedback(null);
    setBulkFeedback(null);
    try {
      await downloadBulkExportSelection({
        tenantSlug: tenantSlug ?? "",
        orderIds: ids,
        items,
        registerSheet: { headers, rows: dataRows }
      });
      setBulkDownloadOpen(false);
      setBulkFeedback(`Скачано: ${items.length} отчёт(ов).`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Не удалось скачать.";
      setBulkDownloadError(msg);
      setNakladnoyFeedback(msg);
      setBulkFeedback(msg);
    } finally {
      setBulkDownloadPending(false);
    }
  };

  const handleClose = () => {
    setViewMode("main");
    setStatusOpen(false);
    clearSelection();
  };

  const openStatusDatetime = (status: string) => {
    setStatusOpen(false);
    setStatusDialogStatus(status);
    setStatusDialogOpen(true);
  };

  const barShell = (children: ReactNode) => (
    <div className="animate-expand flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1.5 rounded-xl border border-border bg-card px-3 py-2 shadow-2xl dark:border-border dark:bg-card">
      {children}
    </div>
  );

  const downloadFromPreview = async (fallbackFilename?: string) => {
    if (!previewTemplate) return;
    setNakladnoyFeedback(null);
    setPreviewDownloading(true);
    setBulkFeedback(`Загрузка: ${previewTemplate.label}…`);
    try {
      if (previewTemplate.downloadKind === "register") {
        exportSelectedExcel();
      } else if (!tenantSlug || !previewTemplate.apiTemplate) {
        throw new Error("Не удалось скачать.");
      } else if (previewTemplate.expeditorLoadingLayout) {
        await downloadExpeditorLoadingLayoutXlsx({
          tenantSlug,
          orderIds: Array.from(selectedOrderIds),
          layout: previewTemplate.expeditorLoadingLayout,
          prefs: previewPrefs,
          fallbackFilename
        });
      } else {
        await downloadOrdersNakladnoyXlsx({
          tenantSlug,
          orderIds: Array.from(selectedOrderIds),
          template: previewTemplate.apiTemplate,
          prefs: previewPrefs,
          format: "xlsx",
          warehouseLayout: previewTemplate.warehouseLayout,
          expeditorLoadingLayout: previewTemplate.expeditorLoadingLayout,
          warehouseExportOptions: previewWarehouseExport,
          fallbackFilename
        });
      }
      setNakladnoyFeedback("Файл Excel скачан.");
      setBulkFeedback(`Скачано: ${previewTemplate.label}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Не удалось скачать Excel.";
      setNakladnoyFeedback(msg);
      setBulkFeedback(msg);
    } finally {
      setPreviewDownloading(false);
    }
  };

  const uploadView = (
    <>
      <OrdersBulkUploadPanel
        disabled={nakladnoyMut.isPending || previewDownloading || bulkDownloadPending}
        canBulkCatalog={canBulkCatalog}
        separateSheets={nakladnoyPrefs.separateSheets}
        onSeparateSheetsChange={(v) => {
          const next = { ...nakladnoyPrefs, separateSheets: v };
          setNakladnoyPrefs(next);
          saveNakladnoyExportPrefs(next);
        }}
        onDownloadOneFile={openBulkDownloadModal}
        onDownloadTemplate={downloadTemplate}
        onBack={() => setViewMode("main")}
        onClose={handleClose}
      />
      <OrdersBulkDownloadModal
        open={bulkDownloadOpen}
        onOpenChange={setBulkDownloadOpen}
        prefsStore={bulkPrefsStore}
        pending={bulkDownloadPending}
        errorMessage={bulkDownloadError}
        onDownload={downloadBulkSelection}
      />

      {tenantSlug || previewTemplate?.downloadKind === "register" ? (
        <OrdersNakladnoyPreviewModal
          open={previewOpen}
          onOpenChange={(open) => {
            setPreviewOpen(open);
            if (!open) setPreviewInitial(null);
          }}
          tenantSlug={tenantSlug ?? ""}
          orderIds={ids}
          template={previewTemplate}
          prefs={previewPrefs}
          warehouseExportOptions={previewWarehouseExport}
          initialPreview={previewInitial}
          onDownload={downloadFromPreview}
          downloadPending={previewDownloading || nakladnoyMut.isPending}
        />
      ) : null}
    </>
  );

  const mainView = barShell(
    <>
      <div className="shrink-0 border-r border-border px-3 py-1.5 text-sm font-medium text-gray-700 dark:border-border dark:text-foreground">
        Выбрано:{" "}
        <span className="text-base font-bold text-teal-700 tabular-nums dark:text-teal-400">
          {formatGroupedInteger(count)}
        </span>
      </div>

      {bulkStatusOptions.length > 0 ? (
      <div className="relative shrink-0" ref={statusDropdownRef}>
        <button
          type="button"
          disabled={bulkStatusMut.isPending}
          onClick={() => setStatusOpen((v) => !v)}
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#22c55e] px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-600 disabled:opacity-60"
        >
          Изменить статус
          <ChevronDown
            className={cn("size-3.5 transition-transform", statusOpen && "rotate-180")}
            aria-hidden
          />
        </button>
        <BulkToolbarDropdownPortal
          open={statusOpen}
          anchorRef={statusDropdownRef}
          onClose={() => setStatusOpen(false)}
          minWidth={220}
        >
          {bulkStatusOptions.map((s) => (
            <button
              key={s.value}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
              style={{ color: s.color }}
              onClick={() => openStatusDatetime(s.value)}
              role="menuitem"
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: s.dot }}
                aria-hidden
              />
              {s.label}
            </button>
          ))}
        </BulkToolbarDropdownPortal>
      </div>
      ) : null}

      {expeditorAssignableOrderIds.length > 0 && has("orders.zakaz.assign") ? (
        <button
          type="button"
          className={toolbarBtn}
          disabled={bulkExpeditorMut.isPending}
          title="Назначается только заказам в статусе «Новый» / «Подтверждён»"
          onClick={() => setExpeditorDialogOpen(true)}
        >
          <Truck className="size-4 shrink-0 text-gray-500 dark:text-muted-foreground" aria-hidden />
          Доставщик
        </button>
      ) : null}

      <button type="button" className={toolbarBtn} onClick={() => setTotalsPanelOpen(true)}>
        <FileBarChart className="size-4 shrink-0 text-gray-500 dark:text-muted-foreground" aria-hidden />
        Итог по заказу
      </button>

      {has("orders.drugie_operacii.update") ? (
      <button
        type="button"
        className={toolbarBtn}
        disabled={bulkConsignmentMut.isPending}
        onClick={() => setConsignmentOpen(true)}
      >
        <FileText className="size-4 shrink-0 text-gray-500 dark:text-muted-foreground" aria-hidden />
        Консигнация
      </button>
      ) : null}

      {newStatusOrderIds.length > 0 && has("orders.zakaz.update") ? (
      <button
        type="button"
        className={toolbarBtn}
        disabled={bulkBonusRefreshMut.isPending || bonusPicker.busy}
        title={
          newStatusOrderIds.length === 1
            ? "Пересчитать бонус и выбрать подарок"
            : "Пересчитать бонус по новому механизму в выбранных заказах «Новый»"
        }
        onClick={async () => {
          setBulkFeedback(null);
          setBulkExpFeedback(null);
          setBulkBonusRefreshFeedback(null);
          if (newStatusOrderIds.length === 1) {
            await bonusPicker.start(newStatusOrderIds[0]!);
            return;
          }
          const ok = await confirm({
            title: "Обновление бонуса",
            message: `В ${newStatusOrderIds.length} заказ(ах) «Новый» бонус будет пересчитан автоматически. Если выбрать один заказ — подарок можно выбрать в окне.`,
            confirmLabel: "Обновить бонус",
            cancelLabel: "Отмена",
            destructive: false
          });
          if (!ok) return;
          bulkBonusRefreshMut.mutate({ order_ids: newStatusOrderIds });
        }}
      >
        <Gift className="size-4 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
        {bulkBonusRefreshMut.isPending || bonusPicker.busy ? "Обновление…" : "Обновление бонуса"}
      </button>
      ) : null}

      {has("orders.zakaz.copy") ? (
      <button
        type="button"
        className={toolbarBtn}
        onClick={() => {
          setNakladnoyFeedback(null);
          setViewMode("upload");
        }}
      >
        <Upload className="size-4 shrink-0 text-gray-500 dark:text-muted-foreground" aria-hidden />
        Загрузка
      </button>
      ) : null}

      {authHydrated && !paymentPrefill.disabled && has("cash.oplaty_klientov.create") ? (
          <Link
            href={paymentPrefill.href}
            className={cn(
              toolbarBtn,
              "border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300 dark:hover:bg-teal-950/60"
            )}
          >
            <Wallet className="size-4 shrink-0" aria-hidden />
            Приход в кассу
          </Link>
      ) : null}

      <button
        type="button"
        className="ml-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-muted hover:text-gray-700 dark:hover:bg-muted"
        title="Закрыть"
        onClick={handleClose}
      >
        <X className="size-4" aria-hidden />
      </button>
    </>
  );

  const floatingBar = (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[100] flex justify-center px-2 sm:px-3 md:left-[15.5rem]">
      <div className="pointer-events-auto flex w-full max-w-[min(100vw-1rem,90rem)] flex-col items-center gap-2">
        {feedback && (!bulkDownloadOpen || bulkDownloadError) ? (
          <p
            role={feedbackTone === "error" ? "alert" : "status"}
            className={cn(
              "max-w-lg rounded-lg border px-3 py-1.5 text-center text-xs shadow-lg",
              feedbackTone === "error" &&
                "border-red-200 bg-red-50 font-medium text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200",
              feedbackTone === "success" &&
                "border-emerald-200 bg-emerald-50 font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200",
              feedbackTone === "neutral" && "border-border bg-card text-muted-foreground"
            )}
          >
            {feedback}
          </p>
        ) : null}
        {paymentPrefill.note && !paymentPrefill.disabled && !bulkDownloadOpen ? (
          <p className="max-w-lg rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-1.5 text-center text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
            {paymentPrefill.note}
          </p>
        ) : null}
        {viewMode === "upload" ? uploadView : mainView}
      </div>
    </div>
  );

  return (
    <>
      {typeof document !== "undefined" ? createPortal(floatingBar, document.body) : null}

      <OrdersBulkStatusDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        selectedCount={count}
        isPending={bulkStatusMut.isPending}
        status={statusDialogStatus}
        onApply={(status, occurredAtIso) => {
          setBulkFeedback(null);
          bulkStatusMut.mutate({
            order_ids: ids,
            status,
            occurred_at: occurredAtIso
          });
          setStatusDialogOpen(false);
        }}
      />

      <OrdersBulkExpeditorDialog
        open={expeditorDialogOpen}
        onOpenChange={setExpeditorDialogOpen}
        selectedCount={expeditorAssignableOrderIds.length}
        expeditors={expeditorsQ.data ?? []}
        isLoadingExpeditors={expeditorsQ.isLoading}
        isPending={bulkExpeditorMut.isPending}
        onAttach={(expeditorUserId) => {
          setBulkExpFeedback(null);
          const ex = (expeditorsQ.data ?? []).find((e) => e.id === expeditorUserId);
          bulkExpeditorMut.mutate(
            {
              order_ids: expeditorAssignableOrderIds,
              expeditor_user_id: expeditorUserId,
              expeditor_label: ex?.fio ?? null
            },
            { onSuccess: () => setExpeditorDialogOpen(false) }
          );
        }}
        onDetach={() => {
          void (async () => {
            const ok = await confirm({
              title: "Открепить",
              message: `Открепить доставщика у ${formatGroupedInteger(expeditorAssignableOrderIds.length)} заказ(ов)?`,
              confirmLabel: "Да",
              cancelLabel: "Нет",
              destructive: true
            });
            if (!ok) return;
            setBulkExpFeedback(null);
            bulkExpeditorMut.mutate(
              { order_ids: expeditorAssignableOrderIds, expeditor_user_id: null },
              { onSuccess: () => setExpeditorDialogOpen(false) }
            );
          })();
        }}
      />

      <OrdersBulkConsignmentDialog
        open={consignmentOpen}
        onOpenChange={setConsignmentOpen}
        selectedCount={count}
        eligibleCount={consignmentEligibleIds.length}
        isPending={bulkConsignmentMut.isPending}
        onApply={(payload) => {
          bulkConsignmentMut.mutate(
            {
              order_ids: consignmentEligibleIds,
              is_consignment: payload.is_consignment,
              consignment_due_date: payload.consignment_due_date,
              conditions_note: payload.conditions_note ?? null,
              skipped_ineligible: count - consignmentEligibleIds.length
            },
            { onSuccess: () => setConsignmentOpen(false) }
          );
        }}
      />
      {bonusPicker.modal}
      {confirmDialog}
    </>
  );
}
