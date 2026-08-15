/**
 * packages/pivot-engine → frontend/vendor/pivot-engine
 * Railway `railway up` faqat frontend/ yuklaydi; monorepo paketini shu yerga nusxalaymiz.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(__dirname, "..");
const repoRoot = join(frontendRoot, "..");
const src = join(repoRoot, "packages", "pivot-engine");
const dst = join(frontendRoot, "vendor", "pivot-engine");

if (!existsSync(join(src, "package.json"))) {
  console.error("pivot-engine topilmadi:", src);
  process.exit(1);
}

rmSync(dst, { recursive: true, force: true });
mkdirSync(dirname(dst), { recursive: true });
cpSync(src, dst, {
  recursive: true,
  filter: (p) => !p.includes("node_modules") && !p.includes(".git")
});

const tsc = spawnSync("npx", ["--yes", "-p", "typescript@5.8.3", "tsc", "-p", "tsconfig.json"], {
  cwd: dst,
  stdio: "inherit",
  shell: true
});
if (tsc.status !== 0) {
  console.error("pivot-engine build (tsc) xato");
  process.exit(1);
}

if (!existsSync(join(dst, "dist", "index.js"))) {
  console.error("pivot-engine dist/index.js yaratilmadi");
  process.exit(1);
}

console.log("OK: vendor/pivot-engine (dist tayyor)");
