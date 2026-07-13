/**
 * Bir buyruq bilan DB ni to'liq tozalash.
 *
 * Himoya (majburiy):
 *   CONFIRM_TRUNCATE=YES
 *   --confirm-phrase=DELETE_ALL_DATA
 *   --backup-ok
 *
 * Ishlatish:
 *   CONFIRM_TRUNCATE=YES npm run db:wipe:all-once -- --confirm-phrase=DELETE_ALL_DATA --backup-ok
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const backendRoot = path.resolve(__dirname, "..");
const extraArgs = process.argv.slice(2);

const r = spawnSync("npx", ["tsx", "scripts/db-truncate-all-once.ts", ...extraArgs], {
  cwd: backendRoot,
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32"
});

process.exit(r.status ?? 1);
