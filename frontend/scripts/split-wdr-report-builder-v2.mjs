#!/usr/bin/env node
/** wdr-report-builder: utils / filters / pivot+dialogs. */
import fs, { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const wdrDir = path.join(root, "components/reports/wdr");
const srcPath = path.join(root, "components/reports/wdr-report-builder.tsx");
const monolithPath = path.join(wdrDir, "wdr-report-builder.monolith.tsx");

mkdirSync(wdrDir, { recursive: true });
if (!fs.existsSync(monolithPath)) {
  copyFileSync(srcPath, monolithPath);
}
const lines = readFileSync(monolithPath, "utf8").split(/\r?\n/);

function exp(block) {
  return block
    .replace(/^type /gm, "export type ")
    .replace(/^function /gm, "export function ")
    .replace(/^const DATASET_ID/gm, "export const DATASET_ID")
    .replace(/^const DATASET_MEASURE_KEYS/gm, "export const DATASET_MEASURE_KEYS")
    .replace(/^const WDR_RU_TEXT_MAP/gm, "export const WDR_RU_TEXT_MAP");
}

writeFileSync(
  path.join(wdrDir, "wdr-report-builder.utils.ts"),
  `import * as WebDataRocksReact from "@webdatarocks/react-webdatarocks";
import {
  emptyReportBuilderExtraFilters,
  type DatasetFiltersPayload,
  type LegacyConfigPayload,
  type WdrReportJson
} from "@/lib/report-builder-wdr-migrate";

${exp(lines.slice(44, 761).join("\n"))}
`
);

const componentStart = lines.findIndex((l) => l.includes("export function WdrReportBuilder"));
const returnLine = lines.findIndex((l, i) => i > componentStart && l.trim() === "return (");
const hookBody = lines.slice(componentStart + 1, returnLine).join("\n");

writeFileSync(
  path.join(wdrDir, "wdr-report-builder-filters-panel.tsx"),
  `"use client";

import { useMemo } from "react";
import { Filter, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchableMultiSelectPanel } from "@/components/ui/searchable-multi-select-panel";
import { cn } from "@/lib/utils";
import { formatDateRangeButton } from "@/components/ui/date-range-popover";
import type { FilterState } from "./wdr-report-builder.utils";

export type WdrFiltersPanelProps = {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  filtersCollapsed: boolean;
  setFiltersCollapsed: (v: boolean | ((p: boolean) => boolean)) => void;
  dateAnchorRef: React.RefObject<HTMLButtonElement | null>;
  dateOpen: boolean;
  setDateOpen: (v: boolean) => void;
  dateModeItems: Array<{ id: string; title: string }>;
  periodBtn: string;
  loadData: () => void | Promise<void>;
  datasetMutPending: boolean;
  agentItems: Array<{ id: string; title: string }>;
  productCategoryItems: Array<{ id: string; title: string }>;
  productGroupItems: Array<{ id: string; title: string }>;
  productItems: Array<{ id: string; title: string }>;
  branchItems: Array<{ id: string; title: string }>;
  filtersQ: { data?: {
    statuses?: Array<{ id: string; label: string }>;
    order_types?: Array<{ id: string; label: string }>;
  } };
  warehouseItems: Array<{ id: string; title: string }>;
  expeditorItems: Array<{ id: string; title: string }>;
  brandItems: Array<{ id: string; title: string }>;
  clientCategoryItems: Array<{ id: string; title: string }>;
  priceTypeItems: Array<{ id: string; title: string }>;
  paymentMethodItems: Array<{ id: string; title: string }>;
  supervisorItems: Array<{ id: string; title: string }>;
  tradeDirectionItems: Array<{ id: string; title: string }>;
  kpiGroupItems: Array<{ id: string; title: string }>;
  clientItems: Array<{ id: string; title: string }>;
  territory1Items: Array<{ id: string; title: string }>;
  territory2Items: Array<{ id: string; title: string }>;
  territory3Items: Array<{ id: string; title: string }>;
};

export function WdrReportBuilderFiltersPanel(props: WdrFiltersPanelProps) {
  const {
    filters,
    setFilters,
    filtersCollapsed,
    setFiltersCollapsed,
    dateAnchorRef,
    dateOpen,
    setDateOpen,
    dateModeItems,
    periodBtn,
    loadData,
    datasetMutPending,
    agentItems,
    productCategoryItems,
    productGroupItems,
    productItems,
    branchItems,
    filtersQ,
    warehouseItems,
    expeditorItems,
    brandItems,
    clientCategoryItems,
    priceTypeItems,
    paymentMethodItems,
    supervisorItems,
    tradeDirectionItems,
    kpiGroupItems,
    clientItems,
    territory1Items,
    territory2Items,
    territory3Items
  } = props;

  return (
${lines.slice(1487, 2009).join("\n")}
  );
}
`
);

writeFileSync(
  path.join(wdrDir, "wdr-report-builder-pivot-section.tsx"),
  `"use client";

import * as WebDataRocksReact from "@webdatarocks/react-webdatarocks";
import {
  Download,
  FolderOpen,
  Fullscreen,
  ListFilter,
  Loader2,
  Maximize2,
  Minimize2,
  Save,
  Settings2,
  SlidersHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getUserFacingError } from "@/lib/error-utils";
import type { WdrReportJson } from "@/lib/report-builder-wdr-migrate";
import {
  applyConditionalFormattingToHost,
  getPivotApi,
  scheduleWdrLayoutRefresh,
  tryGetWdrReportJson,
  type ConditionalRule,
  type DatasetResponse,
  type PivotClass
} from "./wdr-report-builder.utils";

export type WdrPivotSectionProps = {
  lastDataset: DatasetResponse | null;
  pivotRef: React.RefObject<PivotClass | null>;
  pivotWrapRef: React.RefObject<HTMLDivElement | null>;
  formatMenuRef: React.RefObject<HTMLDivElement | null>;
  pivotViewportPx: number;
  hierarchyExpanded: boolean;
  formatMenuOpen: boolean;
  setFormatMenuOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  formatCellsDialogOpen: boolean;
  setFormatCellsDialogOpen: (v: boolean) => void;
  conditionalDialogOpen: boolean;
  setConditionalDialogOpen: (v: boolean) => void;
  saveDialogOpen: boolean;
  setSaveDialogOpen: (v: boolean) => void;
  savedReportsDialogOpen: boolean;
  setSavedReportsDialogOpen: (v: boolean) => void;
  activeSavedReportId: number | null;
  cellFormatPattern: string;
  setCellFormatPattern: (v: string) => void;
  conditionalRules: ConditionalRule[];
  setConditionalRules: React.Dispatch<React.SetStateAction<ConditionalRule[]>>;
  formatValueScope: string;
  setFormatValueScope: (v: string) => void;
  formatAlign: string;
  setFormatAlign: (v: string) => void;
  formatThousands: string;
  setFormatThousands: (v: string) => void;
  formatDecimalSep: string;
  setFormatDecimalSep: (v: string) => void;
  formatDecimalPlaces: string;
  setFormatDecimalPlaces: (v: string) => void;
  formatNegatives: string;
  setFormatNegatives: (v: string) => void;
  formatNullValue: string;
  setFormatNullValue: (v: string) => void;
  formatAsPercent: string;
  setFormatAsPercent: (v: string) => void;
  saveName: string;
  setSaveName: (v: string) => void;
  saveMutPending: boolean;
  savedQ: { data?: Array<{ id: number; name: string }> };
  lastWdrReportRef: React.MutableRefObject<WdrReportJson>;
  pivotReadyRef: React.MutableRefObject<boolean>;
  onSave: () => Promise<boolean>;
  onBrowserExport: () => void;
  onToggleHierarchy: () => void;
  runToolbarAction: (kind: "format" | "options" | "fields") => boolean;
  onToggleFullscreen: () => void;
  loadDefaultReport: () => Promise<void>;
  loadSaved: (id: number) => Promise<void>;
  pivotMountKey: string;
  beforeToolbarCreated: (toolbar: unknown) => void;
  initialReport: WdrReportJson;
  syncPivotSnapshot: () => void;
  hideInternalToolbar: () => void;
};

export function WdrReportBuilderPivotSection(props: WdrPivotSectionProps) {
  const p = props;
  return (
    <>
${lines.slice(2011, lines.length - 1).join("\n")}
    </>
  );
}
`
);

writeFileSync(
  path.join(root, "components/reports/wdr-report-builder.tsx"),
  `"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReportBuilderPivotHeight } from "./wdr/use-report-builder-pivot-height";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import {
  isWdrSavedConfig,
  migrateLegacyReportBuilderConfigToWdrReport,
  normalizeSavedDatasetFilters,
  type LegacyConfigPayload,
  type WdrReportJson
} from "@/lib/report-builder-wdr-migrate";
import {
  DATASET_ID,
  axiosErrorFields,
  buildCaptionMap,
  buildWdrMapping,
  createWdrToolbarConfigurer,
  defaultFilters,
  emptyWdrReport,
  getPivotApi,
  parseTerritoryNodeList,
  reportBuilderDatasetFailureMessage,
  scheduleWdrLayoutRefresh,
  territoryFromNodes,
  tryGetWdrReportJson,
  wdrSeedRowFromMetadata,
  type ConditionalRule,
  type DatasetApiRow,
  type DatasetResponse,
  type FilterState,
  type Metadata,
  type FilterOpts,
  type PivotClass,
  type WdrPivotApi,
  type WdrToolbarActions,
  type WdrToolbarLike
} from "./wdr/wdr-report-builder.utils";
import { WdrReportBuilderFiltersPanel } from "./wdr/wdr-report-builder-filters-panel";
import { WdrReportBuilderPivotSection } from "./wdr/wdr-report-builder-pivot-section";

export default function WdrReportBuilder() {
${hookBody}

  if (!hydrated || !tenantSlug) return <p className="text-sm text-muted-foreground">Загрузка...</p>;

  const periodBtn = formatDateRangeButton(filters.dateFrom, filters.dateTo);

  return (
    <div className="max-w-full space-y-4 overflow-x-hidden pb-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Конструктор отчетов</h1>
          <p className="text-xs text-muted-foreground">
            WebDataRocks — фильтры, сводная таблица, поля, slice, экспорт в Excel
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/reports/builder/pivot"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 text-xs text-muted-foreground")}
          >
            Virtual Pivot (основной)
          </Link>
        </div>
      </div>

      <DateRangePopover
        open={dateOpen}
        onOpenChange={setDateOpen}
        anchorRef={dateAnchorRef}
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        onApply={({ dateFrom, dateTo }) => setFilters((f) => ({ ...f, dateFrom, dateTo }))}
      />

      <WdrReportBuilderFiltersPanel
        filters={filters}
        setFilters={setFilters}
        filtersCollapsed={filtersCollapsed}
        setFiltersCollapsed={setFiltersCollapsed}
        dateAnchorRef={dateAnchorRef}
        dateOpen={dateOpen}
        setDateOpen={setDateOpen}
        dateModeItems={dateModeItems}
        periodBtn={periodBtn}
        loadData={loadData}
        datasetMutPending={datasetMut.isPending}
        agentItems={agentItems}
        productCategoryItems={productCategoryItems}
        productGroupItems={productGroupItems}
        productItems={productItems}
        branchItems={branchItems}
        filtersQ={filtersQ}
        warehouseItems={warehouseItems}
        expeditorItems={expeditorItems}
        brandItems={brandItems}
        clientCategoryItems={clientCategoryItems}
        priceTypeItems={priceTypeItems}
        paymentMethodItems={paymentMethodItems}
        supervisorItems={supervisorItems}
        tradeDirectionItems={tradeDirectionItems}
        kpiGroupItems={kpiGroupItems}
        clientItems={clientItems}
        territory1Items={territory1Items}
        territory2Items={territory2Items}
        territory3Items={territory3Items}
      />

      <WdrReportBuilderPivotSection
        lastDataset={lastDataset}
        pivotRef={pivotRef}
        pivotWrapRef={pivotWrapRef}
        formatMenuRef={formatMenuRef}
        pivotViewportPx={pivotViewportPx}
        hierarchyExpanded={hierarchyExpanded}
        formatMenuOpen={formatMenuOpen}
        setFormatMenuOpen={setFormatMenuOpen}
        formatCellsDialogOpen={formatCellsDialogOpen}
        setFormatCellsDialogOpen={setFormatCellsDialogOpen}
        conditionalDialogOpen={conditionalDialogOpen}
        setConditionalDialogOpen={setConditionalDialogOpen}
        saveDialogOpen={saveDialogOpen}
        setSaveDialogOpen={setSaveDialogOpen}
        savedReportsDialogOpen={savedReportsDialogOpen}
        setSavedReportsDialogOpen={setSavedReportsDialogOpen}
        activeSavedReportId={activeSavedReportId}
        cellFormatPattern={cellFormatPattern}
        setCellFormatPattern={setCellFormatPattern}
        conditionalRules={conditionalRules}
        setConditionalRules={setConditionalRules}
        formatValueScope={formatValueScope}
        setFormatValueScope={setFormatValueScope}
        formatAlign={formatAlign}
        setFormatAlign={setFormatAlign}
        formatThousands={formatThousands}
        setFormatThousands={setFormatThousands}
        formatDecimalSep={formatDecimalSep}
        setFormatDecimalSep={setFormatDecimalSep}
        formatDecimalPlaces={formatDecimalPlaces}
        setFormatDecimalPlaces={setFormatDecimalPlaces}
        formatNegatives={formatNegatives}
        setFormatNegatives={setFormatNegatives}
        formatNullValue={formatNullValue}
        setFormatNullValue={setFormatNullValue}
        formatAsPercent={formatAsPercent}
        setFormatAsPercent={setFormatAsPercent}
        saveName={saveName}
        setSaveName={setSaveName}
        saveMutPending={saveMut.isPending}
        savedQ={savedQ}
        lastWdrReportRef={lastWdrReportRef}
        pivotReadyRef={pivotReadyRef}
        onSave={onSave}
        onBrowserExport={onBrowserExport}
        onToggleHierarchy={onToggleHierarchy}
        runToolbarAction={runToolbarAction}
        onToggleFullscreen={onToggleFullscreen}
        loadDefaultReport={loadDefaultReport}
        loadSaved={loadSaved}
        pivotMountKey={pivotMountKey}
        beforeToolbarCreated={beforeToolbarCreated}
        initialReport={initialReport}
        syncPivotSnapshot={syncPivotSnapshot}
        hideInternalToolbar={hideInternalToolbar}
      />
    </div>
  );
}
`
);

for (const f of [
  "wdr-report-builder.utils.ts",
  "wdr-report-builder-filters-panel.tsx",
  "wdr-report-builder-pivot-section.tsx",
  "wdr-report-builder.tsx"
]) {
  const p = f === "wdr-report-builder.tsx" ? path.join(root, "components/reports", f) : path.join(wdrDir, f);
  console.log(`${f}\t${readFileSync(p, "utf8").split(/\n/).length}`);
}
