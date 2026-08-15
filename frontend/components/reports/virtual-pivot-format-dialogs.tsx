"use client";

import { useEffect, useState } from "react";
import type { ConditionalFormatRule, FieldFormat, PivotConfig, PivotValue } from "@salec/pivot-engine";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DemoApplyCancelBar } from "@/components/reports/demo-dialog-actions";
import { withHeatmapPresets } from "@/lib/pivot-heatmap-presets";

const selectClass =
  "h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export type CellFormatState = {
  valueScope: "all" | "selected";
  selectedFieldId: string;
  formatType: "number" | "currency" | "percent";
  currency: "UZS" | "USD" | "EUR";
  align: "left" | "center" | "right";
  thousands: "space" | "," | ".";
  decimalSep: "." | ",";
  decimalPlaces: string;
  negatives: "-1" | "(1)";
  nullValue: string;
  asPercent: boolean;
  pattern: string;
};

export const DEFAULT_CELL_FORMAT: CellFormatState = {
  valueScope: "all",
  selectedFieldId: "",
  formatType: "number",
  currency: "UZS",
  align: "right",
  thousands: "space",
  decimalSep: ".",
  decimalPlaces: "2",
  negatives: "-1",
  nullValue: "",
  asPercent: false,
  pattern: "#,##0.00"
};

type FormatCellsProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<CellFormatState>;
  /** Qiymat maydonlari (valueScope=selected uchun) */
  valueFields?: Array<{ id: string; label: string }>;
  onApply: (state: CellFormatState) => void;
};

