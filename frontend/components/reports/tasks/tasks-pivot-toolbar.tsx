"use client";

import type { ReactNode } from "react";
import {
  CalendarCog,
  Copy,
  Download,
  Loader2,
  Maximize2,
  Minimize2,
  Settings2,
  SlidersHorizontal,
  TableProperties
} from "lucide-react";
import { getPivotStrings } from "@salec/pivot-engine";
import { VirtualPivotToolbarButton as ToolbarButton } from "@/components/reports/virtual-pivot-toolbar-button";
import { VirtualPivotFormatMenu } from "@/components/reports/virtual-pivot-format-menu";
import {
  TableStyleGallery,
  TableStyleToolbarIcon
} from "@/components/pivot/PivotTable/TableStyleGallery";

export type TasksPivotToolbarMenu = "export" | "format" | "tableStyle" | null;

type Props = {
  layoutLabel: string;
  canExport: boolean;
  hasData: boolean;
  isComputing: boolean;
  isExporting: boolean;
  isFullscreen: boolean;
  hierarchyExpanded: boolean;
  hierarchyDisabled: boolean;
  toolbarMenu: TasksPivotToolbarMenu;
  setToolbarMenu: (m: TasksPivotToolbarMenu) => void;
  tableStyleId: string;
  onTableStyle: (id: string) => void;
  onClearTableStyle: () => void;
  onExportExcel: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
  onExportHtml: () => void;
  onExportPng?: () => void;
  showExportPng?: boolean;
  onCopy: () => void;
  onToggleHierarchy: () => void;
  onOpenDateFormat: () => void;
  onOpenFormatMenu: () => void;
  onOpenCellFormat: () => void;
  onOpenConditional: () => void;
  onViewTable: () => void;
  onViewChart: () => void;
  onToggleColumnTotals: () => void;
  onOpenOptions: () => void;
  onOpenFields: () => void;
  onToggleFullscreen: () => void;
  /** Отчёты / Сохр. как (dialoglar bilan) */
  savedChrome?: ReactNode;
};

export function TasksPivotToolbar({
  layoutLabel,
  canExport,
  hasData,
  isComputing,
  isExporting,
  isFullscreen,
  hierarchyExpanded,
  hierarchyDisabled,
  toolbarMenu,
  setToolbarMenu,
  tableStyleId,
  onTableStyle,
  onClearTableStyle,
  onExportExcel,
  onExportCsv,
  onExportPdf,
  onExportHtml,
  onExportPng,
  showExportPng,
  onCopy,
  onToggleHierarchy,
  onOpenDateFormat,
  onOpenFormatMenu,
  onOpenCellFormat,
  onOpenConditional,
  onViewTable,
  onViewChart,
  onToggleColumnTotals,
  onOpenOptions,
  onOpenFields,
  onToggleFullscreen,
  savedChrome
}: Props) {
  const t = getPivotStrings().toolbar;
  const busy = isComputing || isExporting;

  return (
    <div className="flex min-h-14 flex-wrap items-stretch justify-between gap-2 border-b border-border bg-background px-1 pb-1">
      <div className="flex items-stretch">
        <div className="relative flex">
          {savedChrome}
          {canExport ? (
            <ToolbarButton
              icon={isExporting ? <Loader2 className="animate-spin" /> : <Download />}
              label="Экспорт"
              onClick={() => setToolbarMenu(toolbarMenu === "export" ? null : "export")}
              disabled={!hasData || busy}
            />
          ) : null}
          <ToolbarButton
            icon={<Copy />}
            label="Копировать"
            onClick={onCopy}
            disabled={!hasData || busy}
          />
          <ToolbarButton
            icon={hierarchyExpanded ? <Minimize2 /> : <Maximize2 />}
            label={hierarchyExpanded ? "Сверн." : "Развер."}
            title={
              hierarchyDisabled
                ? "Нет иерархии: в «Поля» добавьте ≥2 поля в строки (классическая/компактная)"
                : hierarchyExpanded
                  ? "Свернуть все"
                  : "Развернуть все"
            }
            onClick={onToggleHierarchy}
            disabled={hierarchyDisabled || busy}
            active={hierarchyExpanded}
          />
          {canExport && toolbarMenu === "export" ? (
            <div className="absolute left-0 top-full z-30 mt-1 w-44 rounded-sm border border-border bg-popover p-1 text-xs shadow-lg">
              <button
                type="button"
                className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                onClick={() => {
                  onExportExcel();
                  setToolbarMenu(null);
                }}
              >
                {t.excel}
              </button>
              <button
                type="button"
                className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                onClick={() => {
                  onExportCsv();
                  setToolbarMenu(null);
                }}
              >
                {t.csv}
              </button>
              <button
                type="button"
                className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                onClick={() => {
                  onExportPdf();
                  setToolbarMenu(null);
                }}
              >
                {t.pdf}
              </button>
              <button
                type="button"
                className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                onClick={() => {
                  onExportHtml();
                  setToolbarMenu(null);
                }}
              >
                {t.html}
              </button>
              {showExportPng && onExportPng ? (
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                  onClick={() => {
                    onExportPng();
                    setToolbarMenu(null);
                  }}
                >
                  PNG
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <span className="ml-2 self-center rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {layoutLabel}
        </span>
        <div className="relative ml-1 flex items-stretch">
          <ToolbarButton
            icon={<TableStyleToolbarIcon />}
            label="Стиль"
            active={toolbarMenu === "tableStyle"}
            onClick={() => setToolbarMenu(toolbarMenu === "tableStyle" ? null : "tableStyle")}
          />
          <TableStyleGallery
            open={toolbarMenu === "tableStyle"}
            selectedId={tableStyleId}
            onSelect={(id) => {
              onTableStyle(id);
              setToolbarMenu(null);
            }}
            onClear={() => {
              onClearTableStyle();
              setToolbarMenu(null);
            }}
            onCreateStub={() => setToolbarMenu(null)}
            onClose={() => setToolbarMenu(null)}
          />
        </div>
      </div>

      <div className="flex items-stretch">
        <div className="relative flex">
          <ToolbarButton icon={<CalendarCog />} label="Формат даты" onClick={onOpenDateFormat} />
          <ToolbarButton icon={<SlidersHorizontal />} label="Формат" onClick={onOpenFormatMenu} />
          <ToolbarButton icon={<Settings2 />} label="Опции" onClick={onOpenOptions} />
          <ToolbarButton icon={<TableProperties />} label="Поля" onClick={onOpenFields} />
          <ToolbarButton
            icon={isFullscreen ? <Minimize2 /> : <Maximize2 />}
            label={isFullscreen ? "Сверн." : "На весь..."}
            onClick={onToggleFullscreen}
            active={isFullscreen}
          />
          <VirtualPivotFormatMenu
            open={toolbarMenu === "format"}
            onOpenChange={(o) => setToolbarMenu(o ? "format" : null)}
            onOpenCellFormat={onOpenCellFormat}
            onOpenConditional={onOpenConditional}
            onViewTable={onViewTable}
            onViewChart={onViewChart}
            onToggleColumnTotals={onToggleColumnTotals}
          />
        </div>
      </div>
    </div>
  );
}
