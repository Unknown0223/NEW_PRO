import fs from "node:fs";
import path from "node:path";

const root = "frontend/app/(dashboard)/reports";
const targets = [
  "balance-control",
  "cumulative-bonus",
  "discount-detail",
  "expeditor-share",
  "expeditor-visits",
  "rfm",
  "sales-compare",
  "universal-discounts",
  "universal-returns",
  "universal-visits",
  "visit-totals",
  "visits-2",
  "sku-3"
];

function polish(slug, src) {
  let out = src;
  out = out.replace(/\n\s*\{\s*kind:\s*"search"[^}]*\},?/g, "\n");
  out = out.replace(/placeholder:\s*"Территория 1"/g, 'placeholder: "Зона"');
  out = out.replace(/placeholder:\s*"Территория 2"/g, 'placeholder: "Область"');
  out = out.replace(/placeholder:\s*"Территория 3"/g, 'placeholder: "Город"');

  const prefsLine = `  tablePrefsId: "report.${slug}.v1",\r\n  filterGridCols: 9,\r\n`;
  if (!/tablePrefsId:/.test(out)) {
    if (/exportFilename:\s*"[^"]+",\r?\n/.test(out)) {
      out = out.replace(/(exportFilename:\s*"[^"]+",\r?\n)/, `$1${prefsLine}`);
    } else if (/exportPermission:\s*"[^"]+",\r?\n/.test(out)) {
      out = out.replace(/(exportPermission:\s*"[^"]+",\r?\n)/, `$1${prefsLine}`);
    } else {
      out = out.replace(/(apiPath:\s*"[^"]+",\r?\n)/, `$1${prefsLine}`);
    }
  } else if (!/filterGridCols:/.test(out)) {
    out = out.replace(/(tablePrefsId:\s*"[^"]+",\r?\n)/, `$1  filterGridCols: 9,\r\n`);
  }

  out = out.replace(/\n{3,}/g, "\n\n");
  return out;
}

const results = [];
for (const slug of targets) {
  const fp = path.join(root, slug, "page.tsx");
  if (!fs.existsSync(fp)) {
    results.push(`${slug}: MISSING`);
    continue;
  }
  const before = fs.readFileSync(fp, "utf8");
  const after = polish(slug, before);
  if (after !== before) {
    fs.writeFileSync(fp, after, "utf8");
    results.push(`${slug}: UPDATED`);
  } else {
    results.push(`${slug}: noop`);
  }
}
console.log(results.join("\n"));
