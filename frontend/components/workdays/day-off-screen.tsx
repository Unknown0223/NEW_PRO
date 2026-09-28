"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CalendarOff, Clock, LogOut, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { formatCountdown, useWorkdayStatus } from "@/lib/workday-status";

const WEEKDAYS_RU = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];

function upperFirst(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

function formatWorkStart(iso: string): string {
  const d = new Date(iso);
  const opts = { timeZone: "Asia/Tashkent" } as const;
  const date = d.toLocaleDateString("ru-RU", { ...opts, day: "numeric", month: "long" });
  const year = d.toLocaleDateString("ru-RU", { ...opts, year: "numeric" });
  const time = d.toLocaleTimeString("ru-RU", { ...opts, hour: "2-digit", minute: "2-digit" });
  const weekday = WEEKDAYS_RU[new Date(d.getTime() + 5 * 3600_000).getUTCDay()];
  return upperFirst(`${weekday}, ${date} ${year}, ${time}`);
}

function formatTodayRu(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return upperFirst(
    `${WEEKDAYS_RU[dt.getUTCDay()]}, ${dt.toLocaleDateString("ru-RU", { timeZone: "UTC", day: "numeric", month: "long" })}`
  );
}

export function DayOffScreen() {
  const hydrated = useAuthStoreHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);
  const clearSession = useAuthStore((s) => s.clearSession);
  const qc = useQueryClient();
  const statusQ = useWorkdayStatus({ enabled: hydrated });
  const status = statusQ.isFetchedAfterMount ? statusQ.data : undefined;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (hydrated && !accessToken) window.location.assign("/login");
  }, [hydrated, accessToken]);

  useEffect(() => {
    if (status?.allowed) window.location.assign("/dashboard");
  }, [status?.allowed]);

  const secondsLeft = useMemo(() => {
    if (!status?.next_work_start) return null;
    return Math.max(0, Math.round((Date.parse(status.next_work_start) - now) / 1000));
  }, [status?.next_work_start, now]);

  useEffect(() => {
    if (secondsLeft === 0) void statusQ.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft === 0]);

  async function logout() {
    const rt = useAuthStore.getState().refreshToken;
    if (rt) {
      try {
        await api.post("/auth/logout", { refreshToken: rt });
      } catch {
        /* sessiyani baribir lokal tozalaymiz */
      }
    }
    clearSession();
    qc.clear();
    try {
      window.localStorage.removeItem("salec:rq:v1");
    } catch {
      /* ignore */
    }
    window.location.assign("/login");
  }

  const loading = !hydrated || statusQ.isPending || (!statusQ.isFetchedAfterMount && !statusQ.isError);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
            <CalendarOff className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Сегодня нерабочий день</h1>
            {status?.today ? (
              <p className="text-sm text-muted-foreground">{formatTodayRu(status.today)}</p>
            ) : null}
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Проверяем рабочий график…</p>
        ) : statusQ.isError ? (
          <p className="text-sm text-destructive">Не удалось получить рабочий график. Попробуйте обновить страницу.</p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed">
              По настройкам системы («Рабочие дни») сегодня для роли{" "}
              <span className="font-medium">«{status?.role_label ?? "—"}»</span> выходной
              {status?.reason_label ? ` (${status.reason_label.toLowerCase()})` : ""}. Пользоваться системой в
              нерабочий день нельзя — все разделы веб-панели и мобильного приложения закрыты до начала рабочего дня.
            </p>
            {status?.comment ? (
              <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{status.comment}</p>
            ) : null}

            {status?.next_work_start ? (
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Рабочий день начнётся</p>
                <p className="mt-1 text-sm font-medium">{formatWorkStart(status.next_work_start)}</p>
                <div className="mt-3 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" aria-hidden />
                  <span className="text-xs text-muted-foreground">Осталось:</span>
                  <span className="font-mono text-2xl font-semibold tabular-nums" aria-live="polite">
                    {formatCountdown(secondsLeft ?? 0)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Ближайший рабочий день не найден в графике. Обратитесь к администратору.
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => void statusQ.refetch()} disabled={statusQ.isFetching}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${statusQ.isFetching ? "animate-spin" : ""}`} aria-hidden />
            Проверить снова
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void logout()}>
            <LogOut className="mr-1.5 h-4 w-4" aria-hidden />
            Выйти
          </Button>
        </div>
      </div>
    </div>
  );
}
