#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const hookPath = path.join(root, "components/orders/order-create/hooks/use-order-create.ts");
const lines = readFileSync(hookPath, "utf8").split(/\r?\n/);

const headerEnd = lines.findIndex((l) => l.startsWith("export function useOrderCreate"));
const importBlock = lines.slice(0, headerEnd).join("\n");
const returnIdx = lines.findIndex((l) => /^\s*return\s*\{/.test(l));
const closeIdx = lines.findIndex((l, i) => i > returnIdx && l === "  } as const;");
const returnBlock = lines.slice(returnIdx, closeIdx >= 0 ? closeIdx + 1 : returnIdx + 200);
const returnKeys = [...returnBlock.join("\n").matchAll(/^\s{4}(\w+),$/gm)].map((m) => m[1]);

const slices = [
  { file: "use-order-create-state.ts", name: "useOrderCreateState", start: 50, end: 182 },
  { file: "use-order-create-queries.ts", name: "useOrderCreateQueries", start: 183, end: 465 },
  { file: "use-order-create-lists-a.ts", name: "useOrderCreateListsA", start: 466, end: 598 },
  { file: "use-order-create-lists-b.ts", name: "useOrderCreateListsB", start: 599, end: 756 },
  { file: "use-order-create-catalog-a.ts", name: "useOrderCreateCatalogA", start: 757, end: 919 },
  { file: "use-order-create-catalog-b.ts", name: "useOrderCreateCatalogB", start: 920, end: 1045 },
  { file: "use-order-create-derived.ts", name: "useOrderCreateDerived", start: 1046, end: 1288 },
  { file: "use-order-create-mutation-a.ts", name: "useOrderCreateMutationA", start: 1289, end: 1425 },
  { file: "use-order-create-mutation-b.ts", name: "useOrderCreateMutationB", start: 1426, end: 1555 },
  { file: "use-order-create-mutation-c.ts", name: "useOrderCreateMutationC", start: 1556, end: 1620 },
  { file: "use-order-create-submit-a.ts", name: "useOrderCreateSubmitA", start: 1621, end: 1795 },
  { file: "use-order-create-submit-b.ts", name: "useOrderCreateSubmitB", start: 1796, end: 1963 }
];

function definedIn(text) {
  const names = new Set();
  for (const l of text.split("\n")) {
    let m = l.match(/^\s*const\s+(\w+)\s*=/);
    if (m) names.add(m[1]);
    m = l.match(/^\s*const\s+\[([^\]]+)\]/);
    if (m) {
      for (const part of m[1].split(",")) {
        const n = part.trim().split(":")[0]?.trim();
        if (n && /^\w+$/.test(n)) names.add(n);
      }
    }
  }
  return names;
}

function usedKeys(text, candidates) {
  return [...candidates].filter((k) => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text));
}

const hooksDir = path.dirname(hookPath);
mkdirSync(hooksDir, { recursive: true });

const priorDefined = new Set(["tenantSlug", "onCreated", "onCancel", "orderType"]);
const layerNames = [];

for (const s of slices) {
  const body = lines.slice(s.start - 1, s.end).join("\n");
  const keys = usedKeys(body, priorDefined);
  const defined = definedIn(body);
  for (const d of defined) priorDefined.add(d);

  const prevType =
    layerNames.length === 0
      ? "OrderCreateProps"
      : `ReturnType<typeof ${layerNames[layerNames.length - 1]}>`;
  const prevArg = layerNames.length === 0 ? "props" : "prev";
  const destructure =
    keys.length > 0
      ? `  const {\n${keys.map((k) => `    ${k},`).join("\n")}\n  } = ${prevArg};\n\n`
      : "";

  const retKeys = [...defined];
  const ret = retKeys.length
    ? `\n  return {\n${retKeys.map((k) => `    ${k},`).join("\n")}\n  } as const;\n`
    : "\n  return {} as const;\n";

  const propsParam =
    layerNames.length === 0
      ? "{ tenantSlug, onCreated, onCancel, orderType }: OrderCreateProps"
      : `props: OrderCreateProps, prev: ${prevType}`;

  writeFileSync(
    path.join(hooksDir, s.file),
    `${importBlock}
import type { OrderCreateProps } from "../types";

export function ${s.name}(${propsParam}) {
${destructure}${body}
${ret}}
`
  );
  layerNames.push(s.name);
  const n = readFileSync(path.join(hooksDir, s.file), "utf8").split("\n").length;
  console.log(`${s.file}\t${n}\tdeps:${keys.length}\tdefs:${retKeys.length}`);
}

const compose = `export function useOrderCreate(props: OrderCreateProps) {
${layerNames.map((n, i) => `  const l${i + 1} = ${n}(${i === 0 ? "props" : "props, l" + i});`).join("\n")}
  return { ${layerNames.map((_, i) => `...l${i + 1}`).join(", ")} } as const;
}

export type OrderCreateVm = ReturnType<typeof useOrderCreate>;
`;

writeFileSync(
  hookPath,
  `${importBlock}
${layerNames.map((n, i) => `import { ${n} } from "./${slices[i].file.replace(/\.ts$/, "")}";`).join("\n")}

${compose}`
);

console.log("main hook lines", readFileSync(hookPath, "utf8").split("\n").length);
