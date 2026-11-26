"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DemoCancelButton } from "@/components/reports/demo-dialog-actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenCellFormat: () => void;
  onOpenConditional: () => void;
  onViewTable: () => void;
  onViewChart: () => void;
  onToggleColumnTotals: () => void;
};

const ACTIONS: Array<{
  id: string;
  label: string;
  hint: string;
  run: keyof Pick<
    Props,
    | "onOpenCellFormat"
    | "onOpenConditional"
    | "onViewTable"
    | "onViewChart"
    | "onToggleColumnTotals"
  >;
}> = [
  {
    id: "cells",
    label: "Формат ячеек…",
    hint: "Число / валюта / процент — с образцом",
    run: "onOpenCellFormat"
  },
  {
    id: "conditional",
    label: "Условное форматирование…",
    hint: "Цвет по порогу",
    run: "onOpenConditional"
  },
  {
    id: "table",
    label: "Таблица",
    hint: "Сводная таблица",
    run: "onViewTable"
  },
  {
    id: "chart",
    label: "Диаграмма",
    hint: "График по значениям",
    run: "onViewChart"
  },
  {
    id: "colTotals",
    label: "Итоги по столбцам",
    hint: "Вкл/выкл итоги столбцов",
    run: "onToggleColumnTotals"
  }
];

/** Формат — markaziy Arena-uslub modal (dropdown o‘rniga). */
export function VirtualPivotFormatMenu({
  open,
  onOpenChange,
  onOpenCellFormat,
  onOpenConditional,
  onViewTable,
  onViewChart,
  onToggleColumnTotals
}: Props) {
  const handlers = {
    onOpenCellFormat,
    onOpenConditional,
    onViewTable,
    onViewChart,
    onToggleColumnTotals
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/25"
        className="w-[420px] max-w-[calc(100%-2rem)] gap-0 overflow-hidden rounded-none border border-[#d5d5d5] bg-white p-0 text-[#2b2b2b] shadow-[0_4px_16px_rgba(0,0,0,0.25)]"
      >
        <div
          className="flex items-center justify-between gap-3 px-5 py-3"
          style={{ borderBottom: "1px solid #e2e2e2" }}
        >
          <DialogTitle className="m-0 text-[18px] font-bold text-[#111]">Формат</DialogTitle>
          <DemoCancelButton onClick={() => onOpenChange(false)}>Отмена</DemoCancelButton>
        </div>

        <div className="px-5 py-3">
          <p
            className="mb-3 text-[11px] uppercase tracking-wide"
            style={{ color: "#999", fontFamily: "Arial, Helvetica, sans-serif" }}
          >
            Образец действий
          </p>
          <ul className="m-0 list-none space-y-1 p-0">
            {ACTIONS.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="flex w-full flex-col rounded-sm border border-transparent px-3 py-2 text-left hover:border-[#d5d5d5] hover:bg-[#f7f7f7]"
                  onClick={() => {
                    handlers[a.run]();
                    onOpenChange(false);
                  }}
                >
                  <span className="text-sm font-medium text-[#111]">{a.label}</span>
                  <span className="text-[11px] text-[#777]">{a.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div
          className="mx-5 mb-4 rounded-sm border border-[#e2e2e2] bg-[#fafafa] px-3 py-2"
          style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
        >
          <p className="mb-1 text-[10px] uppercase tracking-wide text-[#999]">Намуна</p>
          <p className="text-xs text-[#444]">
            «Формат ячеек» — markazda dialog + jonli{" "}
            <span className="font-semibold tabular-nums">1 234,56</span> namuna.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
