import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";

import { CATALOG_IMPORT_TEMPLATE_HEADERS } from "./products.import.helpers";

export async function buildProductCatalogImportTemplateBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Products", {
    views: [{ state: "frozen", ySplit: 1 }]
  });
  sheet.addRow([...CATALOG_IMPORT_TEMPLATE_HEADERS]);
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8F4F2" }
  };
  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}
