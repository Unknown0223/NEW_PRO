"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CalculatedMeasure, PivotField } from "@salec/pivot-engine";
import { compileFormula } from "@salec/pivot-engine";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DemoApplyCancelBar } from "@/components/reports/demo-dialog-actions";
import { cn } from "@/lib/utils";

export type VirtualPivotCalculatedValueDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: PivotField[];
  /** Other calculated measures available as formula operands (exclude editing id). */
  calculatedMeasures?: CalculatedMeasure[];
  editing?: CalculatedMeasure | null;
  onAdd: (measure: CalculatedMeasure) => void;
  onUpdate: (id: string, patch: Partial<Omit<CalculatedMeasure, "id">>) => void;
};

type InsertToken = string;

const ARITH: InsertToken[] = ["+", "−", "*", "/", "^"];
const COMPARE: InsertToken[] = ["=", "≠", "<", ">", "≤", "≥"];
const LOGIC: InsertToken[] = ["OR", "AND"];
const FUNCS: InsertToken[] = ["IF", "ABS", "MIN", "MAX"];
const PARENS: InsertToken[] = ["(", ")"];

/** Prefer common measure ids when sorting numeric fields. */
const MEASURE_PRIORITY = ["amount", "qty", "quantity", "volume", "bonus_qty", "price", "sum", "total"];

/** Map keypad glyphs to formula text the engine accepts. */
function tokenToFormula(token: string): string {
  switch (token) {
    case "−":
      return "-";
    case "≠":
      return "!=";
    case "≤":
      return "<=";
    case "≥":
      return ">=";
    default:
      return token;
  }
}

function needsSpaceBefore(formula: string, insert: string): boolean {
  if (!formula) return false;
  const last = formula[formula.length - 1]!;
  if (/\s/.test(last) || last === "(") return false;
  if (insert === ")" || insert === "," || insert === ".") return false;
  if (insert === "(" && /[A-Za-z0-9_]$/.test(formula)) return false;
  return true;
}

function needsSpaceAfter(insert: string): boolean {
  if (insert === ")" || insert === "(" || insert === "," || insert === "." || insert.endsWith("(")) {
    return false;
  }
  return true;
}

function buildInsertText(current: string, rawToken: string): string {
  const insert = tokenToFormula(rawToken);
  const before = needsSpaceBefore(current, insert) ? " " : "";
  const after = needsSpaceAfter(insert) ? " " : "";
  return `${before}${insert}${after}`;
}

function isNumericField(f: PivotField): boolean {
  return f.dataType === "number" || f.dataType === "currency";
}

function measureSortKey(id: string): number {
  const idx = MEASURE_PRIORITY.indexOf(id.toLowerCase());
  return idx >= 0 ? idx : MEASURE_PRIORITY.length;
}

type KeypadBtnProps = {
  label: string;
  onClick: () => void;
  wide?: boolean;
  className?: string;
};

function KeypadBtn({ label, onClick, wide, className }: KeypadBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center justify-center rounded-sm border border-[#c8c8c8] bg-[#f7f7f7] px-1.5 text-[11px] font-medium text-[#2b2b2b] hover:bg-[#ebebeb] active:bg-[#e0e0e0]",
        wide ? "min-w-[2.75rem]" : "min-w-[1.75rem]",
        className
      )}
    >
      {label}
    </button>
  );
}

