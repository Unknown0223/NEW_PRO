"use client";

import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type BulkFieldMode = "keep" | "clear" | "set";

type Props = {
  label: string;
  mode: BulkFieldMode;
  onModeChange: (mode: BulkFieldMode) => void;
  disabled?: boolean;
  children?: ReactNode;
};

const MODE_BUTTONS: { value: BulkFieldMode; label: string }[] = [
  { value: "keep", label: "Не менять" },
  { value: "clear", label: "Очистить" },
  { value: "set", label: "Задать" }
];

export function WorkSlotsBulkField({ label, mode, onModeChange, disabled, children }: Props) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border bg-background p-4 shadow-sm transition-colors",
        mode === "set" && "border-primary/30 ring-1 ring-primary/10",
        mode === "clear" && "border-amber-500/30 bg-amber-500/5",
        mode === "keep" && "border-border/60 bg-muted/15"
      )}
    >
      <Label className="mb-2 block text-sm font-medium">{label}</Label>
      <div
        className="grid w-full grid-cols-3 gap-1.5 rounded-lg border border-border/60 bg-muted/40 p-1.5"
        role="group"
        aria-label={`${label}: режим`}
      >
        {MODE_BUTTONS.map((b) => (
          <button
            key={b.value}
            type="button"
            disabled={disabled}
            className={cn(
              "flex min-h-[2.75rem] min-w-0 items-center justify-center rounded-md px-2 py-2.5 text-center text-xs font-medium leading-tight transition-colors sm:px-2.5 sm:text-sm sm:leading-snug",
              mode === b.value
                ? "bg-background text-foreground shadow-sm ring-1 ring-border/80"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
              disabled && "pointer-events-none opacity-50"
            )}
            onClick={() => onModeChange(b.value)}
          >
            {b.label}
          </button>
        ))}
      </div>
      {mode === "set" ? <div className="mt-3.5 min-w-0">{children}</div> : null}
      {mode === "clear" ? (
        <p className="mt-2 text-xs text-amber-800 dark:text-amber-200/90">Значение будет сброшено</p>
      ) : null}
    </div>
  );
}
