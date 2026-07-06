"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Clock3 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** `HH:mm` yoki bo‘sh qatorni normalizatsiya qiladi. */
export function normalizeHmInput(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const h = Number.parseInt(m[1]!, 10);
  const min = Number.parseInt(m[2]!, 10);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) {
    return null;
  }
  return `${pad2(h)}:${pad2(min)}`;
}

function parseHm(value: string, fallback: string): { h: number; m: number } {
  const norm = normalizeHmInput(value) ?? normalizeHmInput(fallback) ?? "00:00";
  const [hs, ms] = norm.split(":");
  return {
    h: Number.parseInt(hs!, 10) || 0,
    m: Number.parseInt(ms!, 10) || 0
  };
}

function TimeSpinnerColumn({
  value,
  max,
  onChange
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const bump = (delta: number) => {
    const next = (value + delta + (max + 1)) % (max + 1);
    onChange(next);
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="h-7 w-9 text-teal-600 hover:bg-teal-500/10 hover:text-teal-700 dark:text-teal-400"
        aria-label="Увеличить"
        onClick={() => bump(1)}
      >
        <ChevronUp className="h-4 w-4" />
      </Button>
      <div className="flex h-10 w-12 items-center justify-center rounded-md border border-border/70 bg-background font-mono text-xl font-semibold tabular-nums text-foreground">
        {pad2(value)}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="h-7 w-9 text-teal-600 hover:bg-teal-500/10 hover:text-teal-700 dark:text-teal-400"
        aria-label="Уменьшить"
        onClick={() => bump(-1)}
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
    </div>
  );
}

function TimeScrollColumn({
  value,
  options,
  onPick,
  listRef
}: {
  value: string;
  options: string[];
  onPick: (v: string) => void;
  listRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div
      ref={listRef}
      className="h-[9.25rem] w-12 overflow-y-auto scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          className={cn(
            "flex h-7 w-full items-center justify-center font-mono text-sm transition-colors",
            opt === value
              ? "bg-primary/15 font-semibold text-primary"
              : "text-foreground/80 hover:bg-muted/50"
          )}
          onClick={() => onPick(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export type TimePickerFieldProps = {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
};

/**
 * Faqat vaqt (`HH:mm`): triggerda qiymat doim ko‘rinadi, popover — strelkalar + scroll ro‘yxat.
 */
export function TimePickerField({
  id,
  value,
  onChange,
  placeholder = "00:00",
  disabled,
  className,
  "aria-label": ariaLabel
}: TimePickerFieldProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState({ top: 0, left: 0 });

  const displayValue = normalizeHmInput(value);
  const { h: initH, m: initM } = parseHm(value, placeholder);
  const [panelH, setPanelH] = useState(initH);
  const [panelM, setPanelM] = useState(initM);

  const hourOptions = useMemo(() => Array.from({ length: 24 }, (_, i) => pad2(i)), []);
  const minuteOptions = useMemo(() => Array.from({ length: 60 }, (_, i) => pad2(i)), []);

  useEffect(() => {
    if (!open) return;
    const { h, m } = parseHm(value, placeholder);
    setPanelH(h);
    setPanelM(m);
  }, [open, value, placeholder]);

  const reposition = useCallback(() => {
    if (!open) return;
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const panelW = panelRef.current?.getBoundingClientRect().width ?? 220;
    let left = r.left;
    if (left + panelW > vw - 8) left = Math.max(8, vw - 8 - panelW);
    let top = r.bottom + 6;
    if (top + 280 > vh - 8) top = Math.max(8, r.top - 8 - 280);
    setBox({ top, left });
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const idRaf = requestAnimationFrame(() => requestAnimationFrame(() => reposition()));
    return () => cancelAnimationFrame(idRaf);
  }, [open, reposition]);

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
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const commitPanel = useCallback(() => {
    onChange(`${pad2(panelH)}:${pad2(panelM)}`);
    setOpen(false);
  }, [onChange, panelH, panelM]);

  const syncScroll = useCallback((part: "hour" | "minute") => {
    const el = part === "hour" ? hourListRef.current : minuteListRef.current;
    const val = part === "hour" ? pad2(panelH) : pad2(panelM);
    if (!el) return;
    const idx = Number.parseInt(val, 10);
    if (!Number.isFinite(idx)) return;
    const center = Math.max(0, (el.clientHeight - 28) / 2);
    el.scrollTo({ top: idx * 28 - center, behavior: "auto" });
  }, [panelH, panelM]);

  useEffect(() => {
    if (!open) return;
    syncScroll("hour");
    syncScroll("minute");
  }, [open, panelH, panelM, syncScroll]);

  const hourStr = pad2(panelH);
  const minuteStr = pad2(panelM);

  return (
    <>
      <div
        ref={anchorRef}
        id={id}
        className={cn(
          "flex h-10 min-w-[7.5rem] items-stretch overflow-hidden rounded-md border border-input bg-background shadow-sm",
          disabled && "pointer-events-none opacity-50",
          className
        )}
      >
        <button
          type="button"
          className="flex h-full w-9 shrink-0 items-center justify-center border-r border-border/80 text-muted-foreground hover:bg-muted/60"
          aria-label={ariaLabel ?? "Выбрать время"}
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
        >
          <Clock3 className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="min-w-0 flex-1 px-2 text-left font-mono text-[15px] font-semibold tabular-nums text-foreground hover:bg-muted/40"
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          {displayValue ?? (
            <span className="text-foreground">{placeholder}</span>
          )}
        </button>
      </div>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              className="fixed z-[100] w-[15.5rem] rounded-lg border border-border/80 bg-popover p-3 text-popover-foreground shadow-lg ring-1 ring-black/5"
              style={{ top: box.top, left: box.left }}
            >
              <div className="flex items-center justify-center gap-2">
                <TimeSpinnerColumn value={panelH} max={23} onChange={setPanelH} />
                <span className="pb-1 text-xl font-semibold text-muted-foreground">:</span>
                <TimeSpinnerColumn value={panelM} max={59} onChange={setPanelM} />
              </div>
              <div className="mt-3 flex items-center justify-center gap-1 border-t border-border/60 pt-3">
                <TimeScrollColumn
                  value={hourStr}
                  options={hourOptions}
                  onPick={(h) => setPanelH(Number.parseInt(h, 10))}
                  listRef={hourListRef}
                />
                <span className="flex h-[9.25rem] items-center text-muted-foreground">:</span>
                <TimeScrollColumn
                  value={minuteStr}
                  options={minuteOptions}
                  onPick={(m) => setPanelM(Number.parseInt(m, 10))}
                  listRef={minuteListRef}
                />
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setOpen(false)}
                >
                  Отмена
                </Button>
                <Button type="button" size="sm" className="h-7 text-xs" onClick={() => commitPanel()}>
                  Применить
                </Button>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
