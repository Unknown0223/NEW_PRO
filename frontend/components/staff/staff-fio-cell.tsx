"use client";

import { formatPersonDisplayName, personDisplayInitials, type PersonNameParts } from "@/lib/person-display";
import { cn } from "@/lib/utils";

type Props = PersonNameParts & {
  kpiColor?: string | null;
  showAvatar?: boolean;
  className?: string;
};

export function StaffFioCell({ kpiColor, showAvatar = false, className, ...nameParts }: Props) {
  const display = formatPersonDisplayName(nameParts);
  const initials = personDisplayInitials(nameParts);
  const color = kpiColor?.trim() || "#64748b";

  if (!showAvatar) {
    return (
      <span className={cn("text-sm font-medium text-slate-900", className)} title={display || undefined}>
        {display || "—"}
      </span>
    );
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <div
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
        style={{ backgroundColor: color }}
        aria-hidden
      >
        {initials}
      </div>
      <p className="min-w-0 truncate font-medium text-slate-900" title={display || undefined}>
        {display || "—"}
      </p>
    </div>
  );
}
