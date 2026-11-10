#!/usr/bin/env node
/**
 * Prettier'ni faqat o'zgargan fayllarga qo'llash (butun repo'ni qayta formatlamasdan).
 *
 * Ishlatish (ildizdan):
 *   node scripts/prettier-changed.mjs            # tekshirish (check)
 *   node scripts/prettier-changed.mjs --write    # yozish (formatlash)
 *   node scripts/prettier-changed.mjs --staged   # faqat git stage'dagi fayllar
 *   BASE=origin/main node scripts/prettier-changed.mjs
 *
 * Nima uchun: repo'da 3000+ fayl bor va ularning katta qismi hozircha Prettier
 * uslubida emas. Yangi/o'zgargan fayllarnigina formatlash orqali diff shovqini
 * bo'lmaydi va kod asta-sekin bir uslubga o'tadi.
 */
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const write = args.includes("--write");
const staged = args.includes("--staged");
const base = process.env.BASE || "origin/main";

const EXTS = /\.(ts|tsx|js|jsx|mjs|cjs|json|css|md|yml|yaml)$/i;
const SKIP =
  /(^|\/)(node_modules|\.next|dist|coverage|vendor|build|assets)\/|package-lock\.json$|lint-report\.json$/;

function gitOutput(argv) {
  try {
    return execFileSync("git", argv, { cwd: repoRoot, encoding: "utf8" });
  } catch {
    return "";
  }
}

function collectFiles() {
  let out = "";
  if (staged) {
    out = gitOutput(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]);
  } else {
    out = gitOutput(["diff", "--name-only", "--diff-filter=ACMR", `${base}...HEAD`]);
    if (!out.trim()) out = gitOutput(["status", "--porcelain"]).replace(/^\s*\S+\s+/gm, "");
    // Ishchi daraxtdagi o'zgarishlar (commit qilinmagan) ham qo'shiladi.
    out += "\n" + gitOutput(["diff", "--name-only", "--diff-filter=ACMR"]);
  }
  const files = [
    ...new Set(
      out
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
    )
  ];
  return files.filter((f) => EXTS.test(f) && !SKIP.test(f));
}

const files = collectFiles();
if (files.length === 0) {
  console.log("prettier-changed: formatlanadigan o'zgargan fayl yo'q.");
  process.exit(0);
}

console.log(`prettier-changed: ${files.length} fayl (${write ? "write" : "check"})`);
const bin = path.join(
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prettier.cmd" : "prettier"
);
const res = spawnSync(bin, [write ? "--write" : "--check", ...files], {
  cwd: repoRoot,
  stdio: "inherit",
  shell: process.platform === "win32"
});

if (res.error) {
  console.error(
    "prettier-changed: prettier topilmadi. Ildizda `npm i -D prettier@3` bajaring yoki `npx prettier@3` ishlatilsin."
  );
  process.exit(2);
}
process.exit(res.status ?? 0);
