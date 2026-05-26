"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { formatNumberGrouped } from "@/lib/format-numbers";
import type { OrderCreateVm } from "../../hooks/use-order-create";

export function CompositionSubmitRow({
  vm,
  submitTitle
}: {
  vm: OrderCreateVm;
  submitTitle: string | undefined;
}) {
  const {
    onCancel,
    mutation,
    canSubmit,
    hasClient,
    hasWarehouse,
    polkiSelectedClientLabel,
    warehouseId,
    warehouses,
    polkiSelectedLinesCount,
    polkiEstimatedSum,
    orderComment,
    localError,
    polkiSubmitBlockedReason
  } = vm;

  const warehouseName = useMemo(() => {
    const id = Number.parseInt(warehouseId.trim(), 10);
    if (!Number.isFinite(id)) return null;
    return warehouses.find((w) => w.id === id)?.name ?? null;
  }, [warehouseId, warehouses]);

  return (
    <div className="sticky bottom-0 z-10 -mx-1 mt-4 rounded-[10px] border border-slate-200/90 bg-white/95 px-4 py-4 shadow-[0_-4px_24px_rgba(15,23,42,0.06)] backdrop-blur sm:-mx-0">
      {localError ? (
        <p className="mb-3 text-sm text-destructive" role="alert">
          {localError}
        </p>
      ) : null}
      {!canSubmit && polkiSubmitBlockedReason && !localError ? (
        <p className="mb-3 text-sm text-amber-800 dark:text-amber-200" role="status">
          {polkiSubmitBlockedReason}
        </p>
      ) : null}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
          <span>
            <span className="text-slate-400">Клиент: </span>
            <span className="font-semibold text-slate-800">
              {hasClient ? polkiSelectedClientLabel || "—" : "не выбран"}
            </span>
          </span>
          <span>
            <span className="text-slate-400">Склад: </span>
            <span className="font-semibold text-slate-800">
              {hasWarehouse ? warehouseName ?? "—" : "не выбран"}
            </span>
          </span>
          <span>
            <span className="text-slate-400">Позиций: </span>
            <span className="font-semibold text-slate-800">{polkiSelectedLinesCount}</span>
          </span>
          <span>
            <span className="text-slate-400">Сумма: </span>
            <span className="font-mono font-semibold text-slate-800">
              {formatNumberGrouped(polkiEstimatedSum, { maxFractionDigits: 0 })}
            </span>
          </span>
          {orderComment.trim() ? (
            <span>
              <span className="text-slate-400">Комментарий: </span>
              <span className="font-semibold text-slate-800">добавлен</span>
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={mutation.isPending}>
            Отмена
          </Button>
          <button
            type="button"
            data-testid="order-create-submit"
            disabled={!canSubmit || mutation.isPending}
            title={submitTitle ?? polkiSubmitBlockedReason ?? undefined}
            onClick={() => mutation.mutate()}
            className="inline-flex items-center justify-center rounded-lg bg-[#0a8f7e] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(10,143,126,0.3)] transition hover:bg-[#066b5f] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mutation.isPending ? "Оформление…" : "Оформить возврат"}
          </button>
        </div>
      </div>
    </div>
  );
}
