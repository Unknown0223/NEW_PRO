#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [startLine, endLine, componentName, outName] = process.argv.slice(2).map((x, i) =>
  i < 2 ? Number(x) : x
);
if (!startLine || !endLine || !componentName || !outName) {
  console.error(
    "Usage: node extract-order-create-section.mjs <start> <end> <ComponentName> <out-file.tsx>"
  );
  process.exit(1);
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcPath = path.join(root, "components/orders/order-create-workspace.tsx");
const lines = readFileSync(srcPath, "utf8").split(/\r?\n/");
const chunk = lines.slice(startLine - 1, endLine).join("\n");

const outPath = path.join(root, "components/orders/order-create", outName);
const content = `"use client";

import type { OrderCreateVm } from "./order-create-vm";

export function ${componentName}({ vm }: { vm: OrderCreateVm }) {
  const {
${extractDestructuring(chunk)}
  } = vm;

  return (
${indent(chunk, 4)}
  );
}
`;

writeFileSync(outPath, content, "utf8");
console.log("wrote", outPath, "lines", content.split("\n").length);

function indent(s, n) {
  const pad = " ".repeat(n);
  return s
    .split("\n")
    .map((l) => (l.trim() ? pad + l : l))
    .join("\n");
}

function extractDestructuring(chunk) {
  const ids = new Set();
  const re = /\b([a-z][a-zA-Z0-9]*)\b/g;
  let m;
  const skip = new Set([
    "true",
    "false",
    "null",
    "return",
    "const",
    "let",
    "var",
    "if",
    "else",
    "new",
    "typeof",
    "void",
    "className",
    "type",
    "button",
    "div",
    "span",
    "string",
    "number",
    "async",
    "await",
    "from",
    "import"
  ]);
  while ((m = re.exec(chunk))) {
    const id = m[1];
    if (skip.has(id) || id.length < 2) continue;
    if (/^[A-Z]/.test(id) && !id.endsWith("Props")) ids.add(id);
    else if (
      [
        "tenantSlug",
        "clientId",
        "warehouseId",
        "agentId",
        "mutation",
        "isPolkiSheet",
        "isPolkiFree",
        "isPolkiByOrder",
        "isExchangeFlow",
        "onCancel",
        "onCreated",
        "createCtxQ",
        "stockQ",
        "polkiContextQ",
        "canSubmit",
        "localError",
        "selectionNotice"
      ].includes(id) ||
      id.startsWith("polki") ||
      id.startsWith("setPolki") ||
      id.startsWith("ex") ||
      id.startsWith("setEx") ||
      id.startsWith("can") ||
      id.startsWith("has") ||
      id.startsWith("selected") ||
      id.endsWith("Q") ||
      id.includes("Label") ||
      id.includes("Options") ||
      id.includes("Products") ||
      id.includes("Categories")
    ) {
      ids.add(id);
    }
  }
  return [...ids].sort().join(",\n");
}
