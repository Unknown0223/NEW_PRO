#!/usr/bin/env node
/** Top-level helpers (before export function) → {base}.prelude.tsx */
import fs from "node:fs";
import path from "node:path";

const MAX = 400;
const file = process.argv[2];
if (!file) process.exit(2);

const abs = path.resolve(file);
let lines = fs.readFileSync(abs, "utf8").split(/\r?\n/);
if (lines.length <= MAX) process.exit(0);

const exportIdx = lines.findIndex((l) => /^export\s+(default\s+)?function\s+\w+/.test(l));
if (exportIdx < 1) process.exit(0);

const prelude = lines.slice(0, exportIdx);
if (!prelude.some((l) => /^function\s+\w+/.test(l))) process.exit(0);

const dir = path.dirname(abs);
const base = path.basename(abs, ".tsx");
const preludePath = path.join(dir, `${base}.prelude.tsx`);

const preBody = prelude
  .join("\n")
  .replace(/^function\s+/gm, "export function ")
  .replace(/^(const\s+\w+\s*=\s*)function/gm, "export $1function");

const preludeNames = [...preBody.matchAll(/export function (\w+)/g)].map((m) => m[1]);

fs.writeFileSync(
  preludePath,
  (prelude[0]?.includes("use client") ? "" : '"use client";\n\n') +
    preBody +
    "\n"
);

const importLine = `import { ${preludeNames.join(", ")} } from "./${base}.prelude";\n`;
const rest = lines.slice(exportIdx);
if (!rest.some((l) => l.includes(`${base}.prelude`))) {
  const insertAt = rest[0]?.includes("use client") ? 1 : 0;
  rest.splice(insertAt + 1, 0, importLine);
}

fs.writeFileSync(abs, rest.join("\n"));
const n = rest.join("\n").split(/\r?\n/).length;
console.log(path.basename(abs), "→", n, "lines (+ prelude)");
