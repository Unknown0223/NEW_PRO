"use client";

import { formatNumberGrouped } from "@/lib/format-numbers";
import { DollarSign, Hash, Package, Scale } from "lucide-react";

export function OrderSummaryTiles({
  volumeM3,
  weightKg,
  quantity,
  totalSum
}: {
  volumeM3: number;
  weightKg: number;
  quantity: string;
  totalSum: string;
}) {
  const items = [
    {
      icon: Package,
      iconBg: "bg-green-500",
      value: volumeM3 > 0 ? formatNumberGrouped(String(volumeM3), { maxFractionDigits: 4 }) : "0",
      unit: "м³",
      label: "Общий объем"
    },
    {
      icon: Scale,
      iconBg: "bg-red-500",
      value: weightKg > 0 ? formatNumberGrouped(String(weightKg), { maxFractionDigits: 2 }) : "—",
      unit: "кг",
      label: "Общий вес"
    },
    {
      icon: Hash,
      iconBg: "bg-orange-500",
      value: formatNumberGrouped(quantity, { maxFractionDigits: 3 }),
      unit: "шт",
      label: "Общий количество"
    },
    {
      icon: DollarSign,
      iconBg: "bg-teal-500",
      value: formatNumberGrouped(totalSum, { maxFractionDigits: 2 }),
      unit: "So'm",
      label: "Общая сумма"
    }
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-4"
        >
          <div
            className={`mb-3 flex size-12 items-center justify-center rounded-xl ${item.iconBg}`}
          >
            <item.icon className="size-6 text-white" aria-hidden />
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {item.value}
              <span className="ml-1 text-sm font-normal text-muted-foreground">{item.unit}</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{item.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
