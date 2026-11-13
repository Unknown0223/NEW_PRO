"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  analyzeVideoFrame,
  getFaceLandmarker
} from "@/lib/face-liveness-landmarker";
import {
  POSE_THRESHOLDS,
  directionProgress,
  matchesRequiredDirection,
  poseDelta,
  type HeadPose
} from "@/lib/face-liveness-pose";

type Args = {
  videoRef: RefObject<HTMLVideoElement | null>;
  directions: string[];
  stepIdx: number;
  enabled: boolean;
  onStepComplete: (dir: string) => void;
};

/**
 * ~12 fps MediaPipe pose loop: baseline → delta → auto-complete when direction held.
 */
export function useFaceLivenessDetection({
  videoRef,
  directions,
  stepIdx,
  enabled,
  onStepComplete
}: Args) {
  const [detectorReady, setDetectorReady] = useState(false);
  const [detectorError, setDetectorError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [facePresent, setFacePresent] = useState(false);

  const baselineRef = useRef<HeadPose | null>(null);
  const settleUntilRef = useRef(0);
  const holdCountRef = useRef(0);
  const lastAnalyzeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const stepIdxRef = useRef(stepIdx);
  const onStepCompleteRef = useRef(onStepComplete);
  const completingRef = useRef(false);

  useEffect(() => {
    stepIdxRef.current = stepIdx;
  }, [stepIdx]);
  useEffect(() => {
    onStepCompleteRef.current = onStepComplete;
  }, [onStepComplete]);

  useEffect(() => {
    let cancelled = false;
    setDetectorError(null);
    setDetectorReady(false);
    (async () => {
      try {
        await getFaceLandmarker();
        if (!cancelled) setDetectorReady(true);
      } catch {
        if (!cancelled) {
          setDetectorError(
            "Автоопределение поворота недоступно (модель не загрузилась). Используйте кнопку ниже."
          );
          setDetectorReady(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const resetBaseline = useCallback(() => {
    baselineRef.current = null;
    holdCountRef.current = 0;
    completingRef.current = false;
    settleUntilRef.current = performance.now() + POSE_THRESHOLDS.settleMs;
    setProgress(0);
  }, []);

  useEffect(() => {
    resetBaseline();
  }, [stepIdx, resetBaseline]);

  useEffect(() => {
    if (!enabled || !detectorReady) {
      setFacePresent(false);
      setProgress(0);
      return;
    }
    /* Retry / re-enable: eski baseline yopishib qolmasin — aks holda birinchi urinish “eski” xato bilan yiqiladi. */
    resetBaseline();
    let cancelled = false;

    const tick = async (now: number) => {
      if (cancelled) return;
      rafRef.current = requestAnimationFrame(tick);
      if (completingRef.current) return;
      if (now - lastAnalyzeRef.current < POSE_THRESHOLDS.analysisIntervalMs) return;
      lastAnalyzeRef.current = now;

      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth < 16) return;

      try {
        const landmarker = await getFaceLandmarker();
        if (cancelled || completingRef.current) return;
        const frame = analyzeVideoFrame(landmarker, video, now);
        if (!frame.ok) {
          setFacePresent(false);
          setProgress(0);
          holdCountRef.current = 0;
          return;
        }
        setFacePresent(true);

        if (now < settleUntilRef.current || !baselineRef.current) {
          baselineRef.current = frame.pose;
          setProgress(0);
          return;
        }

        const dir = directions[stepIdxRef.current];
        if (!dir) return;
        const delta = poseDelta(frame.pose, baselineRef.current);
        const prog = directionProgress(delta, dir);
        setProgress(prog);

        if (matchesRequiredDirection(delta, dir)) {
          holdCountRef.current += 1;
          if (holdCountRef.current >= POSE_THRESHOLDS.holdFrames) {
            completingRef.current = true;
            onStepCompleteRef.current(dir);
          }
        } else {
          holdCountRef.current = 0;
        }
      } catch {
        /* transient */
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [detectorReady, directions, enabled, resetBaseline, videoRef]);

  return {
    detectorReady,
    detectorError,
    progress,
    facePresent,
    resetBaseline
  };
}
