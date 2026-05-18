#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(__dirname, "../components/orders/order-create-workspace.tsx");
const s = readFileSync(target, "utf8");
const marker = "export function OrderCreateWorkspace";
const idx = s.indexOf(marker);
if (idx < 0) throw new Error("marker not found");
const propsIdx = s.indexOf("type Props = {");
if (propsIdx < 0) throw new Error("Props not found");
const head = s.slice(0, propsIdx);
const tail = s.slice(idx);
const imports = [
  "import type { OrderCreateProps as Props } from \"@/components/orders/order-create/types\";",
  "import { fieldClass, MAX_POLKI_RETURN_QTY, POLKI_TRADE_DIRECTION_OPTS, POLKI_SKIDKA_OPTS } from \"@/components/orders/order-create/constants\";",
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
  "} from \"@/components/orders/order-create/utils\";",
  "import { CategoryIssueCountBadge } from \"@/components/orders/order-create/category-issue-badge\";",
  "import { PolkiReturnLinesTable } from \"@/components/orders/order-create/polki-return-lines-table\";",
  "import { PolkiClientSearchSelect } from \"@/components/orders/order-create/polki-client-search-select\";",
  ""
].join("\n");
const newContent = head + imports + tail;
writeFileSync(target, newContent);
console.log("lines", newContent.split(/\r?\n/).length);
