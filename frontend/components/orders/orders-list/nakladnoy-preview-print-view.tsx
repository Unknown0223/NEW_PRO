"use client";

import { NakladnoyPreview520Body } from "@/components/orders/orders-list/nakladnoy-preview-520-body";
import { NakladnoyPreviewGrid } from "@/components/orders/orders-list/nakladnoy-preview-grid";
import type { BulkExportTemplateDef } from "@/lib/bulk-export-templates";
import { resolveNakladnoyPrintLayout } from "@/lib/nakladnoy-print-layout";
import type { NakladnoyPreviewResponse } from "@/lib/nakladnoy-preview";
import { cn } from "@/lib/utils";
import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

const PRINT_ROOT_ID = "nakladnoy-print-root";

type Props = {
  preview: NakladnoyPreviewResponse;
  template: BulkExportTemplateDef;
  onClose: () => void;
};

export function NakladnoyPreviewPrintView({ preview, template, onClose }: Props) {
  const layout = useMemo(
    () => resolveNakladnoyPrintLayout(template, preview),
    [template, preview]
  );

  useEffect(() => {
    document.body.setAttribute("data-nakladnoy-print", "1");
    const handleAfterPrint = () => onClose();
    window.addEventListener("afterprint", handleAfterPrint);
    const t = window.setTimeout(() => window.print(), 300);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("afterprint", handleAfterPrint);
      document.body.removeAttribute("data-nakladnoy-print");
    };
  }, [onClose]);

  const pageSize =
    layout.orientation === "landscape" ? "A4 landscape" : "A4 portrait";

  const content = (
    <div
      id={PRINT_ROOT_ID}
      className="nakladnoy-print-root bg-white text-black"
      data-testid="nakladnoy-print-view"
    >
      <style>{`
        @page {
          size: ${pageSize};
          margin: 8mm;
        }
        @media print {
          html, body {
            height: auto !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          body[data-nakladnoy-print] > *:not(#${PRINT_ROOT_ID}) {
            display: none !important;
          }
          #${PRINT_ROOT_ID} {
            display: block !important;
            position: static !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            box-shadow: none !important;
          }
          .nakladnoy-print-no-print {
            display: none !important;
          }
          .nakladnoy-print-sheet {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .nakladnoy-print-sheet + .nakladnoy-print-sheet {
            break-before: page;
            page-break-before: always;
          }
        }
        @media screen {
          #${PRINT_ROOT_ID} {
            position: fixed;
            inset: 0;
            z-index: 10200;
            overflow: auto;
            padding: 1rem;
            box-shadow: 0 0 0 1px #e5e7eb;
          }
        }
        .nakladnoy-print-table {
          width: 100% !important;
          max-width: 100% !important;
          table-layout: fixed;
          font-size: ${layout.tableFontPx}px;
          line-height: 1.2;
          word-wrap: break-word;
          overflow-wrap: anywhere;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .nakladnoy-print-table th,
        .nakladnoy-print-table td {
          padding: 1px 2px !important;
          vertical-align: middle !important;
        }
        .nakladnoy-print-scroll {
          overflow: visible !important;
          width: 100%;
        }
        .nakladnoy-print-narrow {
          max-width: 72mm;
          margin: 0 auto;
        }
      `}</style>

      <div className="nakladnoy-print-no-print mb-4 flex flex-wrap items-center gap-3 border-b border-neutral-200 pb-3">
        <button
          type="button"
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm"
          onClick={onClose}
        >
          Закрыть предпросмотр печати
        </button>
        <span className="text-sm text-neutral-600">
          {layout.label} · {layout.orientation === "landscape" ? "Альбомная" : "Книжная"} A4
          {preview.pages.length > 1 ? ` · ${preview.pages.length} лист.` : ""}
        </span>
      </div>

      <header className="mb-2 text-left">
        <h1 className="text-sm font-bold leading-tight">{preview.label}</h1>
        <p className="text-[10px] text-neutral-600">
          {new Date().toLocaleString("ru-RU")}
          {preview.filename ? ` · ${preview.filename}` : ""}
        </p>
      </header>

      {preview.pages.map((page, pi) => (
        <section
          key={`${page.sheetName}-${pi}`}
          className={cn("nakladnoy-print-sheet", pi > 0 && "mt-4")}
        >
          {preview.pages.length > 1 ? (
            <h2 className="mb-1 border-b border-neutral-400 pb-0.5 text-xs font-semibold">
              {page.sheetName}
            </h2>
          ) : null}

          <div
            className={cn(
              "nakladnoy-print-scroll",
              layout.narrowReceipt && "nakladnoy-print-narrow"
            )}
          >
            {page.kind === "structured-520" && page.loading520 ? (
              <NakladnoyPreview520Body data={page.loading520} />
            ) : page.kind === "grid" && page.grid ? (
              <NakladnoyPreviewGrid
                rows={page.grid.rows}
                tableClassName="nakladnoy-print-table"
                className="nakladnoy-print-scroll"
              />
            ) : null}
          </div>
        </section>
      ))}
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
