"use client";

import Link from "next/link";
import { useRef } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import type { OrderCreateVm } from "../../hooks/use-order-create";
import { PolkiClientSearchSelect } from "../../polki-client-search-select";
import { formatPolkiDocDateLabel, polkiCard } from "./polki-return-ui";

export function ReturnHeaderBlock({ vm }: { vm: OrderCreateVm }) {
  const {
    tenantSlug,
    mutation,
    loadingLists,
    isPolkiByOrder,
    polkiHeaderDate,
    setPolkiHeaderDate,
    clientId,
    polkiSelectedClientLabel,
    resetFlowAfterClientChange,
    setClientId,
    setPolkiOrderIds
  } = vm;

  const dateInputRef = useRef<HTMLInputElement>(null);

  const shiftDate = (days: number) => {
    const base = polkiHeaderDate ? new Date(`${polkiHeaderDate}T12:00:00`) : new Date();
    if (Number.isNaN(base.getTime())) return;
    base.setDate(base.getDate() + days);
    const y = base.getFullYear();
    const m = String(base.getMonth() + 1).padStart(2, "0");
    const d = String(base.getDate()).padStart(2, "0");
    setPolkiHeaderDate(`${y}-${m}-${d}`);
  };

  const openDatePicker = () => {
    const el = dateInputRef.current;
    if (!el) return;
    try {
      el.showPicker?.();
    } catch {
      el.focus();
      el.click();
    }
  };

  return (
    <div className={cn(polkiCard, "p-5 sm:p-6")}>
      <div className="flex flex-wrap items-start gap-4">
        <h1 className="min-w-0 flex-1 text-[20px] font-bold text-slate-800">
          {isPolkiByOrder
            ? "Возврат с полки по заказу"
            : "Создать возврат с полки"}
        </h1>
        <Link
          href="/orders"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "order-first h-8 shrink-0 text-xs text-slate-500 sm:order-none"
          )}
        >
          ← Заказы
        </Link>

        <div className="ml-auto flex w-full min-w-0 flex-wrap items-center justify-end gap-3 sm:w-auto">
          <input
            ref={dateInputRef}
            type="date"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            value={polkiHeaderDate}
            onChange={(e) => setPolkiHeaderDate(e.target.value)}
            disabled={mutation.isPending}
          />
          <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white px-1 py-1">
            <button
              type="button"
              className="p-1 text-slate-400 hover:text-slate-600"
              onClick={() => shiftDate(-1)}
              aria-label="Предыдущий день"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="flex items-center gap-2 px-2 py-0.5 text-left hover:opacity-90"
              onClick={openDatePicker}
            >
              <Calendar className="h-4 w-4 text-slate-500" aria-hidden />
              <div>
                <div className="text-[10px] leading-none text-slate-400">Дата заказа</div>
                <div className="text-sm font-medium text-slate-700">
                  {formatPolkiDocDateLabel(polkiHeaderDate)}
                </div>
              </div>
            </button>
            <button
              type="button"
              className="p-1 text-slate-400 hover:text-slate-600"
              onClick={() => shiftDate(1)}
              aria-label="Следующий день"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="relative min-w-[min(100%,280px)] flex-1 sm:min-w-[280px] sm:flex-none">
            <label
              htmlFor="oc-client-polki"
              className="pointer-events-none absolute left-3 top-[-8px] z-[1] bg-white px-1.5 text-xs text-slate-500"
            >
              Клиенты
            </label>
            <PolkiClientSearchSelect
              id="oc-client-polki"
              data-testid="order-create-client"
              tenantSlug={tenantSlug}
              value={clientId}
              selectedLabel={polkiSelectedClientLabel}
              placeholder="Выберите клиента"
              disabled={mutation.isPending || loadingLists}
              onValueChange={(id) => {
                resetFlowAfterClientChange();
                setClientId(id);
                if (isPolkiByOrder) setPolkiOrderIds([]);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
