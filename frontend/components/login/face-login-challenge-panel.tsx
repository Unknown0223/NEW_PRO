"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import {
  buildAbsoluteBridgeUrl,
  isFaceLoginGateResponse,
  resolveFaceBridgeOrigin,
  type FaceLoginChallengeDto,
  type FaceLoginGateResponse
} from "@/lib/face-login";
import { FaceLivenessPanel } from "@/components/login/face-liveness-panel";
import { FaceLoginQrPane } from "@/components/login/face-login-qr-pane";
import { getUserFacingError } from "@/lib/error-utils";
import { isAxiosError } from "axios";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

type Props = {
  gate: FaceLoginGateResponse;
  onApproved: (tokens: {
    accessToken: string;
    refreshToken?: string;
    user: FaceLoginGateResponse["user"] & { must_change_password?: boolean };
  }) => void;
  onCancel: () => void;
};

export function FaceLoginChallengePanel({ gate, onApproved, onCancel }: Props) {
  const [challenge, setChallenge] = useState<FaceLoginChallengeDto>(gate.face_challenge);
  const [mode, setMode] = useState<"webcam" | "qr">("webcam");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [bridgeUrl, setBridgeUrl] = useState("");
  const [noCam, setNoCam] = useState(false);
  const [webcamOutcome, setWebcamOutcome] = useState<"success" | "failure" | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [qrPhase, setQrPhase] = useState<"wait" | "entering" | null>(null);
  const onApprovedRef = useRef(onApproved);
  useEffect(() => {
    onApprovedRef.current = onApproved;
  }, [onApproved]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const origin = await resolveFaceBridgeOrigin();
      if (cancelled) return;
      setBridgeUrl(buildAbsoluteBridgeUrl(challenge.bridge_path, origin || window.location.origin));
    })();
    return () => {
      cancelled = true;
    };
  }, [challenge.bridge_path, challenge.token]);

  useEffect(() => {
    if (!bridgeUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const QR = await import("qrcode");
        const url = await QR.toDataURL(bridgeUrl, { margin: 1, width: 220 });
        if (!cancelled) setQrDataUrl(url);
      } catch {
        if (!cancelled) setQrDataUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bridgeUrl]);

  const recreateChallenge = useCallback(async (): Promise<boolean> => {
    setRefreshing(true);
    setError(null);
    try {
      const { data } = await api.post("/auth/face-login/recreate", {
        challenge_token: challenge.token
      });
      if (isFaceLoginGateResponse(data)) {
        setChallenge(data.face_challenge);
        setError(null);
        return true;
      }
      setError("Не удалось обновить QR. Войдите снова.");
      return false;
    } catch (err) {
      setError(faceVerifyError(err, "Срок сессии Face ID истёк. Войдите снова."));
      return false;
    } finally {
      setRefreshing(false);
    }
  }, [challenge.token]);

  const pollUntilApproved = useCallback(
    async (isCancelled: () => boolean) => {
      const started = Date.now();
      const token = challenge.token;
      while (Date.now() - started < 130_000) {
        await new Promise((r) => setTimeout(r, 1000));
        if (isCancelled()) return;
        try {
          const { data } = await api.get<{ data: { status: string } }>("/auth/face-login/status", {
            params: { challenge_token: token }
          });
          if (data.data.status === "approved") {
            if (!isCancelled()) setQrPhase("entering");
            const done = await api.post("/auth/face-login/complete", {
              challenge_token: token
            });
            if (done.data?.accessToken) {
              if (!isCancelled()) {
                await new Promise((r) => setTimeout(r, 450));
                onApprovedRef.current(done.data);
              }
              return;
            }
          }
          if (data.data.status === "rejected") {
            if (isCancelled()) return;
            setError("Проверка Face ID отклонена. Можно обновить QR и повторить.");
            return;
          }
          if (data.data.status === "expired") {
            if (isCancelled()) return;
            const ok = await recreateChallenge();
            /* Yangi token — effect qayta poll qiladi; bu loopni to‘xtatamiz. */
            if (!ok && !isCancelled()) {
              setError("Срок проверки истёк. Нажмите «Обновить QR» или войдите снова.");
            }
            return;
          }
        } catch {
          /* keep polling */
        }
      }
      if (!isCancelled()) {
        const ok = await recreateChallenge();
        if (!ok) setError("Время ожидания истекло. Нажмите «Обновить QR» или войдите снова.");
      }
    },
    [challenge.token, recreateChallenge]
  );

  useEffect(() => {
    if (mode !== "qr" && !noCam) return;
    let cancelled = false;
    setQrPhase("wait");
    void pollUntilApproved(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [mode, noCam, pollUntilApproved]);

  const handleCameraError = useCallback(() => {
    setNoCam(true);
    setMode("qr");
  }, []);

  async function submitWebcam(payload: {
    image_base64: string;
    liveness_steps: string[];
    landmarks?: Array<{ x: number; y: number }>;
  }) {
    setBusy(true);
    setError(null);
    /* Outcome ni bu yerda null qilmang — kamera effektini qayta ishga tushirib,
       verify paytida bo‘sh kadr oqimini ochib yuboradi. */
    try {
      const { data } = await api.post("/auth/face-login/verify", {
        challenge_token: challenge.token,
        image_base64: payload.image_base64,
        liveness_steps: payload.liveness_steps,
        channel: "webcam",
        ...(payload.landmarks?.length ? { landmarks: payload.landmarks } : {})
      });
      if (data?.accessToken) {
        setWebcamOutcome("success");
        setError(null);
        /* Qisqa galochka animatsiyasi — keyin modal yopilib asosiy sahifa. */
        await new Promise((r) => setTimeout(r, 700));
        onApprovedRef.current(data);
      } else {
        setWebcamOutcome("failure");
        setError("Не удалось завершить вход");
      }
    } catch (err) {
      if (isAxiosError(err)) {
        const code = (err.response?.data as { error?: string } | undefined)?.error;
        if (code === "FACE_CHALLENGE_EXPIRED") {
          const ok = await recreateChallenge();
          if (ok) {
            setWebcamOutcome(null);
            setError("Срок истёк — QR/проверка обновлены. Повторите съёмку.");
            setRetryToken((n) => n + 1);
          }
          return;
        }
        if (code === "FACE_MISMATCH") {
          setWebcamOutcome("failure");
          setError(faceVerifyError(err));
          return;
        }
      }
      setWebcamOutcome("failure");
      setError(faceVerifyError(err));
    } finally {
      setBusy(false);
    }
  }

  function retryWebcam() {
    setBusy(false);
    setWebcamOutcome(null);
    setError(null);
    setRetryToken((n) => n + 1);
  }

  const showWebcam = mode === "webcam" && !noCam;
  const userLabel = gate.user.name || gate.user.login;
  const showRefresh = !showWebcam || Boolean(error) || refreshing;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy && !refreshing) onCancel();
      }}
    >
      <DialogContent
        showCloseButton={!busy && !refreshing}
        overlayClassName="bg-slate-950/55 supports-backdrop-filter:backdrop-blur-sm"
        className="max-h-[min(94vh,900px)] gap-0 overflow-y-auto p-0 sm:max-w-md"
      >
        <DialogHeader className="border-b border-slate-100 px-5 py-4 pr-12">
          <DialogTitle className="text-lg font-semibold text-slate-900">
            Подтверждение Face ID
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            {userLabel}: после пароля нужна проверка лица по эталону.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          {!challenge.has_reference ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Нет эталонного фото. Попросите администратора загрузить Face ID в карточке сотрудника.
            </p>
          ) : null}

          <div className="flex gap-2">
            <ModeBtn
              active={showWebcam}
              onClick={() => {
                setMode("webcam");
                setNoCam(false);
                setError(null);
              }}
            >
              Камера ПК
            </ModeBtn>
            <ModeBtn
              active={!showWebcam}
              onClick={() => {
                setMode("qr");
                setError(null);
              }}
            >
              QR на телефон
            </ModeBtn>
          </div>

          {showWebcam ? (
            challenge.has_reference ? (
              <FaceLivenessPanel
                directions={challenge.directions}
                busy={busy || refreshing}
                outcome={webcamOutcome}
                retryToken={retryToken}
                onCapture={(p) => void submitWebcam(p)}
                onCameraError={handleCameraError}
              />
            ) : (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm text-slate-600">
                Сначала загрузите эталонное фото в карточке сотрудника, затем повторите вход.
              </p>
            )
          ) : challenge.has_reference ? (
            <FaceLoginQrPane qrDataUrl={qrDataUrl} bridgeUrl={bridgeUrl} qrPhase={qrPhase} />
          ) : (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm text-slate-600">
              Сначала загрузите эталонное фото в карточке сотрудника, затем повторите вход.
            </p>
          )}

          {error ? (
            <p
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          {webcamOutcome === "failure" && showWebcam ? (
            <button
              type="button"
              disabled={busy || refreshing}
              onClick={retryWebcam}
              className="w-full rounded-lg bg-teal-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
            >
              Повторить
            </button>
          ) : null}

          {showRefresh ? (
            <button
              type="button"
              disabled={refreshing || busy}
              onClick={() => void recreateChallenge()}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              {refreshing ? "Обновление…" : "Обновить QR"}
            </button>
          ) : null}

          <button
            type="button"
            disabled={busy || refreshing}
            onClick={onCancel}
            className="w-full pb-1 text-sm text-slate-500 hover:text-slate-800 disabled:opacity-60"
          >
            Отмена — вернуться к паролю
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ModeBtn({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
          : "flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
      }
    >
      {children}
    </button>
  );
}

function faceVerifyError(err: unknown, fallback = "Не удалось проверить Face ID"): string {
  if (isAxiosError(err)) {
    const body = err.response?.data as { error?: string; message?: string } | undefined;
    if (body?.message) return body.message;
    if (body?.error === "FACE_MISMATCH") return "Лицо не совпало с эталоном";
    if (body?.error === "FACE_LIVENESS_FAILED") return "Проверка живости не пройдена";
    if (body?.error === "REFERENCE_MISSING") return "Нет эталонного фото Face ID";
    if (body?.error === "FACE_CHALLENGE_EXPIRED") {
      return "Срок проверки истёк. Нажмите «Обновить QR» или войдите снова.";
    }
  }
  return getUserFacingError(err, fallback);
}
