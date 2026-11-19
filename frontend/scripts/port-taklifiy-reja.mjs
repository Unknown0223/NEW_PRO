/**
 * packages/plans-proposal-demo/src → frontend/components/plans/taklifiy-reja
 * `@/` → `@taklifiy/` (Next path alias).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.join(frontendRoot, "..");
const srcRoot = path.join(repoRoot, "packages", "plans-proposal-demo", "src");
const destRoot = path.join(frontendRoot, "components", "plans", "taklifiy-reja");

const SKIP = new Set(["main.tsx", "App.tsx"]);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function rewrite(text) {
  return text
    .replace(/(from\s+['"])@\//g, "$1@taklifiy/")
    .replace(/(import\s*\(\s*['"])@\//g, "$1@taklifiy/");
}

if (!fs.existsSync(srcRoot)) {
  console.error("[port-taklifiy-reja] demo src topilmadi:", srcRoot);
  process.exit(1);
}

fs.mkdirSync(destRoot, { recursive: true });
const files = walk(srcRoot).filter((f) => !SKIP.has(path.basename(f)));
let n = 0;
for (const file of files) {
  const rel = path.relative(srcRoot, file);
  const dest = path.join(destRoot, rel === "index.css" ? "taklifiy-reja.css" : rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  let text = fs.readFileSync(file, "utf8");
  if (/\.(tsx|ts)$/.test(file)) text = rewrite(text);
  if (path.basename(dest) === "taklifiy-reja.css") {
    text = text
      .replace('@import "tailwindcss";\n\n', "")
      .replace(/:root \{[\s\S]*?\n\}\n/, "")
      .replace(/body \{[\s\S]*?\n\}\n/, "");
    text = `/* Taklifiy reja — panel ichida (scoped). */\n.taklifiy-root {\n  color-scheme: light;\n  color: #243b34;\n}\n\n${text}`;
  }
  fs.writeFileSync(dest, text);
  n += 1;
}
console.log(`[port-taklifiy-reja] OK → ${n} fayl (${destRoot})`);
