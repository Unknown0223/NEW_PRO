"use client";

import { BulkToolbarDropdownPortal } from "@/components/orders/orders-list/bulk-toolbar-dropdown-portal";
import { OrdersBulkConsignmentDialog } from "@/components/orders/orders-list/orders-bulk-consignment-dialog";
import { OrdersBulkExpeditorDialog } from "@/components/orders/orders-list/orders-bulk-expeditor-dialog";
import { OrdersBulkStatusDialog } from "@/components/orders/orders-list/orders-bulk-status-dialog";
import { OrdersBulkUploadPanel } from "@/components/orders/orders-list/orders-bulk-upload-panel";
import type { BulkExportTemplateDef } from "@/lib/bulk-export-templates";
import {
  loadBulkExportPrefsStore,
  resolveNakladnoyPrefsForDownload
} from "@/lib/bulk-export-template-prefs";
import { saveNakladnoyExportPrefs } from "@/lib/order-nakladnoy";
import { downloadStyledXlsxSheet } from "@/lib/download-xlsx-styled";
import { formatGroupedInteger } from "@/lib/format-numbers";
import {
  ORDER_LIST_COLUMNS,
  orderListExportCell
} from "@/lib/orders-list-columns";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  FileBarChart,
  FileText,
  Truck,
  Upload,
  Wallet,
  X
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
  "flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-input dark:bg-background dark:text-foreground dark:hover:bg-muted/50";

/** Pastki panel — shablon dropdown (API status kodlari) */
const BULK_STATUS_QUICK = [
  { value: "new", label: "Новый", color: "#0369a1", dot: "#7dd3fc" },
  { value: "confirmed", label: "Подтвержден к отгрузке", color: "#854d0e", dot: "#fde047" },
  { value: "delivering", label: "Отгружен", color: "#9a3412", dot: "#fdba74" },
  { value: "delivered", label: "Доставлен", color: "#166534", dot: "#86efac" },
  { value: "cancelled", label: "Отменен", color: "#4b5563", dot: "#d1d5db" }
] as const;

type ViewMode = "main" | "upload";

