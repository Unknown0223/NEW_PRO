"use client";

import { formatNumberGrouped } from "@/lib/format-numbers";
import { cn } from "@/lib/utils";

export type SupervisorPaymentSlot = {
  key: string;
  title: string;
  amount: string;
  empty: boolean;
  isTotal?: boolean;
};

const PAYMENT_TONES = [
  {
    border: "border-teal-300 dark:border-teal-500/50",
    bg: "bg-teal-50/80 dark:bg-teal-950/20",
    text: "text-teal-700 dark:text-teal-300"
  },
  {
    border: "border-emerald-300 dark:border-emerald-500/50",
    bg: "bg-emerald-50/80 dark:bg-emerald-950/20",
    text: "text-emerald-700 dark:text-emerald-300"
  },
  {
    border: "border-amber-200 dark:border-amber-500/40",
    bg: "bg-amber-50/80 dark:bg-amber-950/20",
    text: "text-amber-700 dark:text-amber-300"
  },
  {
    border: "border-violet-300 dark:border-violet-500/50",
    bg: "bg-violet-50/80 dark:bg-violet-950/20",
    text: "text-violet-700 dark:text-violet-300"
  },
  {
    border: "border-blue-300 dark:border-blue-500/50",
    bg: "bg-blue-50/80 dark:bg-blue-950/20",
    text: "text-blue-700 dark:text-blue-300"
  },
  {
    border: "border-rose-300 dark:border-rose-500/50",
    bg: "bg-rose-50/80 dark:bg-rose-950/20",
    text: "text-rose-700 dark:text-rose-300"
  }
] as const;

const TOTAL_TONE = {
  border: "border-emerald-400 dark:border-emerald-500/60",
  bg: "bg-emerald-50/90 dark:bg-emerald-950/25",
  text: "text-emerald-700 dark:text-emerald-300"
};

/** «Визиты и отчёты» kartochalari bilan bir xil ixcham uslub */
export function EnterprisePaymentKpiCard({
  slot,
  colorIndex,
  currency = "UZS"
}: {
  slot: SupervisorPaymentSlot;
  colorIndex: number;
  currency?: string;
}) {
  const tone = slot.isTotal ? TOTAL_TONE : PAYMENT_TONES[colorIndex % PAYMENT_TONES.length]!;
  const amountText = slot.empty ? "—" : formatNumberGrouped(slot.amount, { maxFractionDigits: 2 });

  return (
    <div
      className={cn(
        "rounded-xl border p-2.5 transition-shadow hover:shadow-sm",
        tone.border,
        tone.bg,
        slot.empty && "opacity-70"
      )}
    >
      <p className="mb-1 line-clamp-2 text-[10px] font-medium leading-tight text-muted-foreground">
        {slot.title}
      </p>
      <p className={cn("mb-1.5 text-xl font-bold tabular-nums leading-none", tone.text)}>{amountText}</p>
      <div className="flex items-center justify-between gap-1 rounded-lg bg-muted/50 px-2 py-1 text-[10px]">
        <span className="text-muted-foreground">Сумма</span>
        <span className="font-semibold tabular-nums text-foreground">{currency}</span>
      </div>
    </div>
  );
}

/** Eski gradient kartochka — boshqa joylarda kerak bo‘lsa */
export function SupervisorEnterprisePaymentCard({
  slot,
  colorIndex,
  compact = false
}: {
  slot: SupervisorPaymentSlot;
  colorIndex: number;
  compact?: boolean;
}) {
  if (compact) {
    return <EnterprisePaymentKpiCard slot={slot} colorIndex={colorIndex} />;
  }

  const muted = slot.empty;
  const gradient = slot.isTotal
    ? "from-teal-500 to-emerald-600"
    : ["from-teal-500 to-emerald-600", "from-emerald-400 to-green-500", "from-amber-400 to-orange-500"][
        colorIndex % 3
      ];

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm dark:border-border dark:bg-card",
        muted && "opacity-60"
      )}
    >
      <div className={cn("flex items-center justify-between bg-gradient-to-r px-4 py-2.5", gradient)}>
        <span className="text-sm font-semibold text-white">{slot.title}</span>
      </div>
      <div className="p-4">
        <p className="text-lg font-bold tabular-nums text-foreground">
          {muted ? "—" : formatNumberGrouped(slot.amount, { maxFractionDigits: 2 })}
        </p>
      </div>
    </div>
  );
}
