/**
 * Build packages/pivot-engine in-place, then atomically copy to frontend/vendor.
 * Also copies packages/pivot-ui sources to vendor/pivot-ui.
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

const staging = join(frontendRoot, "vendor", ".pivot-engine-staging");
rmSync(staging, { recursive: true, force: true });
mkdirSync(dirname(staging), { recursive: true });
cpSync(src, staging, {
  recursive: true,
  filter: (p) => !p.includes("node_modules") && !p.includes(".git")
});

rmSync(dst, { recursive: true, force: true });
cpSync(staging, dst, { recursive: true });
rmSync(staging, { recursive: true, force: true });

const nm = join(frontendRoot, "node_modules", "@salec", "pivot-engine");
if (existsSync(join(frontendRoot, "node_modules", "@salec"))) {
  rmSync(nm, { recursive: true, force: true });
  mkdirSync(dirname(nm), { recursive: true });
  cpSync(dst, nm, {
    recursive: true,
    filter: (p) => !p.includes("node_modules") && !p.includes(".git")
  });
  console.log("OK: node_modules/@salec/pivot-engine yangilandi");
}

console.log("OK: vendor/pivot-engine (dist tayyor)");

const uiSrc = join(repoRoot, "packages", "pivot-ui");
const uiDst = join(frontendRoot, "vendor", "pivot-ui");
if (existsSync(join(uiSrc, "package.json"))) {
  rmSync(uiDst, { recursive: true, force: true });
  mkdirSync(dirname(uiDst), { recursive: true });
  cpSync(uiSrc, uiDst, {
    recursive: true,
    filter: (p) => !p.includes("node_modules") && !p.includes(".git")
  });
  console.log("OK: vendor/pivot-ui");
}
