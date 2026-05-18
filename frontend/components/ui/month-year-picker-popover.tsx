"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject
} from "react";
import { createPortal } from "react-dom";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

const RU_MONTH_GRID = [
  "Янв.",
  "Февр.",
  "Март",
  "Апр.",
  "Май",
  "Июнь",
  "Июль",
  "Авг.",
  "Сент.",
  "Окт.",
  "Нояб.",
  "Дек."
] as const;

/** To‘liq oy nomlari (SALESDOC uslubi) */
const RU_MONTHS_FULL = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь"
] as const;

function ymIndex(y: number, m: number): number {
  return y * 12 + m;
}

export function parseYearMonthYm(s: string): { y: number; m: number } | null {
  const t = s?.trim();
  if (!/^\d{4}-\d{2}$/.test(t)) return null;
  const [ys, ms] = t.split("-");
  const y = Number(ys);
  const m = Number(ms) - 1;
  if (!Number.isFinite(y) || !Number.isFinite(m) || y < 1990 || y > 2100 || m < 0 || m > 11) {
    return null;
  }
  return { y, m };
}

export function formatYearMonthLongRu(ym: string): string {
  const p = parseYearMonthYm(ym);
  if (!p) return ym.trim() || "—";
  return `${RU_MONTHS_FULL[p.m]}, ${p.y}`;
}

const RU_MONTH_SHORT_BTN = [
  "Янв.",
  "Февр.",
  "Март",
  "Апр.",
  "Май",
  "Июнь",
  "Июль",
  "Авг.",
  "Сент.",
  "Окт.",
  "Нояб.",
  "Дек."
] as const;

/** Tugmada: bitta oy yoki «Апр.—Июнь 2026» kabi oralig‘ */
export function formatReportPeriodButtonRu(fromIso: string, toIso: string): string {
  const fa = (fromIso ?? "").slice(0, 10);
  const ta = (toIso ?? "").slice(0, 10);
  const df = new Date(`${fa}T12:00:00`);
  const dt = new Date(`${ta}T12:00:00`);
  if (Number.isNaN(df.getTime()) || Number.isNaN(dt.getTime())) return "—";
  if (df.getFullYear() === dt.getFullYear() && df.getMonth() === dt.getMonth()) {
    return formatYearMonthLongRu(toYearMonthString(df.getFullYear(), df.getMonth()));
  }
  const y1 = df.getFullYear();
  const y2 = dt.getFullYear();
  const a = RU_MONTH_SHORT_BTN[df.getMonth()];
  const b = RU_MONTH_SHORT_BTN[dt.getMonth()];
  if (y1 === y2) return `${a}—${b} ${y1}`;
  return `${a} ${y1} — ${b} ${y2}`;
}

export function toYearMonthString(y: number, m0: number): string {
  return `${y}-${pad2(m0 + 1)}`;
}

