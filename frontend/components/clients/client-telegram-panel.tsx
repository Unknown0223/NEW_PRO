"use client";

import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { usePermissions } from "@/lib/use-permissions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

type TgLink = {
  id: number;
  status: "active" | "pending";
  phone: string | null;
  phone_match: boolean;
  linked_at: string;
  last_seen_at: string | null;
  approved_at: string | null;
};

type TgInfo = { enabled: boolean; bot_username: string | null; links: TgLink[] };
type TgCode = { code: string; expires_at: string; deep_link: string | null };

function fmt(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function ClientTelegramPanel({ tenantSlug, clientId }: { tenantSlug: string; clientId: number }) {
  const qc = useQueryClient();
  const { confirm, dialog } = useAppConfirm();
  const { has } = usePermissions();
  const canManage = has("clients.klient.update");
  const [code, setCode] = useState<TgCode | null>(null);
  const [copied, setCopied] = useState(false);
  const key = ["client-telegram", tenantSlug, clientId];

  const infoQ = useQuery({
    queryKey: key,
    staleTime: STALE.list,
    queryFn: async () => (await api.get<TgInfo>(`/api/${tenantSlug}/clients/${clientId}/telegram`)).data
  });

  const codeM = useMutation({
    mutationFn: async () => (await api.post<TgCode>(`/api/${tenantSlug}/clients/${clientId}/telegram/code`, {})).data,
    onSuccess: (d) => {
      setCode(d);
      setCopied(false);
    }
  });

  const linkM = useMutation({
    mutationFn: async (p: { id: number; action: "approve" | "revoke" }) =>
      api.post(`/api/${tenantSlug}/clients/${clientId}/telegram/links/${p.id}/${p.action}`, {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key })
  });

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const info = infoQ.data;
  const links = info?.links ?? [];

  return (
    <Card className="border border-border/90 shadow-panel">
      <CardContent className="space-y-4 p-3 sm:p-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Telegram-бот клиента</p>
          <p className="text-xs text-muted-foreground">
            Клиент видит баланс, заказы, оплаты, акт сверки и получает уведомления. Для подключения нужен код, номер
            доставленной накладной и номер телефона.
          </p>
        </div>

        {infoQ.isLoading ? <p className="text-xs text-muted-foreground">Загрузка…</p> : null}
        {info && !info.enabled ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            Бот не настроен для этой компании (TG_APP_BOT_TOKEN / TG_APP_TENANT_SLUG).
          </p>
        ) : null}

        {info?.enabled && canManage ? (
          <div className="space-y-2">
            <Button size="sm" onClick={() => codeM.mutate()} disabled={codeM.isPending}>
              {codeM.isPending ? "Создание…" : "Создать код подключения"}
            </Button>
            {codeM.isError ? <p className="text-xs text-destructive">Не удалось создать код.</p> : null}
            {code ? (
              <div className="space-y-1 rounded-md border border-border bg-muted/40 p-3">
                <p className="font-mono text-2xl font-bold tracking-widest">{code.code}</p>
                <p className="text-xs text-muted-foreground">Действует до {fmt(code.expires_at)} · одноразовый</p>
                {code.deep_link ? (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <a href={code.deep_link} target="_blank" rel="noreferrer" className="break-all text-xs text-blue-600 underline">
                      {code.deep_link}
                    </a>
                    <Button size="sm" variant="outline" onClick={() => void copy(code.deep_link!)}>
                      {copied ? "Скопировано" : "Копировать ссылку"}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground">Подключённые аккаунты ({links.length})</p>
          {links.length === 0 ? <p className="text-xs text-muted-foreground">Нет подключений.</p> : null}
          {links.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2 text-xs">
              <div className="space-y-0.5">
                <p className="font-medium">
                  {l.status === "active" ? "🟢 Активен" : "⏳ Ожидает подтверждения"} · {l.phone ?? "без номера"}
                  {l.phone ? (l.phone_match ? " · номер совпал" : " · номер не совпал") : ""}
                </p>
                <p className="text-muted-foreground">
                  Подключён {fmt(l.linked_at)} · активность {fmt(l.last_seen_at)}
                </p>
              </div>
              {canManage ? (
                <div className="flex gap-2">
                  {l.status === "pending" ? (
                    <Button size="sm" onClick={() => linkM.mutate({ id: l.id, action: "approve" })} disabled={linkM.isPending}>
                      Подтвердить
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={linkM.isPending}
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Отключить Telegram",
                        message: "Клиент больше не будет видеть данные в боте. Продолжить?",
                        confirmLabel: "Отключить",
                        cancelLabel: "Отмена",
                        destructive: true
                      });
                      if (ok) linkM.mutate({ id: l.id, action: "revoke" });
                    }}
                  >
                    {l.status === "pending" ? "Отклонить" : "Отключить"}
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </CardContent>
      {dialog}
    </Card>
  );
}
