/**
 * v4 — products.service bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const mod = path.join(root, "../src/modules/products");
const mainPath = path.join(mod, "products.service.ts");
const backupPath = path.join(mod, "products.service.backup.ts");

function read(p) {
  return fs.readFileSync(p, "utf8").split(/\r?\n/);
}
function slice(lines, a, b) {
  return lines.slice(a - 1, b).join("\n");
}
function w(p, c) {
  fs.writeFileSync(p, c.endsWith("\n") ? c : `${c}\n`);
}

const lines = read(mainPath);
if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(mainPath, backupPath);
}

const hdr = `import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
`;

w(
  path.join(mod, "products.shared.ts"),
  `${hdr}
${slice(lines, 12, 64)}
`.replace(/^function decOpt/m, "export function decOpt").replace(
    /^async function assertProductCatalogFks/m,
    "export async function assertProductCatalogFks"
  )
);

w(
  path.join(mod, "products.types.ts"),
  `${slice(lines, 66, 91)}

${slice(lines, 165, 190)}
`
);

let importHelpers = `${hdr}
${slice(lines, 306, 334)}
${slice(lines, 351, 470)}
`;
importHelpers = importHelpers
  .replace(/^function headerToKey/m, "export function headerToKey")
  .replace(/^function normalizeTemplateHeader/m, "export function normalizeTemplateHeader")
  .replace(/^function headerToTemplateCol/m, "export function headerToTemplateCol")
  .replace(/^function cellText/m, "export function cellText")
  .replace(/^function parseNumLoose/m, "export function parseNumLoose")
  .replace(/^async function resolveCategoryIdByCode/m, "export async function resolveCategoryIdByCode")
  .replace(/^async function resolveCatalogGroupIdByCode/m, "export async function resolveCatalogGroupIdByCode")
  .replace(/^async function resolveSegmentIdByCode/m, "export async function resolveSegmentIdByCode")
  .replace(/^async function resolveBrandIdByCode/m, "export async function resolveBrandIdByCode")
  .replace(/^async function allocateUniqueSku/m, "export async function allocateUniqueSku")
  .replace(/^type TemplateCol/m, "export type TemplateCol");
w(path.join(mod, "products.import.helpers.ts"), importHelpers);

w(
  path.join(mod, "products.import.template.ts"),
  `${hdr}
import { CATALOG_IMPORT_TEMPLATE_HEADERS } from "./products.import.helpers";

${slice(lines, 335, 349)}
`
);

// Move CATALOG constant export - it's in helpers slice 317-333, export it
let ih = fs.readFileSync(path.join(mod, "products.import.helpers.ts"), "utf8");
ih = ih.replace(/^const CATALOG_IMPORT_TEMPLATE_HEADERS/m, "export const CATALOG_IMPORT_TEMPLATE_HEADERS");
w(path.join(mod, "products.import.helpers.ts"), ih);

w(
  path.join(mod, "products.crud.ts"),
  `${hdr}
import { productListInclude, assertProductCatalogFks, decOpt } from "./products.shared";
import type { CreateProductInput, UpdateProductInput } from "./products.types";

${slice(lines, 93, 164)}
${slice(lines, 192, 304)}
`
);

w(
  path.join(mod, "products.import.catalog.ts"),
  `${hdr}
import { createProduct } from "./products.crud";
import {
  allocateUniqueSku,
  cellText,
  headerToTemplateCol,
  parseNumLoose,
  resolveBrandIdByCode,
  resolveCatalogGroupIdByCode,
  resolveCategoryIdByCode,
  resolveSegmentIdByCode,
  type TemplateCol
} from "./products.import.helpers";
import { productListInclude } from "./products.shared";

${slice(lines, 472, 740)}
`
);

let importUpdate = `${hdr}
import { updateProduct } from "./products.crud";
import {
  cellText,
  headerToTemplateCol,
  parseNumLoose,
  resolveBrandIdByCode,
  resolveCatalogGroupIdByCode,
  resolveCategoryIdByCode,
  resolveSegmentIdByCode,
  type TemplateCol
} from "./products.import.helpers";
import { decOpt, productListInclude } from "./products.shared";

${slice(lines, 742, 1077)}
`;
importUpdate = importUpdate
  .replace(/^function decEq/m, "function decEq")
  .replace(/^function intEq/m, "function intEq");
w(path.join(mod, "products.import.update.ts"), importUpdate);

w(
  path.join(mod, "products.import.bulk.ts"),
  `${hdr}
import { createProduct } from "./products.crud";
import type { CreateProductInput } from "./products.types";
import { headerToKey } from "./products.import.helpers";

${slice(lines, 1079, 1197)}
`
);

w(
  path.join(mod, "products.order-form.ts"),
  `import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../config/env";

${slice(lines, 1199, lines.length)}
`
);

w(
  path.join(mod, "products.service.ts"),
  `/**
 * Domain: Products (katalog, narxlar, import).
 * Boundary: route → Zod + RBAC; servis → Prisma, audit, order-create form optimizatsiyasi.
 */
export * from "./products.shared";
export * from "./products.types";
export * from "./products.crud";
export * from "./products.import.helpers";
export * from "./products.import.template";
export * from "./products.import.catalog";
export * from "./products.import.update";
export * from "./products.import.bulk";
export * from "./products.order-form";
`
);

console.log("Phase 26 products split done.");
