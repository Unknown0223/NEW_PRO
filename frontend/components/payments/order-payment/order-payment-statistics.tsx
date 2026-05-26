"use client";

import { formatGroupedInteger } from "@/lib/format-numbers";
import type { PaymentStatistics } from "./types";

type Props = {
  statistics: PaymentStatistics;
};

export function OrderPaymentStatistics({ statistics }: Props) {
  const items: { label: string; value: number; className?: string }[] = [
    { label: "Общая сумма:", value: statistics.total, className: "font-medium" },
    { label: "Получено:", value: statistics.received, className: "font-medium text-teal-700 dark:text-teal-400" },
    { label: "Общий долг по заказам:", value: statistics.totalDebt, className: "font-medium" },
    {
      label: "Осталось:",
      value: statistics.remaining,
      className: "font-medium text-red-600 dark:text-red-400"
    }
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border bg-muted/25 px-4 py-3 text-sm">
      {items.map((stat) => (
        <div key={stat.label} className="flex items-center gap-1.5">
          <span className="text-muted-foreground">{stat.label}</span>
          <span className={stat.className ?? "text-foreground"}>{formatGroupedInteger(stat.value)}</span>
        </div>
      ))}
    </div>
  );
}
