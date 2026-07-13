"use client";

import {
  GROUP_PROCESSING_MENU_ACTIONS,
  type GroupProcessingActionId
} from "@/components/clients/group-processing/group-processing-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (actionId: GroupProcessingActionId) => void;
  selectedCount?: number;
};

export function GroupProcessingPickDialog({ open, onOpenChange, onPick, selectedCount = 0 }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[min(90vh,720px)] w-full max-w-lg gap-0 overflow-hidden p-0 sm:max-w-lg"
        overlayClassName="bg-black/40"
      >
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="text-base font-semibold">Групповые обработки</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Выберите раздел для выбранных клиентов — откроется отдельная страница
            {selectedCount > 0 ? (
              <>
                . Выбрано: <b>{selectedCount}</b>
              </>
            ) : (
              <> (сначала отметьте клиентов в списке)</>
            )}
          </p>
        </DialogHeader>
        <ul className="max-h-[min(70vh,560px)] overflow-y-auto py-1">
          {GROUP_PROCESSING_MENU_ACTIONS.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-3 px-5 py-3 text-left transition-colors",
                  "hover:bg-muted/80 focus-visible:bg-muted focus-visible:outline-none"
                )}
                onClick={() => onPick(a.id)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{a.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{a.description}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex justify-end border-t border-border px-4 py-3">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
