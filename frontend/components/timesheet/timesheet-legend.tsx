"use client";

import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { ATTENDANCE_STATUSES, statusMeta } from "@/components/timesheet/timesheet-shared";

/** Легенда статусов табеля (7 значений) + подсказка режима просмотра. */
export function TimesheetLegend({ canEdit }: { canEdit: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded border bg-card px-3 py-2 text-[11px] text-muted-foreground">
      {ATTENDANCE_STATUSES.map((s) => {
        const meta = statusMeta(s);
        return (
          <span key={s} className="flex items-center gap-1.5">
            <span className={cn("size-3 rounded", meta.dot)} /> {meta.short} — {meta.label}
          </span>
        );
      })}
      {!canEdit ? (
        <span className="flex items-center gap-1">
          <Eye className="size-3" /> Режим просмотра
        </span>
      ) : null}
      <span className="ml-auto">Изменения фиксируются в разделе «Аудит».</span>
    </div>
  );
}
