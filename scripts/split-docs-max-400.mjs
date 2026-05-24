#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAX = Number.parseInt(process.env.MAX_FILE_LINES ?? "400", 10);
const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const targets = [
  { src: "bugun_boshlaymiz.html", outDir: "docs/archive/bugun-boshlaymiz", ext: "html" },
  { src: "optimalizatsiya.md", outDir: "docs/archive/optimalizatsiya", ext: "md" },
  { src: "bugs-va-xatolar.md", outDir: "docs/archive/bugs-va-xatolar", ext: "md" }
];

function splitLines(lines, maxSize) {
  const chunks = [];
  let start = 0;
  while (start < lines.length) {
    if (lines.length - start <= maxSize) {
      chunks.push(lines.slice(start));
      break;
    }
    let end = Math.min(start + maxSize, lines.length);
    while (end > start + 20 && lines[end]?.trim() !== "") end--;
    if (end <= start + 20) end = start + maxSize;
    chunks.push(lines.slice(start, end));
    start = end;
  }
  return chunks;
}

for (const t of targets) {
  const srcPath = path.join(repoRoot, t.src);
  if (!fs.existsSync(srcPath)) {
    console.warn("skip missing", t.src);
    continue;
  }
  const lines = fs.readFileSync(srcPath, "utf8").split(/\r?\n/);
  if (lines.length <= MAX) {
    console.log("ok", t.src, lines.length);
    continue;
  }
  const outDir = path.join(repoRoot, t.outDir);
  fs.mkdirSync(outDir, { recursive: true });
  const chunks = splitLines(lines, MAX - 5);
  const parts = [];
  for (let i = 0; i < chunks.length; i++) {
    const name = `part-${String(i + 1).padStart(2, "0")}.${t.ext}`;
    fs.writeFileSync(path.join(outDir, name), `${chunks[i].join("\n")}\n`);
    parts.push(name);
  }
  const index =
    t.ext === "md"
      ? `# ${path.basename(t.src, ".md")}\n\nBo‘limlar:\n${parts.map((p) => `- [${p}](./${p})`).join("\n")}\n`
      : `<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>${t.src}</title></head><body><ul>${parts.map((p) => `<li><a href="./${p}">${p}</a></li>`).join("")}</ul></body></html>\n`;
  fs.writeFileSync(path.join(outDir, `index.${t.ext === "md" ? "md" : "html"}`), index);
  fs.writeFileSync(srcPath, index);
  console.log("split", t.src, "->", t.outDir, parts.length, "parts");
}
