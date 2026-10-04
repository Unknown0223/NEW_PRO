"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import {
  LOGIN_ALERT_KIND_HINT,
  LOGIN_ALERT_KIND_LABEL,
  LOGIN_ALERT_RISK_LABEL,
  LOGIN_ALERT_STATUS_LABEL,
  fmtAlertDate,
  loginAlertErrorMessage,
  riskVariant,
  roleLabel,
  statusVariant,
  useLoginAlertDetail,
  useLoginAlertMutations,
  type LoginAlertStatus,
  type LoginAlertUser
} from "@/lib/security/login-alerts-api";
import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  alertId: number | null;
  onClose: () => void;
  canUpdate: boolean;
};

export function LoginAlertDetailDialog({ alertId, onClose, canUpdate }: Props) {
  const q = useLoginAlertDetail(alertId);
  const a = q.data;
  const { review, revoke } = useLoginAlertMutations();
  const { confirm, dialog: confirmDialog } = useAppConfirm();
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    setNote(a?.review_note ?? "");
    setErr(null);
    setInfo(null);
  }, [a?.id, a?.review_note]);

  const doReview = async (status: LoginAlertStatus) => {
    if (!a) return;
    setErr(null);
    try {
      await review.mutateAsync({ id: a.id, status, note: note.trim() || null });
      if (status !== "open") onClose();
    } catch (e) {
      setErr(loginAlertErrorMessage(e, "Не удалось сохранить решение"));
    }
  };

  const doRevoke = async (u: LoginAlertUser) => {
    if (!a) return;
    const ok = await confirm({
      title: "Завершить все сессии?",
      message: `${u.name} (${u.login}) будет разлогинен на всех устройствах — в приложении и в браузере потребуется войти заново.`,
      confirmLabel: "Завершить сессии",
      cancelLabel: "Назад",
      destructive: true
    });
    if (!ok) return;
    setErr(null);
    try {
      const r = await revoke.mutateAsync({ id: a.id, userId: u.id });
      setInfo(`${u.name}: завершено сессий — ${r.revoked}`);
    } catch (e) {
      setErr(loginAlertErrorMessage(e, "Не удалось завершить сессии"));
    }
  };

  const sessionsOf = (userId: number) => (a?.active_sessions ?? []).filter((s) => s.user_id === userId);
  const busy = review.isPending || revoke.isPending;

  return (
    <>
      <Dialog open={alertId != null} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{a ? LOGIN_ALERT_KIND_LABEL[a.kind] : "Подозрительный вход"}</DialogTitle>
          </DialogHeader>
          {q.isLoading ? <p className="text-sm text-muted-foreground">Загрузка…</p> : null}
          {q.isError ? <p className="text-sm text-destructive">Не удалось загрузить предупреждение.</p> : null}
          {a ? (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={riskVariant(a.risk)}>Риск: {LOGIN_ALERT_RISK_LABEL[a.risk]}</Badge>
                <Badge variant={statusVariant(a.status)}>{LOGIN_ALERT_STATUS_LABEL[a.status]}</Badge>
                <span className="text-muted-foreground">
                  Повторов: {a.occurrences} · {fmtAlertDate(a.first_seen_at)} — {fmtAlertDate(a.last_seen_at)}
                </span>
              </div>
              <p className="text-muted-foreground">{LOGIN_ALERT_KIND_HINT[a.kind]}</p>

              <div className="space-y-2">
                <p className="font-medium">Аккаунты</p>
                {a.users.map((u) => {
                  const sessions = sessionsOf(u.id);
                  return (
                    <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 p-2">
                      <div>
                        <span className="font-medium">{u.name}</span>{" "}
                        <span className="text-muted-foreground">
                          · {u.login} · {roleLabel(u.role)}
                          {!u.is_active ? " · неактивен" : ""}
                        </span>
                        <div className="text-xs text-muted-foreground">
                          Активных сессий: {sessions.length}
                          {sessions.length > 0
                            ? ` (${sessions
                                .slice(0, 3)
                                .map((s) => s.device_name || s.ip || "—")
                                .join(", ")}${sessions.length > 3 ? "…" : ""})`
                            : ""}
                        </div>
                      </div>
                      {canUpdate && sessions.length > 0 ? (
                        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void doRevoke(u)}>
                          <LogOut className="mr-1 size-4" />
                          Завершить сессии
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2">
                <p className="font-medium">Входы ({a.events.length})</p>
                <div className="max-h-72 overflow-auto rounded-lg border border-border/70">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/60 text-left uppercase text-muted-foreground">
                      <tr>
                        <th className="px-2 py-1.5">Время</th>
                        <th className="px-2 py-1.5">Сотрудник</th>
                        <th className="px-2 py-1.5">Где</th>
                        <th className="px-2 py-1.5">Устройство</th>
                        <th className="px-2 py-1.5">IP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {a.events.map((e) => (
                        <tr key={e.id}>
                          <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">{fmtAlertDate(e.at)}</td>
                          <td className="px-2 py-1.5">{e.user ? `${e.user.name} (${e.user.login})` : "—"}</td>
                          <td className="px-2 py-1.5">{e.platform === "mobile" ? "Приложение" : "Веб"}</td>
                          <td className="px-2 py-1.5" title={e.user_agent ?? e.device_id ?? undefined}>
                            {e.device_name || (e.device_id ? e.device_id.slice(0, 12) : "—")}
                          </td>
                          <td className="px-2 py-1.5 tabular-nums">{e.ip ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {a.reviewed_at ? (
                <p className="text-muted-foreground">
                  Решение: {LOGIN_ALERT_STATUS_LABEL[a.status]} · {a.reviewed_by ?? "—"} · {fmtAlertDate(a.reviewed_at)}
                </p>
              ) : null}
              {canUpdate ? (
                <label className="block space-y-1">
                  <span className="text-muted-foreground">Комментарий</span>
                  <textarea
                    className="min-h-[64px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    maxLength={2000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Например: телефон брата, разрешено руководителем"
                  />
                </label>
              ) : a.review_note ? (
                <p className="whitespace-pre-wrap">{a.review_note}</p>
              ) : null}
              {info ? <p className="text-emerald-600">{info}</p> : null}
              {err ? <p className="text-destructive">{err}</p> : null}
            </div>
          ) : null}
          <DialogFooter className="gap-2">
            {a && canUpdate && a.status !== "open" ? (
              <Button type="button" variant="outline" disabled={busy} onClick={() => void doReview("open")}>
                Вернуть на проверку
              </Button>
            ) : null}
            {a && canUpdate && a.status !== "confirmed" ? (
              <Button type="button" variant="destructive" disabled={busy} onClick={() => void doReview("confirmed")}>
                Нарушение
              </Button>
            ) : null}
            {a && canUpdate && a.status !== "ok" ? (
              <Button type="button" variant="outline" disabled={busy} onClick={() => void doReview("ok")}>
                Проверено — норма
              </Button>
            ) : null}
            <Button type="button" onClick={onClose}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </>
  );
}
