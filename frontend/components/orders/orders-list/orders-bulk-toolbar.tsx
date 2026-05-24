"use client";

import { NakladnoyExportSettingsDialog } from "@/components/orders/nakladnoy-export-settings-dialog";
import { Button } from "@/components/ui/button";
import { ORDER_STATUS_FILTER_OPTIONS } from "@/lib/order-status";
import {
  NAKLADNOY_TEMPLATE_OPTIONS,
  type NakladnoyTemplateId
} from "@/lib/order-nakladnoy";
import { formatGroupedInteger } from "@/lib/format-numbers";
import { Calculator, Download, Settings } from "lucide-react";
import type { UseOrdersListPageResult } from "./use-orders-list-page";

type OrdersBulkToolbarProps = Pick<
  UseOrdersListPageResult,
  | "tenantSlug"
  | "selectedOrderIds"
  | "bulkTargetStatus"
  | "setBulkTargetStatus"
  | "bulkFeedback"
  | "setBulkFeedback"
  | "bulkStatusMut"
  | "canBulkCatalog"
  | "bulkExpeditorChoice"
  | "setBulkExpeditorChoice"
  | "bulkExpeditorMut"
  | "bulkExpFeedback"
  | "setBulkExpFeedback"
  | "expeditorsQ"
  | "setTotalsDialogOpen"
  | "downloadsOpen"
  | "setDownloadsOpen"
  | "nakladnoyTemplate"
  | "setNakladnoyTemplate"
  | "nakladnoyPrefs"
  | "setNakladnoyPrefs"
  | "nakladnoySettingsOpen"
  | "setNakladnoySettingsOpen"
  | "nakladnoyFeedback"
  | "setNakladnoyFeedback"
  | "nakladnoyMut"
  | "clearSelection"
  | "authHydrated"
  | "paymentPrefill"
>;

