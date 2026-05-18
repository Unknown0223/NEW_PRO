#!/usr/bin/env node
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.join(root, "..");

const monolith = execSync("git show HEAD:frontend/components/orders/order-create-workspace.tsx", {
  cwd: repoRoot,
  encoding: "utf8"
});

const marker = "export function OrderCreateWorkspace";
const propsIdx = monolith.indexOf("type Props = {");
const idx = monolith.indexOf(marker);
const head = monolith.slice(0, propsIdx);
const tail = monolith.slice(idx);
const imports = [
  'import type { OrderCreateProps as Props } from "@/components/orders/order-create/types";',
  'import { fieldClass, MAX_POLKI_RETURN_QTY, POLKI_TRADE_DIRECTION_OPTS, POLKI_SKIDKA_OPTS } from "@/components/orders/order-create/constants";',
  "import {",
  "  parsePriceAmount,",
  "  parseStockQty,",
  "  availableOrderQty,",
  "  formatQtyState,",
  "  orderStatusLabelRu,",
  "  currentMonthEndIsoDate,",
  "  unitPriceForType,",
  "  buildPolkiPairRows,",
  "  polkiSplitTotal,",
  "  isPolkiShelfSourceOrder,",
  "  isPolkiReturnByOrderPickable,",
  "  polkiOrderRowHasBonus",
  '} from "@/components/orders/order-create/utils";',
  'import { CategoryIssueCountBadge } from "@/components/orders/order-create/category-issue-badge";',
  'import { PolkiReturnLinesTable } from "@/components/orders/order-create/polki-return-lines-table";',
  'import { PolkiClientSearchSelect } from "@/components/orders/order-create/polki-client-search-select";',
  ""
].join("\n");

const deduped = head + imports + tail;
const srcPath = path.join(root, "components/orders/order-create/order-create-workspace.tsx");
writeFileSync(srcPath, deduped);
writeFileSync(
  path.join(root, "components/orders/order-create-workspace.tsx"),
  '/** Zakaz yaratish — barrel. */\nexport { OrderCreateWorkspace } from "./order-create/order-create-workspace";\n'
);
console.log("deduped lines", deduped.split(/\n/).length);
