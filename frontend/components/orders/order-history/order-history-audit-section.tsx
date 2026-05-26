"use client";

import { Clock, Edit, User } from "lucide-react";

export function OrderHistoryAuditSection({
  createdBy,
  updatedBy,
  lastChange
}: {
  createdBy: string;
  updatedBy: string;
  lastChange: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-base font-bold text-foreground">Аудит</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-50 dark:bg-sky-950/40">
            <User size={14} className="text-sky-600 dark:text-sky-400" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Кто создал</div>
            <div className="mt-0.5 whitespace-pre-line text-sm font-medium text-foreground">
              {createdBy || "—"}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950/40">
            <Edit size={14} className="text-amber-600 dark:text-amber-400" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Кто изменил</div>
            <div className="mt-0.5 whitespace-pre-line text-sm font-medium text-foreground">
              {updatedBy || "—"}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40">
            <Clock size={14} className="text-emerald-600 dark:text-emerald-400" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Последнее изменение</div>
            <div className="mt-0.5 text-sm font-medium text-foreground">{lastChange || "—"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