/** Chapda yillar (joriy yilgacha), o‘ngda kvartallar + checkbox oylar; «Сохранить» = tanlangan oylar oralig‘i (min–max, shu yilda). */
function SalesDocMonthYearPickPanel({
  valueYm,
  onApply,
  onApplyRange,
  onCancel
}: {
  valueYm: string;
  /** Bitta oy (YYYY-MM) — eski rejim */
  onApply?: (ym: string) => void;
  /** Oraliq: ISO kunlar + anchorYm (popover value uchun) */
  onApplyRange?: (from: string, to: string, anchorYm: string) => void;
  onCancel: () => void;
}) {
  const parsed = parseYearMonthYm(valueYm);
  const baseY = new Date().getFullYear();
  const initY = parsed?.y ?? baseY;
  const initM = parsed?.m ?? new Date().getMonth();
  const [y, setY] = useState(initY);
  const [selectedMonths, setSelectedMonths] = useState<Set<number>>(() => new Set([initM]));

  useEffect(() => {
    const p = parseYearMonthYm(valueYm);
    if (p) {
      setY(p.y);
      setSelectedMonths(new Set([p.m]));
    }
  }, [valueYm]);

  const yearMin = baseY - 6;
  const yearMax = baseY;
  const years: number[] = [];
  for (let yy = yearMin; yy <= yearMax; yy++) years.push(yy);

  const quarters: Array<{ label: string; months: readonly number[] }> = [
    { label: "1-й квартал", months: [0, 1, 2] },
    { label: "2-й квартал", months: [3, 4, 5] },
    { label: "3-й квартал", months: [6, 7, 8] },
    { label: "4-й квартал", months: [9, 10, 11] }
  ];

  const toggleMonth = (mi: number) => {
    setSelectedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(mi)) {
        if (next.size > 1) next.delete(mi);
      } else {
        next.add(mi);
      }
      return next;
    });
  };

  const commit = () => {
    if (selectedMonths.size === 0) return;
    const sorted = [...selectedMonths].sort((a, b) => a - b);
    const minM = sorted[0]!;
    const maxM = sorted[sorted.length - 1]!;
    const lastDay = new Date(y, maxM + 1, 0).getDate();
    const from = `${y}-${pad2(minM + 1)}-01`;
    const to = `${y}-${pad2(maxM + 1)}-${pad2(lastDay)}`;
    const anchorYm = toYearMonthString(y, minM);
    if (onApplyRange) {
      onApplyRange(from, to, anchorYm);
    } else if (onApply) {
      onApply(anchorYm);
    }
  };

  const canSave = selectedMonths.size > 0;

  return (
    <div className="flex w-[min(100vw-1.5rem,23rem)] flex-col">
      <div className="flex gap-3 p-3">
        <div className="flex max-h-[15rem] w-[4.75rem] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border/60 pr-2">
          {years.map((yy) => (
            <button
              key={yy}
              type="button"
              onClick={() => setY(yy)}
              className={cn(
                "rounded-md px-1.5 py-1.5 text-center text-xs font-semibold tabular-nums transition-colors",
                y === yy
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-foreground hover:bg-muted"
              )}
            >
              {yy}
            </button>
          ))}
        </div>
        <div className="min-w-0 flex-1 space-y-2.5">
          {quarters.map((q) => (
            <div key={q.label}>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{q.label}</div>
              <div className="flex flex-col gap-1">
                {q.months.map((mi) => {
                  const checked = selectedMonths.has(mi);
                  return (
                    <label
                      key={mi}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition-colors",
                        checked ? "border-primary/60 bg-primary/10" : "border-border/60 hover:bg-muted/60"
                      )}
                    >
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={checked}
                        onChange={() => toggleMonth(mi)}
                      />
                      <span className="font-medium">{RU_MONTHS_FULL[mi]}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-border/60 px-3 py-2">
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onCancel}>
          Выход
        </Button>
        <Button type="button" size="sm" className="h-8 text-xs" disabled={!canSave} onClick={commit}>
          Сохранить
        </Button>
      </div>
    </div>
  );
}

function SingleMonthYearPickPanel({
  valueYm,
  onSelectYm,
  onPickCurrentMonth,
  onClose
}: {
  valueYm: string;
  onSelectYm: (ym: string) => void;
  onPickCurrentMonth: () => void;
  onClose: () => void;
}) {
  const parsed = parseYearMonthYm(valueYm);
  const initial = parsed ?? { y: new Date().getFullYear(), m: new Date().getMonth() };
  const [pickYear, setPickYear] = useState(initial.y);

  useEffect(() => {
    const p = parseYearMonthYm(valueYm);
    if (p) setPickYear(p.y);
  }, [valueYm]);

  const selected = parseYearMonthYm(valueYm);
  const selIdx = selected != null ? ymIndex(selected.y, selected.m) : null;

  return (
    <div className="w-max max-w-[15.5rem] p-3">
      <div className="mb-2 flex items-center justify-between gap-1 px-0.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label="Предыдущий год"
          onClick={() => setPickYear((y) => y - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[3.5rem] text-center text-sm font-semibold tabular-nums text-foreground">
          {pickYear}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label="Следующий год"
          onClick={() => setPickYear((y) => y + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {RU_MONTH_GRID.map((label, i) => {
          const idx = ymIndex(pickYear, i);
          const isSel = selIdx === idx;
          return (
            <button
              key={label}
              type="button"
              onClick={() => {
                onSelectYm(toYearMonthString(pickYear, i));
                onClose();
              }}
              className={cn(
                "rounded-md border px-1 py-2.5 text-center text-[0.7rem] font-medium leading-tight transition-colors",
                isSel &&
                  "border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 dark:hover:bg-primary/90",
                !isSel && "border-border/60 bg-background text-foreground hover:bg-muted"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
        <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={onPickCurrentMonth}>
          Текущий месяц
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={onClose}>
          Закрыть
        </Button>
      </div>
    </div>
  );
}

export type MonthYearPickerPopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorRef: RefObject<HTMLElement | null>;
  /** `YYYY-MM` */
  value: string;
  onChange?: (ym: string) => void;
  /** Доп. пресеты периода под сеткой месяцев (кнопки «прошлый месяц», диапазон и т.д.) */
  extraPresets?: ReactNode;
  /** `salesdoc` — yillar chapda, oylar kvartallar bo‘yicha, Сохранить/Выход */
  layout?: "grid" | "salesdoc";
  /**
   * layout=salesdoc: «Сохранить»da bir yilda bir nechta oy (checkbox).
   * `from`/`to` — oy oralig‘i (eng kichik va eng katta oy, orasidagi oylar hisobotga kiradi).
   */
  onSaveDateRange?: (payload: { from: string; to: string; anchorYm: string }) => void;
};

export function MonthYearPickerPopover({
  open,
  onOpenChange,
  anchorRef,
  value,
  onChange: onChangeProp,
  extraPresets,
  layout = "grid",
  onSaveDateRange
}: MonthYearPickerPopoverProps) {
  const onChange = onChangeProp ?? (() => {});
  const panelRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ top: 0, left: 0 });

  const reposition = useCallback(() => {
    if (!open) return;
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const defaultW = layout === "salesdoc" ? 352 : 260;
    const measured = panelRef.current?.getBoundingClientRect().width ?? defaultW;
    const panelW = Math.min(measured, vw - 16);
    let left = r.left;
    if (left + panelW > vw - 8) left = Math.max(8, vw - 8 - panelW);
    if (left < 8) left = 8;
    let top = r.bottom + 6;
    const estH = layout === "salesdoc" ? 400 : 320;
    if (top + estH > vh - 8) {
      top = Math.max(8, r.top - 6 - estH);
    }
    setBox({ top, left });
  }, [open, anchorRef, layout]);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const id = requestAnimationFrame(() => requestAnimationFrame(() => reposition()));
    return () => cancelAnimationFrame(id);
  }, [open, reposition, value, layout]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => reposition();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    const ro = new ResizeObserver(() => reposition());
    ro.observe(panelRef.current);
    return () => ro.disconnect();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange, anchorRef]);

  const pickCurrent = () => {
    const d = new Date();
    onChange(toYearMonthString(d.getFullYear(), d.getMonth()));
    onOpenChange(false);
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[100] rounded-xl border border-border/80 bg-popover text-popover-foreground shadow-xl ring-1 ring-black/5 dark:ring-white/10"
      style={{ top: box.top, left: box.left }}
    >
      {layout === "salesdoc" ? (
        <SalesDocMonthYearPickPanel
          key={value || "empty"}
          valueYm={value}
          onApply={
            onSaveDateRange
              ? undefined
              : (ym) => {
                  onChange(ym);
                  onOpenChange(false);
                }
          }
          onApplyRange={
            onSaveDateRange
              ? (from, to, anchorYm) => {
                  onSaveDateRange({ from, to, anchorYm });
                  onOpenChange(false);
                }
              : undefined
          }
          onCancel={() => onOpenChange(false)}
        />
      ) : (
        <>
          <SingleMonthYearPickPanel
            key={value || "empty"}
            valueYm={value}
            onSelectYm={onChange}
            onPickCurrentMonth={pickCurrent}
            onClose={() => onOpenChange(false)}
          />
          {extraPresets ? (
            <div className="border-t border-border/60 bg-muted/25 px-3 py-2">
              <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Период</div>
              <div className="flex flex-wrap gap-1">{extraPresets}</div>
            </div>
          ) : null}
        </>
      )}
    </div>,
    document.body
  );
}
