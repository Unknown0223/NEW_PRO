"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DemoApplyCancelBar } from "@/components/reports/demo-dialog-actions";
import { cn } from "@/lib/utils";
import {
  DATE_FORMAT_PATTERNS,
  DATETIME_FORMAT_PATTERNS,
  type PivotDateDisplayMode,
  type PivotDateFormatState
} from "@/lib/pivot-date-format";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: PivotDateFormatState;
  onApply: (state: PivotDateFormatState) => void;
};

const MODE_OPTIONS: { value: PivotDateDisplayMode; label: string }[] = [
  { value: "by_columns", label: "Дата (по столбцам)" },
  { value: "date", label: "Дата" },
  { value: "datetime", label: "Дата и время" }
];

export function VirtualPivotDateFormatDialog({ open, onOpenChange, initial, onApply }: Props) {
  const [mode, setMode] = useState<PivotDateDisplayMode>(initial.mode);
  const [pattern, setPattern] = useState(initial.pattern);

  useEffect(() => {
    if (!open) return;
    setMode(initial.mode);
    setPattern(initial.pattern);
  }, [open, initial.mode, initial.pattern]);

  const patterns = mode === "datetime" ? DATETIME_FORMAT_PATTERNS : DATE_FORMAT_PATTERNS;
  const showPatterns = mode === "date" || mode === "datetime";

  useEffect(() => {
    if (!showPatterns) return;
    if (!(patterns as readonly string[]).includes(pattern)) {
      setPattern(patterns[0]!);
    }
  }, [mode, showPatterns, patterns, pattern]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/35"
        className="w-[420px] max-w-[calc(100%-2rem)] gap-0 overflow-hidden rounded-sm border border-[#d4d4d4] bg-white p-0 text-[#2b2b2b] shadow-xl"
      >
        <div
          className="flex items-center justify-between gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid #e2e2e2", background: "#ffffff" }}
        >
          <DialogTitle className="text-[15px] font-semibold text-[#2b2b2b]">Выберите формат даты</DialogTitle>
          <DemoApplyCancelBar
            onApply={() => {
              onApply({
                mode,
                pattern: showPatterns ? pattern : initial.pattern
              });
              onOpenChange(false);
            }}
            onCancel={() => onOpenChange(false)}
          />
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="flex flex-col gap-2.5">
            {MODE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 text-sm",
                  mode === opt.value && "font-medium"
                )}
              >
                <input
                  type="radio"
                  name="pivot-date-mode"
                  checked={mode === opt.value}
                  onChange={() => setMode(opt.value)}
                  className="h-3.5 w-3.5 accent-primary"
                />
                {opt.label}
              </label>
            ))}
          </div>

          {showPatterns ? (
            <div className="flex flex-col gap-2.5 border-t border-border pt-4">
              {patterns.map((p) => (
                <label
                  key={p}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 font-mono text-sm",
                    pattern === p && "font-medium"
                  )}
                >
                  <input
                    type="radio"
                    name="pivot-date-pattern"
                    checked={pattern === p}
                    onChange={() => setPattern(p)}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  {p}
                </label>
              ))}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
