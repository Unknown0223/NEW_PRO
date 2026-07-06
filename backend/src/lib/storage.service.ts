import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { createReadStream, existsSync, mkdirSync, renameSync, statSync } from "fs";
import { join } from "path";
import { pipeline } from "stream/promises";
import type { Readable } from "stream";
import { env } from "../config/env";
import { logger } from "../config/logger";

export type StoragePutResult = { key: string; bytes: number; url?: string };

function isObjectStorageEnabled(): boolean {
  return Boolean(
    env.STORAGE_ENDPOINT?.trim() &&
      env.STORAGE_BUCKET?.trim() &&
      env.STORAGE_ACCESS_KEY?.trim() &&
      env.STORAGE_SECRET_KEY?.trim()
  );
}

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: "auto",
      endpoint: env.STORAGE_ENDPOINT!.replace(/\/+$/, ""),
      credentials: {
        accessKeyId: env.STORAGE_ACCESS_KEY!,
        secretAccessKey: env.STORAGE_SECRET_KEY!
      },
      forcePathStyle: true
    });
  }
  return s3Client;
}

function objectKey(prefix: string, filename: string): string {
  return `${prefix.replace(/\/+$/, "")}/${filename.replace(/^\/+/, "")}`;
}

function publicUrlForKey(key: string): string | undefined {
  const publicBase = env.STORAGE_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  return publicBase ? `${publicBase}/${key}` : undefined;
}

async function s3PutObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: env.STORAGE_BUCKET!,
      Key: key,
      Body: body,
      ContentType: contentType
    })
  );
}

async function s3GetObject(key: string): Promise<Buffer | null> {
  try {
    const res = await getS3Client().send(
      new GetObjectCommand({ Bucket: env.STORAGE_BUCKET!, Key: key })
    );
    if (!res.Body) return null;
    const chunks: Uint8Array[] = [];
    for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (err) {
    const name = (err as { name?: string }).name;
    if (name === "NoSuchKey" || name === "NotFound") return null;
    throw err;
  }
}

async function s3DeleteObject(key: string): Promise<void> {
  await getS3Client().send(
    new DeleteObjectCommand({ Bucket: env.STORAGE_BUCKET!, Key: key })
  );
}

const LOCAL_ROOT = join(process.cwd(), "uploads", "object-storage");

function localPath(key: string): string {
  return join(LOCAL_ROOT, key.replace(/\.\./g, "_"));
}

/** S3/R2 object storage — env yoqilmagan bo‘lsa lokal disk fallback. */
export async function storagePut(
  prefix: string,
  filename: string,
  stream: Readable,
  contentType: string,
  maxBytes: number
): Promise<StoragePutResult> {
  const key = objectKey(prefix, filename);
  let written = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    written += buf.length;
    if (written > maxBytes) throw new Error("FILE_TOO_LARGE");
    chunks.push(buf);
  }
  const body = Buffer.concat(chunks);

  if (isObjectStorageEnabled()) {
    await s3PutObject(key, body, contentType);
    return { key, bytes: written, url: publicUrlForKey(key) };
  }

  const target = localPath(key);
  mkdirSync(join(target, ".."), { recursive: true });
  const { writeFileSync } = await import("fs");
  writeFileSync(target, body);
  return { key, bytes: written };
}

export async function storagePutFile(
  prefix: string,
  filename: string,
  localFilePath: string,
  contentType: string
): Promise<StoragePutResult> {
  const st = statSync(localFilePath);
  const stream = createReadStream(localFilePath);
  return storagePut(prefix, filename, stream, contentType, st.size + 1);
}

export function storageOpenReadStream(key: string): ReturnType<typeof createReadStream> | null {
  if (isObjectStorageEnabled()) {
    logger.debug({ key }, "storage_get_requires_async_for_remote");
    return null;
  }
  const p = localPath(key);
  if (!existsSync(p)) return null;
  return createReadStream(p);
}

export async function storageReadBuffer(key: string): Promise<Buffer | null> {
  if (isObjectStorageEnabled()) {
    return s3GetObject(key);
  }
  const p = localPath(key);
  if (!existsSync(p)) return null;
  const { readFileSync } = await import("fs");
  return readFileSync(p);
}

export async function storageDelete(key: string): Promise<void> {
  if (isObjectStorageEnabled()) {
    await s3DeleteObject(key);
    return;
  }
  const p = localPath(key);
  if (existsSync(p)) {
    const { unlinkSync } = await import("fs");
    unlinkSync(p);
  }
}

export async function storageSaveStreamToLocalThenUpload(
  prefix: string,
  filename: string,
  stream: Readable,
  contentType: string,
  maxBytes: number
): Promise<StoragePutResult> {
  const tmpDir = join(LOCAL_ROOT, "_tmp");
  mkdirSync(tmpDir, { recursive: true });
  const tmp = join(tmpDir, `${Date.now()}-${filename}.upload`);
  const target = join(tmpDir, `${Date.now()}-${filename}`);
  let written = 0;
  await pipeline(
    stream,
    async function* (source) {
      for await (const chunk of source) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        written += buf.length;
        if (written > maxBytes) throw new Error("FILE_TOO_LARGE");
        yield buf;
      }
    },
    (await import("fs")).createWriteStream(tmp)
  );
  renameSync(tmp, target);
  try {
    return await storagePutFile(prefix, filename, target, contentType);
  } finally {
    try {
      (await import("fs/promises")).unlink(target);
    } catch {
      /* ignore */
    }
  }
}

export function isRemoteObjectStorageEnabled(): boolean {
  return isObjectStorageEnabled();
}
