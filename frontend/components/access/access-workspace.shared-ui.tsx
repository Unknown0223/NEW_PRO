"use client";

import { useEffect, useRef, type ChangeEvent } from "react";
import { cn } from "@/lib/utils";

export function IndeterminateCheckbox({
  checked,
  indeterminate,
  disabled,
  onChange,
  className,
  title,
  "aria-label": ariaLabel
}: {
  checked: boolean;
  indeterminate: boolean;
  disabled?: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  title?: string;
  "aria-label"?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      disabled={disabled}
      checked={checked}
      onChange={onChange}
      title={title}
      aria-label={ariaLabel}
      className={cn("mt-0.5 h-4 w-4 shrink-0 accent-teal-700", className)}
    />
  );
}

export function AccessDimUsersColGroup() {
  return (
    <colgroup>
      <col className="w-8" />
      <col className="min-w-[14rem]" />
      <col className="w-28" />
      <col className="w-32" />
      <col className="w-24" />
      <col className="w-24" />
    </colgroup>
  );
}
