/**
 * S3-01 audit nomi — legacy → CRUD RBAC migratsiyasi.
 * Asosiy mantiq: `migrate-permissions-to-crud.ts` (non-destructive, idempotent).
 *
 *   npx tsx scripts/migrate-legacy-permissions.ts [slug]
 *   npx tsx scripts/migrate-legacy-permissions.ts --all
 *   npx tsx scripts/migrate-legacy-permissions.ts test1 --prune
 */
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const backendRoot = join(__dirname, "..");
const target = join(__dirname, "migrate-permissions-to-crud.ts");
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

execFileSync(npx, ["tsx", target, ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: backendRoot
});
