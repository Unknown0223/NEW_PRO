import { prisma } from "../../config/database";
import { exportTenantCatalogProductsXlsx } from "../products/products.import.catalog";
import { listPricesMatrixForCategories } from "../products/product-prices.read";
import { getTenantDefaultCurrencyCode } from "./tenant-settings.profile.read";
import type { PriceTypeEntryDto } from "./finance-refs";
import {
  bufferToRows,
  cellStr,
  PRICE_HEADERS,
  type ExportSheet
} from "./initial-setup-export.shared";

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

  const priceTypeCodes = priceTypes.map((p) => cellStr(p.code)).filter(Boolean);
  const categories = await prisma.productCategory.findMany({
    where: { tenant_id: tenantId },
    select: { id: true }
  });
  const categoryIds = categories.map((c) => c.id);
  const currency = await getTenantDefaultCurrencyCode(tenantId);
  const priceDataRows: string[][] = [];
  const chunkSize = 50;
  for (const priceType of priceTypeCodes) {
    for (let i = 0; i < categoryIds.length; i += chunkSize) {
      const chunk = categoryIds.slice(i, i + chunkSize);
      try {
        const matrix = await listPricesMatrixForCategories(tenantId, chunk, priceType, currency);
        for (const row of matrix) {
          if (!row.sku || row.price == null) continue;
          priceDataRows.push([row.sku, priceType, String(row.price)]);
        }
      } catch {
        /* skip chunk */
      }
    }
  }
  if (priceDataRows.length) {
    sheets.push({
      sheetName: "product-prices",
      rows: [[...PRICE_HEADERS], ...priceDataRows]
    });
  }

  return sheets;
}
