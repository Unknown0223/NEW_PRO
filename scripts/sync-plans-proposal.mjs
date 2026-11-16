/**
 * packages/plans-proposal → backend/vendor + frontend/vendor (Docker build context).
 * Deploy oldidan: node scripts/sync-plans-proposal.mjs
 */
import { cpSync, existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "packages", "plans-proposal");
const targets = [
  join(root, "backend", "vendor", "plans-proposal"),
  join(root, "frontend", "vendor", "plans-proposal")
];

if (!existsSync(join(src, "package.json"))) {
  console.error("packages/plans-proposal topilmadi");
  process.exit(1);
}

const build = spawnSync("npx", ["tsc", "-p", "tsconfig.cjs.json"], {
  cwd: src,
  stdio: "inherit",
  shell: true
});
if (build.status !== 0) {
  console.error("plans-proposal build xato");
  process.exit(build.status ?? 1);
}

for (const dest of targets) {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, {
    recursive: true,
    filter: (p) => !p.includes(`${src}\\node_modules`) && !p.includes(`${src}/node_modules`)
  });
  // Docker npm file: dep — type module emas, CJS dist
  const pkgPath = join(dest, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  delete pkg.type;
  if (pkg.scripts) {
    delete pkg.scripts.prepare;
    delete pkg.scripts.build;
  }
  pkg.main = "./dist/index.js";
  pkg.types = "./dist/index.d.ts";
  pkg.exports = {
    ".": {
      types: "./dist/index.d.ts",
      require: "./dist/index.js",
      default: "./dist/index.js"
    }
  };
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`synced → ${dest.replace(root + "\\", "").replace(root + "/", "")}`);
}
