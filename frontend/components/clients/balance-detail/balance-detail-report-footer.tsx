"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { fmtUZS } from "@/lib/client-balance-detail/format";
import { cn } from "@/lib/utils";

type Props = {
  debtorTotal: number;
  creditorTotal: number;
  netTotal: number;
};

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="mb-1 text-[12px] text-gray-500">{label}</div>
      <div className={cn("text-[22px] font-bold tabular-nums", color)}>{fmtUZS(Math.abs(value))}</div>
    </div>
  );
}

export function BalanceDetailReportFooter({ debtorTotal, creditorTotal, netTotal }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-400 transition-transform",
            open && "rotate-180"
          )}
        >
          <ChevronDown size={15} />
        </span>
        <span className="text-[20px] font-bold text-gray-800">
          Отчет по дебиторской и кредиторской задолженности
        </span>
      </button>
      {open ? (
        <div className="px-5 pb-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Stat label="Итого долг (дебет)" value={debtorTotal} color="text-red-600" />
            <Stat label="Итого оплата (кредит)" value={creditorTotal} color="text-green-600" />
            <Stat
              label="Чистый баланс (нетто)"
              value={netTotal}
              color={netTotal < 0 ? "text-red-600" : "text-green-700"}
            />
          </div>
          <div className="mt-3 text-[12px] text-gray-400">
            Расчёт: Чистый баланс = Σ Долг + Σ Оплата по текущему набору фильтров. Отрицательное значение —
            дебиторская задолженность клиента.
          </div>
        </div>
      ) : null}
    </div>
  );
}
