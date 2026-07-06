"use client";

import { fmtMoney, fmtUZS } from "@/lib/client-balance-detail/format";
import type { BalanceDetailCard } from "@/lib/client-balance-detail/types";
import { cn } from "@/lib/utils";

type Props = {
  cards: BalanceDetailCard[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

function CardRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-[12px] leading-6">
      <span className="text-gray-500">{label}:</span>
      <span className={cn("font-medium tabular-nums", value < 0 ? "text-red-600" : "text-gray-700")}>
        {fmtUZS(value)}
      </span>
    </div>
  );
}

export function BalanceDetailCards({ cards, selectedId, onSelect }: Props) {
  if (!cards.length) return null;

  return (
    <div className="flex gap-4 overflow-x-auto pb-1">
      {cards.map((card) => {
        const isSelected = selectedId === card.id;
        const isNegative = card.amount < 0;
        const subLines =
          card.paymentSubLines.length > 0
            ? card.paymentSubLines
            : [
                { label: "Naqd", amount: card.cash },
                { label: "Perechis", amount: card.transfer },
                { label: "Terminal", amount: card.terminal }
              ];

        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onSelect(card.id)}
            className={cn(
              "w-[280px] shrink-0 rounded-lg bg-white text-left transition-all",
              isSelected
                ? "border-2 border-[#1aa096] shadow-[0_0_0_3px_rgba(26,160,150,0.12)]"
                : "border border-gray-200 hover:border-gray-300 hover:shadow-sm"
            )}
          >
            <div className="border-b border-gray-100 px-4 pb-2.5 pt-3">
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    isSelected ? "border-[#1aa096] bg-[#1aa096]" : "border-gray-300 bg-white"
                  )}
                >
                  {isSelected ? (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                      <path
                        d="M1.5 5.5L4 8L8.5 2.5"
                        stroke="white"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </span>
                <span className="truncate text-[13px] font-medium text-gray-600">{card.title}</span>
              </div>
              <div
                className={cn(
                  "mt-1 pl-[26px] text-[20px] font-bold leading-7 tabular-nums",
                  isNegative ? "text-red-600" : "text-gray-900"
                )}
              >
                {fmtMoney(card.amount)} So&apos;m
              </div>
            </div>
            <div className="space-y-0 px-4 py-2.5">
              {card.oldDebtIncome !== 0 ? (
                <CardRow label="Эски карздан кирим" value={card.oldDebtIncome} />
              ) : null}
              {subLines.map((line) => (
                <CardRow key={`${card.id}-${line.label}`} label={line.label} value={line.amount} />
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
