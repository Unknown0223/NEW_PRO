"use client";

import type { AxiosError } from "axios";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { api } from "@/lib/api";
import { firstValidationUserHint, getZodFlattenFromApiErrorBody } from "@/lib/api-validation-details";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export type StaffSessionsKind = "agent" | "supervisor" | "expeditor" | "collector" | "auditor" | "operator" | "skladchik";

type SessionRow = {
  id: number;
  device_name: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

function segment(kind: StaffSessionsKind): string {
  switch (kind) {
    case "agent":
      return "agents";
    case "supervisor":
      return "supervisors";
    case "expeditor":
      return "expeditors";
    case "collector":
      return "collectors";
    case "auditor":
      return "auditors";
    case "operator":
      return "operators";
    case "skladchik":
      return "skladchik";
    default:
      return "agents";
  }
}

function sessionActionErrorText(err: unknown, fallback: string): string {
  const ax = err as AxiosError<{ error?: string; message?: string }>;
  const flat = getZodFlattenFromApiErrorBody(ax.response?.data);
  if (flat) {
    const hint = firstValidationUserHint(flat);
    return withApiSupportLine(hint ?? "Ma’lumotlarni tekshiring.", err);
  }
  return getUserFacingError(err, fallback);
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantSlug: string;
  staffKind: StaffSessionsKind;
  userId: number | null;
  maxSessions: number;
  onPatched: () => void;
  /** DialogContent qo‘shimcha klasslari (masalan keng modal) */
  contentClassName?: string;
};

/**
 * Агент / супервайзер / экспедитор / веб-оператор — список сессий, лимит, отзыв.
 */
export function StaffActiveSessionsDialog({
  open,
  onOpenChange,
  tenantSlug,
  staffKind,
  userId,
  maxSessions,
  onPatched,
  contentClassName
}: Props) {
  const [maxDraft, setMaxDraft] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const seg = segment(staffKind);

  const sessionsQ = useQuery({
    queryKey: ["staff-active-sessions", tenantSlug, staffKind, userId],
    enabled: open && userId != null,
    staleTime: STALE.live,
    queryFn: async () => {
      const { data } = await api.get<{ data: SessionRow[] }>(
        `/api/${tenantSlug}/${seg}/${userId}/sessions`
      );
      return data.data;
    }
  });

  useEffect(() => {
    if (open && userId != null) {
      setMaxDraft(maxSessions);
      setSelected(new Set());
      setActionError(null);
    }
  }, [open, userId, maxSessions]);

  const revokeMut = useMutation({
    mutationFn: async (body: { all?: true; token_ids?: number[] }) => {
      await api.post(`/api/${tenantSlug}/${seg}/${userId}/sessions/revoke`, body);
    },
    onMutate: () => {
      setActionError(null);
    },
    onSuccess: () => {
      setActionError(null);
      void sessionsQ.refetch();
      onPatched();
      setSelected(new Set());
    },
    onError: (e: unknown) => {
      setActionError(sessionActionErrorText(e, "Сессии не удалось отозвать."));
    }
  });

  const saveMax = useMutation({
    mutationFn: async () => {
      await api.patch(`/api/${tenantSlug}/${seg}/${userId}`, { max_sessions: maxDraft });
    },
    onMutate: () => {
      setActionError(null);
    },
    onSuccess: () => {
      setActionError(null);
      onPatched();
    },
    onError: (e: unknown) => {
      setActionError(sessionActionErrorText(e, "Лимит не удалось сохранить."));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[90vh] max-w-2xl overflow-hidden border border-teal-800/20 shadow-lg sm:max-w-2xl",
          contentClassName
        )}
      >
        <DialogHeader>
          <DialogTitle>Активные сессии</DialogTitle>
        </DialogHeader>
        {userId == null ? (
          <p className="text-sm text-muted-foreground">Пользователь не выбран.</p>
        ) : (
          <>
            {actionError ? (
              <p className="text-sm text-destructive" role="alert">
                {actionError}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 border-b pb-3">
              <span className="text-sm">Максимальное количество сессий</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMaxDraft((m) => Math.max(1, m - 1))}
              >
                −
              </Button>
              <Input
                className="h-8 w-14 text-center"
                value={maxDraft}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  if (!Number.isNaN(n)) setMaxDraft(Math.min(99, Math.max(1, n)));
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMaxDraft((m) => Math.min(99, m + 1))}
              >
                +
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-teal-600 text-white hover:bg-teal-700"
                disabled={saveMax.isPending}
                onClick={() => saveMax.mutate()}
              >
                Сохранить
              </Button>
            </div>
            <div className="max-h-[45vh] overflow-auto rounded-md border">
              {sessionsQ.isLoading ? (
                <p className="p-4 text-sm text-muted-foreground">Загрузка сессий…</p>
              ) : sessionsQ.isError ? (
                <p className="p-4 text-sm text-destructive">
                  {getUserFacingError(sessionsQ.error, "Не удалось загрузить сессии. Нужны права администратора.")}
                </p>
              ) : null}
              {!sessionsQ.isLoading && !sessionsQ.isError ? (
              <table className="w-full text-xs">
                <thead className="app-table-thead">
                  <tr>
                    <th className="w-8 px-2 py-2" />
                    <th className="px-2 py-2 text-left">Устройство</th>
                    <th className="px-2 py-2 text-left">IP</th>
                    <th className="px-2 py-2 text-left">Приложение</th>
                    <th className="px-2 py-2 text-left">Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {(sessionsQ.data ?? []).map((s) => (
                    <tr key={s.id} className="border-t">
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(s.id)}
                          onChange={(e) => {
                            const n = new Set(selected);
                            if (e.target.checked) n.add(s.id);
                            else n.delete(s.id);
                            setSelected(n);
                          }}
                        />
                      </td>
                      <td className="px-2 py-2">{s.device_name ?? "—"}</td>
                      <td className="px-2 py-2 font-mono">{s.ip_address ?? "—"}</td>
                      <td className="max-w-[12rem] truncate px-2 py-2" title={s.user_agent ?? ""}>
                        {s.user_agent ?? "—"}
                      </td>
                      <td className="px-2 py-2">{new Date(s.created_at).toLocaleString("ru-RU")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              ) : null}
            </div>
            <DialogFooter className="flex flex-wrap gap-2 border-0 bg-transparent p-0">
              <Button
                type="button"
                variant="outline"
                disabled={
                  sessionsQ.isLoading ||
                  sessionsQ.isError ||
                  selected.size === 0 ||
                  revokeMut.isPending
                }
                onClick={() => revokeMut.mutate({ token_ids: Array.from(selected) })}
              >
                Завершить выбранные сессии
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={
                  sessionsQ.isLoading ||
                  sessionsQ.isError ||
                  revokeMut.isPending ||
                  (sessionsQ.data?.length ?? 0) === 0
                }
                onClick={() => revokeMut.mutate({ all: true })}
              >
                <LogOut className="mr-1 size-3" />
                Завершить все сессии
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
