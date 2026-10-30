"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageError } from "@/components/ui/page-error";
import { summarizeAccessLogNew, summarizeAccessLogOld } from "@/lib/access-history-summary";

type Row = {
  id: number;
  created_at: string;
  actor_display: string;
  action_type_label: string;
  operation_label: string;
  old_value?: unknown;
  new_value?: unknown;
};

const LIMIT = 20;

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function Lines({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <ul className="space-y-0.5">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

export function AccessUserHistoryTab({ tenantSlug, userId }: { tenantSlug: string; userId: number }) {
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["access-user-history", tenantSlug, userId, page],
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    queryFn: async () => {
      const p = new URLSearchParams({ target_user_id: String(userId), page: String(page), limit: String(LIMIT) });
      const { data } = await api.get<{ data: Row[]; total: number }>(`/api/${tenantSlug}/access/history?${p}`);
      return data;
    }
  });

  if (q.isError) return <PageError message="Не удалось загрузить историю изменений." onRetry={() => void q.refetch()} />;
  if (q.isLoading) {
    return (
      <div className="space-y-2" aria-busy="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  const rows = q.data?.data ?? [];
  const total = q.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Всего изменений: {total}</p>
        <Link href="/access/history" className="text-xs text-teal-700 underline-offset-2 hover:underline">
          Открыть полную историю
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Изменений доступа ещё не было
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border/70">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="sticky top-0 bg-muted/80 text-xs text-muted-foreground backdrop-blur">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Дата и время</th>
                <th scope="col" className="px-3 py-2 font-medium">Кто изменил</th>
                <th scope="col" className="px-3 py-2 font-medium">Тип изменения</th>
                <th scope="col" className="px-3 py-2 font-medium">Объект / операция</th>
                <th scope="col" className="px-3 py-2 font-medium">Старое состояние</th>
                <th scope="col" className="px-3 py-2 font-medium">Новое состояние</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/50 align-top">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{formatDate(r.created_at)}</td>
                  <td className="px-3 py-2">{r.actor_display || "—"}</td>
                  <td className="px-3 py-2">{r.action_type_label}</td>
                  <td className="px-3 py-2">{r.operation_label || "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    <Lines items={summarizeAccessLogOld(r.old_value)} />
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <Lines items={summarizeAccessLogNew(r.new_value)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 ? (
        <div className="flex shrink-0 items-center justify-end gap-2 text-xs">
          <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Назад
          </Button>
          <span className="tabular-nums">
            {page} / {pages}
          </span>
          <Button type="button" size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Вперёд
          </Button>
        </div>
      ) : null}
    </div>
  );
}