export function VirtualPivotFormatCellsDialog({
  open,
  onOpenChange,
  initial,
  valueFields = [],
  onApply
}: FormatCellsProps) {
  const [state, setState] = useState<CellFormatState>({ ...DEFAULT_CELL_FORMAT, ...initial });

  useEffect(() => {
    if (open) setState({ ...DEFAULT_CELL_FORMAT, ...initial });
  }, [open, initial]);

  const set = <K extends keyof CellFormatState>(key: K, value: CellFormatState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/35"
        className="w-[480px] max-w-[calc(100%-2rem)] gap-0 overflow-hidden rounded-sm border border-[#d4d4d4] bg-white p-0 text-[#2b2b2b] shadow-xl"
      >
        <div
          className="flex items-center justify-between gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid #e2e2e2", background: "#ffffff" }}
        >
          <DialogTitle className="text-[15px] font-semibold text-[#2b2b2b]">Формат ячеек</DialogTitle>
          <DemoApplyCancelBar onApply={() => onApply(state)} onCancel={() => onOpenChange(false)} />
        </div>
        <div className="grid grid-cols-[180px_1fr] gap-x-3 gap-y-2.5 px-5 py-4 text-xs">
          <label className="self-center text-muted-foreground">Выбрать</label>
          <select
            className={selectClass}
            value={state.valueScope}
            onChange={(e) => set("valueScope", e.target.value as CellFormatState["valueScope"])}
          >
            <option value="all">Все значения</option>
            <option value="selected">Выбрать значение</option>
          </select>

          {state.valueScope === "selected" ? (
            <>
              <label className="self-center text-muted-foreground">Поле значения</label>
              <select
                className={selectClass}
                value={state.selectedFieldId}
                onChange={(e) => set("selectedFieldId", e.target.value)}
              >
                <option value="">— выберите —</option>
                {valueFields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </>
          ) : null}

          <label className="self-center text-muted-foreground">Тип</label>
          <select
            className={selectClass}
            value={state.asPercent ? "percent" : state.formatType}
            onChange={(e) => {
              const t = e.target.value as CellFormatState["formatType"];
              set("formatType", t);
              set("asPercent", t === "percent");
            }}
          >
            <option value="number">Число</option>
            <option value="currency">Валюта</option>
            <option value="percent">Процент</option>
          </select>

          {state.formatType === "currency" && !state.asPercent ? (
            <>
              <label className="self-center text-muted-foreground">Валюта</label>
              <select
                className={selectClass}
                value={state.currency}
                onChange={(e) => set("currency", e.target.value as CellFormatState["currency"])}
              >
                <option value="UZS">UZS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </>
          ) : null}

          <label className="self-center text-muted-foreground">Выравнивание текста</label>
          <select
            className={selectClass}
            value={state.align}
            onChange={(e) => set("align", e.target.value as CellFormatState["align"])}
          >
            <option value="left">Слева</option>
            <option value="center">По центру</option>
            <option value="right">Справа</option>
          </select>

          <label className="self-center text-muted-foreground">Разделитель тысяч</label>
          <select
            className={selectClass}
            value={state.thousands}
            onChange={(e) => set("thousands", e.target.value as CellFormatState["thousands"])}
          >
            <option value="space">(пробел)</option>
            <option value=",">,</option>
            <option value=".">.</option>
          </select>

          <label className="self-center text-muted-foreground">Десятичный разделитель</label>
          <select
            className={selectClass}
            value={state.decimalSep}
            onChange={(e) => set("decimalSep", e.target.value as CellFormatState["decimalSep"])}
          >
            <option value=".">.</option>
            <option value=",">,</option>
          </select>

          <label className="self-center text-muted-foreground">Десятичные знаки</label>
          <select
            className={selectClass}
            value={state.decimalPlaces}
            onChange={(e) => set("decimalPlaces", e.target.value)}
          >
            {["0", "1", "2", "3", "4"].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>

          <label className="self-center text-muted-foreground">Формат отрицательных</label>
          <select
            className={selectClass}
            value={state.negatives}
            onChange={(e) => set("negatives", e.target.value as CellFormatState["negatives"])}
          >
            <option value="-1">-1</option>
            <option value="(1)">(1)</option>
          </select>

          <label className="self-center text-muted-foreground">Нулевое значение</label>
          <Input
            className="h-8 text-xs"
            value={state.nullValue}
            onChange={(e) => set("nullValue", e.target.value)}
            placeholder="—"
          />

          <label className="self-center text-muted-foreground">Как проценты</label>
          <select
            className={selectClass}
            value={state.asPercent ? "true" : "false"}
            onChange={(e) => {
              const asPercent = e.target.value === "true";
              set("asPercent", asPercent);
              if (asPercent) set("formatType", "percent");
              else if (state.formatType === "percent") set("formatType", "number");
            }}
          >
            <option value="false">Нет</option>
            <option value="true">Да</option>
          </select>

          <label className="self-center text-muted-foreground">Шаблон числа</label>
          <Input
            className="h-8 text-xs"
            value={state.pattern}
            onChange={(e) => set("pattern", e.target.value)}
            placeholder="#,##0.00"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

type ConditionalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rules: ConditionalFormatRule[];
  onChange: (rules: ConditionalFormatRule[]) => void;
  onApply: () => void;
  /** Metrika maydonlari (ixtiyoriy fieldId) */
  valueFields?: Array<{ id: string; label: string }>;
};

export function VirtualPivotConditionalDialog({
  open,
  onOpenChange,
  rules,
  onChange,
  onApply,
  valueFields = []
}: ConditionalProps) {
  const addRule = () => {
    onChange([
      ...rules,
      {
        id: `cf-${Date.now()}-${rules.length}`,
        type: "lt",
        threshold: 0,
        textColor: "#ef4444",
        backgroundColor: undefined
      }
    ]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/35"
        className="w-[560px] max-w-[calc(100%-2rem)] gap-0 overflow-hidden rounded-sm border border-[#d4d4d4] bg-white p-0 text-[#2b2b2b] shadow-xl"
      >
        <div
          className="flex items-center justify-between gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid #e2e2e2", background: "#ffffff" }}
        >
          <DialogTitle className="text-[15px] font-semibold text-[#2b2b2b]">Условное форматирование</DialogTitle>
          <DemoApplyCancelBar onApply={onApply} onCancel={() => onOpenChange(false)} />
        </div>
        <div className="space-y-3 px-5 py-4 text-xs">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="h-7 w-7 p-0 text-sm" onClick={addRule} aria-label="Добавить условие">
              +
            </Button>
            <span className="text-muted-foreground">Добавить условие</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto h-7 text-xs"
              onClick={() => onChange(withHeatmapPresets([]))}
            >
              Heatmap presets
            </Button>
          </div>
          {rules.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-6 text-center text-muted-foreground">
              <p>Нет активных условий.</p>
              <Button type="button" variant="outline" size="sm" className="mt-3 h-7 text-xs" onClick={addRule}>
                + Добавить условие
              </Button>
            </div>
          ) : (
            rules.map((rule, idx) => (
              <div key={rule.id ?? idx} className="space-y-2 rounded-md border border-border bg-background p-2.5">
                {valueFields.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <label className="w-[70px] shrink-0 text-muted-foreground">Поле</label>
                    <select
                      className={selectClass}
                      value={rule.fieldId ?? ""}
                      onChange={(e) => {
                        const fieldId = e.target.value || undefined;
                        onChange(rules.map((r, i) => (i === idx ? { ...r, fieldId } : r)));
                      }}
                    >
                      <option value="">Все значения</option>
                      {valueFields.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div
                  className={
                    rule.type === "between"
                      ? "grid grid-cols-[70px_1fr_1fr_1fr_1fr_28px] items-center gap-2"
                      : "grid grid-cols-[70px_1fr_1fr_1fr_28px] items-center gap-2"
                  }
                >
                  <span className="text-muted-foreground">Значение</span>
                  <select
                    className={selectClass}
                    value={rule.type}
                    onChange={(e) => {
                      const type = e.target.value as ConditionalFormatRule["type"];
                      onChange(
                        rules.map((r, i) =>
                          i === idx
                            ? {
                                ...r,
                                type,
                                thresholdMax: type === "between" ? (r.thresholdMax ?? r.threshold ?? 0) : undefined
                              }
                            : r
                        )
                      );
                    }}
                  >
                    <option value="lt">Меньше чем</option>
                    <option value="gt">Больше чем</option>
                    <option value="eq">Равно</option>
                    <option value="gte">≥</option>
                    <option value="lte">≤</option>
                    <option value="between">Между</option>
                    <option value="negative">Отрицательные</option>
                  </select>
                  {rule.type === "between" ? (
                    <>
                      <Input
                        className="h-8 text-xs"
                        type="number"
                        title="Мин"
                        placeholder="Мин"
                        value={rule.threshold ?? 0}
                        onChange={(e) => {
                          const threshold = Number(e.target.value);
                          onChange(rules.map((r, i) => (i === idx ? { ...r, threshold } : r)));
                        }}
                      />
                      <Input
                        className="h-8 text-xs"
                        type="number"
                        title="Макс"
                        placeholder="Макс"
                        value={rule.thresholdMax ?? 0}
                        onChange={(e) => {
                          const thresholdMax = Number(e.target.value);
                          onChange(rules.map((r, i) => (i === idx ? { ...r, thresholdMax } : r)));
                        }}
                      />
                    </>
                  ) : (
                    <Input
                      className="h-8 text-xs"
                      type="number"
                      disabled={rule.type === "negative"}
                      value={rule.threshold ?? 0}
                      onChange={(e) => {
                        const threshold = Number(e.target.value);
                        onChange(rules.map((r, i) => (i === idx ? { ...r, threshold } : r)));
                      }}
                    />
                  )}
                  <Input
                    className="h-8 text-xs"
                    type="color"
                    title="Цвет текста"
                    value={rule.textColor ?? "#ef4444"}
                    onChange={(e) => {
                      const textColor = e.target.value;
                      onChange(rules.map((r, i) => (i === idx ? { ...r, textColor } : r)));
                    }}
                  />
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Удалить"
                    onClick={() => onChange(rules.filter((_, i) => i !== idx))}
                  >
                    ×
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-muted-foreground">Фон</label>
                  <Input
                    className="h-8 w-20 text-xs"
                    type="color"
                    value={rule.backgroundColor ?? "#ffffff"}
                    onChange={(e) => {
                      const backgroundColor = e.target.value;
                      onChange(rules.map((r, i) => (i === idx ? { ...r, backgroundColor } : r)));
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Map format state onto pivot value formats. */
export function applyCellFormatToConfig(config: PivotConfig, state: CellFormatState): PivotConfig {
  const decimals = Number.parseInt(state.decimalPlaces, 10);
  const safeDecimals = Number.isFinite(decimals) ? decimals : 2;
  const type: FieldFormat["type"] = state.asPercent
    ? "percent"
    : state.formatType === "currency"
      ? "currency"
      : state.formatType === "percent"
        ? "percent"
        : "number";

  const format: FieldFormat = {
    type,
    decimals: safeDecimals,
    thousandsSep: state.thousands,
    decimalSep: state.decimalSep,
    negativeFormat: state.negatives === "(1)" ? "parens" : "minus",
    nullDisplay: state.nullValue,
    numberPattern: state.pattern || undefined,
    ...(type === "currency" ? { currency: state.currency } : {})
  };

  const values: PivotValue[] = config.values.map((v) => {
    if (state.valueScope === "selected" && state.selectedFieldId && v.fieldId !== state.selectedFieldId) {
      return v;
    }
    return { ...v, format: { ...format } };
  });

  return { ...config, values };
}

export function cellFormatFromConfig(config: PivotConfig): Partial<CellFormatState> {
  const first = config.values[0]?.format;
  if (!first) return {};
  return {
    decimalPlaces: String(first.decimals ?? 2),
    asPercent: first.type === "percent",
    formatType: first.type === "currency" ? "currency" : first.type === "percent" ? "percent" : "number",
    currency: first.currency ?? "UZS",
    thousands: first.thousandsSep ?? "space",
    decimalSep: first.decimalSep ?? ".",
    negatives: first.negativeFormat === "parens" ? "(1)" : "-1",
    nullValue: first.nullDisplay ?? "",
    pattern: first.numberPattern ?? "#,##0.00",
    align: "right",
    selectedFieldId: config.values[0]?.fieldId ?? ""
  };
}
