"use client";

import { Button } from "@/components/ui/button";
import { HistoryDrawer } from "@/components/history/history-drawer";
import { usePermissions } from "@/lib/use-permissions";
import { History } from "lucide-react";
import { useState } from "react";

/**
 * Sahifa ichidagi "tarix" ikonkasi. Faqat `<module>.<section>.history`
 * ruxsati bo'lsa ko'rinadi; bosilganda o'ng tomonda tarix drawer ochiladi.
 */
export function HistoryIconButton({
  module,
  section,
  entityType,
  entityId,
  title,
  size = "icon-sm",
  variant = "ghost",
  label
}: {
  module: string;
  section: string;
  entityType: string;
  entityId: string | number;
  title?: string;
  size?: "icon" | "icon-sm" | "sm";
  variant?: "ghost" | "outline";
  label?: string;
}) {
  const { has, isLoading } = usePermissions();
  const [open, setOpen] = useState(false);

  // Faqat `.history` — `.view` yetarli emas (aks holda soat har view userda chiqadi).
  const allowed = has(`${module}.${section}.history`);
  if (isLoading || !allowed) return null;

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        title={title ?? "История"}
        aria-label={title ?? "История"}
        className={label ? "gap-2" : undefined}
      >
        <History className="size-4" aria-hidden />
        {label ? <span className="text-sm font-medium">{label}</span> : null}
      </Button>
      {open && (
        <HistoryDrawer
          open={open}
          onOpenChange={setOpen}
          entityType={entityType}
          entityId={entityId}
          title={title ?? "История"}
        />
      )}
    </>
  );
}
