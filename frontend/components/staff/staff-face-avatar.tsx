"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const SIZE_CLASS = {
  sm: "h-9 w-9 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-28 w-28 text-2xl",
  xl: "h-36 w-36 text-3xl"
} as const;

type Size = keyof typeof SIZE_CLASS;

type Props = {
  tenantSlug: string;
  userId: number;
  /** Initials when photo missing / failed */
  initials?: string;
  alt?: string;
  size?: Size;
  className?: string;
  /** Skip image request (e.g. known no face) */
  hasPhoto?: boolean;
  ringColor?: string | null;
};

/**
 * Dumaloq xodim rasmi — etalon face-reference; yo‘q bo‘lsa initials.
 */
export function StaffFaceAvatar({
  tenantSlug,
  userId,
  initials = "?",
  alt = "",
  size = "sm",
  className,
  hasPhoto = true,
  ringColor
}: Props) {
  const [failed, setFailed] = useState(false);
  const showImg = hasPhoto && userId > 0 && !failed;
  const src = `/api/${tenantSlug}/staff/users/${userId}/face-reference`;

  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white bg-slate-400 font-bold text-white shadow-sm",
        SIZE_CLASS[size],
        className
      )}
      style={ringColor ? { boxShadow: `0 0 0 2px ${ringColor}` } : undefined}
      aria-hidden={!alt}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="select-none uppercase tracking-wide">{initials.slice(0, 2) || "?"}</span>
      )}
    </div>
  );
}
