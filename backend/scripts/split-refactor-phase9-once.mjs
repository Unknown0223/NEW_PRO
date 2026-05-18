import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/orders");
const read = (p) => fs.readFileSync(p, "utf8").split(/\r?\n/);
const slice = (lines, a, b) => lines.slice(a - 1, b).join("\n");

// --- order-bonus-qty-sum ---
const bonus = read(path.join(root, "order-bonus-qty-sum.ts"));
const bonusH = slice(bonus, 1, 36);

fs.writeFileSync(
  path.join(root, "order-bonus-sum.ts"),
  `${bonusH}
${slice(bonus, 38, 166)}
`
);

fs.writeFileSync(
  path.join(root, "order-bonus-qty.ts"),
  `${bonusH}
${slice(bonus, 168, bonus.length)}
`
);

fs.writeFileSync(
  path.join(root, "order-bonus-qty-sum.ts"),
  `/** Qty + sum threshold bonus lines — barrel. */\nexport * from "./order-bonus-sum";\nexport * from "./order-bonus-qty";\n`
);

// --- order-create-context.catalog ---
const ctx = read(path.join(root, "order-create-context.service.ts"));
const ctxH = slice(ctx, 1, 19);

fs.writeFileSync(
  path.join(root, "order-create-context.catalog.ts"),
  `${ctxH}
import {
  resolveConstraintScope,
  type LinkageSelectedMasters
} from "../linkage/linkage.service";

${slice(ctx, 20, 56)}

${slice(ctx, 386, ctx.length)}
`
);

fs.writeFileSync(
  path.join(root, "order-create-context.service.ts"),
  `${ctxH}
import {
  getOrderCreateCatalogBundle,
  loadOrderCreateCatalogSlice,
  type OrderCreateCatalogBundle
} from "./order-create-context.catalog";

${slice(ctx, 58, 385)}
`
);

// Re-export catalog API from main entry for route imports
let svc = fs.readFileSync(path.join(root, "order-create-context.service.ts"), "utf8");
if (!svc.includes("export { getOrderCreateCatalogBundle")) {
  svc += `\nexport { getOrderCreateCatalogBundle, type OrderCreateCatalogBundle } from "./order-create-context.catalog";\n`;
  fs.writeFileSync(path.join(root, "order-create-context.service.ts"), svc);
}

// Export loadOrderCreateCatalogSlice for service
let cat = fs.readFileSync(path.join(root, "order-create-context.catalog.ts"), "utf8");
cat = cat.replace(/^async function loadOrderCreateCatalogSlice/m, "export async function loadOrderCreateCatalogSlice");
fs.writeFileSync(path.join(root, "order-create-context.catalog.ts"), cat);

console.log("phase9 bonus + create-context done");