export function VirtualPivotCalculatedValueDialog({
  open,
  onOpenChange,
  fields,
  calculatedMeasures = [],
  editing = null,
  onAdd,
  onUpdate
}: VirtualPivotCalculatedValueDialogProps) {
  const [label, setLabel] = useState("");
  const [formula, setFormula] = useState("");
  const [individual, setIndividual] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [fieldQuery, setFieldQuery] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const availableFields = useMemo(() => {
    const calcs = calculatedMeasures
      .filter((m) => m.id !== editing?.id)
      .map(
        (m): PivotField => ({
          id: m.id,
          label: m.label,
          dataType: "number"
        })
      );
    const byId = new Map<string, PivotField>();
    for (const f of fields) byId.set(f.id, f);
    for (const c of calcs) {
      if (!byId.has(c.id)) byId.set(c.id, c);
    }
    const all = [...byId.values()];
    all.sort((a, b) => {
      const aNum = isNumericField(a) ? 0 : 1;
      const bNum = isNumericField(b) ? 0 : 1;
      if (aNum !== bNum) return aNum - bNum;
      if (aNum === 0) {
        const pa = measureSortKey(a.id);
        const pb = measureSortKey(b.id);
        if (pa !== pb) return pa - pb;
      }
      return a.label.localeCompare(b.label, "ru");
    });
    return all;
  }, [fields, calculatedMeasures, editing?.id]);

  const filteredFields = useMemo(() => {
    const q = fieldQuery.trim().toLowerCase();
    if (!q) return availableFields;
    return availableFields.filter(
      (f) => f.label.toLowerCase().includes(q) || f.id.toLowerCase().includes(q)
    );
  }, [availableFields, fieldQuery]);

  const allowedIds = useMemo(() => availableFields.map((f) => f.id), [availableFields]);

  useEffect(() => {
    if (!open) return;
    setFieldQuery("");
    setNameError(null);
    setError(null);
    if (editing) {
      setLabel(editing.label);
      setFormula(editing.formula);
      setIndividual(editing.individual !== false);
      return;
    }
    setLabel("");
    setFormula("");
    setIndividual(true);
  }, [open, editing]);

  const insertAtCursor = useCallback(
    (rawToken: string) => {
      const el = textareaRef.current;
      if (el) {
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const before = formula.slice(0, start);
        const after = formula.slice(end);
        const piece = buildInsertText(before, rawToken);
        const next = before + piece + after;
        const caret = before.length + piece.length;
        setFormula(next);
        setError(null);
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(caret, caret);
        });
        return;
      }
      setFormula((prev) => prev + buildInsertText(prev, rawToken));
      setError(null);
    },
    [formula]
  );

  const insertField = useCallback(
    (fieldId: string) => {
      insertAtCursor(fieldId);
    },
    [insertAtCursor]
  );

  function validateFormula(nextFormula: string): string | null {
    try {
      compileFormula(nextFormula, allowedIds);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Ошибка формулы";
    }
  }

  function handleApply() {
    const trimmedLabel = label.trim();
    const trimmedFormula = formula.trim();
    let nextNameError: string | null = null;
    let nextFormulaError: string | null = null;

    if (!trimmedLabel) {
      nextNameError = "Укажите название значения";
    }
    if (!trimmedFormula) {
      nextFormulaError = "Введите формулу";
    } else {
      nextFormulaError = validateFormula(trimmedFormula);
    }

    setNameError(nextNameError);
    setError(nextFormulaError);

    if (nextNameError) {
      nameInputRef.current?.focus();
      return;
    }
    if (nextFormulaError) {
      textareaRef.current?.focus();
      return;
    }

    if (editing) {
      onUpdate(editing.id, { label: trimmedLabel, formula: trimmedFormula, individual });
      onOpenChange(false);
      return;
    }
    const id = `calc_custom_${Date.now().toString(36)}`;
    onAdd({ id, label: trimmedLabel, formula: trimmedFormula, individual });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="!z-[80] !bg-black/45 !backdrop-blur-[1px]"
        className={cn(
          "!z-[80] gap-0 overflow-hidden rounded-sm border border-[#d4d4d4] bg-white p-0",
          "text-[#2b2b2b] shadow-2xl !ring-0",
          /* Compact centered modal — same inset+margin pattern as Options/Fields */
          "!inset-0 !left-0 !right-0 !top-0 !bottom-0 !m-auto !h-fit !max-h-[70vh]",
          "!w-[min(600px,calc(100%-2rem))] !max-w-[min(600px,calc(100%-2rem))]",
          "!translate-x-0 !translate-y-0 !transform-none",
          "data-open:!animate-none data-closed:!animate-none !duration-0"
        )}
        style={{ transform: "none" }}
      >
        <div
          className="flex shrink-0 items-center justify-between gap-2 px-3 py-2"
          style={{ borderBottom: "1px solid #e2e2e2", background: "#ffffff" }}
        >
          <DialogTitle className="text-[14px] font-semibold text-[#2b2b2b]">
            Вычисляемое значение
          </DialogTitle>
          <DemoApplyCancelBar onApply={handleApply} onCancel={() => onOpenChange(false)} />
        </div>

        <div className="grid max-h-[calc(70vh-2.75rem)] grid-cols-1 overflow-hidden sm:grid-cols-[minmax(0,1fr)_200px]">
          {/* Left: name + formula + keypad */}
          <div className="flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto border-b border-[#e2e2e2] px-3 py-2.5 sm:border-b-0 sm:border-r">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[#6b6b6b]" htmlFor="calc-value-name">
                Название значения
              </label>
              <Input
                id="calc-value-name"
                ref={nameInputRef}
                className={cn(
                  "h-7 rounded-sm border-[#c8c8c8] text-xs",
                  nameError && "border-red-500 focus-visible:ring-red-400"
                )}
                value={label}
                onChange={(e) => {
                  setLabel(e.target.value);
                  if (nameError) setNameError(null);
                }}
                placeholder="Например: НДС 12% или Маржа"
                aria-invalid={Boolean(nameError)}
              />
              {nameError ? <p className="text-[11px] text-red-600">{nameError}</p> : null}
            </div>

            <div className="flex min-h-0 flex-col gap-1">
              <label className="text-[11px] font-medium text-[#6b6b6b]" htmlFor="calc-value-formula">
                Формула
              </label>
              <textarea
                id="calc-value-formula"
                ref={textareaRef}
                value={formula}
                onChange={(e) => {
                  setFormula(e.target.value);
                  setError(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const fieldId = e.dataTransfer.getData("text/pivot-field-id");
                  if (fieldId) insertField(fieldId);
                }}
                placeholder="Кликните поле справа или введите, например: amount * 0.12"
                aria-invalid={Boolean(error)}
                className={cn(
                  "h-[88px] max-h-[120px] shrink-0 resize-none overflow-y-auto rounded-sm border bg-white px-2 py-1.5 font-mono text-[12px] leading-relaxed outline-none focus-visible:ring-1 focus-visible:ring-[#888]",
                  dragOver ? "border-[#555] bg-[#f5f5f5]" : "border-[#c8c8c8]",
                  error && "border-red-500 focus-visible:ring-red-400"
                )}
              />
              {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
            </div>

            <label
              className="flex cursor-pointer items-start gap-2 text-[11px] leading-snug text-[#2b2b2b]"
              title="Если включено — формула считается по каждой строке данных, затем агрегируется"
            >
              <input
                type="checkbox"
                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#555]"
                checked={individual}
                onChange={(e) => setIndividual(e.target.checked)}
              />
              <span>
                Вычислять отдельные значения
                <span className="mt-0.5 block text-[10px] text-[#888]">
                  Формула по каждой строке, затем агрегация
                </span>
              </span>
            </label>

            {/* Operator keypad */}
            <div className="space-y-1 border-t border-[#e8e8e8] pt-2">
              <div className="flex flex-wrap gap-1">
                {ARITH.map((t) => (
                  <KeypadBtn key={t} label={t} onClick={() => insertAtCursor(t)} />
                ))}
                {PARENS.map((t) => (
                  <KeypadBtn key={t} label={t} onClick={() => insertAtCursor(t)} />
                ))}
                <KeypadBtn label="," onClick={() => insertAtCursor(",")} />
                <KeypadBtn label="." onClick={() => insertAtCursor(".")} />
              </div>
              <div className="flex flex-wrap gap-1">
                {COMPARE.map((t) => (
                  <KeypadBtn key={t} label={t} onClick={() => insertAtCursor(t)} />
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {LOGIC.map((t) => (
                  <KeypadBtn key={t} label={t} wide onClick={() => insertAtCursor(t)} />
                ))}
                {FUNCS.map((t) => (
                  <KeypadBtn
                    key={t}
                    label={t}
                    wide
                    onClick={() => insertAtCursor(t === "IF" ? "IF(" : `${t}(`)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right: field list — fixed panel height, scrolls internally */}
          <div className="flex h-[220px] min-h-0 flex-col overflow-hidden bg-[#fafafa] sm:h-full">
            <div
              className="shrink-0 space-y-1 px-2.5 py-1.5"
              style={{ borderBottom: "1px solid #e2e2e2" }}
            >
              <div className="text-[11px] font-semibold text-[#555]">Доступные поля</div>
              <Input
                className="h-7 rounded-sm border-[#c8c8c8] bg-white text-[11px]"
                value={fieldQuery}
                onChange={(e) => setFieldQuery(e.target.value)}
                placeholder="Поиск поля…"
                aria-label="Поиск доступных полей"
              />
              <p className="text-[10px] leading-snug text-[#999]">
                Сначала числовые. Клик — вставить id.
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {filteredFields.length === 0 ? (
                <p className="px-2.5 py-2 text-[11px] text-[#888]">
                  {availableFields.length === 0 ? "Нет доступных полей" : "Ничего не найдено"}
                </p>
              ) : (
                <ul className="divide-y divide-[#ececec]" role="listbox" aria-label="Доступные поля">
                  {filteredFields.map((f) => {
                    const numeric = isNumericField(f);
                    return (
                      <li key={f.id}>
                        <button
                          type="button"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/pivot-field-id", f.id);
                            e.dataTransfer.effectAllowed = "copy";
                          }}
                          onClick={() => insertField(f.id)}
                          className={cn(
                            "flex h-7 w-full cursor-grab items-center gap-1.5 px-2 text-left hover:bg-[#efefef] active:cursor-grabbing active:bg-[#e8e8e8]",
                            !numeric && "opacity-90"
                          )}
                          title={`${f.label} (${f.id})`}
                        >
                          {numeric ? (
                            <span
                              className="w-3 shrink-0 text-center text-[10px] font-semibold leading-none text-[#6b6b6b]"
                              aria-hidden
                            >
                              Σ
                            </span>
                          ) : (
                            <span className="w-3 shrink-0" aria-hidden />
                          )}
                          <span className="min-w-0 flex-1 truncate text-[11px] leading-none text-[#2b2b2b]">
                            <span className="font-medium">{f.label}</span>
                            <span className="ml-1.5 font-mono text-[10px] font-normal text-[#999]">
                              {f.id}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
