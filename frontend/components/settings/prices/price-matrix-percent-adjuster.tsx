"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  onApply: (factor: number) => void;
  disabled?: boolean;
};

export function PriceMatrixPercentAdjuster({ onApply, disabled }: Props) {
  const [value, setValue] = useState("");
  const [mode, setMode] = useState<"increase" | "decrease">("increase");

  const apply = () => {
    const num = Number.parseFloat(value.replace(",", "."));
    if (!Number.isFinite(num) || num <= 0) return;
    const factor = mode === "increase" ? 1 + num / 100 : 1 - num / 100;
    if (factor <= 0) return;
    onApply(factor);
    setValue("");
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-1">
      <div className="flex items-center rounded-md bg-muted p-0.5">
        <button
          type="button"
          className={cn(
            "flex items-center gap-1 rounded px-2 py-1 text-xs font-medium",
            mode === "increase" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
          )}
          disabled={disabled}
          onClick={() => setMode("increase")}
        >
          <ArrowUpRight className="size-3.5" />+
        </button>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1 rounded px-2 py-1 text-xs font-medium",
            mode === "decrease" ? "bg-destructive text-destructive-foreground shadow-sm" : "text-muted-foreground"
          )}
          disabled={disabled}
          onClick={() => setMode("decrease")}
        >
          <ArrowDownRight className="size-3.5" />−
        </button>
      </div>
      <div className="relative">
        <Input
          className="h-9 w-24 pr-7 text-right text-sm tabular-nums"
          inputMode="decimal"
          placeholder="0"
          value={value}
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value;
            if (/^[\d.,]*$/.test(v)) setValue(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") apply();
          }}
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          %
        </span>
      </div>
      <Button type="button" size="sm" className="h-9 gap-1" disabled={disabled || !value.trim()} onClick={apply}>
        <Calculator className="size-3.5" />
        Применить
      </Button>
    </div>
  );
}
