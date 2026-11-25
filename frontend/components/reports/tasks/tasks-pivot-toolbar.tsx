"use client";

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
import {
  TableStyleGallery,
  TableStyleToolbarIcon
} from "@/components/pivot/PivotTable/TableStyleGallery";

export type TasksPivotToolbarMenu = "export" | "format" | "tableStyle" | "options" | null;

type Props = {
  layoutLabel: string;
  canExport: boolean;
  hasData: boolean;
  isComputing: boolean;
  isExporting: boolean;
  isFullscreen: boolean;
  toolbarMenu: TasksPivotToolbarMenu;
  setToolbarMenu: (m: TasksPivotToolbarMenu) => void;
  tableStyleId: string;
  onTableStyle: (id: string) => void;
  onClearTableStyle: () => void;
  onExportExcel: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
  onExportHtml: () => void;
  onCopy: () => void;
  onOpenDateFormat: () => void;
  onOpenCellFormat: () => void;
  onOpenFields: () => void;
  onToggleFullscreen: () => void;
  onSetLayoutFlat: () => void;
  onSetLayoutClassic: () => void;
};

export function TasksPivotToolbar({
  layoutLabel,
  canExport,
  hasData,
  isComputing,
  isExporting,
  isFullscreen,
  toolbarMenu,
  setToolbarMenu,
  tableStyleId,
  onTableStyle,
  onClearTableStyle,
  onExportExcel,
  onExportCsv,
  onExportPdf,
  onExportHtml,
  onCopy,
  onOpenDateFormat,
  onOpenCellFormat,
  onOpenFields,
  onToggleFullscreen,
  onSetLayoutFlat,
  onSetLayoutClassic
}: Props) {
  const t = getPivotStrings().toolbar;
  const busy = isComputing || isExporting;

  return (
    <div className="flex min-h-14 flex-wrap items-stretch justify-between gap-2 border-b border-border bg-background px-1 pb-1">
      <div className="flex items-stretch">
        <div className="relative flex">
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
          <ToolbarButton
            icon={<SlidersHorizontal />}
            label="Формат"
            onClick={() => setToolbarMenu(toolbarMenu === "format" ? null : "format")}
          />
          <ToolbarButton
            icon={<Settings2 />}
            label="Опции"
            onClick={() => setToolbarMenu(toolbarMenu === "options" ? null : "options")}
          />
          <ToolbarButton icon={<TableProperties />} label="Поля" onClick={onOpenFields} />
          <ToolbarButton
            icon={isFullscreen ? <Minimize2 /> : <Maximize2 />}
            label={isFullscreen ? "Сверн." : "На весь..."}
            onClick={onToggleFullscreen}
            active={isFullscreen}
          />
          {toolbarMenu === "format" ? (
            <div className="absolute right-20 top-full z-30 mt-1 w-52 rounded-sm border border-border bg-popover p-1 text-xs shadow-lg">
              <button
                type="button"
                className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                onClick={() => {
                  onOpenCellFormat();
                  setToolbarMenu(null);
                }}
              >
                Формат ячеек…
              </button>
            </div>
          ) : null}
          {toolbarMenu === "options" ? (
            <div className="absolute right-12 top-full z-30 mt-1 w-52 rounded-sm border border-border bg-popover p-1 text-xs shadow-lg">
              <button
                type="button"
                className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                onClick={() => {
                  onSetLayoutFlat();
                  setToolbarMenu(null);
                }}
              >
                Табличная форма
              </button>
              <button
                type="button"
                className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                onClick={() => {
                  onSetLayoutClassic();
                  setToolbarMenu(null);
                }}
              >
                Классическая
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
