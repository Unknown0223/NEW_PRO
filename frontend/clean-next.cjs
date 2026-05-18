/* Next.js dev: .next yoki webpack keshi buzilsa (Cannot find module './NNNN.js', /access 404) — dev ni to‘xtating, `npm run clean` yoki ildizdan `npm run repair:next`. */
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const dirs = [
  path.join(root, ".next"),
  path.join(root, "node_modules", ".cache")
];

for (const dir of dirs) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    process.stdout.write(`o‘chirildi: ${path.relative(root, dir) || "."}\n`);
  } catch (e) {
    if (e && e.code === "ENOENT") continue;
    throw e;
  }
}
