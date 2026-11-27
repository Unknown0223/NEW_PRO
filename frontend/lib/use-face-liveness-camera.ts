"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefCallback
} from "react";
import {
  buildFaceVideoConstraints,
  listFaceVideoDevices,
  readSavedFaceCameraDeviceId,
  writeSavedFaceCameraDeviceId,
  type FaceCameraDevice
} from "@/lib/face-camera-devices";

type Opts = {
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  streamRef: MutableRefObject<MediaStream | null>;
  outcome: "success" | "failure" | null;
  retryToken: number;
  onCameraError?: (message: string) => void;
  onResetFlow: () => void;
};

export function useFaceLivenessCamera({
  videoRef,
  streamRef,
  outcome,
  retryToken,
  onCameraError,
  onResetFlow
}: Opts) {
  const [ready, setReady] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [cameraDevices, setCameraDevices] = useState<FaceCameraDevice[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(() => readSavedFaceCameraDeviceId());
  const onCameraErrorRef = useRef(onCameraError);
  useEffect(() => {
    onCameraErrorRef.current = onCameraError;
  }, [onCameraError]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
  }, [streamRef, videoRef]);

  const attachStream = useCallback(
    async (stream: MediaStream) => {
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
    },
    [videoRef]
  );

  const setVideoNode = useCallback<RefCallback<HTMLVideoElement>>(
    (node) => {
      videoRef.current = node;
      if (node && streamRef.current) {
        void attachStream(streamRef.current).then((ok) => {
          if (ok) setReady(true);
        });
      }
    },
    [attachStream, streamRef, videoRef]
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
    setCamError(null);

    (async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        const msg = "Камера недоступна в этом браузере. Используйте QR на телефон.";
        setCamError(msg);
        onCameraErrorRef.current?.(msg);
        return;
      }
      try {
        stopCamera();
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: buildFaceVideoConstraints(deviceId),
            audio: false
          });
        } catch (firstErr) {
          if (!deviceId) throw firstErr;
          writeSavedFaceCameraDeviceId(null);
          if (!cancelled) setDeviceId(null);
          return;
        }
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (deviceId) writeSavedFaceCameraDeviceId(deviceId);
        const listed = await listFaceVideoDevices();
        if (!cancelled) setCameraDevices(listed);
        const attached = await attachStream(stream);
        if (cancelled) return;
        const markReady = () => {
          if (cancelled) return;
          const v = videoRef.current;
          if (!v || v.readyState < 2 || v.videoWidth < 16) return;
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
  }, [attachStream, deviceId, outcome, retryToken, stopCamera, streamRef, videoRef]);

  const onCameraDeviceChange = useCallback(
    (nextId: string) => {
      writeSavedFaceCameraDeviceId(nextId);
      setDeviceId(nextId);
      onResetFlow();
    },
    [onResetFlow]
  );

  return {
    ready,
    setReady,
    camError,
    cameraDevices,
    deviceId,
    stopCamera,
    setVideoNode,
    onCameraDeviceChange
  };
}
