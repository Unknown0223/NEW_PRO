"use client";

import { useEffect, useMemo, useRef } from "react";
import { Pause, Play, RotateCcw, SkipBack } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtHour } from "./types";

type VisitMark = { id: string; hour: number; label: string };

export default function BottomBar({
  hour,
  onHour,
  playing,
  onPlaying,
  visitMarks = [],
  rangeStart = 0,
  rangeEnd = 23,
  disabled = false
}: {
  hour: number;
  onHour: (h: number) => void;
  playing: boolean;
  onPlaying: (p: boolean) => void;
  visitMarks?: VisitMark[];
  /** Marshrut boshlangan soat (floor) */
  rangeStart?: number;
  /** Marshrut tugagan soat (ceil) */
  rangeEnd?: number;
  disabled?: boolean;
}) {
  const start = Math.max(0, Math.min(23, rangeStart));
  const end = Math.max(start + 1, Math.min(23, rangeEnd));
  const span = end - start || 1;

  const hours = useMemo(() => {
    const out: number[] = [];
    for (let h = start; h <= end; h++) out.push(h);
    return out;
  }, [start, end]);

  const activeRef = useRef<HTMLButtonElement | null>(null);

  const clamped = Math.min(end, Math.max(start, hour));
  const activeHour = Math.floor(clamped);
  const progressPct = ((clamped - start) / span) * 100;

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeHour, playing]);

  const togglePlay = () => {
    if (disabled) return;
    if (!playing && clamped >= end - 0.05) {
      onHour(start);
      onPlaying(true);
      return;
    }
    onPlaying(!playing);
  };

  const resetToStart = () => {
    onPlaying(false);
    onHour(start);
  };

  const jumpToEnd = () => {
    onPlaying(false);
    onHour(end);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-gps-card px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-semibold text-ink-soft">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-soft/70">Легенда</span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-white shadow" style={{ background: "#16a34a" }} />
            Заказы
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-white shadow" style={{ background: "#e11d48" }} />
            Отказы
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="22" height="6">
              <line x1="0" y1="3" x2="22" y2="3" stroke="#0b7c70" strokeWidth="2" opacity="0.7" strokeDasharray="3 2" />
            </svg>
            Линия (GPS)
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="22" height="6">
              <line x1="0" y1="3" x2="22" y2="3" stroke="#0f9e8e" strokeWidth="3.5" strokeLinecap="round" />
            </svg>
            Линия маршрута
          </span>
          <span className="flex items-center gap-1.5">
            <span className="grid h-4 w-4 place-items-center rounded-full border-2 border-white bg-[#0f9e8e] text-[8px] font-bold text-white shadow">
              5
            </span>
            Точка маршрута
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full border-2 border-white shadow" style={{ background: "#0f9e8e" }} />
            Торговые точки
          </span>
        </div>

        <div className="ml-auto flex min-w-0 flex-[1.4] items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={togglePlay}
            aria-label={playing ? "Пауза" : "Воспроизвести маршрут"}
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-full text-white shadow-md transition-all hover:-translate-y-0.5 disabled:opacity-40",
              playing ? "bg-amber-500" : "bg-teal-deep hover:bg-teal-brand"
            )}
          >
            {playing ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5 translate-x-px" />
            )}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={resetToStart}
            aria-label="В начало маршрута"
            title={`В начало (${fmtHour(start)})`}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-ink-soft shadow-sm transition-colors hover:text-teal-deep disabled:opacity-40"
          >
            <SkipBack className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={jumpToEnd}
            aria-label="Конец маршрута"
            title={`Конец (${fmtHour(end)})`}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-ink-soft shadow-sm transition-colors hover:text-teal-deep disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          <div className="flex min-w-[4.5rem] flex-col items-center leading-none">
            <span className="font-display text-[15px] font-bold tabular-nums text-teal-deep">
              {fmtHour(clamped)}
            </span>
            <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-ink-soft/70">
              {playing ? "Воспроизведение" : `${fmtHour(start)}–${fmtHour(end)}`}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="relative mb-1.5 px-0.5">
              <div className="relative h-2 rounded-full bg-slate-100">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-teal-deep to-teal-brand transition-[width] duration-75 ease-linear"
                  style={{ width: `${progressPct}%` }}
                />
                {visitMarks.map((m) => {
                  if (m.hour < start - 0.01 || m.hour > end + 0.01) return null;
                  const left = Math.min(100, Math.max(0, ((m.hour - start) / span) * 100));
                  const reached = m.hour <= clamped;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      title={`${fmtHour(m.hour)} · ${m.label}`}
                      disabled={disabled}
                      onClick={() => {
                        onPlaying(false);
                        onHour(m.hour);
                      }}
                      className={cn(
                        "absolute top-1/2 z-[1] h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow",
                        reached ? "bg-teal-deep" : "bg-slate-300"
                      )}
                      style={{ left: `${left}%` }}
                    />
                  );
                })}
              </div>
              <input
                type="range"
                min={start}
                max={end}
                step={0.05}
                value={clamped}
                disabled={disabled}
                onChange={(e) => {
                  onPlaying(false);
                  onHour(Number(e.target.value));
                }}
                aria-label="Время маршрута"
                className="absolute inset-0 h-2 w-full cursor-pointer appearance-none bg-transparent opacity-0 disabled:cursor-not-allowed"
              />
            </div>

            <div className="scroll-slim flex items-center gap-0.5 overflow-x-auto pb-0.5">
              {hours.map((h) => {
                const active = h === activeHour;
                const past = h <= clamped;
                return (
                  <button
                    key={h}
                    ref={active ? activeRef : undefined}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      onPlaying(false);
                      onHour(h);
                    }}
                    className={cn(
                      "min-w-[28px] shrink-0 rounded-md px-1 py-1 text-center font-display text-[10.5px] font-semibold tabular-nums transition-all disabled:opacity-40",
                      active
                        ? "scale-110 bg-teal-deep text-white shadow-[0_4px_12px_-3px_rgba(11,124,112,0.7)]"
                        : past
                          ? "bg-teal-50 text-teal-deep hover:bg-teal-100"
                          : "text-ink-soft/60 hover:bg-slate-100 hover:text-ink"
                    )}
                  >
                    {String(h).padStart(2, "0")}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
