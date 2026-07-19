"use client";

import { cn } from "@/lib/utils";

/** Arena Universal / WDR demo dialog action chrome. */
export function DemoApplyButton({
  onClick,
  children = "Применить",
  className,
  disabled
}: {
  onClick: () => void;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center justify-center rounded-sm px-3.5 text-[11px] font-semibold uppercase tracking-wide text-white",
        "bg-[#4a4a4a] hover:bg-[#3a3a3a] disabled:opacity-40",
        className
      )}
    >
      {children}
    </button>
  );
}

export function DemoCancelButton({
  onClick,
  children = "Отмена",
  className
}: {
  onClick: () => void;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center justify-center rounded-sm px-3.5 text-[11px] font-semibold uppercase tracking-wide",
        "border border-[#c8c8c8] bg-[#f0f0f0] text-[#2b2b2b] hover:bg-[#e6e6e6]",
        className
      )}
    >
      {children}
    </button>
  );
}

/** Demo order: Apply (dark) then Cancel (light). */
export function DemoApplyCancelBar({
  onApply,
  onCancel,
  applyLabel = "Применить",
  cancelLabel = "Отмена",
  leading,
  className
}: {
  onApply: () => void;
  onCancel: () => void;
  applyLabel?: string;
  cancelLabel?: string;
  leading?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex shrink-0 items-center gap-1.5", className)}>
      {leading}
      <DemoApplyButton onClick={onApply}>{applyLabel}</DemoApplyButton>
      <DemoCancelButton onClick={onCancel}>{cancelLabel}</DemoCancelButton>
    </div>
  );
}
