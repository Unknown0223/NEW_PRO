"use client";

import type { ClientRefusalRow } from "@/lib/refusals-types";
import { formatRefusalDateTime } from "@/lib/refusals-types";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, ArrowUpDown, Copy } from "lucide-react";
import Link from "next/link";

function SortTh({
  label,
  sortKey,
  currentSort,
  sortDir,
  onSort,
  className
}: {
  label: string;
  sortKey: string;
  currentSort: string;
  sortDir: "asc" | "desc";
  onSort: (key: string) => void;
  className?: string;
}) {
  const active = currentSort === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={cn(
        "cursor-pointer select-none whitespace-nowrap bg-muted/80 px-4 py-2.5 text-left text-xs font-semibold tracking-wide text-muted-foreground hover:bg-muted",
        className
      )}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          sortDir === "asc" ? (
            <ArrowUp className="size-3 text-teal-600" aria-hidden />
          ) : (
            <ArrowDown className="size-3 text-teal-600" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="size-3 text-muted-foreground/40" aria-hidden />
        )}
      </span>
    </th>
  );
}

function CopyBtn({ text }: { text: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void navigator.clipboard.writeText(text).catch(() => {});
      }}
      className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-muted hover:text-muted-foreground"
      title="Скопировать"
    >
      <Copy className="size-3" aria-hidden />
    </button>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 5 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3.5 max-w-[200px] animate-pulse rounded bg-muted" />
        </td>
      ))}
    </tr>
  );
}

export function RefusalsTable({
  rows,
  loading,
  sortKey,
  sortDir,
  onSort
}: {
  rows: ClientRefusalRow[];
  loading: boolean;
  sortKey: string;
  sortDir: "asc" | "desc";
  onSort: (key: string) => void;
}) {
  return (
    <>
      <div className="hidden md:block">
        <table className="w-full min-w-[800px] border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border">
              <SortTh
                label="Дата"
                sortKey="created_at"
                currentSort={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                className="w-[130px]"
              />
              <SortTh label="Клиенты" sortKey="client" currentSort={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortTh
                label="Причины отказа"
                sortKey="reason"
                currentSort={sortKey}
                sortDir={sortDir}
                onSort={onSort}
              />
              <SortTh label="Агент" sortKey="agent" currentSort={sortKey} sortDir={sortDir} onSort={onSort} />
              <th className="w-[130px] bg-muted/80 px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">
                Территория
              </th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
              : rows.map((row, idx) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-border/60 transition-colors hover:bg-teal-50/40 dark:hover:bg-teal-950/20",
                      idx % 2 === 1 && "bg-muted/20"
                    )}
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-muted-foreground">
                      {formatRefusalDateTime(row.created_at)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/clients/${row.client_id}`}
                          className="text-left text-sm font-medium text-teal-700 hover:underline dark:text-teal-400"
                        >
                          {row.client_name}
                        </Link>
                        <CopyBtn text={row.client_name} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-foreground">
                      {row.refusal_reason_label ?? row.refusal_reason_ref}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-foreground">
                      {row.agent_code ? `${row.agent_code} - [${row.agent_name}]` : row.agent_name}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {row.territory ? (
                        <span className="inline-flex items-center rounded-md border border-border bg-muted/50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          {row.territory}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}

            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center">
                  <p className="text-sm text-muted-foreground">Нет данных</p>
                  <p className="text-xs text-muted-foreground/70">Попробуйте изменить фильтры</p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 p-4 md:hidden">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
            ))
          : rows.map((row) => (
              <div
                key={row.id}
                className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/clients/${row.client_id}`} className="font-semibold text-teal-700">
                    {row.client_name}
                  </Link>
                  {row.territory ? (
                    <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-[10px] font-bold uppercase">
                      {row.territory}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs">{row.refusal_reason_label ?? row.refusal_reason_ref}</p>
                <div className="flex items-center justify-between gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
                  <span className="truncate">{row.agent_code ?? row.agent_name}</span>
                  <span className="whitespace-nowrap">{formatRefusalDateTime(row.created_at)}</span>
                </div>
              </div>
            ))}
        {!loading && rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Нет данных</p>
        ) : null}
      </div>
    </>
  );
}
