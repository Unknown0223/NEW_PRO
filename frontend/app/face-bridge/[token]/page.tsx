"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { FaceLivenessPanel } from "@/components/login/face-liveness-panel";
import { getUserFacingError } from "@/lib/error-utils";
import { isAxiosError } from "axios";
import { SalesArenaLogo } from "@/components/brand/sales-arena-logo";

type StatusDto = {
  status: string;
  directions: string[] | unknown;
  expires_at: string;
  has_reference?: boolean;
};

export default function FaceBridgePage() {
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : "";
  const [status, setStatus] = useState<StatusDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"success" | "failure" | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<{ data: StatusDto }>("/auth/face-login/status", {
          params: { challenge_token: token }
        });
        if (cancelled) return;
        if (data.data.status === "approved") {
          setOutcome("success");
          setStatus(data.data);
          return;
        }
        if (data.data.status === "rejected") {
          setOutcome("failure");
          setError("Проверка Face ID отклонена. Обновите QR на компьютере и повторите.");
          setStatus(data.data);
          return;
        }
        if (data.data.status !== "pending") {
          setError("Сессия Face ID недоступна или истекла.");
          return;
        }
        if (data.data.has_reference === false) {
          setError(
            "Нет эталонного фото Face ID. Администратор должен загрузить фото в карточке сотрудника (Пользователи → редактирование)."
          );
          setStatus(data.data);
          return;
        }
        setStatus(data.data);
      } catch (e) {
        if (!cancelled) setError(getUserFacingError(e, "Ссылка Face ID недействительна"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const directions = Array.isArray(status?.directions)
    ? (status!.directions as string[]).filter((d) => typeof d === "string")
    : [];
  const canCapture = Boolean(
    status && status.has_reference !== false && directions.length > 0 && outcome !== "success"
  );

  async function refreshStatus(): Promise<StatusDto | null> {
    try {
      const { data } = await api.get<{ data: StatusDto }>("/auth/face-login/status", {
        params: { challenge_token: token }
      });
      setStatus(data.data);
      return data.data;
    } catch {
      return null;
    }
  }

  async function onCapture(payload: {
    image_base64: string;
    liveness_steps: string[];
    landmarks?: Array<{ x: number; y: number }>;
  }) {
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/face-login/verify", {
        challenge_token: token,
        image_base64: payload.image_base64,
        liveness_steps: payload.liveness_steps,
        channel: "qr_phone",
        ...(payload.landmarks?.length ? { landmarks: payload.landmarks } : {})
      });
      setOutcome("success");
      setError(null);
      setStatus((prev) => (prev ? { ...prev, status: "approved" } : prev));
    } catch (err) {
      const latest = await refreshStatus();
      if (isAxiosError(err)) {
        const body = err.response?.data as { message?: string; error?: string } | undefined;
        const code = body?.error;
        if (code === "REFERENCE_MISSING") {
          setOutcome("failure");
          setError(
            "Нет эталонного фото Face ID. Администратор должен загрузить фото в карточке сотрудника."
          );
        } else if (code === "FACE_MISMATCH") {
          setOutcome("failure");
          setError(body?.message ?? "Лицо не совпало с эталоном");
        } else if (code === "FACE_CHALLENGE_REJECTED" || latest?.status === "rejected") {
          setOutcome("failure");
          setError("Проверка Face ID отклонена. Обновите QR на компьютере.");
        } else {
          setOutcome("failure");
          setError(body?.message ?? getUserFacingError(err));
        }
      } else {
        setOutcome("failure");
        setError(getUserFacingError(err));
      }
    } finally {
      setBusy(false);
    }
  }

  function onRetry() {
    setBusy(false);
    setOutcome(null);
    setError(null);
    setRetryToken((n) => n + 1);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-slate-950 text-white">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <SalesArenaLogo height={32} />
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Face ID · телефон
          </p>
        </div>

        <div className="flex flex-1 flex-col rounded-3xl border border-white/10 bg-white p-3 text-slate-900 shadow-xl sm:p-4">
          <h1 className="text-lg font-bold leading-tight sm:text-xl">Подтверждение входа</h1>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Держите лицо в овале и поверните голову по стрелке. Компьютер завершит вход сам.
          </p>

          {outcome === "success" ? (
            <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              Готово — лицо совпало (проверено на сервере). Компьютер войдёт сам — можно закрыть
              страницу.
            </p>
          ) : null}

          {error && outcome !== "success" ? (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          {outcome === "failure" && status?.status === "pending" ? (
            <button
              type="button"
              disabled={busy}
              onClick={onRetry}
              className="mt-3 w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
            >
              Повторить
            </button>
          ) : null}

          {canCapture ? (
            <div className="mt-3 flex-1">
              <FaceLivenessPanel
                directions={directions}
                busy={busy}
                compact
                outcome={outcome}
                retryToken={retryToken}
                onCapture={(p) => void onCapture(p)}
              />
            </div>
          ) : null}

          {!outcome && !error && !status ? (
            <p className="mt-8 text-center text-sm text-slate-500">Загрузка…</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
