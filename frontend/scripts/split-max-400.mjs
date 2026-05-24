#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAX = Number.parseInt(process.env.MAX_FILE_LINES ?? "400", 10);
const CHUNK = MAX - 120;
const frontendRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function ensureNl(s) {
  return s.endsWith("\n") ? s : `${s}\n`;
}
function lineCount(p) {
  return fs.readFileSync(p, "utf8").split(/\r?\n/).length;
}
function extractImports(lines, endIdx) {
  const out = [];
  let i = 0;
  if (lines[0]?.includes("use client")) {
    out.push(lines[0]);
    i = 1;
  }
  while (i < endIdx) {
    if (lines[i].startsWith("import ")) {
      let block = lines[i];
      i++;
      while (i < endIdx && !block.trimEnd().endsWith(";")) {
        block += `\n${lines[i]}`;
        i++;
      }
      out.push(block);
    } else if (lines[i].trim() === "") i++;
    else break;
  }
  return out.join("\n");
}
function splitAtBlank(lines, maxSize) {
  const chunks = [];
  let start = 0;
  while (start < lines.length) {
    if (lines.length - start <= maxSize) {
      chunks.push(lines.slice(start));
      break;
    }
    let end = Math.min(start + maxSize, lines.length);
    while (end > start + 40 && lines[end]?.trim() !== "") end--;
    if (end <= start + 40) end = start + maxSize;
    chunks.push(lines.slice(start, end));
    start = end;
  }
  return chunks;
}
function findDefinedNames(lines) {
  const names = new Set();
  for (const l of lines) {
    let m = l.match(/^\s*const\s+(\w+)\s*=/);
    if (m) names.add(m[1]);
    m = l.match(/^\s*function\s+(\w+)\s*\(/);
    if (m) names.add(m[1]);
  }
  return [...names];
}
function findUsedNames(lines, candidates) {
  const text = lines.join("\n");
  return candidates.filter((n) => new RegExp(`\\b${n}\\b`).test(text));
}

function splitHookFile(hookPath, hookExportName) {
  const lines = fs.readFileSync(hookPath, "utf8").split(/\r?\n/);
  const fnIdx = lines.findIndex((l) => l.includes(`export function ${hookExportName}`));
  const returnIdx = lines.findIndex((l, i) => i > fnIdx && /^\s*return\s*\{/.test(l));
  if (fnIdx < 0 || returnIdx < 0) throw new Error("hook markers not found");
  const imports = extractImports(lines, fnIdx);
  const propsInner = lines[fnIdx].match(/\(([\s\S]*)\)/)?.[1] ?? "";
  const body = lines.slice(fnIdx + 1, returnIdx);
  const returnBlock = lines.slice(returnIdx);
  if (body.length <= CHUNK) return;

  const dir = path.dirname(hookPath);
  const base = path.basename(hookPath, ".ts");
  const chunks = splitAtBlank(body, CHUNK);
  const partNames = [];
  const allDefined = chunks.map((c) => findDefinedNames(c));

  for (let i = 0; i < chunks.length; i++) {
    const partName = `${hookExportName}Part${i + 1}`;
    partNames.push(partName);
    const need = new Set();
    for (let j = 0; j < i; j++) findUsedNames(chunks[i], allDefined[j]).forEach((n) => need.add(n));
    const destructure =
      need.size > 0
        ? `  const {\n${[...need].map((k) => `    ${k},`).join("\n")}\n  } = p${i};\n\n`
        : "";
    const partImports =
      i === 0
        ? `import type { OrderCreateProps } from "../types";\nimport "../use-order-create.imports";\n`
        : `import type { OrderCreateProps } from "../types";\nimport { ${partNames[i - 1]} } from "./${base}.part${i}";\n`;
    const keys = findDefinedNames(chunks[i]);
    fs.writeFileSync(
      path.join(dir, `${base}.part${i + 1}.ts`),
      ensureNl(`"use client";\n\n${partImports}
export function ${partName}(${i === 0 ? propsInner : `${propsInner}, p${i}: ReturnType<typeof ${partNames[i - 1]}>`}) {
${destructure}${chunks[i].join("\n")}
  return {\n${keys.map((k) => `    ${k},`).join("\n")}\n  };
}
`)
    );
  }

  const call = propsInner.trim() ? propsInner.split(":")[0].trim() : "";
  fs.writeFileSync(
    hookPath,
    ensureNl(`${imports}
${partNames.map((n, i) => `import { ${n} } from "./${base}.part${i + 1}";`).join("\n")}

export function ${hookExportName}(${propsInner}) {
${partNames.map((n, i) => `  const l${i + 1} = ${n}(${i === 0 ? call : `${call}, l${i}`});`).join("\n")}
  return { ${partNames.map((_, i) => `...l${i + 1}`).join(", ")} };
}

export type OrderCreateVm = ReturnType<typeof ${hookExportName}>;
`)
  );
}

const mode = process.argv[2];
if (mode === "order-create-hook") {
  splitHookFile(path.join(frontendRoot, "components/orders/order-create/hooks/use-order-create.ts"), "useOrderCreate");
  for (const f of fs.readdirSync(path.join(frontendRoot, "components/orders/order-create/hooks"))) {
    if (f.match(/use-order-create\.part\d+\.ts$/) && lineCount(path.join(frontendRoot, "components/orders/order-create/hooks", f)) > MAX) {
      console.warn("still >400:", f);
    }
  }
} else {
  console.error("Usage: node split-max-400.mjs order-create-hook");
  process.exit(2);
}
