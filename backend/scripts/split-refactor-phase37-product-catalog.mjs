/**
 * v4 — product-catalog.service bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const mod = path.join(root, "../src/modules/products");
const mainPath = path.join(mod, "product-catalog.service.ts");
const backupPath = path.join(mod, "product-catalog.service.backup.ts");

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

const hdr = `import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
`;

let sharedBody = slice(lines, 12, 41);
sharedBody = sharedBody
  .replace(/^function listWhere/m, "export function listWhere")
  .replace(/^function normCode/m, "export function normCode");

w(
  path.join(mod, "product-catalog.types.ts"),
  `${slice(lines, 5, 10)}

${slice(lines, 269, 280)}

${slice(lines, 591, 596)}
`
);

w(
  path.join(mod, "product-catalog.shared.ts"),
  `${hdr}import type { ListCatalogOpts } from "./product-catalog.types";

${sharedBody}
`
);

function catalogFile(name, range) {
  w(
    path.join(mod, name),
    `${hdr}import type { ListCatalogOpts } from "./product-catalog.types";
import { listWhere, normCode } from "./product-catalog.shared";

${slice(lines, range[0], range[1])}
`
  );
}

catalogFile("product-catalog.groups.ts", [45, 99]);
catalogFile("product-catalog.brands.ts", [101, 155]);
catalogFile("product-catalog.manufacturers.ts", [157, 211]);
catalogFile("product-catalog.segments.ts", [213, 265]);

let icBody = slice(lines, 282, 492);
icBody = icBody.replace(/^async function assertTenantPriceTypes/m, "async function assertTenantPriceTypes");

w(
  path.join(mod, "product-catalog.interchangeable.ts"),
  `${hdr}import { listDistinctPriceTypesForTenant } from "../reference/reference.service";
import type { InterchangeableGroupRow, ListCatalogOpts } from "./product-catalog.types";
import { normCode } from "./product-catalog.shared";

${icBody}
`
);

let assertBody = `${slice(lines, 494, 589)}\n\n${slice(lines, 599, 629)}`;
assertBody = assertBody.replace(
  /^async function interchangeableGroupIdsForProduct/m,
  "async function interchangeableGroupIdsForProduct"
);

w(
  path.join(mod, "product-catalog.interchangeable-assert.ts"),
  `${hdr}import type { InterchangeableExchangeLookupRow } from "./product-catalog.types";

${assertBody}
`
);

w(
  path.join(mod, "product-catalog.service.ts"),
  `/**
 * Domain: product catalog metadata (groups, brands, interchangeable).
 */
export * from "./product-catalog.types";
export * from "./product-catalog.shared";
export * from "./product-catalog.groups";
export * from "./product-catalog.brands";
export * from "./product-catalog.manufacturers";
export * from "./product-catalog.segments";
export * from "./product-catalog.interchangeable";
export * from "./product-catalog.interchangeable-assert";
`
);

console.log("Phase 37 product-catalog split done.");
