import { prisma } from "../../config/database";
import { exportTenantCatalogProductsXlsx } from "../products/products.import.catalog";
import { listPricesMatrixForCategories } from "../products/product-prices.read";
import { getTenantDefaultCurrencyCode } from "./tenant-settings.profile.read";
import { priceTypeKey, type PriceTypeEntryDto } from "./finance-refs";
import { bufferToRows, type ExportSheet } from "./initial-setup-export.shared";

export async function collectProductExportSheets(
  tenantId: number,
  priceTypes: PriceTypeEntryDto[]
): Promise<ExportSheet[]> {
  const sheets: ExportSheet[] = [];

  const productsBuf = await exportTenantCatalogProductsXlsx(tenantId);
  const productRows = bufferToRows(productsBuf);
  if (productRows.length > 1) {
    sheets.push({ sheetName: "products-catalog", rows: productRows });
  }

  const activeTypes = priceTypes.filter((p) => p.active !== false);
  const columns = activeTypes
    .map((p) => ({
      header: (p.name.trim() || priceTypeKey(p)).trim(),
      key: priceTypeKey(p)
    }))
    .filter((c) => c.header && c.key);
  if (!columns.length) return sheets;

  const categories = await prisma.productCategory.findMany({
    where: { tenant_id: tenantId },
    select: { id: true }
  });
  const categoryIds = categories.map((c) => c.id);
  const currency = await getTenantDefaultCurrencyCode(tenantId);
  const bySku = new Map<string, Record<string, string>>();
  const chunkSize = 50;

  for (const col of columns) {
    for (let i = 0; i < categoryIds.length; i += chunkSize) {
      const chunk = categoryIds.slice(i, i + chunkSize);
      try {
        const matrix = await listPricesMatrixForCategories(tenantId, chunk, col.key, currency);
        for (const row of matrix) {
          if (!row.sku || row.price == null) continue;
          const cur = bySku.get(row.sku) ?? {};
          cur[col.header] = String(row.price);
          bySku.set(row.sku, cur);
        }
      } catch {
        /* skip chunk */
      }
    }
  }

  if (!bySku.size) return sheets;

  const headers = columns.map((c) => c.header);
  const dataRows = [...bySku.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "ru"))
    .map(([sku, prices]) => [sku, ...headers.map((h) => prices[h] ?? "")]);

  sheets.push({
    sheetName: "product-prices",
    rows: [["Артикул (SKU)", ...headers], ...dataRows]
  });

  return sheets;
}
