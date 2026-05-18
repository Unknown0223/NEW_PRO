/**
 * Grafana dashboard JSON sintaksis tekshiruvi (Foundation P2 #9).
 *   node scripts/perf/validate-grafana-dashboard.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const path = join(root, "docs/grafana/dashboard-foundation-api.json");

const raw = readFileSync(path, "utf8");
const doc = JSON.parse(raw);

if (!Array.isArray(doc.panels) || doc.panels.length === 0) {
  console.error("dashboard: panels bo‘sh");
  process.exit(1);
}

for (const p of doc.panels) {
  if (!p.title || !p.type) {
    console.error("panel title/type yo‘q", p.id);
    process.exit(1);
  }
}

console.log(`OK ${path} (${doc.panels.length} panels)`);
