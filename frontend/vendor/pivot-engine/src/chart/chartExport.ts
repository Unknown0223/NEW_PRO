export type ExportChartPngOptions = {
  filename?: string;
  /** html2canvas scale (default 2 — retina-friendly) */
  scale?: number;
  backgroundColor?: string;
};

const DEFAULT_FILENAME = "pivot-chart.png";

export function resolveChartExportFilename(filename?: string): string {
  const base = filename ?? DEFAULT_FILENAME;
  return base.toLowerCase().endsWith(".png") ? base : `${base}.png`;
}

function triggerPngDownload(dataUrl: string, filename: string): void {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

/**
 * DOM chart konteynerini PNG sifatida yuklab olish (browser).
 * html2canvas dynamic import — faqat export vaqtida yuklanadi.
 */
export async function exportChartElementToPng(
  element: HTMLElement,
  options: ExportChartPngOptions = {}
): Promise<void> {
  if (typeof document === "undefined") {
    throw new Error("exportChartElementToPng requires a browser environment");
  }

  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(element, {
    scale: options.scale ?? 2,
    backgroundColor: options.backgroundColor ?? "#ffffff",
    logging: false,
    useCORS: true
  });

  const dataUrl = canvas.toDataURL("image/png");
  triggerPngDownload(dataUrl, resolveChartExportFilename(options.filename));
}
