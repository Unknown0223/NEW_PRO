/**
 * Perf smoke: 10k rows compute timing (CI-friendly threshold).
 * Run: node packages/pivot-engine/scripts/benchmark-smoke.mjs
 */
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = pathToFileURL(join(root, "dist/index.js")).href;

const { PivotEngine, DEFAULT_PIVOT_CONFIG } = await import(dist);

const N = 10_000;
const rows = Array.from({ length: N }, (_, i) => ({
  dealer: `D${i % 20}`,
  brand: `B${i % 8}`,
  sku: `S${i % 100}`,
  amount: (i % 97) * 1000,
  qty: i % 11
}));

const fields = [
  { id: "dealer", label: "Dealer", dataType: "string" },
  { id: "brand", label: "Brand", dataType: "string" },
  { id: "sku", label: "SKU", dataType: "string" },
  { id: "amount", label: "Amount", dataType: "number" },
  { id: "qty", label: "Qty", dataType: "number" }
];

const config = {
  ...DEFAULT_PIVOT_CONFIG,
  rows: ["dealer", "brand"],
  values: [{ fieldId: "amount", aggregation: "SUM" }]
};

const engine = new PivotEngine();
const t0 = performance.now();
const result = engine.compute(rows, fields, config);
const ms = performance.now() - t0;

console.log(`rows=${N} out=${result.rows.length} ms=${ms.toFixed(1)}`);
if (ms > 2000) {
  console.error("FAIL: 10k compute > 2000ms");
  process.exit(1);
}
console.log("OK benchmark-smoke");
