"use client";

import { useRef, type ReactNode } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatPriceDraftDisplay,
  isAllowedPriceInput,
  parsePriceDraft,
  sanitizePriceInput
} from "@/lib/price-matrix-draft";

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
          <Input
            className="h-10 w-40 font-mono text-sm tabular-nums"
            value={bulk}
            disabled={disabled || bulkDisabled}
            inputMode="decimal"
            maxLength={16}
            placeholder="0"
            onChange={(e) => {
              const v = e.target.value;
              if (!isAllowedPriceInput(v)) return;
              onBulkChange(sanitizePriceInput(v));
            }}
            onBlur={() => {
              const parsed = parsePriceDraft(bulk);
              if (parsed.ok) onBulkChange(formatPriceDraftDisplay(parsed.value));
            }}
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
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
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
