/**
 * Bir martalik: orders.service.backup.ts → domain/*.ts + orders.service.ts barrel
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ordersDir = path.join(__dirname, "../src/modules/orders");
const domainDir = path.join(ordersDir, "domain");
const srcPath = path.join(ordersDir, "orders.service.backup.ts");
const lines = fs.readFileSync(srcPath, "utf8").split(/\r?\n/);

function slice(a, b) {
  return fixDomainImports(lines.slice(a - 1, b).join("\n"));
}

function fixDomainImports(text) {
  return text
    .replace(/from "\.\.\/\.\.\/lib\//g, 'from "../../../lib/')
    .replace(/from "\.\.\/\.\.\/config\//g, 'from "../../../config/')
    .replace(/from "\.\.\/jobs\//g, 'from "../../jobs/')
    .replace(/from "\.\.\/products\//g, 'from "../../products/')
    .replace(/from "\.\.\/consignment\//g, 'from "../../consignment/')
    .replace(/from "\.\.\/client-balances\//g, 'from "../../client-balances/')
    .replace(/from "\.\.\/tenant-settings\//g, 'from "../../tenant-settings/')
    .replace(/from "\.\.\/work-slots\//g, 'from "../../work-slots/')
    .replace(/from "\.\/bonus-stack-policy"/g, 'from "../bonus-stack-policy"')
    .replace(/from "\.\/order-bonus-apply"/g, 'from "../order-bonus-apply"')
    .replace(/from "\.\/order-status"/g, 'from "../order-status"')
    .replace(/from "\.\/expeditor-auto-assign"/g, 'from "../expeditor-auto-assign"')
    .replace(/from "\.\/order-nakladnoy-xlsx"/g, 'from "../order-nakladnoy-xlsx"')
    .replace(/from "\.\/order-nakladnoy-pdf"/g, 'from "../order-nakladnoy-pdf"')
    .replace(/from "\.\/exchange-order-create"/g, 'from "../exchange-order-create"')
    .replace(/import\("\.\.\/work-slots\//g, 'import("../../work-slots/');
}

const header = fixDomainImports(lines.slice(0, 51).join("\n"));

fs.mkdirSync(domainDir, { recursive: true });

const typesBody = slice(53, 369)
  .replace(/^const orderDetailInclude/m, "export const orderDetailInclude");

fs.writeFileSync(
  path.join(domainDir, "order.types.ts"),
  `/** Orders domain — shared types and Prisma include. */
import { Prisma } from "@prisma/client";

${typesBody}
`
);

const detailBody = [slice(371, 662), "", slice(1293, 1318), "", slice(2327, 2424)].join("\n");
fs.writeFileSync(
  path.join(domainDir, "order.detail-mappers.ts"),
  `${header}

import {
  orderDetailInclude,
  type BonusGiftOverrideInput,
  type BonusGiftSwapOptionRow,
  type OrderDetailLoaded,
  type OrderDetailRow,
  type OrderItemRow,
  type OrderListRow
} from "./order.types";

${detailBody.replace(/^async function /gm, "export async function ").replace(/^function /gm, "export function ")}
`
);

const createBody = slice(664, 1288);
fs.writeFileSync(
  path.join(domainDir, "order.create.ts"),
  `${header}

import {
  assertOrderWarehouseBlockAssignment,
  enrichOrderDetailRow,
  bonusGiftMapToJson,
  roundOrderMoney,
  validateBonusGiftOverrides
} from "./order.detail-mappers";
import {
  orderDetailInclude,
  type BonusGiftOverrideInput,
  type CreateOrderInput,
  type OrderDetailLoaded,
  type OrderDetailRow
} from "./order.types";

${createBody}
`
);

const metaBody = [slice(1290, 1291), "", slice(1323, 2007)].join("\n");
fs.writeFileSync(
  path.join(domainDir, "order.meta.ts"),
  `${header}

import {
  bonusGiftMapToJson,
  enrichOrderDetailRow,
  parseBonusGiftSelectionsJson,
  roundOrderMoney,
  validateBonusGiftOverrides
} from "./order.detail-mappers";
import {
  orderDetailInclude,
  type OrderDetailLoaded,
  type OrderDetailRow,
  type UpdateOrderLinesInput,
  type UpdateOrderMetaInput
} from "./order.types";
import { assertOrderWarehouseBlockAssignment } from "./order.detail-mappers";

${metaBody}
`
);

// assert is used by meta - but meta imports from create which may import meta - circular!
// assertOrderWarehouseBlockAssignment is only in create slice 1293-1318 - put in detail-mappers or separate
// Fix: export assert from order.create and meta imports create - create doesn't import meta. OK.

const lifecycleBody = slice(2009, 2286);
fs.writeFileSync(
  path.join(domainDir, "order.lifecycle.ts"),
  `${header}

import { updateOrderMeta } from "./order.meta";
import {
  enrichOrderDetailRow
} from "./order.detail-mappers";
import {
  orderDetailInclude,
  type OrderDetailLoaded,
  type OrderDetailRow
} from "./order.types";

${lifecycleBody}
`
);

const listOrdersQueryType = slice(2288, 2325);
const queryBody = slice(2426, 2674);
fs.writeFileSync(
  path.join(domainDir, "order.query.ts"),
  `${header}

import {
  allowedNextForRole,
  enrichOrderDetailRow,
  loadOrdersFinanceEnrichment,
  sumBonusQty
} from "./order.detail-mappers";
import {
  orderDetailInclude,
  type ListOrdersQuery,
  type OrderDetailLoaded,
  type OrderDetailRow,
  type OrderListRow
} from "./order.types";

${listOrdersQueryType}

${queryBody}
`
);

// ListOrdersQuery should only be in types - remove duplicate from query
let queryContent = fs.readFileSync(path.join(domainDir, "order.query.ts"), "utf8");
queryContent = queryContent.replace(/\nexport type ListOrdersQuery = \{[\s\S]*?\};\n\n/, "\n");
fs.writeFileSync(path.join(domainDir, "order.query.ts"), queryContent);

// Add ListOrdersQuery to types
let typesContent = fs.readFileSync(path.join(domainDir, "order.types.ts"), "utf8");
if (!typesContent.includes("export type ListOrdersQuery")) {
  typesContent += `\n${listOrdersQueryType}\n`;
  fs.writeFileSync(path.join(domainDir, "order.types.ts"), typesContent);
}

const nakladnoyBody = slice(2676, lines.length);
fs.writeFileSync(
  path.join(domainDir, "order.nakladnoy.ts"),
  `${header}

${nakladnoyBody}
`
);

fs.writeFileSync(
  path.join(domainDir, "index.ts"),
  `export * from "./order.types";
export * from "./order.detail-mappers";
export * from "./order.query";
export * from "./order.lifecycle";
export * from "./order.meta";
export * from "./order.nakladnoy";
export * from "./order.create";
`
);

fs.writeFileSync(
  path.join(ordersDir, "orders.service.ts"),
  `/**
 * Orders domain — backward-compatible re-exports.
 * Implementation: ./domain/*
 * Rollback: orders.service.backup.ts
 */
export * from "./domain";
`
);

console.log("Split complete.");
