"use client";

import type { ReactNode } from "react";

export function VirtualPivotToolbarButton({
  icon,
  label,
  onClick,
  disabled = false,
  active = false,
  title
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      className={`flex w-[58px] flex-col items-center justify-center gap-0.5 px-1 py-1 text-[9px] leading-tight transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40${active ? " bg-muted text-foreground" : " text-muted-foreground"}`}
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
    >
      <span className="flex h-4 items-center [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
      <span className="w-full truncate">{label}</span>
    </button>
  );
}
