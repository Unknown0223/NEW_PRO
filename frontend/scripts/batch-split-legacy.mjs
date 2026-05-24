#!/usr/bin/env node
/**
 * legacy-max-loc-frontend.txt dagi fayllarni split-workspace-file orqali bo‘ladi.
 * View: faqat hook bo‘linadi; view >400 bo‘lsa top-level JSX bo‘yicha sections.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const frontendRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.join(frontendRoot, "..");
const legacyPath = path.join(repoRoot, "scripts", "legacy-max-loc-frontend.txt");
const files = fs
  .readFileSync(legacyPath, "utf8")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean);

let ok = 0;
let fail = 0;
for (const rel of files) {
  if (rel.includes("order-create/hooks/") || rel.includes("order-create/view/order-create-view")) continue;
  const abs = path.join(repoRoot, rel);
  if (!fs.existsSync(abs)) {
    console.warn("missing", rel);
    fail++;
    continue;
  }
  const r = spawnSync(process.execPath, ["scripts/split-workspace-file.mjs", "file", abs], {
    cwd: frontendRoot,
    encoding: "utf8",
    stdio: "pipe"
  });
  if (r.status === 0) {
    ok++;
    console.log("OK", rel);
  } else {
    fail++;
    console.error("FAIL", rel, (r.stderr || r.stdout || "").split("\n").slice(-3).join(" "));
  }
}

console.log(`\nDone: ${ok} ok, ${fail} fail`);
