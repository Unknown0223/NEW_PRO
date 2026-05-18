/**
 * v4 — products.route bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const mod = path.join(root, "../src/modules/products");
const src = path.join(mod, "products.route.ts");
const backup = path.join(mod, "products.route.backup.ts");

function read(p) {
  return fs.readFileSync(p, "utf8").split(/\r?\n/);
}
function slice(lines, a, b) {
  return lines.slice(a - 1, b).join("\n");
}
function w(p, c) {
  fs.writeFileSync(p, c.endsWith("\n") ? c : `${c}\n`);
}

if (!fs.existsSync(backup)) {
  fs.copyFileSync(src, backup);
}

const lines = read(backup);

const routeHdr = `import type { FastifyInstance } from "fastify";
import { catalogRoles } from "./products.route.shared";
`;

w(
  path.join(mod, "products.route.shared.ts"),
  `import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";

export const catalogRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;
`
);

w(
  path.join(mod, "products.route.mappers.ts"),
  `import type { FastifyRequest } from "fastify";
import type { Prisma } from "@prisma/client";

export type ProductListRow = {
  id: number;
  sku: string;
  name: string;
  unit: string;
  barcode: string | null;
  is_active: boolean;
  category_id: number | null;
  product_group_id: number | null;
  brand_id: number | null;
  manufacturer_id: number | null;
  segment_id: number | null;
  weight_kg: Prisma.Decimal | null;
  volume_m3: Prisma.Decimal | null;
  qty_per_block: number | null;
  dimension_unit: string | null;
  width_cm: Prisma.Decimal | null;
  height_cm: Prisma.Decimal | null;
  length_cm: Prisma.Decimal | null;
  ikpu_code: string | null;
  hs_code: string | null;
  sell_code: string | null;
  comment: string | null;
  sort_order: number | null;
  is_blocked: boolean;
  is_equipment: boolean;
  created_at: Date;
  category: { id: number; name: string } | null;
  product_group: { id: number; name: string } | null;
  brand: { id: number; name: string } | null;
  manufacturer: { id: number; name: string } | null;
  segment: { id: number; name: string } | null;
  prices?: { id: number; price_type: string; price: Prisma.Decimal; currency: string }[];
};

${slice(lines, 86, 132).replace(/^function mapProductToJson/m, "export function mapProductToJson").replace(/^async function readProductImportBuffer/m, "export async function readProductImportBuffer")}
`
);

function routeFile(name, fnName, ranges, extraImports) {
  const body = ranges.map(([a, b]) => slice(lines, a, b)).join("\n\n");
  w(
    path.join(mod, name),
    `${routeHdr}
${extraImports}

export async function ${fnName}(app: FastifyInstance) {
${body}
}
`
  );
}

routeFile(
  "products.route.list.ts",
  "registerProductListRoutes",
  [[135, 238]],
  `import type { Prisma } from "@prisma/client";
import { parseProductsListQuery } from "../../contracts/products.schemas";
import { sendApiError } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { prisma } from "../../config/database";
import { jwtAccessVerify } from "../auth/auth.prehandlers";
import {
  requireIfSkladchikThenAnyEntitlement,
  SKLADCHIK_ALL_ENTITLEMENT_KEYS
} from "../staff/skladchik-access.prehandler";
import { productListInclude } from "./products.service";
import { mapProductToJson, type ProductListRow } from "./products.route.mappers";
`
);

routeFile(
  "products.route.write.ts",
  "registerProductWriteRoutes",
  [[240, 318]],
  `import {
  createProductBodySchema,
  updateProductBodySchema
} from "../../contracts/products.schemas";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { createProduct, softDeleteProduct, updateProduct } from "./products.service";
import { mapProductToJson, type ProductListRow } from "./products.route.mappers";
`
);

routeFile(
  "products.route.import.ts",
  "registerProductImportRoutes",
  [[320, 530]],
  `import { unlink } from "fs/promises";
import { writeProductImportTempFile } from "../../jobs/import-temp-file";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { sendApiError } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { enqueueProductsXlsxImportJob } from "../jobs/jobs.service";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import {
  buildProductCatalogImportTemplateBuffer,
  exportTenantCatalogProductsXlsx,
  importProductsCatalogUpdateOnlyXlsx,
  importProductsFromCatalogTemplateXlsx,
  importProductsFromXlsx
} from "./products.service";
import { readProductImportBuffer } from "./products.route.mappers";
`
);

routeFile(
  "products.route.bulk.ts",
  "registerProductBulkRoutes",
  [[532, 552]],
  `import { bulkProductsBodySchema } from "../../contracts/products.schemas";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { createProductsBulk } from "./products.service";
`
);

w(
  path.join(mod, "products.route.ts"),
  `import type { FastifyInstance } from "fastify";
import { registerProductBulkRoutes } from "./products.route.bulk";
import { registerProductImportRoutes } from "./products.route.import";
import { registerProductListRoutes } from "./products.route.list";
import { registerProductWriteRoutes } from "./products.route.write";

export async function registerProductRoutes(app: FastifyInstance) {
  await registerProductListRoutes(app);
  await registerProductWriteRoutes(app);
  await registerProductImportRoutes(app);
  await registerProductBulkRoutes(app);
}
`
);

console.log("Phase 27 products.route split done.");
