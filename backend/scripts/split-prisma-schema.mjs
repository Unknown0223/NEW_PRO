#!/usr/bin/env node
/**
 * schema.prisma → schema.prisma (generator/datasource) + models/*.prisma (≤400 lines)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAX = Number.parseInt(process.env.MAX_FILE_LINES ?? "395", 10);
const prismaDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "prisma");
const schemaPath = path.join(prismaDir, "schema.prisma");
const modelsDir = path.join(prismaDir, "models");

const text = fs.readFileSync(schemaPath, "utf8");
const lines = text.split(/\r?\n/);

let headerEnd = 0;
for (let i = 0; i < lines.length; i++) {
  if (/^model\s+\w+/.test(lines[i])) {
    headerEnd = i;
    break;
  }
}
const header = lines.slice(0, headerEnd).join("\n");

const modelBlocks = [];
let i = headerEnd;
while (i < lines.length) {
  if (!/^model\s+\w+/.test(lines[i])) {
    i++;
    continue;
  }
  const start = i;
  i++;
  while (i < lines.length && !/^model\s+\w+/.test(lines[i])) i++;
  modelBlocks.push(lines.slice(start, i).join("\n"));
}

fs.mkdirSync(modelsDir, { recursive: true });
const files = [];
let chunk = [];
let chunkLines = 0;
let fileIdx = 1;

function flush() {
  if (chunk.length === 0) return;
  const name = `group-${String(fileIdx).padStart(2, "0")}.prisma`;
  fileIdx++;
  const p = path.join(modelsDir, name);
  fs.writeFileSync(p, `${chunk.join("\n\n")}\n`);
  files.push(name);
  chunk = [];
  chunkLines = 0;
}

for (const block of modelBlocks) {
  const n = block.split("\n").length;
  if (chunkLines + n > MAX && chunk.length > 0) flush();
  chunk.push(block);
  chunkLines += n;
}
flush();

const mainSchema = `${header.trim()}\n`;
fs.writeFileSync(schemaPath, mainSchema);
console.log(`Wrote ${files.length} model files in prisma/models/`);
