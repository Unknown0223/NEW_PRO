"use client";

import { useMemo } from "react";
import { Briefcase, Palmtree, Stethoscope, UserCheck, UserX, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AttendanceStatus } from "@/components/timesheet/timesheet-shared";

type Row = {
  cells: Array<{ date: string; status: AttendanceStatus }>;
};

/**
 * Карточки статистики «на опорный день» (как в ZIP-прототипе): сколько сотрудников
 * работают / отсутствуют / в отпуске / на больничном именно в этот день, а не сумма
 * за весь месяц (иначе получаются абсурдные числа вроде «906 отсутствий»).
 */
export function TimesheetStatCards({
  rows,
  refDate,
  refLabel
}: {
  rows: Row[];
  refDate: string;
  refLabel: string;
}) {
  const stats = useMemo(() => {
    let worked = 0;
    let absent = 0;
    let vacation = 0;
    let sick = 0;
    let trip = 0;
    for (const r of rows) {
      const cell = r.cells.find((c) => c.date === refDate);
      if (!cell) continue;
      if (cell.status === "worked" || cell.status === "half_day") worked += 1;
      else if (cell.status === "absent") absent += 1;
      else if (cell.status === "vacation") vacation += 1;
      else if (cell.status === "sick") sick += 1;
      else if (cell.status === "trip") trip += 1;
    }
    return { employees: rows.length, worked, absent, vacation, sick, trip };
  }, [rows, refDate]);

  // Палитра карточек 1:1 с ZIP-прототипом TabelERP:
  //  Сотрудников — нейтральный, В работе — emerald, Отсутствуют — rose,
  //  Отпуск — yellow, Больничный — orange, Командировка — purple.
  const cards = [
    { label: "Сотрудников", value: stats.employees, icon: Users, chip: "bg-muted", accent: "text-foreground" },
    { label: "В работе", value: stats.worked, icon: UserCheck, chip: "bg-emerald-50 dark:bg-emerald-500/10", accent: "text-emerald-600 dark:text-emerald-400" },
    { label: "Отсутствуют", value: stats.absent, icon: UserX, chip: "bg-rose-50 dark:bg-rose-500/10", accent: "text-rose-600 dark:text-rose-400" },
    { label: "Отпуск", value: stats.vacation, icon: Palmtree, chip: "bg-yellow-50 dark:bg-yellow-500/10", accent: "text-yellow-600 dark:text-yellow-400" },
    { label: "Больничный", value: stats.sick, icon: Stethoscope, chip: "bg-orange-50 dark:bg-orange-500/10", accent: "text-orange-600 dark:text-orange-400" },
    { label: "Командировка", value: stats.trip, icon: Briefcase, chip: "bg-purple-50 dark:bg-purple-500/10", accent: "text-purple-600 dark:text-purple-400" }
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {cards.map((c) => (
        <Card key={c.label} className="flex items-center gap-2.5 p-3">
          <div className={cn("grid size-9 shrink-0 place-items-center rounded-lg", c.chip, c.accent)}>
            <c.icon className="size-4" />
          </div>
          <div className="min-w-0">
            <div className={cn("text-xl font-bold leading-none", c.accent)}>{c.value}</div>
            <div className="mt-1 truncate text-[11px] text-muted-foreground">{c.label}</div>
          </div>
        </Card>
      ))}
      <p className="col-span-2 -mt-1 text-[11px] text-muted-foreground sm:col-span-3 xl:col-span-6">
        Показатели на {refLabel}.
      </p>
    </div>
  );
}
