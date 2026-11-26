"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { PivotLayoutForm } from "@salec/pivot-engine";

export type LayoutOptionsSelection = {
  layoutForm: "flat" | "classic" | "compact";
  grandTotals: "none" | "both" | "rows" | "columns";
  subtotals: "none" | "both" | "rows" | "columns";
};

const GRAND_TOTAL_OPTIONS = [
  ["none", "Не показывать общий итог"],
  ["both", "Показать общий итог"],
  ["rows", "Показать только для рядов"],
  ["columns", "Показать только для столбцов"]
] as const;

const SUBTOTAL_OPTIONS = [
  ["none", "Не показывать промежуточный итог"],
  ["both", "Показать промежуточный итог"],
  ["rows", "Показать только промежуточный итог рядов"],
  ["columns", "Показать только промежуточный итог столбцов"]
] as const;

const LAYOUT_FORM_OPTIONS = [
  ["compact", "Компактная форма"],
  ["classic", "Классическая форма"],
  ["flat", "Табличная форма"]
] as const;

function OptionGroup({
  title,
  name,
  value,
  onChange,
  items
}: {
  title: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  items: readonly (readonly [string, string])[];
}) {
  return (
    <div>
      <div
        style={{
          color: "#999",
          fontSize: 14,
          textTransform: "uppercase",
          marginBottom: 25,
          fontFamily: "Arial, Helvetica, sans-serif",
          letterSpacing: 0
        }}
      >
        {title}
      </div>
      <ul className="m-0 list-none p-0">
        {items.map(([itemValue, label]) => {
          const checked = value === itemValue;
          return (
            <li key={itemValue} style={{ marginBottom: 12 }}>
              <div className="relative">
                <input
                  id={`${name}-${itemValue}`}
                  type="radio"
                  name={name}
                  checked={checked}
                  onChange={() => onChange(itemValue)}
                  className="peer absolute opacity-0"
                  style={{ width: 0, height: 0 }}
                />
                <label
                  htmlFor={`${name}-${itemValue}`}
                  className="relative inline-block cursor-pointer"
                  style={{
                    color: "#111",
                    fontSize: 14,
                    padding: "4px 0 4px 35px",
                    lineHeight: 1.2,
                    fontFamily: "Arial, Helvetica, sans-serif",
                    fontWeight: checked ? 700 : 400
                  }}
                >
                  <span
                    aria-hidden
                    className="absolute left-0 top-1/2 block -translate-y-1/2 rounded-full bg-white"
                    style={{
                      width: 22,
                      height: 22,
                      border: "1px solid #d5d5d5"
                    }}
                  />
                  {checked ? (
                    <span
                      aria-hidden
                      className="absolute top-1/2 block -translate-y-1/2 rounded-full"
                      style={{
                        width: 14,
                        height: 14,
                        left: 5,
                        background: "#555"
                      }}
                    />
                  ) : null}
                  {label}
                </label>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: LayoutOptionsSelection;
  onApply: (sel: LayoutOptionsSelection) => void;
};

export function VirtualPivotLayoutOptionsDialog({
  open,
  onOpenChange,
  initial,
  onApply
}: Props) {
  const [grandTotals, setGrandTotals] = useState(initial.grandTotals);
  const [subtotals, setSubtotals] = useState(initial.subtotals);
  const [schema, setSchema] = useState<PivotLayoutForm>(initial.layoutForm);

  useEffect(() => {
    if (!open) return;
    setGrandTotals(initial.grandTotals);
    setSubtotals(initial.subtotals);
    setSchema(initial.layoutForm);
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/25"
        className={cn(
          "gap-0 overflow-visible rounded-none border border-[#d5d5d5] bg-white p-0 shadow-[0_4px_16px_rgba(0,0,0,0.25)]",
          "!inset-0 !left-0 !right-0 !top-0 !bottom-0 !m-auto !h-fit",
          "!translate-x-0 !translate-y-0 !transform-none",
          "data-open:!animate-none data-closed:!animate-none !duration-0 !ring-0",
          "w-[620px] max-w-[calc(100%-2rem)] sm:max-w-[620px]"
        )}
        style={{
          transform: "none",
          padding: "22px 28px 28px",
          boxSizing: "border-box",
          fontFamily: "Arial, Helvetica, sans-serif"
        }}
      >
        <div className="relative" style={{ minHeight: 40, marginBottom: 28 }}>
          <DialogTitle
            className="m-0 block p-0"
            style={{
              color: "#111",
              fontSize: 20,
              fontWeight: 700,
              padding: "6px 0",
              lineHeight: 1.2,
              paddingRight: 210
            }}
          >
            Настройки разметки
          </DialogTitle>
          <div className="absolute right-0 top-0 flex" style={{ fontSize: 0 }}>
            <button
              type="button"
              onClick={() =>
                onApply({
                  layoutForm: schema,
                  grandTotals,
                  subtotals
                })
              }
              className="inline-block cursor-pointer text-center uppercase outline-none"
              style={{
                height: 38,
                minWidth: 90,
                marginRight: 20,
                padding: "10px 12px",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: 0.5,
                color: "#fff",
                background: "#555",
                border: "none",
                borderRadius: 4,
                fontFamily: "Arial, Helvetica, sans-serif"
              }}
            >
              Применить
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-block cursor-pointer text-center uppercase outline-none"
              style={{
                height: 38,
                minWidth: 90,
                padding: "10px 12px",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: 0.5,
                color: "#555",
                background: "#DBDBDB",
                border: "none",
                borderRadius: 4,
                fontFamily: "Arial, Helvetica, sans-serif"
              }}
            >
              Отмена
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gridTemplateRows: "auto auto",
            columnGap: 40,
            rowGap: 36,
            fontSize: 14
          }}
        >
          <div style={{ gridColumn: 1, gridRow: 1 }}>
            <OptionGroup
              title="Общий итог"
              name="grand-totals"
              value={grandTotals}
              onChange={(v) => setGrandTotals(v as LayoutOptionsSelection["grandTotals"])}
              items={GRAND_TOTAL_OPTIONS}
            />
          </div>
          <div style={{ gridColumn: 2, gridRow: 1 }}>
            <OptionGroup
              title="Промежуточный итог"
              name="subtotals"
              value={subtotals}
              onChange={(v) => setSubtotals(v as LayoutOptionsSelection["subtotals"])}
              items={SUBTOTAL_OPTIONS}
            />
          </div>
          <div style={{ gridColumn: 1, gridRow: 2 }}>
            <OptionGroup
              title="Разметки"
              name="schema"
              value={schema}
              onChange={(v) => setSchema(v as PivotLayoutForm)}
              items={LAYOUT_FORM_OPTIONS}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
