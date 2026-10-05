"use client";

import { useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { ChevronDown, Delete, Move, X } from "lucide-react";
import { cn } from "@/lib/utils";

const FN_KEY = "h-7 [@media(max-height:760px)]:h-6 rounded-[8px] bg-card text-[11px] font-bold text-foreground/70 shadow-sm transition-colors hover:text-[var(--pr-brand-700)]";
const OP_KEY = "h-8 [@media(max-height:760px)]:h-7 rounded-[9px] border border-[var(--pr-field)] bg-card text-[13px] font-semibold text-foreground/70 transition-colors hover:bg-muted";
const NUM_KEY = "h-8 [@media(max-height:760px)]:h-7 rounded-[9px] bg-[#eef2f6] text-[13px] font-semibold text-[#273449] transition-colors hover:bg-[#dde6f0] dark:bg-muted dark:text-foreground dark:hover:bg-muted/70";
const HEAD_BTN = "rounded-md p-1 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground";

const FUNCS = [
  { label: "MIN", text: "MIN(" },
  { label: "MAX", text: "MAX(" },
  { label: "ЕСЛИ", text: "ЕСЛИ(" },
  { label: "ОКР", text: "ОКРУГЛ(" }
];

type Props = {
  canvasRef: RefObject<HTMLElement | null>;
  disabled?: boolean;
  onInsert: (text: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onEquals: () => void;
};

/** Draggable keypad inside the formula canvas (template «Установка формулу»). */
export function PayrollFormulaCalc({ canvasRef, disabled, onInsert, onBackspace, onClear, onEquals }: Props) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const startDrag = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const canvas = canvasRef.current?.getBoundingClientRect();
    const calc = (e.currentTarget.closest("[data-calc]") as HTMLElement | null)?.getBoundingClientRect();
    if (!canvas || !calc) return;
    e.preventDefault();
    const init = { x: calc.left - canvas.left, y: calc.top - canvas.top };
    const sx = e.clientX;
    const sy = e.clientY;
    setPos(init);
    const move = (ev: PointerEvent) => {
      setPos({
        x: Math.min(Math.max(8, init.x + ev.clientX - sx), Math.max(8, canvas.width - calc.width - 8)),
        y: Math.min(Math.max(8, init.y + ev.clientY - sy), Math.max(8, canvas.height - calc.height - 8))
      });
    };
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  };

  const key = (label: string, text: string, cls: string, extra?: string) => (
    <button key={label} type="button" disabled={disabled} onClick={() => onInsert(text)} className={cn(cls, extra, "disabled:opacity-50")}>
      {label}
    </button>
  );

  return (
    <div
      data-calc
      className="absolute z-10 w-[240px] select-none rounded-[18px] border border-[var(--pr-field)] bg-card p-2.5 shadow-[0_12px_26px_-10px_rgba(15,65,57,0.30)]"
      style={pos ? { left: pos.x, top: pos.y } : { right: 16, bottom: 16 }}
    >
      <div className="mb-2 flex h-6 items-center justify-between px-1">
        <button type="button" onPointerDown={startDrag} aria-label="Переместить калькулятор" title="Переместить" className={cn(HEAD_BTN, "cursor-grab active:cursor-grabbing")}>
          <Move className="size-4" />
        </button>
        <button type="button" onClick={() => setCollapsed((v) => !v)} aria-label={collapsed ? "Развернуть" : "Свернуть"} className={HEAD_BTN}>
          <ChevronDown className={cn("size-4 transition-transform", collapsed && "rotate-180")} />
        </button>
        <button type="button" onClick={onClear} disabled={disabled} aria-label="Очистить" title="Очистить всё" className={HEAD_BTN}>
          <X className="size-4" />
        </button>
      </div>
      {collapsed ? null : (
        <>
          <div className="rounded-[12px] bg-[#eef2f7] p-1.5 dark:bg-muted/60">
            <div className="grid grid-cols-4 gap-1.5">
              {FUNCS.map((f) => key(f.label, f.text, FN_KEY))}
              {key("<", " < ", FN_KEY, "text-[13px] font-semibold")}
              {key(">", " > ", FN_KEY, "text-[13px] font-semibold")}
              {key("ОКР↗", "ОКРУГЛВВЕРХ(", FN_KEY, "col-span-2")}
              {key(";", "; ", FN_KEY, "text-[13px] font-semibold")}
              {key("=", " = ", FN_KEY, "text-[13px] font-semibold")}
              {key("ОКР↘", "ОКРУГЛВНИЗ(", FN_KEY, "col-span-2")}
            </div>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            <button type="button" disabled={disabled} onClick={onBackspace} aria-label="Стереть" className={cn(OP_KEY, "flex items-center justify-center disabled:opacity-50")}>
              <Delete className="size-4" />
            </button>
            {key("(", "(", OP_KEY)}
            {key(")", ")", OP_KEY)}
            {key("+", " + ", OP_KEY)}
            {["7", "8", "9", "-", "4", "5", "6", "*", "1", "2", "3", "/"].map((k) =>
              /^\d$/.test(k) ? key(k, k, NUM_KEY) : key(k, ` ${k} `, OP_KEY)
            )}
            {key(".", ".", NUM_KEY)}
            {key("0", "0", NUM_KEY)}
            <button
              type="button"
              onClick={onEquals}
              aria-label="Вычислить"
              title="Проверить и посчитать"
              className="col-span-2 h-8 rounded-[9px] [@media(max-height:760px)]:h-7 bg-primary text-[13px] font-bold text-white transition-colors hover:bg-[var(--pr-brand-600)]"
            >
              =
            </button>
          </div>
        </>
      )}
    </div>
  );
}

type Tok = { kind: "var" | "num" | "op" | "word"; text: string };

function tokenize(text: string): Tok[] {
  const parts = text.match(/\[[^\]]*\]?|>=|<=|<>|[()+\-*/;<>=]|\d+(?:[.,]\d+)?|[^\s()+\-*/;<>=[\]]+/g) ?? [];
  return parts.map((p) => {
    if (p.startsWith("[")) return { kind: "var", text: p.replace(/^\[|\]$/g, "") };
    if (/^\d/.test(p)) return { kind: "num", text: p };
    if (/^(>=|<=|<>|[()+\-*/;<>=])$/.test(p)) return { kind: "op", text: p };
    return { kind: "word", text: p };
  });
}

/** Read-only chip view of the formula, as in the template canvas. */
export function PayrollFormulaTokens({ text }: { text: string }) {
  return (
    <div className="contents">
      {tokenize(text).map((t, i) =>
        t.kind === "var" ? (
          <span key={i} className="rounded-md border border-[var(--pr-field)] bg-card px-2 py-0.5 text-[12px] font-medium text-foreground/70">
            {t.text}
          </span>
        ) : (
          <span key={i} className={cn("whitespace-nowrap text-[13px]", t.kind === "op" ? "text-muted-foreground" : "font-bold text-foreground")}>
            {t.text}
          </span>
        )
      )}
    </div>
  );
}
