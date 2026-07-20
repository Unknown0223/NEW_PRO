/**
 * Build packages/pivot-engine in-place, then atomically swap into frontend/vendor.
 * Also copies packages/pivot-ui sources to vendor/pivot-ui.
 *
 * Muhim: eski `vendor/pivot-engine` faqat yangi staging tayyor bo‘lgach almashtiriladi —
 * crash bo‘lsa (Windows STATUS_STACK_BUFFER_OVERRUN) Next alias buzilib qolmasin.
 */
import { cpSync, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(__dirname, "..");
const repoRoot = join(frontendRoot, "..");
const src = join(repoRoot, "packages", "pivot-engine");
const dst = join(frontendRoot, "vendor", "pivot-engine");
const vendorDir = join(frontendRoot, "vendor");

function copyTree(from, to) {
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, {
    recursive: true,
    filter: (p) => !p.includes("node_modules") && !p.includes(".git")
  });
}

/** Staging tayyor bo‘lgach: dst → .old, staging → dst, keyin .old o‘chiriladi. */
function atomicReplaceDir(livePath, stagingPath) {
  const bak = `${livePath}.old`;
  rmSync(bak, { recursive: true, force: true });
  if (existsSync(livePath)) {
    renameSync(livePath, bak);
  }
  try {
    renameSync(stagingPath, livePath);
  } catch (err) {
    // Swap muvaffaqiyatsiz — eski versiyani qaytarish
    if (existsSync(bak) && !existsSync(livePath)) {
      try {
        renameSync(bak, livePath);
      } catch {
        /* ignore */
      }
    }
    throw err;
  }
  rmSync(bak, { recursive: true, force: true });
}

if (!existsSync(join(src, "package.json"))) {
  console.error("pivot-engine topilmadi:", src);
  process.exit(1);
}

const tsc = spawnSync("npx", ["tsc", "-p", "tsconfig.json"], {
  cwd: src,
  stdio: "inherit",
  shell: true
});
if (tsc.status !== 0) {
  console.error("pivot-engine build (tsc) xato");
  process.exit(1);
}

if (!existsSync(join(src, "dist", "index.js"))) {
  console.error("pivot-engine dist/index.js yaratilmadi");
  process.exit(1);
}

const staging = join(vendorDir, ".pivot-engine-staging");
rmSync(staging, { recursive: true, force: true });
mkdirSync(vendorDir, { recursive: true });
copyTree(src, staging);

if (!existsSync(join(staging, "dist", "index.js"))) {
  console.error("staging dist/index.js yo‘q — vendor o‘zgartirilmadi");
  rmSync(staging, { recursive: true, force: true });
  process.exit(1);
}

atomicReplaceDir(dst, staging);

const nm = join(frontendRoot, "node_modules", "@salec", "pivot-engine");
const nmParent = join(frontendRoot, "node_modules", "@salec");
if (existsSync(nmParent)) {
  const nmStaging = join(nmParent, ".pivot-engine-staging");
  rmSync(nmStaging, { recursive: true, force: true });
  copyTree(dst, nmStaging);
  atomicReplaceDir(nm, nmStaging);
  console.log("OK: node_modules/@salec/pivot-engine yangilandi");
}

console.log("OK: vendor/pivot-engine (dist tayyor)");

const uiSrc = join(repoRoot, "packages", "pivot-ui");
const uiDst = join(frontendRoot, "vendor", "pivot-ui");
if (existsSync(join(uiSrc, "package.json"))) {
  const uiStaging = join(vendorDir, ".pivot-ui-staging");
  rmSync(uiStaging, { recursive: true, force: true });
  copyTree(uiSrc, uiStaging);
  atomicReplaceDir(uiDst, uiStaging);
  console.log("OK: vendor/pivot-ui");
}
