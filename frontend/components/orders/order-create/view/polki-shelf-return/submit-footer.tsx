"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumberGrouped } from "@/lib/format-numbers";
import type { OrderCreateVm } from "../../hooks/use-order-create";

type SubmitFooterProps = {
  vm: OrderCreateVm;
  warehouseName: string;
  submitTitle: string | undefined;
};

export function SubmitFooter({ vm, warehouseName, submitTitle }: SubmitFooterProps) {
  const {
    onCancel,
    mutation,
    canSubmit,
    polkiSelectedClientLabel,
    polkiSelectedLinesCount,
    polkiEstimatedSum,
    polkiSubmitBlockedReason
  } = vm;

  return (
    <div className="sticky bottom-0 z-40 -mx-2 border-t border-border bg-background/95 px-2 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-3 md:-mx-4">
      {!canSubmit && polkiSubmitBlockedReason ? (
        <div
          role="status"
          className="mb-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="min-w-0 leading-snug">{polkiSubmitBlockedReason}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            Клиент:{" "}
            <span className="font-semibold text-foreground">
              {polkiSelectedClientLabel || <span className="text-destructive">не выбран</span>}
            </span>
          </span>
          <span>
            Склад:{" "}
            <span className="font-semibold text-foreground">
              {warehouseName || <span className="text-destructive">не выбран</span>}
            </span>
          </span>
          <span>
            Позиций: <span className="font-semibold text-foreground">{polkiSelectedLinesCount}</span>
          </span>
          <span>
            Сумма:{" "}
            <span className="font-semibold text-foreground">
              {formatNumberGrouped(polkiEstimatedSum, { maxFractionDigits: 0 })}
            </span>
          </span>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 lg:ml-auto">
          <Button type="button" variant="outline" onClick={onCancel} disabled={mutation.isPending}>
            Отмена
          </Button>
          <Button
            type="button"
            data-testid="order-create-submit"
            disabled={!canSubmit}
            onClick={() => mutation.mutate()}
            className="bg-[#0a8f7e] px-6 font-semibold text-white shadow-[0_6px_16px_rgba(10,143,126,0.3)] hover:bg-[#066b5f] disabled:opacity-50"
            title={submitTitle}
          >
            {mutation.isPending ? "Оформление…" : "Возврат"}
          </Button>
        </div>
      </div>
    </div>
  );
}
