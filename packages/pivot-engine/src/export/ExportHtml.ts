import type { PivotData } from "../types/pivot.types.js";
import { pivotDataToAoA } from "./ExportExcel.js";
import { countPivotExportRows, type ExportProgress, yieldToMain } from "./exportUtils.js";

export type ExportHtmlOptions = {
  filename?: string;
  title?: string;
  useFormattedValues?: boolean;
  includeSubtotals?: boolean;
  expandedRows?: Set<string>;
  onProgress?: (progress: ExportProgress) => void;
};

const DEFAULT_FILENAME = "pivot-export.html";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Pivot jadvali uchun chop etishga mos HTML. */
export function pivotDataToHtml(data: PivotData, options: ExportHtmlOptions = {}): string {
  const aoa = pivotDataToAoA(data, {
    useFormattedValues: options.useFormattedValues,
    includeSubtotals: options.includeSubtotals,
    expandedRows: options.expandedRows
  });

  const headerLevels = data.headers.length;
  const headRows = aoa.slice(0, headerLevels);
  const bodyRows = aoa.slice(headerLevels);

  const thead = headRows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<th>${escapeHtml(String(cell ?? ""))}</th>`).join("")}</tr>`
    )
    .join("");

  const tbody = bodyRows
    .map(
      (row, idx) =>
        `<tr class="${idx === bodyRows.length - 1 && data.grandTotal ? "grand-total" : ""}">${row
          .map((cell, ci) => {
            const align = ci === 0 ? "left" : "right";
            return `<td style="text-align:${align}">${escapeHtml(String(cell ?? ""))}</td>`;
          })
          .join("")}</tr>`
    )
    .join("");

  const title = options.title ? `<h1>${escapeHtml(options.title)}</h1>` : "";

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(options.title ?? "Pivot export")}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; color: #111; }
    h1 { font-size: 18px; margin: 0 0 16px; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th, td { border: 1px solid #d4d4d8; padding: 6px 10px; }
    th { background: #f4f4f5; font-weight: 600; }
    tr.grand-total td { background: #f4f4f5; font-weight: 700; }
    @media print { body { margin: 12px; } }
  </style>
</head>
<body>
  ${title}
  <table>
    <thead>${thead}</thead>
    <tbody>${tbody}</tbody>
  </table>
</body>
</html>`;
}

/** HTML faylni brauzerda yuklab olish. */
export async function exportPivotToHtml(
  data: PivotData,
  options: ExportHtmlOptions = {}
): Promise<void> {
  const onProgress = options.onProgress;
  const totalRows = countPivotExportRows(data, options);
  onProgress?.({ phase: "preparing", processedRows: 0, totalRows });
  await yieldToMain();

  const html = pivotDataToHtml(data, options);
  onProgress?.({ phase: "writing", processedRows: totalRows, totalRows });
  await yieldToMain();

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = options.filename ?? DEFAULT_FILENAME;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  onProgress?.({ phase: "done", processedRows: totalRows, totalRows });
}
