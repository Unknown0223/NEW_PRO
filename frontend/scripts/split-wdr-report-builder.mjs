#!/usr/bin/env node
/** wdr-report-builder: pivot height hook alohida modul. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcPath = path.join(root, "components/reports/wdr-report-builder.tsx");
const lines = readFileSync(srcPath, "utf8").split(/\r?\n/);

if (!lines[9]?.includes("useReportBuilderPivotHeight")) {
  console.log("already split or structure changed");
  process.exit(0);
}

const outDir = path.join(root, "components/reports/wdr");
mkdirSync(outDir, { recursive: true });

writeFileSync(
  path.join(outDir, "use-report-builder-pivot-height.ts"),
  `"use client";

import { useEffect, useState } from "react";

${lines.slice(5, 8).join("\n")}

${lines
  .slice(9, 23)
  .join("\n")
  .replace(/^function useReportBuilderPivotHeight/, "export function useReportBuilderPivotHeight")}
`
);

const withoutHook = [...lines.slice(0, 5), ...lines.slice(23)];
const insertImport = 'import { useReportBuilderPivotHeight } from "./wdr/use-report-builder-pivot-height";';
const importIdx = withoutHook.findIndex((l) => l.startsWith("import * as WebDataRocks"));
withoutHook.splice(importIdx, 0, insertImport);

writeFileSync(path.join(root, "components/reports/wdr-report-builder.tsx"), withoutHook.join("\n"));
console.log("wdr lines", withoutHook.length);
