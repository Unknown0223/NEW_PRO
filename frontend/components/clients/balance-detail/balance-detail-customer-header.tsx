"use client";

import { RefreshCw } from "lucide-react";
import type { BalanceDetailCustomer } from "@/lib/client-balance-detail/types";

type Props = {
  customer: BalanceDetailCustomer;
  showOverallModal: boolean;
  onToggleOverallModal: (v: boolean) => void;
  onRefresh: () => void;
  refreshing?: boolean;
  embedded?: boolean;
  /** Во вкладке профиля — показать карточку «Общий» */
  showGeneralBlock?: boolean;
  onToggleGeneralBlock?: (v: boolean) => void;
};

export function BalanceDetailCustomerHeader({
  customer,
  showOverallModal,
  onToggleOverallModal,
  onRefresh,
  refreshing,
  embedded,
  showGeneralBlock,
  onToggleGeneralBlock
}: Props) {
  if (embedded) return null;

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-wrap items-baseline gap-x-10 gap-y-1">
        <div>
          <h1 className="text-[24px] font-bold leading-7 tracking-wide text-[#1aa096]">{customer.name}</h1>
          <div className="mt-1 text-[15px] font-semibold text-gray-800">{customer.name}</div>
        </div>
        <div className="flex items-baseline gap-2 text-[13px]">
          <span className="font-semibold text-gray-700">Тел:</span>
          <span className="text-gray-500">{customer.phone || "—"}</span>
        </div>
        <div className="flex items-baseline gap-2 text-[13px]">
          <span className="font-semibold text-gray-700">Территория:</span>
          <span className="text-gray-600">{customer.territory}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex cursor-pointer select-none items-center gap-2 text-[13px] text-gray-600">
          <input
            type="checkbox"
            checked={showOverallModal}
            onChange={(e) => onToggleOverallModal(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 accent-[#1aa096]"
          />
          Показать общий блок
        </label>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="flex h-10 items-center gap-2 rounded-lg bg-[#1aa096] px-4 text-[13px] font-medium text-white shadow-sm transition hover:bg-[#158a81] active:scale-[0.98] disabled:opacity-70"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin-slow" : ""} />
          Обновить данные
        </button>
      </div>
    </div>
  );
}
