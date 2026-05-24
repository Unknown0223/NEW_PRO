#!/usr/bin/env node
/**
 * Katta .tsx → helpers + useHook + View + yupqa barrel (≤400 qator maqsad).
 * Ishlatish: node scripts/split-hook-view-generic.mjs path/to/file.tsx
 */
import fs from "node:fs";
import path from "node:path";

const MAX = Number.parseInt(process.env.MAX_FILE_LINES ?? "400", 10);
const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node split-hook-view-generic.mjs <file.tsx>");
  process.exit(2);
}

const abs = path.resolve(filePath);
const dir = path.dirname(abs);
const base = path.basename(abs, ".tsx");
const lines = fs.readFileSync(abs, "utf8").split(/\r?\n/);

const exportIdx = lines.findIndex((l) => /^export\s+(default\s+)?function\s+\w+/.test(l));
if (exportIdx < 0) {
  console.error("No export function found:", abs);
  process.exit(1);
}

const exportLine = lines[exportIdx];
const fnMatch = exportLine.match(/function\s+(\w+)/);
const fnName = fnMatch?.[1] ?? "Component";
const hookName = `use${fnName.replace(/Workspace$/, "").replace(/^./, (c) => c.toUpperCase())}`;
const useName = fnName.startsWith("use") ? fnName : hookName;

let returnIdx = -1;
for (let i = exportIdx + 1; i < lines.length; i++) {
  if (/^\s*return\s*\(/.test(lines[i])) {
    returnIdx = i;
    break;
  }
}
if (returnIdx < 0) {
  console.error("No return ( found:", abs);
  process.exit(1);
}

const preamble = lines.slice(0, exportIdx);
const fnSig = lines[exportIdx];
const hookBody = lines.slice(exportIdx + 1, returnIdx);
const viewBody = lines.slice(returnIdx);

const propsMatch = fnSig.match(/\(\s*(\{[^}]*\}|\w+)\s*:/);
const propsType = propsMatch ? fnSig.match(/\((\{[^}]*\}[^)]*)\)/)?.[1] ?? "{}" : "{}";

const subDir = path.join(dir, base.replace(/-workspace$/, "").replace(/\.tsx$/, "") || base);
const helpersPath = path.join(subDir, `${base}.helpers.ts`);
const hookPath = path.join(subDir, "hooks", `use-${kebab(base)}.ts`);
const viewPath = path.join(subDir, "view", `${base}-view.tsx`);
const barrelPath = path.join(dir, `${base}.tsx`);

fs.mkdirSync(path.join(subDir, "hooks"), { recursive: true });
fs.mkdirSync(path.join(subDir, "view"), { recursive: true });

const hasPreamble = preamble.some((l) => l.trim().length > 0);
if (hasPreamble) {
  const helperExports = preamble
    .filter((l) => /^function\s+\w+/.test(l) || /^export\s+function\s+\w+/.test(l))
    .map((l) => l.replace(/^function\s+/, "export function "))
    .length;
  const helperContent =
    (preamble[0]?.includes("use client") ? "" : '"use client";\n\n') +
    preamble.join("\n").replace(/^function\s+/gm, "export function ");
  fs.writeFileSync(helpersPath, ensureNl(helperContent));
}

const hookImports = `"use client";

import { api } from "@/lib/api";
${hasPreamble ? `import * as H from "../${base}.helpers";\n` : ""}
// TODO: trim imports — copied from original; run typecheck

`;

const viewImports = `"use client";

import type { ${useName}Vm } from "../hooks/use-${kebab(base)}";

`;

function kebab(s) {
  return s.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/_/g, "-").toLowerCase();
}

function ensureNl(s) {
  return s.endsWith("\n") ? s : `${s}\n`;
}

function splitChunks(arr, maxLines) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += maxLines) {
    chunks.push(arr.slice(i, i + maxLines));
  }
  return chunks;
}

const hookChunks = splitChunks(hookBody, MAX - 40);
const viewChunks = splitChunks(viewBody, MAX - 30);

if (hookChunks.length === 1) {
  fs.writeFileSync(
    hookPath,
    ensureNl(
      `${hookImports}
export type ${useName}Vm = ReturnType<typeof ${useName}>;

export function ${useName}(${propsType}) {
${hookBody.join("\n")}
}
`
    )
  );
} else {
  hookChunks.forEach((chunk, i) => {
    fs.writeFileSync(
      path.join(subDir, "hooks", `use-${kebab(base)}.part${i + 1}.ts`),
      ensureNl(`// part ${i + 1}\n${chunk.join("\n")}`)
    );
  });
  fs.writeFileSync(
    hookPath,
    ensureNl(
      `${hookImports}
export function ${useName}(${propsType}) {
${hookChunks.map((_, i) => `  // part${i + 1} inlined — merge manually`).join("\n")}
  throw new Error("Split incomplete: merge hook parts");
}
`
    )
  );
}

if (viewChunks.length === 1) {
  fs.writeFileSync(
    viewPath,
    ensureNl(
      `${viewImports}
export function ${fnName}View({ vm }: { vm: ${useName}Vm }) {
${viewBody.join("\n")}
}
`
    )
  );
} else {
  viewChunks.forEach((chunk, i) => {
    fs.writeFileSync(
      path.join(subDir, "view", `${base}-view.part${i + 1}.tsx`),
      ensureNl(`${viewImports}\nexport function Part${i + 1}() {\n${chunk.join("\n")}\n}`)
    );
  });
}

const barrel = `"use client";

import { ${useName} } from "./${path.relative(dir, hookPath).replace(/\\/g, "/").replace(/\.ts$/, "")}";
import { ${fnName}View } from "./${path.relative(dir, viewPath).replace(/\\/g, "/").replace(/\.tsx$/, "")}";

${fnSig.replace(`export function ${fnName}`, `export function ${fnName}`).replace(/\{[\s\S]*$/, "")} {
  const vm = ${useName}(${fnSig.includes("(") ? fnSig.slice(fnSig.indexOf("(") + 1, fnSig.lastIndexOf(")")) : "props"});
  return <${fnName}View vm={vm} />;
}
`;

// Simpler barrel
const propsParam = fnSig.match(/\(([\s\S]*)\)/)?.[1] ?? "props";
const simpleBarrel = `"use client";

import { ${useName} } from "./${path.relative(dir, hookPath).replace(/\\/g, "/").replace(/\.ts$/, "")}";
import { ${fnName}View } from "./${path.relative(dir, viewPath).replace(/\\/g, "/").replace(/\.tsx$/, "")}";

export function ${fnName}(${propsParam}) {
  const vm = ${useName}(${propsParam.split(":")[0]?.trim() || "props"});
  return <${fnName}View vm={vm} />;
}
`;

fs.writeFileSync(barrelPath, ensureNl(simpleBarrel));
console.log(`Split ${abs} → ${subDir}/ (backup: ${abs}.pre-split.bak)`);
if (!fs.existsSync(`${abs}.pre-split.bak`)) {
  fs.copyFileSync(abs, `${abs}.pre-split.bak`);
}
