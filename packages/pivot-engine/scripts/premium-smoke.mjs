/**
 * Premium smoke: calculated measure + conditional between + formatters.
 * Run (after build): node packages/pivot-engine/scripts/premium-smoke.mjs
 */
import { pathToFileURL } from "node:url";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = pathToFileURL(join(root, "dist/index.js")).href;

const {
  PivotEngine,
  DEFAULT_PIVOT_CONFIG,
  compileFormula,
  evaluateFormula,
  applyCalculatedMeasures,
  getConditionalFormatStyle,
  formatNumber
} = await import(dist);

let failed = 0;
function pass(name) {
  console.log(`PASS  ${name}`);
}
function fail(name, detail) {
  failed++;
  console.error(`FAIL  ${name}: ${detail}`);
}

const rows = [
  { dealer: "A", amount: 100_000, qty: 10 },
  { dealer: "A", amount: 50_000, qty: 5 },
  { dealer: "B", amount: 200_000, qty: 20 }
];

const fields = [
  { id: "dealer", label: "Dealer", dataType: "string" },
  { id: "amount", label: "Amount", dataType: "number" },
  { id: "qty", label: "Qty", dataType: "number" }
];

// 1) Formula compile / evaluate
try {
  const fn = compileFormula("amount * 0.12", ["amount", "qty"]);
  const v = fn({ amount: 1_000_000 });
  if (Math.abs(v - 120_000) > 0.01) throw new Error(`got ${v}`);
  pass("compileFormula amount*0.12");
} catch (e) {
  fail("compileFormula", e.message);
}

try {
  const v = evaluateFormula("amount / qty", { amount: 500, qty: 10 }, ["amount", "qty"]);
  if (v !== 50) throw new Error(`got ${v}`);
  pass("evaluateFormula amount/qty");
} catch (e) {
  fail("evaluateFormula", e.message);
}

try {
  const v = evaluateFormula(
    "IF(amount > 100 AND qty >= 1, ABS(amount - qty), MAX(amount, qty))",
    { amount: 150, qty: 10 },
    ["amount", "qty"]
  );
  if (v !== 140) throw new Error(`got ${v}`);
  const p = evaluateFormula("qty ^ 2", { qty: 4 }, ["amount", "qty"]);
  if (p !== 16) throw new Error(`power got ${p}`);
  pass("evaluateFormula IF/AND/ABS/MAX/^");
} catch (e) {
  fail("evaluateFormula extended", e.message);
}

// 2) Calculated measure on rows + pivot compute
const measures = [{ id: "calc_vat", label: "VAT 12%", formula: "amount * 0.12", individual: true }];
const enriched = applyCalculatedMeasures(rows, measures, fields);
if (enriched[0].calc_vat !== 12_000) {
  fail("applyCalculatedMeasures", `expected 12000 got ${enriched[0].calc_vat}`);
} else {
  pass("applyCalculatedMeasures");
}

const engine = new PivotEngine();
const config = {
  ...DEFAULT_PIVOT_CONFIG,
  rows: ["dealer"],
  values: [
    { fieldId: "amount", aggregation: "SUM" },
    { fieldId: "calc_vat", aggregation: "SUM", label: "VAT 12%" }
  ],
  calculatedMeasures: measures,
  options: {
    ...DEFAULT_PIVOT_CONFIG.options,
    conditionalFormats: [
      {
        id: "cf-between",
        type: "between",
        threshold: 10_000,
        thresholdMax: 20_000,
        backgroundColor: "#dbeafe",
        fieldId: "calc_vat"
      }
    ]
  }
};

const result = engine.compute(rows, fields, config);
if (!result?.rows?.length) {
  fail("pivot.compute", "no rows");
} else {
  pass(`pivot.compute rows=${result.rows.length}`);
}

// 3) Conditional between
const cellOk = {
  value: 15_000,
  rawValue: 15_000,
  formatted: "15000",
  columnKey: "calc_vat",
  isEmpty: false
};
const styleOk = getConditionalFormatStyle(cellOk, config.options.conditionalFormats);
if (styleOk?.backgroundColor !== "#dbeafe") {
  fail("conditional between hit", JSON.stringify(styleOk));
} else {
  pass("conditional between hit");
}

const cellMiss = { ...cellOk, rawValue: 5_000, value: 5_000 };
const styleMiss = getConditionalFormatStyle(cellMiss, config.options.conditionalFormats);
if (styleMiss) {
  fail("conditional between miss", JSON.stringify(styleMiss));
} else {
  pass("conditional between miss");
}

// 4) Formatters wiring
const formatted = formatNumber(-1234.5, {
  type: "number",
  decimals: 1,
  thousandsSep: ",",
  decimalSep: ".",
  negativeFormat: "parens"
});
if (formatted !== "(1,234.5)") {
  fail("formatNumber separators", formatted);
} else {
  pass("formatNumber separators");
}

if (failed > 0) {
  console.error(`\npremium-smoke: ${failed} failed`);
  process.exit(1);
}
console.log("\nOK premium-smoke (all pass)");
