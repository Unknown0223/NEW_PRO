"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import type { SlotHistoryItem } from "@/lib/work-slots-types";
import { formatSlotDate, slotAuditActionLabel } from "./work-slots-utils";

type Props = {
  tenant: string;
  slotId: number;
  limit?: number;
  /** When true, show link to full detail history */
  detailLink?: boolean;
};

export function SlotHistorySnippet({ tenant, slotId, limit = 5, detailLink = true }: Props) {
  const [rows, setRows] = useState<SlotHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void apiFetch<{ data: SlotHistoryItem[] }>(
      `/api/${tenant}/work-slots/${slotId}/history?limit=${limit}`
    )
      .then((res) => {
        if (!cancelled) setRows(res.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenant, slotId, limit]);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <History className="h-3.5 w-3.5 text-teal-700" />
          История замен
        </p>
        {detailLink ? (
          <Link
            href={`/work-slots/${slotId}`}
            className="text-[11px] font-medium text-teal-700 underline"
          >
            Полная
          </Link>
        ) : null}
      </div>
      {loading ? (
        <p className="px-3 py-3 text-xs text-muted-foreground">Загрузка…</p>
      ) : rows.length === 0 ? (
        <p className="px-3 py-3 text-xs text-muted-foreground">Истории нет</p>
      ) : (
        <ul className="divide-y divide-border/70">
          {rows.map((h) => (
            <li key={h.id} className="px-3 py-2 text-xs">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <span className="font-medium text-slate-800">
                  {slotAuditActionLabel(h.action)}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {formatSlotDate(h.created_at)}
                </span>
              </div>
              <p className="mt-0.5 truncate text-slate-600">
                {h.prev_user_name ?? "—"} → {h.next_user_name ?? "—"}
              </p>
              {h.note ? (
                <p className="mt-0.5 truncate text-[10px] text-muted-foreground" title={h.note}>
                  {h.note}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
