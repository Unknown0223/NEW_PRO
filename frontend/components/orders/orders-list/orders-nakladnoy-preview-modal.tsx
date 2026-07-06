"use client";

import { DialogHeaderActions } from "@/components/ui/dialog-header-actions";
import { NakladnoyPreviewPrintView } from "@/components/orders/orders-list/nakladnoy-preview-print-view";
import { NakladnoyPreviewGrid } from "@/components/orders/orders-list/nakladnoy-preview-grid";
import { NakladnoyPreview520Body } from "@/components/orders/orders-list/nakladnoy-preview-520-body";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import type { BulkExportTemplateDef } from "@/lib/bulk-export-templates";
import {
  fetchNakladnoyPreview,
  type NakladnoyPreviewResponse
} from "@/lib/nakladnoy-preview";
import type { NakladnoyExportPrefs } from "@/lib/order-nakladnoy";
import { ChevronLeft, ChevronRight, Download, Loader2, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantSlug: string;
  orderIds: number[];
  template: BulkExportTemplateDef | null;
  prefs: NakladnoyExportPrefs;
  warehouseExportOptions?: Record<string, boolean>;
  /** Реестр — serverdan emas, klientda tayyorlangan */
  initialPreview?: NakladnoyPreviewResponse | null;
  onDownload: (filename?: string) => void | Promise<void>;
  downloadPending?: boolean;
};

export function OrdersNakladnoyPreviewModal({
  open,
  onOpenChange,
  tenantSlug,
  orderIds,
  template,
  prefs,
  warehouseExportOptions,
  initialPreview,
  onDownload,
  downloadPending
}: Props) {
  const [preview, setPreview] = useState<NakladnoyPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!open || !template) return;

    if (initialPreview) {
      setPreview(initialPreview);
      setLoading(false);
      setError(null);
      setPageIndex(0);
      return;
    }

    if (template.downloadKind === "register" || !template.apiTemplate) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setPreview(null);
    setPageIndex(0);

    void fetchNakladnoyPreview({ tenantSlug, orderIds, template, prefs, warehouseExportOptions })
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Xato");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, tenantSlug, orderIds, prefs, warehouseExportOptions, template, initialPreview]);

  useEffect(() => {
    if (!open) setPrinting(false);
  }, [open]);

  const pages = preview?.pages ?? [];
  const pageCount = pages.length;
  const safePage = pageCount > 0 ? Math.min(pageIndex, pageCount - 1) : 0;
  const page = pages[safePage];

  const sheetTitle = useMemo(() => {
    if (!page) return "";
    return pageCount > 1 ? `${page.sheetName} (${safePage + 1}/${pageCount})` : page.sheetName;
  }, [page, pageCount, safePage]);

  const label = template?.label ?? "Накладная";
  const canPrint = Boolean(preview && template && !loading && !error);

  return (
    <>
      {printing && preview && template ? (
        <NakladnoyPreviewPrintView
          preview={preview}
          template={template}
          onClose={() => setPrinting(false)}
        />
      ) : null}

      <Dialog open={open && !printing} onOpenChange={onOpenChange}>
        <DialogContent
          className="z-[10101] flex max-h-[92vh] w-[min(96vw,58rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
          overlayClassName="z-[10100] bg-black/40"
          showCloseButton={false}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b bg-muted/40 px-5 py-4">
            <DialogHeader className="min-w-0 flex-1 gap-0 space-y-0 text-left">
              <DialogTitle className="pr-2 text-base">{label}</DialogTitle>
              {preview?.filename ? (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{preview.filename}</p>
              ) : null}
            </DialogHeader>
            <DialogHeaderActions>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!canPrint}
                onClick={() => setPrinting(true)}
                className="shrink-0 gap-1.5"
              >
                <Printer className="size-4" />
                Печать
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={downloadPending || loading || Boolean(error) || !preview}
                onClick={() => onDownload(preview?.filename)}
                className="shrink-0 gap-1.5"
              >
                {downloadPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                Скачать Excel
              </Button>
            </DialogHeaderActions>
          </div>

          <div className="relative flex min-h-0 flex-1 flex-col">
            {pageCount > 1 ? (
              <>
                <button
                  type="button"
                  disabled={safePage <= 0 || loading}
                  onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
                  className="absolute left-1 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border bg-white/95 shadow-md transition hover:bg-teal-50 disabled:opacity-30 dark:bg-card"
                  aria-label="Предыдущий лист"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  disabled={safePage >= pageCount - 1 || loading}
                  onClick={() => setPageIndex((i) => Math.min(pageCount - 1, i + 1))}
                  className="absolute right-1 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border bg-white/95 shadow-md transition hover:bg-teal-50 disabled:opacity-30 dark:bg-card"
                  aria-label="Следующий лист"
                >
                  <ChevronRight className="size-5" />
                </button>
              </>
            ) : null}

            <div className="min-h-0 flex-1 overflow-auto bg-white px-8 py-4 dark:bg-background">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" />
                  Yuklanmoqda…
                </div>
              ) : error ? (
                <p className="py-8 text-center text-sm text-destructive">{error}</p>
              ) : page?.kind === "structured-520" && page.loading520 ? (
                <NakladnoyPreview520Body data={page.loading520} />
              ) : page?.kind === "grid" && page.grid ? (
                <NakladnoyPreviewGrid rows={page.grid.rows} />
              ) : null}
            </div>

            {pageCount > 1 && !loading && !error ? (
              <div className="flex shrink-0 items-center justify-center gap-3 border-t bg-muted/30 px-4 py-2 text-sm text-muted-foreground">
                <button
                  type="button"
                  disabled={safePage <= 0}
                  onClick={() => setPageIndex((i) => i - 1)}
                  className="rounded p-1 hover:bg-muted disabled:opacity-30"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <span className="tabular-nums">
                  Лист {safePage + 1} / {pageCount}
                  {sheetTitle ? ` — ${page.sheetName}` : ""}
                </span>
                <button
                  type="button"
                  disabled={safePage >= pageCount - 1}
                  onClick={() => setPageIndex((i) => i + 1)}
                  className="rounded p-1 hover:bg-muted disabled:opacity-30"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
