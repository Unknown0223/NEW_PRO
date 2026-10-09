"use client";

import { PageShell } from "@/components/dashboard/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

type Row = {
  id: number;
  title: string;
  body: string | null;
  link_href: string | null;
  read_at: string | null;
  created_at: string;
};

type Status = "all" | "unread" | "read";

export default function NotificationsPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["notifications-page", tenantSlug, appliedQ, status, page],
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const params = new URLSearchParams({
        status,
        page: String(page),
        limit: "30"
      });
      if (appliedQ.trim()) params.set("q", appliedQ.trim());
      const { data } = await api.get<{ data: Row[]; unread_count: number; total: number }>(
        `/api/${tenantSlug}/notifications?${params}`
      );
      return data;
    }
  });

  const readOne = useMutation({
    mutationFn: (id: number) => api.patch(`/api/${tenantSlug}/notifications/${id}/read`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications-page", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["notifications", tenantSlug] });
    }
  });

  const readAll = useMutation({
    mutationFn: () => api.post(`/api/${tenantSlug}/notifications/read-all`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications-page", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["notifications", tenantSlug] });
    }
  });

  const rows = query.data?.data ?? [];
  const total = query.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 30));

  return (
    <PageShell>
      <div className="mx-auto flex min-w-0 max-w-3xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">Уведомления</h1>
            <p className="text-sm text-muted-foreground">
              Только ваши. Прочитанные исчезают из колокольчика и остаются здесь.
              {query.data ? ` Непрочитано: ${query.data.unread_count}.` : ""}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!query.data?.unread_count || readAll.isPending}
            onClick={() => void readAll.mutate()}
          >
            Отметить все прочитанными
          </Button>
        </div>

        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setAppliedQ(q);
          }}
        >
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по тексту"
            className="h-9 max-w-xs"
            aria-label="Поиск"
          />
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={status}
            aria-label="Статус"
            onChange={(e) => {
              setStatus(e.target.value as Status);
              setPage(1);
            }}
          >
            <option value="all">Все</option>
            <option value="unread">Непрочитанные</option>
            <option value="read">Прочитанные</option>
          </select>
          <Button type="submit" size="sm" className="h-9">
            Найти
          </Button>
        </form>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {query.isLoading ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">Загрузка…</p>
          ) : query.isError ? (
            <p className="px-4 py-10 text-center text-sm text-destructive">Не удалось загрузить.</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">Ничего не найдено</p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((n) => (
                <li key={n.id} className={cn("px-4 py-3", !n.read_at && "bg-muted/40")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {n.link_href ? (
                        <Link href={n.link_href} className="font-medium text-primary hover:underline">
                          {n.title}
                        </Link>
                      ) : (
                        <p className="font-medium">{n.title}</p>
                      )}
                      {n.body ? <p className="mt-1 text-sm text-muted-foreground">{n.body}</p> : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(n.created_at).toLocaleString("ru-RU")}
                        {n.read_at ? " · прочитано" : " · новое"}
                      </p>
                    </div>
                    {!n.read_at ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        disabled={readOne.isPending}
                        onClick={() => void readOne.mutate(n.id)}
                      >
                        Прочитано
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {pages > 1 ? (
          <div className="flex items-center justify-center gap-3 text-sm">
            <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Назад
            </Button>
            <span className="tabular-nums text-muted-foreground">
              {page} / {pages}
            </span>
            <Button type="button" variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Вперёд
            </Button>
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}
