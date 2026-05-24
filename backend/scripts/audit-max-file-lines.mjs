#!/usr/bin/env node
/**
 * Backend audit: src, prisma, scripts, tests, openapi (bundle mustasno).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoScript = path.join(backendRoot, "..", "scripts", "audit-max-file-lines.mjs");
const roots = [
  path.join(backendRoot, "src"),
  path.join(backendRoot, "prisma"),
  path.join(backendRoot, "scripts"),
  path.join(backendRoot, "tests"),
  path.join(backendRoot, "openapi")
];
const r = spawnSync(process.execPath, [repoScript, "--backend", ...roots], {
  stdio: "inherit",
  cwd: path.join(backendRoot, ".."),
  env: process.env
});
process.exit(r.status ?? 1);
