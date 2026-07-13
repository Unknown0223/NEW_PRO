/**
 * Split order.nakladnoy.ts → payload + generate + barrel
 */
import fs from "node:fs";
import path from "node:path";

const domainDir = path.resolve("src/modules/orders/domain");
const srcPath = path.join(domainDir, "order.nakladnoy.ts");
const lines = fs.readFileSync(srcPath, "utf8").split(/\r?\n/);

const headerEnd = 74;
const payloadEnd = 357;
const header = lines.slice(0, headerEnd).join("\n");

const payloadImports = `${header}
import type { NakladnoyOrderPayload } from "../order-nakladnoy-xlsx";
`;

const payloadBody = lines.slice(headerEnd, payloadEnd).join("\n");
fs.writeFileSync(
  path.join(domainDir, "order.nakladnoy.payload.ts"),
  `${payloadImports}
${payloadBody}
`,
  "utf8"
);

const generateHeader = `/**
 * Nakladnoy PDF/XLSX generation and bulk export.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/database";
import {
  buildNakladnoyXlsx,
  type NakladnoyBuildOptions,
  DEFAULT_NAKLADNOY_BUILD_OPTIONS
} from "../order-nakladnoy-xlsx";
import { buildWarehouseLoadXlsx } from "../warehouse-templates/build-warehouse-load-xlsx";
import { warehouseExportOptionsForLayout } from "../warehouse-templates/warehouse-export-options";
import { buildExpeditorLoadingXlsx } from "../warehouse-templates/build-expeditor-loading-xlsx";
import { buildExpeditorLoading520Document } from "../warehouse-templates/expeditor-loading-520-document";
import { buildExpeditorLoading520XlsxFromDocument } from "../warehouse-templates/expeditor-loading-520-xlsx";
import { buildExpeditorLoading520Preview } from "../warehouse-templates/expeditor-loading-520-preview";
import type { NakladnoyPreviewResponse } from "../warehouse-templates/nakladnoy-preview.types";
import { workbookBufferToNakladnoyPreview } from "../warehouse-templates/nakladnoy-xlsx-preview";
import {
  isExpeditorLoadingLayoutId,
  expeditorLoadingDownloadFilename,
  getExpeditorLoadingLayoutDef,
  type ExpeditorLoadingLayoutId
} from "../warehouse-templates/expeditor-loading-template-ids";
import { buildWarehouseAggregateContext } from "../warehouse-templates/warehouse-template-shared";
import {
  isWarehouseLayoutId,
  warehouseLayoutDownloadFilename,
  type WarehouseLayoutId
} from "../warehouse-templates/warehouse-template-ids";
import { buildNakladnoyPdf } from "../order-nakladnoy-pdf";
import {
  loadBulkNakladnoyOrderPayloads,
  mapOrderToNakladnoyPayload,
  NAKLADNOY_TEMPLATE_IDS,
  type BulkNakladnoyFileResult,
  type NakladnoyTemplateId
} from "./order.nakladnoy.payload";

export { NAKLADNOY_TEMPLATE_IDS, type NakladnoyTemplateId, type BulkNakladnoyFileResult };
export { mapOrderToNakladnoyPayload, loadBulkNakladnoyOrderPayloads };
`;

const generateBody = lines.slice(payloadEnd).join("\n");
fs.writeFileSync(
  path.join(domainDir, "order.nakladnoy.generate.ts"),
  `${generateHeader}
${generateBody}
`,
  "utf8"
);

fs.writeFileSync(
  srcPath,
  `export * from "./order.nakladnoy.payload";
export * from "./order.nakladnoy.generate";
`,
  "utf8"
);

console.log("Split order.nakladnoy.ts");