export function OrdersBulkToolbar(props: OrdersBulkToolbarProps) {
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

  const [viewMode, setViewMode] = useState<ViewMode>("main");
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusDialogInitial, setStatusDialogInitial] = useState<{
    status: string;
    step: "status" | "datetime";
  }>({ status: "", step: "status" });
  const [expeditorDialogOpen, setExpeditorDialogOpen] = useState(false);
  const [consignmentOpen, setConsignmentOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  const consignmentEligibleIds = useMemo(
    () => selectedRows.filter(isBulkConsignmentEligible).map((o) => o.id),
    [selectedRows]
  );

  useEffect(() => {
    if (selectedOrderIds.size === 0) {
      setViewMode("main");
      setStatusOpen(false);
    }
  }, [selectedOrderIds.size]);

  const hasSelection = Boolean(tenantSlug) && selectedOrderIds.size > 0;

  if (!hasSelection) return null;

  const count = selectedOrderIds.size;
  const ids = Array.from(selectedOrderIds);
  const feedback =
    bulkFeedback ?? bulkExpFeedback ?? bulkConsignmentFeedback ?? nakladnoyFeedback;

  const exportSelectedExcel = () => {
    const order = tablePrefs.visibleColumnOrder;
    const headers = order.map((id) => ORDER_LIST_COLUMNS.find((c) => c.id === id)?.label ?? id);
    const dataRows = selectedRows.map((o) => order.map((colId) => orderListExportCell(o, colId)));
    void downloadStyledXlsxSheet(
      `zakazlar_tanlangan_${new Date().toISOString().slice(0, 10)}.xlsx`,
      "Zakazlar",
      headers,
      dataRows
    );
    setBulkFeedback("Excel: выбранные заказы загружены.");
  };

  const downloadTemplate = (template: BulkExportTemplateDef) => {
    setNakladnoyFeedback(null);
    if (template.downloadKind === "register") {
      exportSelectedExcel();
      setBulkFeedback(`Скачано: ${template.label}`);
      return;
    }
    if (!canBulkCatalog || !template.apiTemplate) {
      setBulkFeedback("Недостаточно прав для загрузки накладных.");
      return;
    }
    setNakladnoyTemplate(template.apiTemplate);
    const prefsStore = loadBulkExportPrefsStore();
    const mergedPrefs = resolveNakladnoyPrefsForDownload(prefsStore, template, nakladnoyPrefs);
    nakladnoyMut.mutate({
      template: template.apiTemplate,
      prefs: mergedPrefs,
      format: "xlsx",
      warehouseLayout: template.warehouseLayout
    });
    setBulkFeedback(`Загрузка: ${template.label}…`);
  };

  const downloadOneFile = () => {
    if (!canBulkCatalog) {
      setBulkFeedback("Недостаточно прав для загрузки.");
      return;
    }
    setNakladnoyFeedback(null);
    setNakladnoyTemplate("nakladnoy_warehouse");
    nakladnoyMut.mutate({
      template: "nakladnoy_warehouse",
      prefs: nakladnoyPrefs,
      format: "xlsx"
    });
    setBulkFeedback("Загрузка одним файлом…");
  };

  const handleClose = () => {
    setViewMode("main");
    setStatusOpen(false);
    clearSelection();
  };

  const openStatusDatetime = (status: string) => {
    setStatusOpen(false);
    setStatusDialogInitial({ status, step: "datetime" });
    setStatusDialogOpen(true);
  };

  const barShell = (children: ReactNode) => (
    <div className="animate-expand flex max-w-[min(100vw-1rem,72rem)] flex-nowrap items-center gap-2 overflow-x-auto overflow-y-visible rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-2xl [overflow-y:visible] scrollbar-none dark:border-border dark:bg-card">
      {children}
    </div>
  );

  const uploadView = (
    <OrdersBulkUploadPanel
      disabled={nakladnoyMut.isPending}
      canBulkCatalog={canBulkCatalog}
      separateSheets={nakladnoyPrefs.separateSheets}
      onSeparateSheetsChange={(v) => {
        const next = { ...nakladnoyPrefs, separateSheets: v };
        setNakladnoyPrefs(next);
        saveNakladnoyExportPrefs(next);
      }}
      onDownloadOneFile={downloadOneFile}
      onDownloadTemplate={downloadTemplate}
      onBack={() => setViewMode("main")}
      onClose={handleClose}
    />
  );

  const mainView = barShell(
    <>
      <div className="shrink-0 border-r border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 dark:border-border dark:text-foreground">
        Выбрано:{" "}
        <span className="text-base font-bold text-teal-700 tabular-nums dark:text-teal-400">
          {formatGroupedInteger(count)}
        </span>
      </div>

      <div className="relative shrink-0" ref={statusDropdownRef}>
        <button
          type="button"
          disabled={bulkStatusMut.isPending}
          onClick={() => setStatusOpen((v) => !v)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-600 disabled:opacity-60"
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
          {BULK_STATUS_QUICK.map((s) => (
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
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted"
            role="menuitem"
            onClick={() => {
              setStatusOpen(false);
              setStatusDialogInitial({ status: "", step: "status" });
              setStatusDialogOpen(true);
            }}
          >
            Все статусы…
          </button>
        </BulkToolbarDropdownPortal>
      </div>

      <button
        type="button"
        className={toolbarBtn}
        disabled={bulkExpeditorMut.isPending}
        onClick={() => setExpeditorDialogOpen(true)}
      >
        <Truck className="size-4 shrink-0 text-gray-500 dark:text-muted-foreground" aria-hidden />
        Доставщик
      </button>

      <button type="button" className={toolbarBtn} onClick={() => setTotalsPanelOpen(true)}>
        <FileBarChart className="size-4 shrink-0 text-gray-500 dark:text-muted-foreground" aria-hidden />
        Итог по заказу
      </button>

      <button
        type="button"
        className={toolbarBtn}
        disabled={bulkConsignmentMut.isPending}
        onClick={() => setConsignmentOpen(true)}
      >
        <FileText className="size-4 shrink-0 text-gray-500 dark:text-muted-foreground" aria-hidden />
        Консигнация
      </button>

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

      {authHydrated ? (
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
        className="ml-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-muted"
        title="Закрыть"
        onClick={handleClose}
      >
        <X className="size-4" aria-hidden />
      </button>
    </>
  );

  const floatingBar = (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[100] flex justify-center px-2 sm:px-3">
      <div className="pointer-events-auto flex w-full max-w-[min(100vw-1rem,90rem)] flex-col items-center gap-2">
        {feedback ? (
          <p className="max-w-lg rounded-lg border border-border bg-card px-3 py-1.5 text-center text-xs text-muted-foreground shadow-lg">
            {feedback}
          </p>
        ) : null}
        {paymentPrefill.note ? (
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
        initialStatus={statusDialogInitial.status}
        initialStep={statusDialogInitial.step}
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
        selectedCount={count}
        expeditors={expeditorsQ.data ?? []}
        isLoadingExpeditors={expeditorsQ.isLoading}
        isPending={bulkExpeditorMut.isPending}
        onAttach={(expeditorUserId) => {
          setBulkExpFeedback(null);
          bulkExpeditorMut.mutate(
            { order_ids: ids, expeditor_user_id: expeditorUserId },
            { onSuccess: () => setExpeditorDialogOpen(false) }
          );
        }}
        onDetach={() => {
          if (!window.confirm(`Открепить доставщика у ${formatGroupedInteger(count)} заказ(ов)?`)) {
            return;
          }
          setBulkExpFeedback(null);
          bulkExpeditorMut.mutate(
            { order_ids: ids, expeditor_user_id: null },
            { onSuccess: () => setExpeditorDialogOpen(false) }
          );
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
              skipped_ineligible: count - consignmentEligibleIds.length
            },
            { onSuccess: () => setConsignmentOpen(false) }
          );
        }}
      />
    </>
  );
}
