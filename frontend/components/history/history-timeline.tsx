"use client";

import { Badge } from "@/components/ui/badge";
import { formatOrderHistoryDateTime } from "@/components/orders/order-history/format-order-history-datetime";
import { HISTORY_SOURCE_LABEL, type HistoryTimelineItem } from "@/lib/use-entity-history";
import { humanizeAction, payloadDetailRows, summarizePayload } from "@/lib/history-labels";
import { Clock, User } from "lucide-react";
import { useMemo, useState } from "react";

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

function DetailBlock({ detail, action }: { detail: unknown; action?: string | null }) {
  const [open, setOpen] = useState(true);
  const rows = payloadDetailRows(detail);
  const hasDetail =
    detail != null && (typeof detail !== "object" || Object.keys(detail as object).length > 0);
  if (!hasDetail || rows.length === 0) {
    return null;
  }
  void action;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] font-medium text-teal-700 underline-offset-2 hover:underline dark:text-teal-400"
      >
        {open ? "Скрыть детали" : "Показать детали"}
      </button>
      {open && (
        <dl className="mt-1.5 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1.5 rounded-lg border border-border/70 bg-muted/40 p-2.5 text-[12px] leading-relaxed">
          {rows.map((row) => (
            <div key={row.label} className="contents">
              <dt className="whitespace-nowrap text-muted-foreground">{row.label}</dt>
              <dd className="break-words font-medium text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** Bir xil tahrir uchun audit + order_change dublikatini olib tashlash. */
function dedupeOrderTimeline(items: HistoryTimelineItem[]): HistoryTimelineItem[] {
  const sorted = [...items].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const out: HistoryTimelineItem[] = [];
  for (const item of sorted) {
    const action = (item.event_type ?? item.action ?? "").toLowerCase();
    const isFlatLinesAudit =
      item.source === "audit" &&
      (action === "order.lines" || action === "lines") &&
      item.detail != null &&
      typeof item.detail === "object" &&
      !("paid_lines" in (item.detail as object));

    if (isFlatLinesAudit) {
      const t = new Date(item.created_at).getTime();
      const hasRich = sorted.some((other) => {
        if (other.id === item.id) return false;
        if (other.source !== "order_change") return false;
        const oa = (other.event_type ?? other.action ?? "").toLowerCase();
        if (oa !== "lines" && oa !== "order.lines") return false;
        return Math.abs(new Date(other.created_at).getTime() - t) < 15_000;
      });
      if (hasRich) continue;
    }
    out.push(item);
  }
  return out;
}

export function HistoryTimeline({
  items,
  emptyText = "Нет записей истории"
}: {
  items: HistoryTimelineItem[];
  emptyText?: string;
}) {
  const visible = useMemo(() => dedupeOrderTimeline(items), [items]);

  if (!visible.length) {
    return <p className="px-1 py-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <ol className="relative space-y-3 border-l border-border pl-4">
      {visible.map((item) => {
        const actionCode = item.event_type ?? item.action;
        const title = humanizeAction(actionCode);
        const summary = summarizePayload(item.detail, actionCode);
        return (
          <li key={item.id} className="relative">
            <span
              className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-background bg-primary"
              aria-hidden
            />
            <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={sourceVariant(item.source)}>
                  {HISTORY_SOURCE_LABEL[item.source] ?? item.source}
                </Badge>
                <span className="text-sm font-semibold text-foreground">{title}</span>
              </div>
              {summary ? (
                <p className="mt-1.5 text-[13px] leading-snug text-foreground/85">{summary}</p>
              ) : null}
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
              <DetailBlock detail={item.detail} action={actionCode} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
