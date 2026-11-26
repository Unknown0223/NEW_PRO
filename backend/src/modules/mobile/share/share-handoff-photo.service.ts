import { Readable } from "node:stream";
import { storagePut } from "../../../lib/storage.service";
import {
  decodeBase64Image,
  MAX_IMAGE_BYTES
} from "../mobile-face.shared";

/** Ulashish handoff fotosi — S3 yoki lokal disk; `photo_key` qaytaradi. */
export async function uploadShareHandoffPhoto(input: {
  tenantId: number;
  userId: number;
  requestId: number;
  imageBase64: string;
}): Promise<{ photo_key: string; bytes: number }> {
  const { buf, contentType } = decodeBase64Image(input.imageBase64);
  const ext = contentType.includes("png") ? "png" : "jpg";
  const filename = `${input.userId}-${Date.now()}.${ext}`;
  const put = await storagePut(
    `tenants/${input.tenantId}/share-handoff/${input.requestId}`,
    filename,
    Readable.from(buf),
    contentType,
    MAX_IMAGE_BYTES
  );
  return { photo_key: put.key, bytes: put.bytes };
}
