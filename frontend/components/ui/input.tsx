"use client";

import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";
import { INPUT_NUMERIC_CLASS, INPUT_SURFACE_CLASS } from "@/lib/ui-input-styles";
import {
  formatDecimalInputDisplay,
  sanitizeDecimalInput
} from "@/lib/format-numbers";

export type InputProps = React.ComponentProps<"input"> & {
  /** type="number" uchun kasr xonalari (default 6) */
  maxFractionDigits?: number;
  /** type="number" da manfiy ruxsat (default true) */
  allowNegative?: boolean;
};

function emitRawChange(
  e: React.ChangeEvent<HTMLInputElement>,
  raw: string,
  onChange?: React.ChangeEventHandler<HTMLInputElement>
) {
  if (!onChange) return;
  const target = e.target;
  const prev = target.value;
  target.value = raw;
  onChange(e);
  target.value = prev;
}

/**
 * Standart input. `type="number"` — avtomatik 3 xonali (minglik) guruhlash;
 * `onChange` da qiymat bo‘shliqsiz (API/state uchun) keladi.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    className,
    type = "text",
    value,
    defaultValue,
    onChange,
    maxFractionDigits,
    allowNegative,
    inputMode,
    ...props
  },
  ref
) {
  const isGroupedNumber = type === "number";
  const sanitizeOpts = {
    allowNegative: allowNegative ?? true,
    maxFractionDigits: maxFractionDigits ?? 6
  };

  if (isGroupedNumber) {
    const controlled = value !== undefined;
    const source = controlled
      ? value == null
        ? ""
        : String(value)
      : defaultValue == null
        ? ""
        : String(defaultValue);
    const display = formatDecimalInputDisplay(source, sanitizeOpts);

    return (
      <InputPrimitive
        ref={ref}
        {...props}
        type="text"
        inputMode={inputMode ?? "decimal"}
        data-slot="input"
        data-grouped-number=""
        className={cn(INPUT_SURFACE_CLASS, INPUT_NUMERIC_CLASS, className)}
        {...(controlled ? { value: display } : { defaultValue: display })}
        onChange={(e) => {
          emitRawChange(e, sanitizeDecimalInput(e.target.value, sanitizeOpts), onChange);
        }}
      />
    );
  }

  return (
    <InputPrimitive
      ref={ref}
      {...props}
      type={type}
      data-slot="input"
      className={cn(INPUT_SURFACE_CLASS, className)}
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      inputMode={inputMode}
    />
  );
});
Input.displayName = "Input";

export { Input };
