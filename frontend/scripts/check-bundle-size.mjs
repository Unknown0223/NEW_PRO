/**
 * Bundle size smoke check — `.next` build statistikasi (build dan keyin).
 * CI: `npm run build && npm run size-limit`
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const NEXT_DIR = join(process.cwd(), ".next");
const MAX_TOTAL_MB = Number(process.env.BUNDLE_MAX_MB ?? 80);

function dirSizeBytes(dir) {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) total += dirSizeBytes(p);
    else total += st.size;
  }
  return total;
}

if (!existsSync(NEXT_DIR)) {
  console.error("Missing .next — run `npm run build` first");
  process.exit(1);
}

const bytes = dirSizeBytes(NEXT_DIR);
const mb = bytes / (1024 * 1024);
console.log(`.next total: ${mb.toFixed(2)} MB (limit ${MAX_TOTAL_MB} MB)`);
if (mb > MAX_TOTAL_MB) {
  console.error("Bundle size exceeds limit");
  process.exit(1);
}
