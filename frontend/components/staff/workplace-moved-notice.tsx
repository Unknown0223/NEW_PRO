"use client";

import Link from "next/link";

type Props = {
  className?: string;
  workSlotId?: number | null;
};

/** Склад, филиал, цены и ограничения — только в Рабочее место. */
export function WorkplaceMovedNotice({ className = "", workSlotId }: Props) {
  const href = workSlotId != null ? `/work-slots/${workSlotId}` : "/work-slots";
  return (
    <p
      className={`rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 ${className}`}
    >
      Склад, филиал, территория, направление, типы цен и ограничения настраиваются в{" "}
      <Link href={href} className="font-semibold underline">
        Рабочее место
      </Link>
      .
    </p>
  );
}
