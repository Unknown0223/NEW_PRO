#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const hookPath = path.join(root, "components/orders/order-create/hooks/use-order-create.ts");
const viewPath = path.join(root, "components/orders/order-create/view/order-create-view.tsx");

let hook = readFileSync(hookPath, "utf8");

if (!hook.includes('from "../types"')) {
  hook = hook
    .replace('from "./types"', 'from "../types"')
    .replace('from "./constants"', 'from "../constants"')
    .replace('from "./utils"', 'from "../utils"')
    .replace(
      'import type { OrderCreateProps } from "../types";',
      `import type {
  OrderCreateProps,
  PolkiOrderPickRow,
  PolkiPairRowModel,
  PolkiClientItem,
  PolkiOrderGroup
} from "../types";`
    )
    .replace(
      /import \{ CategoryIssueCountBadge \} from "\.\/category-issue-badge";\nimport \{ PolkiReturnLinesTable \} from "\.\/polki-return-lines-table";\nimport \{ PolkiClientSearchSelect \} from "\.\/polki-client-search-select";\n/,
      ""
    );
}

const fnStart = hook.indexOf("export function useOrderCreate");
const returnStart = hook.indexOf("\n  return {", fnStart);
const body = hook.slice(fnStart, returnStart);

const names = new Set();
for (const m of body.matchAll(/^  const \[(\w+), (set\w+)\]/gm)) {
  names.add(m[1]);
  names.add(m[2]);
}
for (const m of body.matchAll(/^  const \[(\w+)\] =/gm)) names.add(m[1]);
for (const m of body.matchAll(/^  const (\w+) =/gm)) names.add(m[1]);

const params = ["tenantSlug", "onCreated", "onCancel", "orderType"];
const ordered = [...params, ...[...names].filter((n) => !params.includes(n)).sort()];

const returnBlock = `  return {\n${ordered.map((n) => `    ${n},`).join("\n")}\n  } as const;\n}\n\nexport type OrderCreateVm = ReturnType<typeof useOrderCreate>;\n`;

const afterReturn = hook.indexOf("export type OrderCreateVm", returnStart);
hook =
  afterReturn > returnStart
    ? hook.slice(0, returnStart) + "\n" + returnBlock
    : hook.slice(0, returnStart) + "\n" + returnBlock;

writeFileSync(hookPath, hook);

let view = readFileSync(viewPath, "utf8");
const destructureStart = view.indexOf("  const {");
const destructureEnd = view.indexOf("  } = vm;", destructureStart) + "  } = vm;".length;
view =
  view.slice(0, destructureStart) +
  `  const {\n${ordered.map((k) => `    ${k},`).join("\n")}\n  } = vm;` +
  view.slice(destructureEnd);

if (!view.includes("POLKI_PRICE_TYPE_LABEL_RU")) {
  view = view.replace(
    'import { fieldClass, MAX_POLKI_RETURN_QTY, POLKI_TRADE_DIRECTION_OPTS, POLKI_SKIDKA_OPTS } from "../constants";',
    'import { fieldClass, MAX_POLKI_RETURN_QTY, POLKI_TRADE_DIRECTION_OPTS, POLKI_SKIDKA_OPTS, POLKI_PRICE_TYPE_LABEL_RU } from "../constants";'
  );
}
if (!view.includes("parseStockQty")) {
  view = view.replace(
    'import {\n  parsePriceAmount,',
    'import {\n  parseStockQty,\n  parsePriceAmount,'
  );
}

writeFileSync(viewPath, view);
console.log("vm keys:", ordered.length);
