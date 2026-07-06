import { randomBytes } from "node:crypto";
import { isRemoteObjectStorageEnabled, storagePut } from "./storage.service";
import { Readable } from "stream";

const DATA_URL_RE = /^data:(image\/[a-z+]+);base64,(.+)$/i;

function decodeBase64Photo(input: string): { buffer: Buffer; contentType: string } | null {
  const trimmed = input.trim();
  const m = DATA_URL_RE.exec(trimmed);
  if (m) {
    return { contentType: m[1]!, buffer: Buffer.from(m[2]!, "base64") };
  }
  if (/^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length > 80) {
    return { contentType: "image/jpeg", buffer: Buffer.from(trimmed, "base64") };
  }
  return null;
}

/**
 * Remote storage yoqilganda base64 fotoni S3/R2 ga yuklaydi va public URL qaytaradi.
 * Yoqilmagan bo‘lsa — kiruvchi qiymat o‘zgartirilmaydi (DB da data URL).
 */
export async function resolveClientPhotoImageUrl(
  tenantId: number,
  clientId: number,
  imageInput: string
): Promise<string> {
  if (!isRemoteObjectStorageEnabled()) {
    return imageInput;
  }
  const decoded = decodeBase64Photo(imageInput);
  if (!decoded) {
    return imageInput;
  }
  const ext = decoded.contentType.includes("png") ? "png" : "jpg";
  const filename = `${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
  const prefix = `client-photos/${tenantId}/${clientId}`;
  const result = await storagePut(
    prefix,
    filename,
    Readable.from(decoded.buffer),
    decoded.contentType,
    decoded.buffer.length + 1
  );
  if (result.url) return result.url;
  return result.key;
}