export function OrdersBulkToolbar(props: OrdersBulkToolbarProps) {
  const {
    tenantSlug,
    selectedOrderIds,
    bulkTargetStatus,
    setBulkTargetStatus,
    bulkFeedback,
    setBulkFeedback,
    bulkStatusMut,
    canBulkCatalog,
    bulkExpeditorChoice,
    setBulkExpeditorChoice,
    bulkExpeditorMut,
    bulkExpFeedback,
    setBulkExpFeedback,
    expeditorsQ,
    setTotalsDialogOpen,
    downloadsOpen,
    setDownloadsOpen,
    nakladnoyTemplate,
    setNakladnoyTemplate,
    nakladnoyPrefs,
    setNakladnoyPrefs,
    nakladnoySettingsOpen,
    setNakladnoySettingsOpen,
    nakladnoyFeedback,
    setNakladnoyFeedback,
    nakladnoyMut,
    clearSelection,
    authHydrated,
    paymentPrefill
  } = props;

  if (!tenantSlug || selectedOrderIds.size === 0) return null;

  return (
    <>
      <div className="flex flex-col gap-0 rounded-lg border border-border bg-muted/50 text-sm shadow-sm">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <span className="font-medium text-foreground">
            Guruh ishlashi:{" "}
            <span className="tabular-nums">{formatGroupedInteger(selectedOrderIds.size)}</span> ta zakaz
          </span>
          <label className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Holatni o‘zgartirish</span>
            <select
              className="h-9 min-w-[11rem] rounded-md border border-input bg-background px-2 text-sm text-foreground"
              value={bulkTargetStatus}
              onChange={(e) => {
                setBulkTargetStatus(e.target.value);
                setBulkFeedback(null);
              }}
            >
              <option value="">— Holatni tanlang —</option>
              {ORDER_STATUS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={!bulkTargetStatus || bulkStatusMut.isPending}
            onClick={() => {
              setBulkFeedback(null);
              bulkStatusMut.mutate({
                order_ids: Array.from(selectedOrderIds),
                status: bulkTargetStatus
              });
            }}
          >
            Qo‘llash
          </Button>
          {canBulkCatalog ? (
            <>
              <label className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">Ekspeditor (guruh)</span>
                <select
                  className="h-9 min-w-[12rem] rounded-md border border-input bg-background px-2 text-sm"
                  value={bulkExpeditorChoice}
                  onChange={(e) => {
                    setBulkExpeditorChoice(e.target.value);
                    setBulkExpFeedback(null);
                  }}
                >
                  <option value="">— Tanlang —</option>
                  <option value="__clear__">Yechish (bo‘sh)</option>
                  {(expeditorsQ.data ?? []).map((ex) => (
                    <option key={ex.id} value={String(ex.id)}>
                      {ex.fio}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                size="sm"
                className="bg-orange-600 text-white hover:bg-orange-700"
                disabled={!bulkExpeditorChoice || bulkExpeditorMut.isPending}
                onClick={() => {
                  setBulkExpFeedback(null);
                  const v = bulkExpeditorChoice;
                  let expeditor_user_id: number | null;
                  if (v === "__clear__") {
                    expeditor_user_id = null;
                  } else {
                    const n = Number.parseInt(v, 10);
                    if (!Number.isFinite(n) || n < 1) return;
                    expeditor_user_id = n;
                  }
                  bulkExpeditorMut.mutate({
                    order_ids: Array.from(selectedOrderIds),
                    expeditor_user_id
                  });
                }}
              >
                Ekspeditorni qo‘llash
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            size="sm"
            className="bg-sky-700 text-white hover:bg-sky-800"
            onClick={() => setTotalsDialogOpen(true)}
          >
            <Calculator className="mr-1 size-4" aria-hidden />
            Itoglar
          </Button>
          {canBulkCatalog ? (
            <Button
              type="button"
              size="sm"
              className="bg-teal-700 text-white hover:bg-teal-800"
              onClick={() => {
                setDownloadsOpen((v) => !v);
                setNakladnoyFeedback(null);
              }}
              aria-expanded={downloadsOpen}
            >
              <Download className="mr-1 size-4" aria-hidden />
              Yuklashlar
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
            Tanlovni bekor qilish
          </Button>
          {bulkFeedback ? (
            <span className="w-full text-xs text-muted-foreground sm:w-auto">{bulkFeedback}</span>
          ) : null}
          {bulkExpFeedback ? (
            <span className="w-full text-xs text-muted-foreground sm:w-auto">{bulkExpFeedback}</span>
          ) : null}
        </div>

        {canBulkCatalog && downloadsOpen ? (
          <div className="space-y-3 border-t border-border/80 bg-background/60 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Excel (.xlsx): «Загруз зав.склада 5.1.8» yoki «Накладные 2.1.0». Sozlamalar (shtrix-kod,
              varaqlarga ajratish) pastdagi tishli tugma orqali — brauzerda saqlanadi.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <label className="flex min-w-[14rem] flex-col gap-1 text-xs font-medium text-muted-foreground">
                Накладные
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm font-normal text-foreground"
                  value={nakladnoyTemplate}
                  onChange={(e) => {
                    setNakladnoyTemplate(e.target.value as NakladnoyTemplateId);
                    setNakladnoyFeedback(null);
                  }}
                >
                  {NAKLADNOY_TEMPLATE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-9 w-9 shrink-0"
                title="Nakladnoy sozlamalari"
                aria-label="Nakladnoy sozlamalari"
                onClick={() => setNakladnoySettingsOpen(true)}
              >
                <Settings className="size-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-teal-700 text-white hover:bg-teal-800"
                disabled={nakladnoyMut.isPending}
                onClick={() => {
                  setNakladnoyFeedback(null);
                  nakladnoyMut.mutate({ template: nakladnoyTemplate, prefs: nakladnoyPrefs });
                }}
              >
                {nakladnoyMut.isPending ? "Tayyorlanmoqda…" : "Bitta faylda yuklab olish"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={nakladnoyMut.isPending}
                onClick={() => {
                  setNakladnoyFeedback(null);
                  nakladnoyMut.mutate({
                    template: nakladnoyTemplate,
                    prefs: nakladnoyPrefs,
                    format: "pdf"
                  });
                }}
              >
                {nakladnoyMut.isPending ? "Tayyorlanmoqda…" : "PDF yuklab olish"}
              </Button>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Joriy sozlamalar:</span>{" "}
              {nakladnoyPrefs.codeColumn === "barcode" ? "Штрих-код" : "Код (SKU)"}
              {" · "}
              {nakladnoyPrefs.separateSheets
                ? `Varaqlarga ajratish: ${
                    nakladnoyPrefs.groupBy === "territory"
                      ? "hudud"
                      : nakladnoyPrefs.groupBy === "agent"
                        ? "agent"
                        : "ekspeditor"
                  }`
                : nakladnoyTemplate === "nakladnoy_expeditor"
                  ? "Bitta varaqda barcha zakazlar (2.1.0, ustma-ust)"
                  : "Barcha zakazlar bitta jadvalda (5.1.8)"}
              {nakladnoyTemplate === "nakladnoy_expeditor" && nakladnoyPrefs.separateSheets
                ? " · 2.1.0: har guruh alohida varaq, ichida zakazlar ustma-ust"
                : null}
            </p>
            {nakladnoyFeedback ? (
              <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-foreground">
                {nakladnoyFeedback}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {tenantSlug && authHydrated ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-card/50 px-3 py-2.5 text-sm shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Moliya</span>
            <a
              href="/payments"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Barcha to‘lovlar
            </a>
          </div>
          <div className="flex flex-col items-stretch gap-1 sm:items-end">
            <a
              href={paymentPrefill.href}
              className="inline-flex h-8 items-center justify-center rounded-md border border-teal-700/60 px-3 text-sm font-medium text-teal-900 hover:bg-teal-50 dark:text-teal-100 dark:hover:bg-teal-950/50"
            >
              {selectedOrderIds.size > 0 ? "Kassaga kirim (tanlanganlar)" : "Yangi to‘lov (kassa)"}
            </a>
            {paymentPrefill.note ? (
              <span className="max-w-md text-[11px] text-muted-foreground">{paymentPrefill.note}</span>
            ) : null}
          </div>
        </div>
      ) : null}

      <NakladnoyExportSettingsDialog
        open={nakladnoySettingsOpen}
        onOpenChange={setNakladnoySettingsOpen}
        prefs={nakladnoyPrefs}
        onSave={setNakladnoyPrefs}
      />
    </>
  );
}
