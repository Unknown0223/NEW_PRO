"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FaceLivenessPreview } from "@/components/login/face-liveness-preview";
import { FaceLivenessStatus } from "@/components/login/face-liveness-status";
import { captureVideoJpeg } from "@/lib/face-capture-crop";
import { LIVENESS_LABELS } from "@/lib/face-login";
import { analyzeVideoFrame, getFaceLandmarker } from "@/lib/face-liveness-landmarker";
import { POSE_THRESHOLDS } from "@/lib/face-liveness-pose";
import { useFaceLivenessDetection } from "@/lib/use-face-liveness-detection";

type Props = {
  directions: string[];
  busy?: boolean;
  onCapture: (payload: {
    image_base64: string;
    liveness_steps: string[];
    landmarks?: Array<{ x: number; y: number }>;
  }) => void;
  onCameraError?: (message: string) => void;
  compact?: boolean;
  outcome?: "success" | "failure" | null;
  retryToken?: number;
};

const ARROW_META: Record<string, { rotate: number; x: string; y: string }> = {
  up: { rotate: -90, x: "50%", y: "8%" },
  down: { rotate: 90, x: "50%", y: "92%" },
  left: { rotate: 180, x: "8%", y: "50%" },
  right: { rotate: 0, x: "92%", y: "50%" },
  "up-left": { rotate: -135, x: "14%", y: "14%" },
  "up-right": { rotate: -45, x: "86%", y: "14%" },
  "down-left": { rotate: 135, x: "14%", y: "86%" },
  "down-right": { rotate: 45, x: "86%", y: "86%" }
};

const ALIGN_YAW = 0.08;
const ALIGN_PITCH = 0.08;
const ALIGN_HOLD = 4;

