"use client";

import { Camera, LogIn, LogOut, Timer } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { OpenDayRow, TabelMarkRow } from "@/components/tabel/tabel-marks-types";
import { cn } from "@/lib/utils";

export function TabelMarksStats({
  onlyProblems,
  items,
  openDays,
  kind,
  onKind,
  stats
}: {
  onlyProblems: boolean;
  items: TabelMarkRow[];
  openDays: OpenDayRow[];
  kind: string;
  onKind: (next: string) => void;
  stats: { inn: number; mid: number; out: number; withMedia: number };
}) {
  if (onlyProblems) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Вне гео-зоны", value: items.filter((r) => (r.problem_reasons ?? []).includes("Вне гео-зоны")).length },
          { label: "Лицо не совпало", value: items.filter((r) => (r.problem_reasons ?? []).includes("Лицо не совпало")).length },
          { label: "Fake GPS", value: items.filter((r) => (r.problem_reasons ?? []).includes("Fake GPS")).length },
          { label: "Нет ухода", value: openDays.length }
        ].map((c) => (
          <button
            key={c.label}
            type="button"
            className={cn(
              "rounded-xl border bg-card p-3 text-left",
              kind === c.label && "border-primary ring-2 ring-primary/30"
            )}
            onClick={() => onKind(kind === c.label ? "" : c.label)}
          >
            <div className="text-xl font-bold leading-none">{c.value}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{c.label}</div>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {[
        { label: "Приход", value: stats.inn, icon: LogIn, chip: "bg-emerald-50 text-emerald-700" },
        { label: "Примерный уход", value: stats.mid, icon: Timer, chip: "bg-amber-50 text-amber-800" },
        { label: "Официальный уход", value: stats.out, icon: LogOut, chip: "bg-sky-50 text-sky-800" },
        { label: "С фото или видео", value: stats.withMedia, icon: Camera, chip: "bg-teal-50 text-teal-800" }
      ].map((c) => (
        <Card key={c.label} className="flex items-center gap-2.5 p-3">
          <div className={cn("grid size-9 shrink-0 place-items-center rounded-lg", c.chip)}>
            <c.icon className="size-4" />
          </div>
          <div>
            <div className="text-xl font-bold leading-none">{c.value}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{c.label}</div>
          </div>
        </Card>
      ))}
    </div>
  );
}
