/**
 * Split order.query.ts → order.query.list.ts + order.query.detail.ts + barrel
 */
import fs from "node:fs";
import path from "node:path";

const domainDir = path.resolve("src/modules/orders/domain");
const srcPath = path.join(domainDir, "order.query.ts");
const lines = fs.readFileSync(srcPath, "utf8").split(/\r?\n/);

const header = lines.slice(0, 71).join("\n");

const listBody = lines.slice(72, 518).join("\n");
fs.writeFileSync(
  path.join(domainDir, "order.query.list.ts"),
  `${header}

${listBody}
`,
  "utf8"
);

const detailBody = lines.slice(519).join("\n");
fs.writeFileSync(
  path.join(domainDir, "order.query.detail.ts"),
  `/** Order detail query. */
import { prisma } from "../../../config/database";
import { enrichOrderDetailRow } from "./order.detail-mappers";
import { orderDetailInclude, type OrderDetailLoaded, type OrderDetailRow } from "./order.types";

${detailBody}
`,
  "utf8"
);

fs.writeFileSync(
  srcPath,
  `export * from "./order.query.list";
export * from "./order.query.detail";
`,
  "utf8"
);

console.log("Split order.query.ts");
