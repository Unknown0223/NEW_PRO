"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { INPUT_NUMERIC_CLASS } from "@/lib/ui-input-styles";
import {
  formatDecimalInputDisplay,
  sanitizeDecimalInput,
  type DecimalInputSanitizeOpts
} from "@/lib/format-numbers";

export type GroupedNumberInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "type" | "maxFractionDigits" | "allowNegative"
> & {
  value: string;
  onValueChange: (raw: string) => void;
} & DecimalInputSanitizeOpts;

/**
 * Aniq API: `value` / `onValueChange` — bo‘shliqsiz raw string.
 * Ko‘rinish: 1 234 567,50 (ru-RU, 3 xonali guruh).
 */
export const GroupedNumberInput = React.forwardRef<HTMLInputElement, GroupedNumberInputProps>(
  function GroupedNumberInput(
    {
      value,
      onValueChange,
      allowNegative,
      maxFractionDigits,
      inputMode = "decimal",
      className,
      ...props
    },
    ref
  ) {
    const display = formatDecimalInputDisplay(value, { allowNegative, maxFractionDigits });
    return (
      <Input
        ref={ref}
        {...props}
        type="text"
        inputMode={inputMode}
        data-grouped-number=""
        className={cn(INPUT_NUMERIC_CLASS, className)}
        value={display}
        onChange={(e) => {
          onValueChange(
            sanitizeDecimalInput(e.target.value, { allowNegative, maxFractionDigits })
          );
        }}
      />
    );
  }
);
GroupedNumberInput.displayName = "GroupedNumberInput";
