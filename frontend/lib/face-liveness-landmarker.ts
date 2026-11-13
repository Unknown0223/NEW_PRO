/**
 * MediaPipe Face Landmarker loader + frame analysis for Face ID liveness.
 * Prefers local /mediapipe assets (npm run sync:mediapipe); CDN fallback if missing.
 * Offline caveat: without local public/mediapipe or network, detector fails → manual button.
 */

import type { LandmarkPoint } from "@/lib/face-liveness-pose";
import { estimateHeadPoseFromLandmarks, type HeadPose } from "@/lib/face-liveness-pose";

export const MEDIAPIPE_TASKS_VERSION = "0.10.21";

const LOCAL_WASM = "/mediapipe/wasm";
const LOCAL_MODEL = "/mediapipe/face_landmarker.task";
const CDN_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_TASKS_VERSION}/wasm`;
const CDN_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

type FaceLandmarkerLike = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestampMs: number
  ) => {
    faceLandmarks?: Array<Array<{ x: number; y: number; z?: number }>>;
  };
  close?: () => void;
};

let landmarkerPromise: Promise<FaceLandmarkerLike> | null = null;

function looksLikeBinaryAsset(res: Response): boolean {
  if (!(res.ok || res.status === 206)) return false;
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  // Auth middleware used to redirect /mediapipe/*.wasm → login HTML (200 text/html).
  if (ct.includes("text/html")) return false;
  return true;
}

async function urlExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (looksLikeBinaryAsset(res)) return true;
  } catch {
    /* try GET range for servers that reject HEAD */
  }
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      cache: "no-store"
    });
    return looksLikeBinaryAsset(res);
  } catch {
    return false;
  }
}

async function resolveAssetPaths(): Promise<{ wasm: string; model: string }> {
  const localWasmOk = await urlExists(`${LOCAL_WASM}/vision_wasm_internal.wasm`);
  const localModelOk = await urlExists(LOCAL_MODEL);
  return {
    wasm: localWasmOk ? LOCAL_WASM : CDN_WASM,
    model: localModelOk ? LOCAL_MODEL : CDN_MODEL
  };
}

async function createLandmarker(
  delegate: "GPU" | "CPU",
  paths: { wasm: string; model: string }
): Promise<FaceLandmarkerLike> {
  const { FilesetResolver, FaceLandmarker } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks(paths.wasm);
  const landmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: paths.model,
      delegate
    },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false
  });
  return landmarker as FaceLandmarkerLike;
}

async function createLandmarkerWithFallback(): Promise<FaceLandmarkerLike> {
  const local = await resolveAssetPaths();
  const cdn = { wasm: CDN_WASM, model: CDN_MODEL };
  const attempts: Array<{ wasm: string; model: string; delegate: "GPU" | "CPU" }> = [
    { ...local, delegate: "GPU" },
    { ...local, delegate: "CPU" },
    { ...cdn, delegate: "GPU" },
    { ...cdn, delegate: "CPU" }
  ];
  let lastErr: unknown;
  for (const attempt of attempts) {
    try {
      return await createLandmarker(attempt.delegate, attempt);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("FaceLandmarker init failed");
}

/** Singleton FaceLandmarker (local assets → CDN, GPU → CPU). */
export function getFaceLandmarker(): Promise<FaceLandmarkerLike> {
  if (!landmarkerPromise) {
    landmarkerPromise = createLandmarkerWithFallback();
  }
  return landmarkerPromise;
}

export function resetFaceLandmarkerForTests(): void {
  landmarkerPromise = null;
}

export type FramePoseResult =
  | { ok: true; pose: HeadPose; landmarks: LandmarkPoint[] }
  | { ok: false; reason: "no_face" | "bad_pose" };

export function analyzeVideoFrame(
  landmarker: FaceLandmarkerLike,
  video: HTMLVideoElement,
  timestampMs: number
): FramePoseResult {
  if (!video.videoWidth || !video.videoHeight) {
    return { ok: false, reason: "no_face" };
  }
  const result = landmarker.detectForVideo(video, timestampMs);
  const face = result.faceLandmarks?.[0];
  if (!face || face.length < 264) {
    return { ok: false, reason: "no_face" };
  }
  const landmarks: LandmarkPoint[] = face.map((p) => ({ x: p.x, y: p.y, z: p.z }));
  const pose = estimateHeadPoseFromLandmarks(landmarks);
  if (!pose) return { ok: false, reason: "bad_pose" };
  return { ok: true, pose, landmarks };
}
