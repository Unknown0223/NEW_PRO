#!/usr/bin/env node
/**
 * Frontend: components, app, lib ≤ MAX_FILE_LINES — monorepo skriptiga yo‘naltiradi.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const r = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "audit-max-file-lines.mjs"), "--frontend"], {
  stdio: "inherit",
  cwd: repoRoot,
  env: process.env
});
process.exit(r.status ?? 1);
