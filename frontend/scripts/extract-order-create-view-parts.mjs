#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const viewDir = path.join(root, "components/orders/order-create/view");
const viewPath = path.join(viewDir, "order-create-view.tsx");
const lines = readFileSync(viewPath, "utf8").split(/\r?\n/);

const hookSrc = readFileSync(
  path.join(root, "components/orders/order-create/hooks/use-order-create.ts"),
  "utf8"
);
const vmKeys = [...hookSrc.matchAll(/^\s{4}(\w+),$/gm)].map((m) => m[1]);
const importBlock = lines.slice(0, 43).join("\n");

function usedKeys(text) {
  return vmKeys.filter((k) => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text));
}

function writePart(file, name, start, end) {
  const body = lines.slice(start - 1, end).join("\n");
  const keys = usedKeys(body);
  writeFileSync(
    path.join(viewDir, file),
    `${importBlock}
import type { OrderCreateVm } from "../hooks/use-order-create";

export function ${name}({ vm }: { vm: OrderCreateVm }) {
  const {\n${keys.map((k) => `    ${k},`).join("\n")}\n  } = vm;
  return (\n    <>\n${body}\n    </>\n  );
}
`
  );
  console.log(file, end - start + 1, "body lines");
}

writePart("order-create-view-header.tsx", "OrderCreateViewHeader", 246, 337);
writePart("order-create-flow-notes.tsx", "OrderCreateFlowNotes", 400, 432);
writePart("order-create-view-footer.tsx", "OrderCreateViewFooter", 2052, 2083);

const composed = [
  ...lines.slice(0, 43),
  'import type { OrderCreateVm } from "../hooks/use-order-create";',
  'import { OrderCreateViewHeader } from "./order-create-view-header";',
  'import { OrderCreateFlowNotes } from "./order-create-flow-notes";',
  'import { OrderCreateViewFooter } from "./order-create-view-footer";',
  "",
  ...lines.slice(44, 244),
  "  return (",
  "    <PageShell>",
  "      <OrderCreateViewHeader vm={vm} />",
  "",
  ...lines.slice(338, 399),
  "        <OrderCreateFlowNotes vm={vm} />",
  "",
  ...lines.slice(433, 2051),
  "",
  "      <OrderCreateViewFooter vm={vm} />",
  "",
  ...lines.slice(2084)
].join("\n");

writeFileSync(viewPath, composed);
console.log("order-create-view.tsx", composed.split(/\n/).length, "lines");
