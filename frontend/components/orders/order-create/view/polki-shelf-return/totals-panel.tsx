"use client";

import { memo } from "react";
import { Box, Cuboid, Package, Wallet } from "lucide-react";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { cn } from "@/lib/utils";
import type { OrderCreateVm } from "../../hooks/use-order-create";
import { polkiCard } from "./polki-return-ui";

function SummaryCard({
  icon,
  iconBg,
  value,
  label,
  sublabel
}: {
  icon: React.ReactNode;
  iconBg: string;
  value: string;
  label: string;
  sublabel?: string;
}) {
  return (
    <div className={cn(polkiCard, "flex items-center gap-3 p-4")}>
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", iconBg)}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
        <div className="text-xl font-bold tabular-nums text-slate-800 sm:text-2xl">{value}</div>
        {sublabel ? <div className="text-[11px] text-slate-500">{sublabel}</div> : null}
      </div>
    </div>
  );
}

export const TotalsPanel = memo(function TotalsPanel({ vm }: { vm: OrderCreateVm }) {
  const { polkiEstimatedSum, polkiTotalReturnQtySum, polkiVolumeM3, polkiSelectedLinesCount } = vm;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        icon={<Package className="h-5 w-5 text-white" aria-hidden />}
        iconBg="bg-indigo-500"
        value={String(polkiSelectedLinesCount)}
        label="Позиций в возврате"
        sublabel="уникальных строк"
      />
      <SummaryCard
        icon={<Box className="h-5 w-5 text-white" aria-hidden />}
        iconBg="bg-orange-400"
        value={`${formatNumberGrouped(polkiTotalReturnQtySum, { maxFractionDigits: 0 })} шт`}
        label="Общее количество"
        sublabel="на склад"
      />
      <SummaryCard
        icon={<Cuboid className="h-5 w-5 text-white" aria-hidden />}
        iconBg="bg-emerald-500"
        value={`${formatNumberGrouped(polkiVolumeM3, { maxFractionDigits: 2 })} м³`}
        label="Общий объём"
      />
      <div
        className={cn(
          polkiCard,
          "flex items-center justify-between gap-3 border-2 border-[#0a8f7e]/25 bg-gradient-to-br from-teal-50/80 to-white p-4"
        )}
      >
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#0a8f7e]">
            Итоговая сумма
          </div>
          <div className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">
            {formatNumberGrouped(polkiEstimatedSum, { maxFractionDigits: 0 })}
          </div>
          <div className="text-[11px] text-slate-500">К возврату на склад / баланс</div>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0a8f7e] text-white shadow-md shadow-teal-900/10">
          <Wallet className="h-6 w-6" aria-hidden />
        </div>
      </div>
    </div>
  );
});
