/**
 * Face-crop + MediaPipe landmarks for etalon upload / verify snapshots.
 * Uses a dedicated IMAGE-mode landmarker so VIDEO singleton stays untouched.
 */

import { faceBoundingBoxFromLandmarks, type NormPoint } from "@/lib/face-capture-crop";
import { MEDIAPIPE_TASKS_VERSION } from "@/lib/face-liveness-landmarker";

const LOCAL_WASM = "/mediapipe/wasm";
const LOCAL_MODEL = "/mediapipe/face_landmarker.task";
const CDN_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_TASKS_VERSION}/wasm`;
const CDN_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

type ImageLandmarker = {
  detect: (image: HTMLCanvasElement | HTMLImageElement) => {
    faceLandmarks?: Array<Array<{ x: number; y: number; z?: number }>>;
  };
  close?: () => void;
};

let imageLandmarkerPromise: Promise<ImageLandmarker> | null = null;

async function urlOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store" });
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    return (res.ok || res.status === 206) && !ct.includes("text/html");
  } catch {
    return false;
  }
}

async function getImageLandmarker(): Promise<ImageLandmarker> {
  if (!imageLandmarkerPromise) {
    imageLandmarkerPromise = (async () => {
      const { FilesetResolver, FaceLandmarker } = await import("@mediapipe/tasks-vision");
      const localWasm = await urlOk(`${LOCAL_WASM}/vision_wasm_internal.wasm`);
      const localModel = await urlOk(LOCAL_MODEL);
      const wasm = localWasm ? LOCAL_WASM : CDN_WASM;
      const model = localModel ? LOCAL_MODEL : CDN_MODEL;
      const vision = await FilesetResolver.forVisionTasks(wasm);
      for (const delegate of ["GPU", "CPU"] as const) {
        try {
          return (await FaceLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: model, delegate },
            runningMode: "IMAGE",
            numFaces: 1,
            outputFaceBlendshapes: false,
            outputFacialTransformationMatrixes: false
          })) as ImageLandmarker;
        } catch {
          /* try next */
        }
      }
      throw new Error("IMAGE_LANDMARKER_FAILED");
    })();
  }
  return imageLandmarkerPromise;
}

function canvasFromBitmap(bmp: ImageBitmap): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("CANVAS");
  ctx.drawImage(bmp, 0, 0);
  return canvas;
}

function cropCanvasToFace(
  src: HTMLCanvasElement,
  landmarks: NormPoint[]
): HTMLCanvasElement | null {
  const box = faceBoundingBoxFromLandmarks(landmarks, 0.32);
  if (!box) return null;
  const sx = Math.floor(box.x * src.width);
  const sy = Math.floor(box.y * src.height);
  const sw = Math.max(48, Math.floor(box.w * src.width));
  const sh = Math.max(48, Math.floor(box.h * src.height));
  const side = Math.max(sw, sh);
  const out = document.createElement("canvas");
  out.width = 512;
  out.height = 512;
  const ctx = out.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#f5f5f5";
  ctx.fillRect(0, 0, 512, 512);
  const scale = Math.min(512 / sw, 512 / sh);
  const dw = Math.floor(sw * scale);
  const dh = Math.floor(sh * scale);
  ctx.drawImage(
    src,
    sx,
    sy,
    Math.min(sw, src.width - sx),
    Math.min(sh, src.height - sy),
    Math.floor((512 - dw) / 2),
    Math.floor((512 - dh) / 2),
    dw,
    dh
  );
  void side;
  return out;
}

export type PreparedFaceUpload = {
  image_base64: string;
  landmarks: NormPoint[];
};

/** Crop face from photo and return JPEG + landmarks for etalon upload. */
export async function prepareFaceReferenceFromFile(
  file: File
): Promise<PreparedFaceUpload | { error: string }> {
  try {
    const bmp = await createImageBitmap(file);
    const full = canvasFromBitmap(bmp);
    bmp.close();
    const landmarker = await getImageLandmarker();
    const detected = landmarker.detect(full);
    const face = detected.faceLandmarks?.[0];
    if (!face || face.length < 400) {
      return { error: "На фото не найдено лицо. Загрузите чёткий портрет анфас." };
    }
    const landmarks: NormPoint[] = face.map((p) => ({ x: p.x, y: p.y }));
    const cropped = cropCanvasToFace(full, landmarks) ?? full;
    const dataUrl = cropped.toDataURL("image/jpeg", 0.92);
    const image_base64 = dataUrl.includes(",") ? dataUrl.split(",")[1]! : dataUrl;
    /* Re-detect on crop so landmark coords match stored crop image. */
    const re = landmarker.detect(cropped).faceLandmarks?.[0];
    const finalLandmarks: NormPoint[] = re?.length
      ? re.map((p) => ({ x: p.x, y: p.y }))
      : landmarks;
    return { image_base64, landmarks: finalLandmarks };
  } catch {
    return { error: "Не удалось разобрать лицо на фото. Попробуйте другое изображение." };
  }
}