export function FaceLivenessPanel({
  directions,
  busy,
  onCapture,
  onCameraError,
  compact,
  outcome = null,
  retryToken = 0
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onCameraErrorRef = useRef(onCameraError);
  const onCaptureRef = useRef(onCapture);
  const stepIdxRef = useRef(0);
  const doneStepsRef = useRef<string[]>([]);
  const advancingRef = useRef(false);
  const alignHoldRef = useRef(0);
  const capturedRef = useRef(false);

  const [stepIdx, setStepIdx] = useState(0);
  const [doneSteps, setDoneSteps] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [stepConfirmed, setStepConfirmed] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [flashProgress, setFlashProgress] = useState<number | null>(null);
  const [phase, setPhase] = useState<"liveness" | "align" | "sending">("liveness");

  useEffect(() => {
    onCameraErrorRef.current = onCameraError;
  }, [onCameraError]);
  useEffect(() => {
    onCaptureRef.current = onCapture;
  }, [onCapture]);
  useEffect(() => {
    stepIdxRef.current = stepIdx;
  }, [stepIdx]);
  useEffect(() => {
    doneStepsRef.current = doneSteps;
  }, [doneSteps]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
  }, []);

  const resetFlow = useCallback(() => {
    stepIdxRef.current = 0;
    doneStepsRef.current = [];
    advancingRef.current = false;
    alignHoldRef.current = 0;
    capturedRef.current = false;
    setStepIdx(0);
    setDoneSteps([]);
    setStepConfirmed(false);
    setAdvancing(false);
    setFlashProgress(null);
    setPhase("liveness");
    /* Kamera qayta ochilguncha detektor ishlamasin — bo‘sh/eski kadr ketmasin. */
    setReady(false);
  }, []);

  useEffect(() => {
    if (retryToken > 0 && !outcome) resetFlow();
  }, [retryToken, outcome, resetFlow]);

  const attachStream = useCallback(async (stream: MediaStream) => {
    const video = videoRef.current;
    if (!video) return false;
    video.srcObject = stream;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    try {
      await video.play();
    } catch {
      /* autoplay may wait for gesture */
    }
    return video.readyState >= 2 || video.videoWidth > 0;
  }, []);

  const setVideoNode = useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node;
      if (node && streamRef.current) {
        void attachStream(streamRef.current).then((ok) => {
          if (ok) setReady(true);
        });
      }
    },
    [attachStream]
  );

  useEffect(() => {
    if (outcome) {
      stopCamera();
      setReady(false);
      return;
    }
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    setReady(false);

    (async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        const msg = "Камера недоступна в этом браузере. Используйте QR на телефон.";
        setCamError(msg);
        onCameraErrorRef.current?.(msg);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "user" },
            width: { ideal: 720 },
            height: { ideal: 720 }
          },
          audio: false
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const attached = await attachStream(stream);
        if (cancelled) return;
        const markReady = () => {
          if (cancelled) return;
          const v = videoRef.current;
          if (!v || v.readyState < 2 || v.videoWidth < 16) return;
          /* Qisqa settle — birinchi yorug‘/auto-exposure kadri serverga ketmasin. */
          settleTimer = setTimeout(() => {
            if (!cancelled) setReady(true);
          }, 280);
        };
        if (attached) {
          markReady();
        } else {
          retryTimer = setTimeout(() => {
            if (cancelled || !streamRef.current) return;
            void attachStream(streamRef.current).then(() => {
              markReady();
            });
          }, 120);
        }
      } catch {
        const msg = "Нет доступа к камере. Разрешите камеру или используйте QR на телефон.";
        setCamError(msg);
        onCameraErrorRef.current?.(msg);
      }
    })();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (settleTimer) clearTimeout(settleTimer);
      stopCamera();
      setReady(false);
    };
  }, [attachStream, stopCamera, outcome, retryToken]);

  const emitCapture = useCallback(
    (steps: string[], landmarks?: Array<{ x: number; y: number }>) => {
      if (capturedRef.current) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth < 16) return;
      if (!streamRef.current) return;
      const dataUrl = captureVideoJpeg(video, { landmarks, quality: 0.92 });
      if (!dataUrl) return;
      capturedRef.current = true;
      setPhase("sending");
      stopCamera();
      setReady(false);
      onCaptureRef.current({
        image_base64: dataUrl,
        liveness_steps: steps,
        ...(landmarks?.length ? { landmarks } : {})
      });
    },
    [stopCamera]
  );

  const completeStep = useCallback(
    (dir: string) => {
      if (advancingRef.current || outcome || phase !== "liveness") return;
      advancingRef.current = true;
      setAdvancing(true);
      setStepConfirmed(true);
      setFlashProgress(1);
      const next = [...doneStepsRef.current, dir];
      doneStepsRef.current = next;
      setDoneSteps(next);

      window.setTimeout(() => {
        setStepConfirmed(false);
        setFlashProgress(null);
        if (stepIdxRef.current + 1 < directions.length) {
          const nextIdx = stepIdxRef.current + 1;
          stepIdxRef.current = nextIdx;
          setStepIdx(nextIdx);
          advancingRef.current = false;
          setAdvancing(false);
          return;
        }
        advancingRef.current = false;
        setAdvancing(false);
        alignHoldRef.current = 0;
        setPhase("align");
      }, 280);
    },
    [directions.length, outcome, phase]
  );

  const { detectorReady, detectorError, progress, facePresent } = useFaceLivenessDetection({
    videoRef,
    directions,
    stepIdx,
    enabled: ready && !camError && !busy && !advancing && phase === "liveness" && !outcome,
    onStepComplete: completeStep
  });

  useEffect(() => {
    if (phase !== "align" || !ready || camError || busy || outcome) return;
    let cancelled = false;
    let raf = 0;
    let last = 0;

    const tick = async (now: number) => {
      if (cancelled) return;
      raf = requestAnimationFrame(tick);
      if (now - last < POSE_THRESHOLDS.analysisIntervalMs) return;
      last = now;
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      try {
        const landmarker = await getFaceLandmarker();
        if (cancelled) return;
        const frame = analyzeVideoFrame(landmarker, video, now);
        if (!frame.ok) {
          alignHoldRef.current = 0;
          return;
        }
        const frontal =
          Math.abs(frame.pose.yaw) <= ALIGN_YAW && Math.abs(frame.pose.pitch) <= ALIGN_PITCH;
        if (!frontal) {
          alignHoldRef.current = 0;
          return;
        }
        alignHoldRef.current += 1;
        if (alignHoldRef.current >= ALIGN_HOLD) {
          emitCapture(doneStepsRef.current, frame.landmarks);
        }
      } catch {
        /* manual button */
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [phase, ready, camError, busy, outcome, emitCapture]);

  const markStepManual = useCallback(() => {
    if (busy || outcome || advancingRef.current) return;
    if (phase === "align" || phase === "sending") {
      emitCapture(doneStepsRef.current);
      return;
    }
    const dir = directions[stepIdxRef.current];
    if (!dir) return;
    completeStep(dir);
  }, [busy, completeStep, directions, emitCapture, outcome, phase]);

  const current = directions[stepIdx] ?? "";
  const label = LIVENESS_LABELS[current] ?? current;
  const arrow = ARROW_META[current];
  const total = directions.length;
  const stepNum = Math.min(stepIdx + 1, total);
  const previewSize = compact
    ? "aspect-[3/4] w-full max-h-[min(78dvh,640px)]"
    : "aspect-[3/4] max-h-[min(68vh,520px)]";
  const shownProgress = flashProgress ?? progress;
  const arrowDone = stepConfirmed || shownProgress >= 0.98;
  const arrowWarm = shownProgress >= POSE_THRESHOLDS.progressSoftStart;
  const ovalClass = compact
    ? "left-1/2 top-[48%] h-[78%] w-[72%] -translate-x-1/2 -translate-y-1/2"
    : "left-1/2 top-[46%] h-[68%] w-[58%] -translate-x-1/2 -translate-y-1/2";
  const vignette = compact
    ? "radial-gradient(ellipse 55% 62% at 50% 48%, transparent 56%, rgba(2,6,23,0.78) 58%)"
    : "radial-gradient(ellipse 42% 52% at 50% 46%, transparent 58%, rgba(2,6,23,0.72) 59%)";

  const verifying = phase === "sending" || Boolean(busy);
  const statusTitle =
    outcome === "success"
      ? "Лицо совпало — вход…"
      : outcome === "failure"
        ? "Лицо не совпало с эталоном"
        : verifying
          ? "Проверка на сервере…"
          : phase === "align"
            ? "Смотрите прямо в камеру"
            : `Поверните голову ${label}`;
  const hint = outcome
    ? outcome === "success"
      ? "Модальное окно закроется автоматически."
      : "Нажмите «Повторить» или обновите эталон в карточке сотрудника."
    : verifying
      ? "Сверяем снимок с эталоном на сервере."
      : phase === "align"
        ? "Держите лицо в овале — снимок сделается сам."
        : detectorError ||
          (detectorReady
            ? facePresent
              ? "Держите лицо в овале — поворот определится автоматически."
              : "Поместите лицо в овал."
            : "Загружаем детектор лица…");
  const titleClass =
    outcome === "failure" ? "text-red-600" : outcome === "success" ? "text-emerald-700" : "text-slate-900";

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <FaceLivenessPreview
        setVideoNode={setVideoNode}
        camError={camError}
        ready={ready}
        compact={compact}
        previewSize={previewSize}
        ovalClass={ovalClass}
        vignette={vignette}
        outcome={outcome}
        phase={phase}
        arrow={arrow}
        arrowDone={arrowDone}
        arrowWarm={arrowWarm}
        facePresent={facePresent}
        progress={shownProgress}
        serverBusy={busy}
      />
      {!camError ? (
        <FaceLivenessStatus
          compact={compact}
          outcome={outcome}
          phase={phase}
          busy={busy}
          total={total}
          stepNum={stepNum}
          stepIdx={stepIdx}
          doneCount={doneSteps.length}
          statusTitle={statusTitle}
          hint={hint}
          titleClass={titleClass}
          shownProgress={shownProgress}
          detectorReady={detectorReady}
          detectorError={detectorError}
          showManual={!outcome && !verifying}
          manualLabel={
            phase === "align"
              ? "Сделать фото сейчас"
              : stepIdx + 1 >= directions.length
                ? "Сделать фото вручную"
                : "Пропустить шаг"
          }
          manualDisabled={!ready || Boolean(busy) || Boolean(camError) || advancing}
          onManual={markStepManual}
        />
      ) : null}
    </div>
  );
}
