"use client";

import { Badge } from "@/components/ui/badge";
import { formatOrderHistoryDateTime } from "@/components/orders/order-history/format-order-history-datetime";
import { HISTORY_SOURCE_LABEL, type HistoryTimelineItem } from "@/lib/use-entity-history";
import { humanizeAction, payloadDetailRows, summarizePayload } from "@/lib/history-labels";
import { Clock, User } from "lucide-react";
import { useState } from "react";

function sourceVariant(source: string): "default" | "secondary" | "info" | "warning" | "success" {
  switch (source) {
    case "order_status":
      return "warning";
    case "access_log":
      return "info";
    case "activity":
      return "secondary";
    case "audit":
    case "order_change":
    case "client_audit":
      return "success";
    default:
      return "default";
  }
}

function DetailBlock({ detail, code }: { detail: unknown; code?: string | null }) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState(false);
  const rows = payloadDetailRows(detail);
  const hasDetail =
    detail != null && (typeof detail !== "object" || Object.keys(detail as object).length > 0);
  if (!hasDetail && !code) {
    return null;
  }
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
      >
        {open ? "Скрыть детали" : "Детали"}
      </button>
      {open && (
        <div className="mt-1.5 space-y-2">
          {rows.length > 0 && (
            <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 rounded-md bg-muted/50 p-2 text-[11px] leading-relaxed">
              {rows.map((row) => (
                <div key={row.label} className="contents">
                  <dt className="whitespace-nowrap text-muted-foreground">{row.label}</dt>
                  <dd className="break-words font-medium text-foreground/90">{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {code ? (
            <p className="text-[10px] text-muted-foreground/80">Код: {code}</p>
          ) : null}
          <button
            type="button"
            onClick={() => setRaw((v) => !v)}
            className="text-[10px] text-muted-foreground/70 underline-offset-2 hover:underline"
          >
            {raw ? "Скрыть JSON" : "Показать JSON"}
          </button>
          {raw && (
            <pre className="max-h-48 overflow-auto rounded-md bg-muted/60 p-2 text-[11px] leading-relaxed text-foreground/80">
              {JSON.stringify(detail, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export function HistoryTimeline({
  items,
  emptyText = "Нет записей истории"
}: {
  items: HistoryTimelineItem[];
  emptyText?: string;
}) {
  if (!items.length) {
    return <p className="px-1 py-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <ol className="relative space-y-3 border-l border-border pl-4">
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-background bg-primary" aria-hidden />
          <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={sourceVariant(item.source)}>
                {HISTORY_SOURCE_LABEL[item.source] ?? item.source}
              </Badge>
              <span className="text-sm font-medium text-foreground">
                {humanizeAction(item.event_type ?? item.action)}
              </span>
            </div>
            {(() => {
              const summary = summarizePayload(item.detail);
              return summary ? (
                <p className="mt-1 text-xs text-foreground/70">{summary}</p>
              ) : null;
            })()}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" aria-hidden />
                {formatOrderHistoryDateTime(item.created_at)}
              </span>
              <span className="inline-flex items-center gap-1">
                <User className="size-3" aria-hidden />
                {item.actor_login ?? (item.actor_user_id ? `#${item.actor_user_id}` : "Система")}
              </span>
            </div>
            <DetailBlock detail={item.detail} code={item.event_type ?? item.action} />
          </div>
        </li>
      ))}
    </ol>
  );
}
