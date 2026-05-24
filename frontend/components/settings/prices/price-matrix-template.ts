import { parsePriceDraft } from "@/lib/price-matrix-draft";
import type { PriceMatrixRow } from "./price-matrix-types";

function priceCellForExport(row: PriceMatrixRow, draft?: Record<number, string>): string {
  const raw = draft?.[row.product_id] ?? row.price ?? "";
  if (!String(raw).trim()) return "";
  const parsed = parsePriceDraft(String(raw));
  return parsed.ok ? String(parsed.value) : String(raw).trim();
}

/**
 * Shablon: barcha tanlangan kategoriyalar + tanlangan narx turi bo‘yicha (jadval tab emas).
 */
export async function downloadPriceMatrixTemplate(
  rows: PriceMatrixRow[],
  opts: {
    priceType: string;
    categoryLabels?: string[];
    draft?: Record<number, string>;
    currency?: string;
  }
): Promise<void> {
  if (!opts.priceType.trim()) {
    throw new Error("PRICE_TYPE_REQUIRED");
  }
  if (rows.length === 0) {
    throw new Error("NO_ROWS");
  }

  const cur = rows[0]?.currency ?? opts.currency ?? "UZS";
  const ptSlug = opts.priceType
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  const catPart =
    opts.categoryLabels && opts.categoryLabels.length > 0
      ? `${opts.categoryLabels.length}-kat`
      : "kategoriya";
  const filename = `narx-${ptSlug}-${catPart}.xlsx`;

  const showCategory = new Set(rows.map((r) => r.category_id).filter(Boolean)).size > 1;
  const headers = showCategory
    ? ["SKU", "Название", "Категория", `Сумма (${cur})`]
    : ["SKU", "Название", `Сумма (${cur})`];

  const aoa: (string | number)[][] = [[`Тип цены: ${opts.priceType}`]];
  if (opts.categoryLabels && opts.categoryLabels.length > 0) {
    aoa.push([`Категории (${opts.categoryLabels.length}): ${opts.categoryLabels.join(", ")}`]);
  }
  aoa.push([]);
  aoa.push(headers);
  for (const r of rows) {
    const price = priceCellForExport(r, opts.draft);
    if (showCategory) {
      aoa.push([r.sku, r.name, r.category_name ?? "", price]);
    } else {
      aoa.push([r.sku, r.name, price]);
    }
  }

  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = (showCategory ? [16, 40, 22, 14] : [16, 42, 14]).map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Narx");
  const out = filename.toLowerCase().endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, out, { bookType: "xlsx", compression: true });
}
