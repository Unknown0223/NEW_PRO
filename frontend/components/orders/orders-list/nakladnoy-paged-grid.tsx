"use client";

import {
  splitNakladnoyGridIntoPapers,
  type NakladnoyPaperChunk,
  type NakladnoyPreviewPage
} from "@/lib/nakladnoy-preview";
import { cn } from "@/lib/utils";
import { useLayoutEffect, useMemo, useRef } from "react";

const MM_TO_PX = 96 / 25.4;
/** `@page { margin }` bilan bir xil bo‘lishi shart. */
export const NAKLADNOY_PAPER_MARGIN_MM = 8;
/** Bundan kichik masshtabda o‘qib bo‘lmaydi — blok qog‘ozdan katta bo‘lsa bo‘linishga ruxsat. */
const MIN_ZOOM = 0.55;

type Grid = NonNullable<NakladnoyPreviewPage["grid"]>;

function paperSizePx(orientation: "portrait" | "landscape") {
  const w = (orientation === "portrait" ? 210 : 297) - NAKLADNOY_PAPER_MARGIN_MM * 2;
  const h = (orientation === "portrait" ? 297 : 210) - NAKLADNOY_PAPER_MARGIN_MM * 2;
  return { widthMm: w, heightMm: h, widthPx: w * MM_TO_PX, heightPx: h * MM_TO_PX };
}

function PaperTable({ chunk, colWidthsPx }: { chunk: NakladnoyPaperChunk; colWidthsPx?: number[] }) {
  const tableWidth = colWidthsPx?.reduce((s, w) => s + w, 0);
  return (
    <table
      className="nakladnoy-paper-table"
      style={tableWidth ? { width: tableWidth } : undefined}
    >
      {colWidthsPx ? (
        <colgroup>
          {colWidthsPx.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
      ) : null}
      <tbody>
        {chunk.rows.map((row, ri) => {
          const hPt = chunk.rowHeightsPt?.[ri];
          return (
            <tr key={chunk.start + ri} style={hPt ? { height: `${hPt}pt` } : undefined}>
              {row.map((cell, ci) => {
                if (cell.skip) return null;
                return (
                  <td
                    key={ci}
                    colSpan={cell.colSpan}
                    rowSpan={cell.rowSpan}
                    className={cn(
                      !cell.noBorder && "nakladnoy-paper-bordered",
                      cell.wrap ? "nakladnoy-paper-wrap" : "nakladnoy-paper-nowrap",
                      cell.bold && "font-bold",
                      cell.align === "right" && "text-right tabular-nums",
                      cell.align === "center" && "text-center"
                    )}
                    style={{
                      ...(cell.bg ? { backgroundColor: cell.bg } : {}),
                      ...(cell.fs ? { fontSize: `${cell.fs}pt` } : {})
                    }}
                  >
                    {cell.v}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Paper({
  chunk,
  colWidthsPx,
  first,
  size,
  label
}: {
  chunk: NakladnoyPaperChunk;
  colWidthsPx?: number[];
  first: boolean;
  size: ReturnType<typeof paperSizePx>;
  label?: string;
}) {
  const paperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const fit = () => {
      const paper = paperRef.current;
      const el = contentRef.current;
      if (!paper || !el) return;
      el.style.zoom = "1";
      const w = el.scrollWidth;
      const h = el.scrollHeight;
      if (!w || !h) return;
      const z = Math.min(1, (size.widthPx * 0.98) / w, (size.heightPx * 0.98) / h);
      const oversized = z < MIN_ZOOM;
      el.style.zoom = String(Math.max(MIN_ZOOM, z));
      paper.classList.toggle("nakladnoy-paper-oversized", oversized);
    };
    fit();
    let cancelled = false;
    void document.fonts?.ready.then(() => {
      if (!cancelled) fit();
    });
    return () => {
      cancelled = true;
    };
  }, [chunk, size.widthPx, size.heightPx]);

  return (
    <div
      ref={paperRef}
      className={cn("nakladnoy-paper", first && "nakladnoy-paper-first")}
      style={{ width: `${size.widthMm}mm` }}
    >
      {label ? <p className="nakladnoy-paper-label">{label}</p> : null}
      <div ref={contentRef} className="nakladnoy-paper-content">
        <PaperTable chunk={chunk} colWidthsPx={colWidthsPx} />
      </div>
    </div>
  );
}

const PAPER_CSS = `
  .nakladnoy-paper {
    box-sizing: border-box;
    overflow: hidden;
    break-inside: avoid;
    page-break-inside: avoid;
    break-before: page;
    page-break-before: always;
    background: white;
    color: black;
  }
  .nakladnoy-paper-first {
    break-before: auto;
    page-break-before: auto;
  }
  .nakladnoy-paper-oversized {
    overflow: visible;
    break-inside: auto;
    page-break-inside: auto;
  }
  .nakladnoy-paper-table {
    border-collapse: collapse;
    table-layout: fixed;
    font-family: Calibri, Carlito, "Segoe UI", Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.15;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .nakladnoy-paper-table td {
    padding: 0 2px;
    vertical-align: middle;
  }
  .nakladnoy-paper-table td.nakladnoy-paper-wrap {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .nakladnoy-paper-table td.nakladnoy-paper-nowrap {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: clip;
  }
  .nakladnoy-paper-table td.nakladnoy-paper-bordered {
    border: 1px solid #000;
  }
  .nakladnoy-paper-label {
    margin: 0 0 4px;
    font-size: 11px;
    color: #737373;
  }
  @media print {
    .nakladnoy-paper-label {
      display: none !important;
    }
  }
  @media screen {
    .nakladnoy-paper {
      margin: 0 auto 28px;
      padding: 0;
      outline: 1px dashed #a3a3a3;
      outline-offset: 6px;
    }
    .nakladnoy-paper-oversized {
      outline-color: #dc2626;
    }
  }
`;

type Props = {
  grid: Grid;
  orientation?: "portrait" | "landscape";
  /** Ekranda qog‘oz raqamini ko‘rsatish. */
  showPaperLabels?: boolean;
};

/** Excel sahifa bo‘linishlari bo‘yicha qog‘ozlarga bo‘lingan varaq — har qog‘oz A4 ga sig‘diriladi. */
export function NakladnoyPagedGrid({ grid, orientation = "portrait", showPaperLabels }: Props) {
  const papers = useMemo(() => splitNakladnoyGridIntoPapers(grid), [grid]);
  const size = useMemo(() => paperSizePx(orientation), [orientation]);

  return (
    <div className="nakladnoy-paged-grid">
      <style>{PAPER_CSS}</style>
      {papers.map((chunk, i) => (
        <Paper
          key={chunk.start}
          chunk={chunk}
          colWidthsPx={grid.colWidthsPx}
          first={i === 0}
          size={size}
          label={showPaperLabels ? `Страница ${i + 1} / ${papers.length}` : undefined}
        />
      ))}
    </div>
  );
}
