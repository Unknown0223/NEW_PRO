"use client";

import Link from "next/link";

type Props = {
  className?: string;
  workSlotId?: number | null;
  /** expeditor — avtoprivyazka / yo‘nalish ham joyda */
  variant?: "default" | "expeditor";
  /** true — konfiguratsiya dialogini ochish uchun ?openConfig=1 */
  openConfig?: boolean;
};

/** Склад, филиал, цены и сотрудник на месте — только в Рабочее место. */
export function WorkplaceMovedNotice({
  className = "",
  workSlotId,
  variant = "default",
  openConfig = false
}: Props) {
  const base = workSlotId != null ? `/work-slots/${workSlotId}` : "/work-slots";
  const href = openConfig && workSlotId != null ? `${base}?openConfig=1` : base;

  if (variant === "expeditor") {
    return (
      <p
        className={`rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 ${className}`}
      >
        Склад, филиал, территория, направление и{" "}
        <strong>условия автопривязки заказов</strong> настраиваются в{" "}
        <Link href={href} className="font-semibold underline">
          Рабочее место
        </Link>
        {openConfig && workSlotId != null ? " → «Конфигурация места» → вкладка «Экспедитор»" : ""}.
      </p>
    );
  }

  return (
    <p
      className={`rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 ${className}`}
    >
      Склад, филиал, территория, направление и назначение сотрудника настраиваются в{" "}
      <Link href={href} className="font-semibold underline">
        Рабочее место
      </Link>
      .
    </p>
  );
}
