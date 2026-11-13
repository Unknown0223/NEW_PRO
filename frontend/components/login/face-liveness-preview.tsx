"use client";

import type { RefCallback } from "react";
import { FaceScanIndicator } from "@/components/login/face-scan-indicator";

type ArrowMeta = { rotate: number; x: string; y: string };

type Props = {
  setVideoNode: RefCallback<HTMLVideoElement>;
  camError: string | null;
  ready: boolean;
  compact?: boolean;
  previewSize: string;
  ovalClass: string;
  vignette: string;
  outcome: "success" | "failure" | null;
  phase: "liveness" | "align" | "sending";
  arrow?: ArrowMeta;
  arrowDone: boolean;
  arrowWarm: boolean;
  facePresent?: boolean;
  progress?: number;
  serverBusy?: boolean;
};

export function FaceLivenessPreview({
  setVideoNode,
  camError,
  ready,
  compact,
  previewSize,
  ovalClass,
  vignette,
  outcome,
  phase,
  arrow,
  arrowDone,
  arrowWarm,
  facePresent,
  progress = 0,
  serverBusy
}: Props) {
  const showServer = phase === "sending" || Boolean(serverBusy);
  const indicatorMode =
    outcome === "success"
      ? "success"
      : outcome === "failure"
        ? "failure"
        : showServer
          ? "server"
          : phase === "align"
            ? "align"
            : "scan";

  const showCenterIndicator =
    Boolean(outcome) ||
    showServer ||
    phase === "align" ||
    (phase === "liveness" && facePresent && !arrowDone);

  return (
    <div
      className={`relative mx-auto w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 ${previewSize}`}
    >
      {camError ? (
        <div className="flex h-full min-h-[280px] items-center justify-center p-6 text-center text-sm text-amber-100">
          {camError}
        </div>
      ) : (
        <>
          <video
            ref={setVideoNode}
            className="h-full w-full object-cover [transform:scaleX(-1)]"
            autoPlay
            muted
            playsInline
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: vignette }}
            aria-hidden
          />
          <div
            className={`pointer-events-none absolute rounded-[50%] border-[2.5px] shadow-[0_0_0_1px_rgba(15,23,42,0.3)] transition-colors duration-300 ${ovalClass} ${
              outcome === "failure"
                ? "border-red-400"
                : outcome === "success" || showServer
                  ? "border-emerald-400/90"
                  : facePresent
                    ? "border-teal-300"
                    : "border-white/80"
            }`}
            aria-hidden
          />
          {phase === "liveness" && arrow && !outcome && !showServer ? (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: arrow.x, top: arrow.y }}
              aria-hidden
            >
              <span
                className={`flex items-center justify-center rounded-full text-white shadow-lg ring-4 transition-all duration-200 ${
                  compact ? "h-16 w-16" : "h-14 w-14"
                } ${
                  arrowDone
                    ? "bg-emerald-500 ring-emerald-200/50"
                    : arrowWarm
                      ? "scale-110 bg-teal-400 ring-teal-100/40"
                      : "animate-pulse bg-teal-500/95 shadow-teal-900/40 ring-white/30"
                }`}
              >
                {arrowDone ? (
                  <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none">
                    <path
                      d="M5 13l4 4L19 7"
                      stroke="currentColor"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-8 w-8"
                    fill="none"
                    style={{ transform: `rotate(${arrow.rotate}deg)` }}
                  >
                    <path
                      d="M5 12h12m0 0-5-5m5 5-5 5"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
            </div>
          ) : null}

          {showCenterIndicator ? (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-slate-950/30">
              <FaceScanIndicator
                mode={indicatorMode}
                progress={phase === "align" ? 0.85 : progress}
                compact={compact}
              />
            </div>
          ) : null}

          {!ready && !outcome ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 text-sm text-slate-200">
              Включаем камеру…
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
