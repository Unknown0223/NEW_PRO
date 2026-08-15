import fs from "node:fs";
import path from "node:path";

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const root = path.resolve("packages/pivot-ui/src");

const map = [
  ["@/lib/cn", "lib/cn.ts"],
  ["@/lib/pivotWorker", "lib/pivotWorker.ts"],
  ["@/components/PivotBuilder", "components/PivotBuilder.tsx"],
  ["@/components/PivotChart", "components/PivotChart.tsx"],
  ["@/components/PivotTable", "components/PivotTable.tsx"],
  ["@/components/PivotDrillThrough", "components/PivotDrillThrough.tsx"],
  ["@/components/PivotToolbar", "components/PivotToolbar.tsx"],
  ["@/components/filters/FilterEditor", "components/filters/FilterEditor.tsx"],
  ["@/components/filters/DateRangeFilter", "components/filters/DateRangeFilter.tsx"],
  ["@/components/filters/NumberRangeFilter", "components/filters/NumberRangeFilter.tsx"],
  ["@/components/filters/MultiSelectFilter", "components/filters/MultiSelectFilter.tsx"],
  ["@/components/filters/TopNFilter", "components/filters/TopNFilter.tsx"],
  ["@/hooks/usePivot", "hooks/usePivot.ts"],
  ["@/hooks/usePivotExport", "hooks/usePivotExport.ts"],
  ["@/hooks/usePivotUrlConfig", "hooks/usePivotUrlConfig.ts"]
];

for (const file of walk(root)) {
  let c = fs.readFileSync(file, "utf8");
  const dir = path.dirname(file);
  for (const [alias, target] of map) {
    const abs = path.join(root, target);
    let rel = path.relative(dir, abs).split(path.sep).join("/");
    if (!rel.startsWith(".")) rel = "./" + rel;
    rel = rel.replace(/\.tsx?$/, ".js");
    c = c.split(`"${alias}"`).join(`"${rel}"`);
    c = c.split(`'${alias}'`).join(`'${rel}'`);
  }
  fs.writeFileSync(file, c);
}

console.log("pivot-ui imports rewritten");
