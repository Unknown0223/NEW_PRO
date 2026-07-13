"use client";

import { useRef, type ReactNode } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExcelDropTarget } from "@/components/ui/excel-file-drop-zone";
import { GroupedNumberInput } from "@/components/ui/grouped-number-input";
import { Label } from "@/components/ui/label";
import { pickFirstExcelFile, EXCEL_ACCEPT } from "@/lib/excel-file-pick";

type Props = {
  bulk: string;
  onBulkChange: (v: string) => void;
  onApplyBulk: () => void;
  disabled?: boolean;
  bulkDisabled?: boolean;
  percentSlot?: ReactNode;
  scopeHint?: string | null;
  canDownloadTemplate?: boolean;
  templateLoading?: boolean;
  onDownloadTemplate?: () => void;
  canImportExcel?: boolean;
  onImportFile?: (file: File) => void;
};

export function PriceMatrixToolbar({
  bulk,
  onBulkChange,
  onApplyBulk,
  disabled,
  bulkDisabled,
  percentSlot,
  scopeHint,
  canDownloadTemplate,
  templateLoading,
  onDownloadTemplate,
  canImportExcel,
  onImportFile
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3 rounded-lg border bg-muted/15 px-3 py-3">
      <div className="flex flex-wrap items-end gap-3">
        {percentSlot}
        <div className="grid gap-1">
        <Label className="text-xs">Все строки (сумма)</Label>
        <div className="flex gap-2">
          <GroupedNumberInput
            className="h-10 w-40 font-mono text-sm tabular-nums"
            value={bulk}
            disabled={disabled || bulkDisabled}
            maxFractionDigits={2}
            maxLength={16}
            placeholder="0"
            onValueChange={onBulkChange}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-10"
            disabled={disabled || bulkDisabled}
            onClick={onApplyBulk}
          >
            Qo‘llash
          </Button>
        </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 gap-1.5"
          disabled={!canDownloadTemplate || disabled || templateLoading}
          onClick={() => void onDownloadTemplate?.()}
        >
          <Download className="size-4" aria-hidden />
          {templateLoading ? "…" : "Shablon (.xlsx)"}
        </Button>
        <ExcelDropTarget
          disabled={!canImportExcel || disabled}
          onFile={(f) => onImportFile?.(f)}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 gap-1.5"
            disabled={!canImportExcel || disabled}
            onClick={() => fileRef.current?.click()}
          >
            <FileSpreadsheet className="size-4 text-emerald-600" aria-hidden />
            Excel import
          </Button>
        </ExcelDropTarget>
        <input
          ref={fileRef}
          type="file"
          accept={EXCEL_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = pickFirstExcelFile(e.target.files);
            if (f) onImportFile?.(f);
            e.target.value = "";
          }}
        />
      </div>

      {scopeHint ? (
        <p className="w-full text-[11px] text-muted-foreground">{scopeHint}</p>
      ) : null}
    </div>
  );
}
