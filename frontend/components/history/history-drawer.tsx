"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { HistoryTimeline } from "@/components/history/history-timeline";
import { useEntityHistory } from "@/lib/use-entity-history";
import { useAuthStore } from "@/lib/auth-store";

export function HistoryDrawer({
  open,
  onOpenChange,
  entityType,
  entityId,
  title = "История"
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  entityId: string | number;
  title?: string;
}) {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const q = useEntityHistory({ tenantSlug, entityType, entityId, enabled: open });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="bg-black/30"
        className="left-auto right-0 top-0 h-dvh w-full max-w-md translate-x-0 translate-y-0 rounded-none rounded-l-xl border-l p-0 data-open:slide-in-from-right-4"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <DialogTitle>{title}</DialogTitle>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {q.isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Загрузка истории...</p>
            ) : q.isError ? (
              <p className="py-6 text-center text-sm text-destructive">Не удалось загрузить историю</p>
            ) : (
              <HistoryTimeline items={q.data?.items ?? []} />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
