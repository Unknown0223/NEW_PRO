#!/usr/bin/env node
/** Split a single view part file >400 lines into .a/.b parts */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const MAX = 350;
const file = process.argv[2];
const lines = readFileSync(file, "utf8").split(/\r?\n/);
const fnIdx = lines.findIndex((l) => /^export function/.test(l));
const retIdx = lines.findIndex((l, i) => i > fnIdx && /^\s*return\s*\(/.test(l));
const header = lines.slice(0, retIdx + 1);
const jsx = lines.slice(retIdx + 1, lines.length - 2);
const footer = lines.slice(lines.length - 2);

const mid = Math.floor(jsx.length / 2);
let split = mid;
while (split > 0 && jsx[split]?.trim() !== "") split--;
if (split < 50) split = mid;

const base = file.replace(/\.tsx$/, "");
const partA = `${base}.a.tsx`;
const partB = `${base}.b.tsx`;
const fnName = lines[fnIdx].match(/function\s+(\w+)/)?.[1];

writeFileSync(partA, [...header, ...jsx.slice(0, split), "    </>", "  );", "}", ""].join("\n"));
writeFileSync(
  partB,
  [
    ...lines.slice(0, fnIdx + 1).filter((l) => !l.includes(fnName)),
    `import { ${fnName}A } from "./${path.basename(partA).replace(/\.tsx$/, "")}";`,
    "",
    lines.slice(0, fnIdx + 1).join("\n").replace(fnName, `${fnName}B`),
    "  return (",
    "    <>",
    `      <${fnName}A {...arguments[0]} />`,
    ...jsx.slice(split),
    footer.join("\n")
  ].join("\n")
);
console.log("split", file, "->", partA, partB);
