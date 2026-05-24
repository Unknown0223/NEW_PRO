#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAX = 400;
const CHUNK = 320;
const file = path.resolve(process.argv[2]);
const fnName = process.argv[3];
const vmType = process.argv[4] ?? "OrderCreateVm";
const vmImport = process.argv[5] ?? "../hooks/use-order-create";

const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
const fnIdx = lines.findIndex((l) => l.includes(`export function ${fnName}`));
if (fnIdx < 0) throw new Error(`function ${fnName} not found in ${file}`);
const retIdx = lines.findIndex((l, i) => i > fnIdx && /^\s*return\s*\(/.test(l));
if (retIdx < 0) throw new Error(`return ( not found in ${file}`);
let depth = 0;
let endIdx = retIdx;
for (let i = retIdx; i < lines.length; i++) {
  for (const ch of lines[i]) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
  }
  if (i > retIdx && depth <= 0 && /^\s*\);\s*$/.test(lines[i])) {
    endIdx = i;
    break;
  }
}
const header = lines.slice(0, fnIdx + 1).join("\n");
const inner = lines.slice(retIdx + 1, endIdx);
const mid = Math.floor(inner.length / 2);
let splitAt = mid;
while (splitAt > 20 && inner[splitAt]?.trim() !== "") splitAt--;
const a = inner.slice(0, splitAt);
const b = inner.slice(splitAt);
const dir = path.dirname(file);
const base = path.basename(file, ".tsx");
const p1 = path.join(dir, `${base}.a.tsx`);
const p2 = path.join(dir, `${base}.b.tsx`);
const imp = lines.slice(0, fnIdx).filter((l) => l.startsWith("import") || l.includes("use client")).join("\n");
const mk = (suffix, body, partFn) => `${imp}
import type { ${vmType} } from "${vmImport}";

export function ${partFn}({ vm }: { vm: ${vmType} }) {
  return (
    <>
${body.join("\n")}
    </>
  );
}
`;
fs.writeFileSync(p1, mk("a", a, `${fnName}A`));
fs.writeFileSync(p2, mk("b", b, `${fnName}B`));
fs.writeFileSync(
  file,
  `${imp}
import type { ${vmType} } from "${vmImport}";
import { ${fnName}A } from "./${base}.a";
import { ${fnName}B } from "./${base}.b";

export function ${fnName}({ vm }: { vm: ${vmType} }) {
  return (
    <>
      <${fnName}A vm={vm} />
      <${fnName}B vm={vm} />
    </>
  );
}
`
);
console.log("split", file, fs.readFileSync(p1, "utf8").split("\n").length, fs.readFileSync(p2, "utf8").split("\n").length);
