import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ord = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/orders");
const lines = fs.readFileSync(path.join(ord, "orders.route.backup.ts"), "utf8").split(/\r?\n/);
const slice = (a, b) => lines.slice(a - 1, b).join("\n");

const hdr = slice(1, 40).replace(
  /const catalogRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;\n\n/,
  `import { catalogRoles } from "./orders.route.shared";\n\n`
);

const fn = (name, bodyLines) => `${hdr}
export async function ${name}(app: FastifyInstance) {
${slice(bodyLines[0], bodyLines[1])}
}
`;

fs.writeFileSync(
  path.join(ord, "orders.route.shared.ts"),
  `import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";

/** Web panel + operator-like roles for order catalog/write routes. */
export const catalogRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;
`
);

const parts = [
  ["orders.route.list.ts", "registerOrderListRoutes", [42, 85]],
  ["orders.route.catalog.ts", "registerOrderCatalogRoutes", [87, 164]],
  ["orders.route.detail.ts", "registerOrderDetailRoutes", [166, 187]],
  ["orders.route.patch.ts", "registerOrderPatchRoutes", [189, 343]],
  ["orders.route.bulk.ts", "registerOrderBulkRoutes", [345, 439]],
  ["orders.route.write.ts", "registerOrderWriteRoutes", [441, 646]]
];

for (const [file, fnName, range] of parts) {
  fs.writeFileSync(path.join(ord, file), fn(fnName, range));
}

fs.writeFileSync(
  path.join(ord, "orders.route.ts"),
  `import type { FastifyInstance } from "fastify";
import { registerOrderBulkRoutes } from "./orders.route.bulk";
import { registerOrderCatalogRoutes } from "./orders.route.catalog";
import { registerOrderDetailRoutes } from "./orders.route.detail";
import { registerOrderListRoutes } from "./orders.route.list";
import { registerOrderPatchRoutes } from "./orders.route.patch";
import { registerOrderWriteRoutes } from "./orders.route.write";

export async function registerOrderRoutes(app: FastifyInstance) {
  await registerOrderListRoutes(app);
  await registerOrderCatalogRoutes(app);
  await registerOrderDetailRoutes(app);
  await registerOrderPatchRoutes(app);
  await registerOrderBulkRoutes(app);
  await registerOrderWriteRoutes(app);
}
`
);

console.log("phase13 orders.route split done");
