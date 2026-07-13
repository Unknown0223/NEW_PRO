#!/usr/bin/env node
import fs, { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const viewDir = path.join(root, "components/orders/order-create/view");
const sourcePath = path.join(viewDir, "order-create-view.monolith.tsx");
const fallbackPath = path.join(viewDir, "order-create-view.tsx");
const sourceFile = fs.existsSync(sourcePath) ? sourcePath : fallbackPath;
const lines = readFileSync(sourceFile, "utf8").split(/\r?\n/);

const hooksDir = path.join(root, "components/orders/order-create/hooks");
const vmKeys = [];
for (const name of fs.readdirSync(hooksDir)) {
  if (!name.startsWith("use-order-create") || !name.endsWith(".ts")) continue;
  const src = readFileSync(path.join(hooksDir, name), "utf8");
  for (const m of src.matchAll(/^\s{4}(\w+),$/gm)) vmKeys.push(m[1]);
}
const vmKeysUnique = [...new Set(vmKeys)];
const importBlock = lines.slice(0, 37).join("\n");

const slices = [
  { file: "order-create-view-header.tsx", name: "OrderCreateViewHeader", start: 194, end: 284 },
  { file: "order-create-view-alerts.tsx", name: "OrderCreateViewAlerts", start: 292, end: 379, wrap: true },
  { file: "order-create-form-section.tsx", name: "OrderCreateFormSection", start: 381, end: 1321, wrap: true },
  { file: "order-create-catalog-section.tsx", name: "OrderCreateCatalogSection", start: 1323, end: 1976, wrap: true },
  { file: "order-create-view-footer.tsx", name: "OrderCreateViewFooter", start: 1979, end: 2024, wrap: true }
];

function usedKeys(text) {
  return vmKeysUnique.filter((k) => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text));
}

function emitSection(s) {
  const body = lines.slice(s.start - 1, s.end).join("\n");
  const keys = usedKeys(body);
  const destructure = `  const {\n${keys.map((k) => `    ${k},`).join("\n")}\n  } = vm;\n\n`;
  const inner = s.wrap ? `  return (\n    <>\n${body}\n    </>\n  );` : `  return (\n${body}\n  );`;
  writeFileSync(
    path.join(viewDir, s.file),
    `${importBlock}
import type { OrderCreateVm } from "../hooks/use-order-create";

export function ${s.name}({ vm }: { vm: OrderCreateVm }) {
${destructure}${inner}
}
`
  );
  const n = readFileSync(path.join(viewDir, s.file), "utf8").split(/\n/).length;
  console.log(`${s.file}\t${n}\tkeys:${keys.length}`);
}

mkdirSync(viewDir, { recursive: true });
for (const s of slices) emitSection(s);

const barrel = (file, name, parts) => `${importBlock}
import type { OrderCreateVm } from "../hooks/use-order-create";
${parts.map((p) => `import { ${p.name} } from "./${p.file.replace(".tsx", "")}";`).join("\n")}

export function ${name}({ vm }: { vm: OrderCreateVm }) {
  return (
    <>
${parts.map((p) => `      <${p.name} vm={vm} />`).join("\n")}
    </>
  );
}
`;

writeFileSync(
  path.join(viewDir, "order-create-view.tsx"),
  `${importBlock}
import type { OrderCreateVm } from "../hooks/use-order-create";
import { PolkiShelfReturnView } from "./polki-shelf-return/polki-shelf-return-view";
import { OrderCreateViewHeader } from "./order-create-view-header";
import { OrderCreateViewAlerts } from "./order-create-view-alerts";
import { OrderCreateFormSection } from "./order-create-form-section";
import { OrderCreateCatalogSection } from "./order-create-catalog-section";
import { OrderCreateViewFooter } from "./order-create-view-footer";

export function OrderCreateView({ vm }: { vm: OrderCreateVm }) {
  if (vm.isPolkiSheet) {
    return <PolkiShelfReturnView vm={vm} />;
  }

  return (
    <PageShell>
      <OrderCreateViewHeader vm={vm} />
      <div className="flex w-full min-w-0 flex-col gap-6 pb-32">
        <OrderCreateViewAlerts vm={vm} />
        <OrderCreateFormSection vm={vm} />
        <OrderCreateCatalogSection vm={vm} />
      </div>
      <OrderCreateViewFooter vm={vm} />
    </PageShell>
  );
}
`
);

console.log("done");

