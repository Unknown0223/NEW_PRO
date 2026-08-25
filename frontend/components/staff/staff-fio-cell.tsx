"use client";

import { formatPersonDisplayName, personDisplayInitials, type PersonNameParts } from "@/lib/person-display";
import { StaffFaceAvatar } from "@/components/staff/staff-face-avatar";
import { cn } from "@/lib/utils";

type Props = PersonNameParts & {
  kpiColor?: string | null;
  showAvatar?: boolean;
  className?: string;
  /** Agar berilsa — dumaloq etalon rasm (yo‘q bo‘lsa initials) */
  face?: { tenantSlug: string; userId: number } | null;
};

export function StaffFioCell({
  kpiColor,
  showAvatar = false,
  className,
  face,
  ...nameParts
}: Props) {
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
      {face && face.userId > 0 ? (
        <StaffFaceAvatar
          tenantSlug={face.tenantSlug}
          userId={face.userId}
          initials={initials}
          alt={display}
          size="sm"
          ringColor={color}
        />
      ) : (
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: color }}
          aria-hidden
        >
          {initials}
        </div>
      )}
      <p className="min-w-0 truncate font-medium text-slate-900" title={display || undefined}>
        {display || "—"}
      </p>
    </div>
  );
}
