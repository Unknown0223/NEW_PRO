import { buildFaceEmbedding } from "./face-match.embedding";

/**
 * Bump when embedding algorithm changes — cached User.ui_preferences
 * descriptors must rebuild from the stored reference JPEG.
 */
export const FACE_DESCRIPTOR_VERSION = 3;

/**
 * Identity fingerprint: FaceRecognitionNet 128-d embedding (WASM TFJS).
 * Studio etalon vs webcam probe is much more stable than block/hist fingerprints.
 */
export async function buildFaceDescriptor(imageBuf: Buffer): Promise<number[]> {
  try {
    return await buildFaceEmbedding(imageBuf);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "FACE_IMAGE_BLANK" || msg === "FACE_NOT_DETECTED") throw e;
    // Surface model/runtime failures as "no face" so the client can retry cleanly.
    throw new Error("FACE_NOT_DETECTED");
  }
}
