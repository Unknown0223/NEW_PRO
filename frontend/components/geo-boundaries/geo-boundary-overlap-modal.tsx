"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { GeoBoundaryOverlapConflict } from "@/lib/geo-boundaries-types";
import { GEO_BOUNDARY_KIND_LABELS } from "@/lib/geo-boundaries-types";

type Props = {
  open: boolean;
  incomingName: string;
  conflicts: GeoBoundaryOverlapConflict[];
  saving: boolean;
  onChooseExistingWins: () => void;
  onChooseIncomingWins: () => void;
  onCancel: () => void;
};

export function GeoBoundaryOverlapModal({
  open,
  incomingName,
  conflicts,
  saving,
  onChooseExistingWins,
  onChooseIncomingWins,
  onCancel
}: Props) {
  const existingLabel = conflicts.map((c) => `${c.name} (${GEO_BOUNDARY_KIND_LABELS[c.kind]})`).join(", ");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent
        className="z-[3000] max-w-md"
        overlayClassName="z-[2999] bg-black/50"
      >
        <DialogHeader>
          <DialogTitle>Границы пересекаются</DialogTitle>
          <DialogDescription>
            Новая граница «{incomingName}» пересекается с «{existingLabel}». Какая граница должна иметь приоритет?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="font-semibold">A — Сохраняется ранее нарисованная</p>
            <p className="mt-1 text-muted-foreground">
              Существующая граница не меняется. Новая граница обрезается по её контуру.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="font-semibold">B — Приоритет у новой границы</p>
            <p className="mt-1 text-muted-foreground">
              Новая фигура сохраняется целиком. Существующая граница обрезается под неё.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button type="button" disabled={saving} onClick={onChooseExistingWins} className="w-full">
            A — приоритет у «{conflicts[0]?.name ?? "существующей"}»
          </Button>
          <Button type="button" variant="secondary" disabled={saving} onClick={onChooseIncomingWins} className="w-full">
            B — приоритет у «{incomingName}»
          </Button>
          <Button type="button" variant="ghost" disabled={saving} onClick={onCancel} className="w-full">
            Отмена
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
