#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pivotPath = path.join(root, "components/reports/wdr/wdr-report-builder-pivot-section.tsx");
let src = readFileSync(pivotPath, "utf8");

const destructure = `  const {
    lastDataset,
    pivotRef,
    pivotWrapRef,
    formatMenuRef,
    pivotViewportPx,
    hierarchyExpanded,
    formatMenuOpen,
    setFormatMenuOpen,
    formatCellsDialogOpen,
    setFormatCellsDialogOpen,
    conditionalDialogOpen,
    setConditionalDialogOpen,
    saveDialogOpen,
    setSaveDialogOpen,
    savedReportsDialogOpen,
    setSavedReportsDialogOpen,
    activeSavedReportId,
    cellFormatPattern,
    setCellFormatPattern,
    conditionalRules,
    setConditionalRules,
    formatValueScope,
    setFormatValueScope,
    formatAlign,
    setFormatAlign,
    formatThousands,
    setFormatThousands,
    formatDecimalSep,
    setFormatDecimalSep,
    formatDecimalPlaces,
    setFormatDecimalPlaces,
    formatNegatives,
    setFormatNegatives,
    formatNullValue,
    setFormatNullValue,
    formatAsPercent,
    setFormatAsPercent,
    saveName,
    setSaveName,
    saveMutPending,
    savedQ,
    lastWdrReportRef,
    pivotReadyRef,
    onSave,
    onBrowserExport,
    onToggleHierarchy,
    runToolbarAction,
    onToggleFullscreen,
    loadDefaultReport,
    loadSaved,
    pivotMountKey,
    beforeToolbarCreated,
    initialReport,
    syncPivotSnapshot,
    hideInternalToolbar
  } = props;
`;

src = src.replace(
  "export function WdrReportBuilderPivotSection(props: WdrPivotSectionProps) {\n  const p = props;\n  return (\n    <>\n        <div",
  `export function WdrReportBuilderPivotSection(props: WdrPivotSectionProps) {\n${destructure}\n  return (\n    <>\n      {lastDataset?.truncated ? (\n        <div`
);

src = src.replace(/saveMut\.isPending/g, "saveMutPending");

writeFileSync(pivotPath, src);
console.log("fixed wdr pivot section");
