import { Readable } from "stream";
import { prisma } from "../../config/database";
import { storagePut, storageReadBuffer, storageDelete } from "../../lib/storage.service";
import { FACE_DESCRIPTOR_VERSION, buildFaceDescriptor } from "./face-match.descriptor";
import {
  buildLandmarkDescriptor,
  parseLandmarkDescriptor,
  type LandmarkXY
} from "./face-landmark-match.pure";
import { parseDescriptor } from "./face-match.pure";
import {
  MAX_IMAGE_BYTES,
  REF_AT,
  REF_DESC,
  REF_DESC_V,
  REF_KEY,
  REF_LANDMARK_DESC,
  decodeBase64Image,
  readUiPrefs,
  storagePrefix,
  type UiPrefs
} from "./mobile-face.shared";

export async function getFaceReferenceKey(tenantId: number, userId: number): Promise<string | null> {
  const u = await prisma.user.findFirst({
    where: { id: userId, tenant_id: tenantId },
    select: { ui_preferences: true }
  });
  if (!u) return null;
  const prefs = readUiPrefs(u.ui_preferences);
  const key = prefs[REF_KEY];
  return typeof key === "string" && key.length > 0 ? key : null;
}

export async function getFaceReferenceMeta(tenantId: number, userId: number) {
  const u = await prisma.user.findFirst({
    where: { id: userId, tenant_id: tenantId },
    select: { ui_preferences: true }
  });
  if (!u) return { has_reference: false as const, uploaded_at: null as string | null };
  const prefs = readUiPrefs(u.ui_preferences);
  const key = prefs[REF_KEY];
  const at = prefs[REF_AT];
  return {
    has_reference: typeof key === "string" && key.length > 0,
    uploaded_at: typeof at === "string" ? at : null
  };
}

export async function loadOrBuildReferenceDescriptor(
  tenantId: number,
  userId: number,
  prefs: UiPrefs,
  expectedLen?: number
): Promise<number[] | null> {
  const cached = parseDescriptor(prefs[REF_DESC]);
  const cachedV = Number(prefs[REF_DESC_V] ?? 0);
  if (
    cached &&
    cachedV === FACE_DESCRIPTOR_VERSION &&
    (expectedLen == null || cached.length === expectedLen)
  ) {
    return cached;
  }
  const key = prefs[REF_KEY];
  if (typeof key !== "string" || !key) return null;
  const buf = await storageReadBuffer(key);
  if (!buf) return null;
  const desc = await buildFaceDescriptor(buf);
  prefs[REF_DESC] = desc;
  prefs[REF_DESC_V] = FACE_DESCRIPTOR_VERSION;
  await prisma.user.update({
    where: { id: userId },
    data: { ui_preferences: prefs as object }
  });
  return desc;
}

export async function uploadFaceReference(
  tenantId: number,
  userId: number,
  imageBase64: string,
  landmarks?: LandmarkXY[] | null
): Promise<{ storage_key: string; uploaded_at: string }> {
  const { buf, contentType } = decodeBase64Image(imageBase64);
  let descriptor: number[];
  try {
    descriptor = await buildFaceDescriptor(buf);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "FACE_IMAGE_BLANK" || msg === "FACE_NOT_DETECTED") throw e;
    throw e;
  }
  const landmarkDesc = landmarks?.length ? buildLandmarkDescriptor(landmarks) : null;
  const ext = contentType.includes("png") ? "png" : "jpg";
  const filename = `reference.${ext}`;
  const put = await storagePut(
    storagePrefix(tenantId, userId),
    filename,
    Readable.from(buf),
    contentType,
    MAX_IMAGE_BYTES
  );
  const uploadedAt = new Date().toISOString();
  const u = await prisma.user.findFirst({
    where: { id: userId, tenant_id: tenantId },
    select: { ui_preferences: true }
  });
  if (!u) throw new Error("NOT_FOUND");
  const prefs = readUiPrefs(u.ui_preferences);
  prefs[REF_KEY] = put.key;
  prefs[REF_AT] = uploadedAt;
  prefs[REF_DESC] = descriptor;
  prefs[REF_DESC_V] = FACE_DESCRIPTOR_VERSION;
  if (landmarkDesc) prefs[REF_LANDMARK_DESC] = landmarkDesc;
  else delete prefs[REF_LANDMARK_DESC];
  await prisma.user.update({
    where: { id: userId },
    data: { ui_preferences: prefs as object }
  });
  return { storage_key: put.key, uploaded_at: uploadedAt };
}

export async function deleteFaceReference(tenantId: number, userId: number): Promise<{ ok: true }> {
  const u = await prisma.user.findFirst({
    where: { id: userId, tenant_id: tenantId },
    select: { ui_preferences: true }
  });
  if (!u) throw new Error("NOT_FOUND");
  const prefs = readUiPrefs(u.ui_preferences);
  const key = prefs[REF_KEY];
  if (typeof key === "string" && key.length > 0) {
    try {
      await storageDelete(key);
    } catch {
      /* ignore missing file */
    }
  }
  delete prefs[REF_KEY];
  delete prefs[REF_AT];
  delete prefs[REF_DESC];
  delete prefs[REF_DESC_V];
  delete prefs[REF_LANDMARK_DESC];
  await prisma.user.update({
    where: { id: userId },
    data: { ui_preferences: prefs as object }
  });
  return { ok: true };
}

export function readStoredLandmarkDescriptor(prefs: UiPrefs): number[] | null {
  return parseLandmarkDescriptor(prefs[REF_LANDMARK_DESC]);
}

export async function readFaceReferenceBuffer(
  tenantId: number,
  userId: number
): Promise<Buffer | null> {
  const key = await getFaceReferenceKey(tenantId, userId);
  if (!key) return null;
  return storageReadBuffer(key);
}
