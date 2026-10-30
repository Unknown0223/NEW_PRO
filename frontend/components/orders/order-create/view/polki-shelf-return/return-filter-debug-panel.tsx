"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Info } from "lucide-react";
import type { ReturnFilterMetaView } from "@/lib/return-filter-messages";
import { returnFilterModeLabel } from "@/lib/return-filter-messages";
import { formatNumberGrouped } from "@/lib/format-numbers";

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

export function ReturnFilterDebugPanel({
  meta,
  className = ""
}: {
  meta: ReturnFilterMetaView | null | undefined;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!meta?.filter_mode && !meta?.explanation && !meta?.log?.length) return null;

  return (
    <div
      className={`rounded-lg border border-border/90 bg-muted/80 text-[11px] text-slate-700 ${className}`}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        )}
        <Info className="h-3.5 w-3.5 shrink-0 text-teal-700" />
        <span className="font-medium text-slate-800">Фильтр возврата</span>
        <span className="text-slate-500">· {returnFilterModeLabel(meta.filter_mode)}</span>
      </button>

      {meta.explanation && open ? (
        <p className="border-t border-border/80 px-3 py-2 text-slate-700">{meta.explanation}</p>
      ) : null}

      {open ? (
        <dl className="grid gap-1 border-t border-border/80 px-3 py-2 sm:grid-cols-2">
          {meta.client_balance != null ? (
            <>
              <dt className="text-slate-500">Отображаемый баланс</dt>
              <dd className="font-mono tabular-nums">{formatNumberGrouped(meta.client_balance)}</dd>
            </>
          ) : null}
          {meta.ledger_net_balance != null ? (
            <>
              <dt className="text-slate-500">Леджер (заказы + оплаты)</dt>
              <dd className="font-mono tabular-nums">{formatNumberGrouped(meta.ledger_net_balance)}</dd>
            </>
          ) : null}
          {meta.unpaid_delivered_total != null && meta.unpaid_delivered_total !== "0" ? (
            <>
              <dt className="text-slate-500">Неоплаченные доставки</dt>
              <dd className="font-mono tabular-nums">{formatNumberGrouped(meta.unpaid_delivered_total)}</dd>
            </>
          ) : null}
          {meta.ledger_balance != null ? (
            <>
              <dt className="text-slate-500">Журнал л/с</dt>
              <dd className="font-mono tabular-nums">{formatNumberGrouped(meta.ledger_balance)}</dd>
            </>
          ) : null}
          {meta.delivered_in_period != null ? (
            <>
              <dt className="text-slate-500">Доставлено за период</dt>
              <dd className="tabular-nums">{meta.delivered_in_period} шт.</dd>
            </>
          ) : null}
          {meta.delivered_after_filter != null ? (
            <>
              <dt className="text-slate-500">Прошло фильтр</dt>
              <dd className="tabular-nums">{meta.delivered_after_filter} шт.</dd>
            </>
          ) : null}
          <dt className="text-slate-500">Начало периода</dt>
          <dd>{fmtDate(meta.period_from)}</dd>
          <dt className="text-slate-500">Точка нулевого баланса</dt>
          <dd>{fmtDate(meta.balance_zero_at)}</dd>
          <dt className="text-slate-500">Мин. дата заказа</dt>
          <dd>{fmtDate(meta.min_order_created_at)}</dd>
        </dl>
      ) : null}

      {open && meta.log && meta.log.length > 0 ? (
        <ol className="list-decimal space-y-0.5 border-t border-border/80 px-5 py-2 text-[10px] text-slate-600">
          {meta.log.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
