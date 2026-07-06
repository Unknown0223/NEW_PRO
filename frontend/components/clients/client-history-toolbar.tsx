"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClientHistoryModal } from "@/components/clients/client-history-modal";
import type { ClientAuditHistoryViewModel } from "@/lib/client-audit-history";
import { useClientAuditHistory } from "@/hooks/use-client-audit-history";
import type { ClientDetailApiRow } from "@/components/clients/client-detail-view";

type Props = {
  /** Agar berilsa — qayta fetch qilinmaydi (workspace bilan bir xil model). */
  model?: ClientAuditHistoryViewModel | null;
  loading?: boolean;
  tenantSlug?: string;
  clientId?: number;
  client?: ClientDetailApiRow | null;
  className?: string;
  size?: "sm" | "md";
  initialOpen?: boolean;
};

/** Шаблон: teal «Timeline» tugmasi + modal. */
export function ClientHistoryToolbar({
  model: modelProp,
  loading: loadingProp,
  tenantSlug,
  clientId,
  client,
  className,
  size = "md",
  initialOpen = false
}: Props) {
  const fetchSelf = modelProp === undefined && Boolean(tenantSlug) && (clientId ?? 0) > 0;
  const fetched = useClientAuditHistory(tenantSlug ?? "", clientId ?? 0, client);
  const model = modelProp !== undefined ? modelProp : fetched.model;
  const loading = loadingProp ?? (fetchSelf ? fetched.loading : false);

  const [open, setOpen] = useState(initialOpen);

  useEffect(() => {
    if (initialOpen) setOpen(true);
  }, [initialOpen]);

  return (
    <>
      <button
        type="button"
        disabled={loading || !model}
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg bg-teal-600 font-medium text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50",
          size === "sm" ? "px-3 py-1.5 text-xs" : "px-3.5 py-2 text-sm",
          className
        )}
      >
        <Clock className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
        Timeline
      </button>
      {model ? (
        <ClientHistoryModal open={open} onClose={() => setOpen(false)} model={model} />
      ) : null}
    </>
  );
}
