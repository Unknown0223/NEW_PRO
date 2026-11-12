import { useEffect, useRef, useState } from "react";
import { Check, Dices, Palette, RotateCcw, X } from "lucide-react";
import { canvasThemes, DEFAULT_CANVAS, getCanvasTheme } from "../data/themes";
import { useToast } from "./ui";
import { cn } from "../utils/cn";

export default function ThemePicker({
  value,
  onChange,
  compact = false,
}: {
  value: string;
  onChange: (id: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const active = getCanvasTheme(value);
  const toast = useToast();

  const pick = (id: string) => {
    onChange(id);
    toast(`${getCanvasTheme(id).name} mavzusi qo'llandi`);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const randomize = () => {
    const pool = canvasThemes.filter((t) => t.id !== value);
    pick(pool[Math.floor(Math.random() * pool.length)].id);
  };

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={`Sahifa mavzusi — ${active.name}`}
        className={cn(
          "group flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-full border px-2 py-2 text-[10.5px] font-semibold backdrop-blur transition",
          open
            ? "border-brand-400 bg-white text-ink"
            : "border-line bg-white/70 text-ink-2 hover:border-brand-300 hover:text-brand-700",
        )}
      >
        <span className="relative flex size-4 items-center justify-center">
          <span
            className="absolute size-4 rounded-full opacity-90 transition-transform duration-500 group-hover:rotate-180"
            style={{ background: `conic-gradient(from 210deg, ${active.amb1}, ${active.amb2}, ${active.amb3}, ${active.amb1})` }}
          />
          <span className="relative size-[7px] rounded-full" style={{ background: active.c900 }} />
        </span>
        {!compact && <span className="hidden lg:inline">{active.name.split(" ")[1] ?? active.name}</span>}
        <Palette size={12} className="hidden text-muted sm:block lg:hidden" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Sahifa mavzusini tanlash"
          className="view-in-scale fixed inset-x-3 top-[76px] z-[120] overflow-hidden rounded-[20px] border border-white/12 shadow-[0_40px_90px_-30px_rgba(0,0,0,.75)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+10px)] sm:w-[336px]"
          style={{ background: "var(--c-900)" }}
        >
          <div className="amb-mesh pointer-events-none absolute inset-0 opacity-45" />

          <div className="relative flex items-start justify-between gap-2 px-3.5 pb-2.5 pt-3">
            <div>
              <p className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-white/40">Sahifa mavzusi</p>
              <p className="mt-1 font-display text-[14px] font-semibold tracking-[-0.02em] text-white">{active.name}</p>
              <p className="text-[9.5px] text-white/45">{active.note}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Yopish"
              className="grid size-6 shrink-0 place-items-center rounded-lg border border-white/12 bg-white/5 text-white/60 transition hover:text-white"
            >
              <X size={12} />
            </button>
          </div>

          <div className="relative grid max-h-[54vh] grid-cols-2 gap-1.5 overflow-y-auto px-3 pb-2 scroll-thin sm:max-h-none">
            {canvasThemes.map((t) => {
              const on = t.id === value;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => pick(t.id)}
                  aria-pressed={on}
                  className={cn(
                    "group relative overflow-hidden rounded-[13px] border p-1.5 text-left transition-all duration-300",
                    on ? "border-lime/70 bg-white/[0.09]" : "border-white/10 bg-white/[0.03] hover:-translate-y-0.5 hover:border-white/25",
                  )}
                >
                  <span
                    className="relative block h-[42px] w-full overflow-hidden rounded-[9px]"
                    style={{ background: t.c900 }}
                  >
                    <span
                      className="absolute inset-0"
                      style={{
                        background: `radial-gradient(60% 70% at 18% 12%, ${t.amb1}bb, transparent 66%), radial-gradient(56% 66% at 88% 26%, ${t.amb2}aa, transparent 64%), radial-gradient(64% 70% at 62% 108%, ${t.amb3}88, transparent 68%)`,
                      }}
                    />
                    <span
                      className="absolute inset-0 opacity-60"
                      style={{ backgroundImage: `radial-gradient(${t.dot} 1px, transparent 1px)`, backgroundSize: "9px 9px" }}
                    />
                    <span className="absolute bottom-1 left-1.5 h-[3px] w-8 rounded-full bg-lime" />
                    <span className="absolute bottom-1 left-[42px] h-[3px] w-4 rounded-full bg-white/40" />
                    {on && (
                      <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-lime text-[#0b1024]">
                        <Check size={9} strokeWidth={4} />
                      </span>
                    )}
                  </span>
                  <span className="mt-1.5 block truncate text-[9.5px] font-semibold text-white">{t.name}</span>
                  <span className="mt-[3px] flex items-center gap-1">
                    {[t.amb1, t.amb2, t.amb3].map((c) => (
                      <span key={c} className="size-[7px] rounded-full ring-1 ring-white/20" style={{ background: c }} />
                    ))}
                    <span className="ml-auto font-mono text-[7px] uppercase text-white/30">{t.c900}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative flex items-center gap-1.5 border-t border-white/10 px-3 py-2.5">
            <button
              type="button"
              onClick={randomize}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-lime py-2 text-[10px] font-bold text-[#0b1024] transition hover:brightness-110 active:scale-95"
            >
              <Dices size={12} /> Tasodifiy
            </button>
            <button
              type="button"
              onClick={() => pick(DEFAULT_CANVAS)}
              disabled={value === DEFAULT_CANVAS}
              className="flex items-center justify-center gap-1.5 rounded-full border border-white/14 bg-white/5 px-3 py-2 text-[10px] font-semibold text-white/70 transition hover:text-white disabled:opacity-35"
            >
              <RotateCcw size={11} /> Standart
            </button>
          </div>

          <p className="relative px-3 pb-2.5 text-center font-mono text-[7.5px] text-white/25">
            Tanlov brauzerda saqlanadi · ilova ranglari o'zgarmaydi
          </p>
        </div>
      )}
    </div>
  );
}
