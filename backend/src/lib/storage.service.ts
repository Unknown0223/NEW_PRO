import {
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  renameSync,
  statSync,
  unlinkSync
} from "fs";
import { unlink } from "fs/promises";
import { join } from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import type { Readable as ReadableType } from "stream";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { limitStreamBytes, type ByteCountState } from "./storage-stream.pure";

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

async function putLocalStream(
  key: string,
  stream: ReadableType,
  maxBytes: number
): Promise<number> {
  const target = localPath(key);
  mkdirSync(join(target, ".."), { recursive: true });
  const tmp = `${target}.upload`;
  const state: ByteCountState = { written: 0 };
  try {
    await pipeline(
      stream,
      async function* (source) {
        yield* limitStreamBytes(source, maxBytes, state);
      },
      createWriteStream(tmp)
    );
    renameSync(tmp, target);
    return state.written;
  } catch (err) {
    try {
      if (existsSync(tmp)) unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    throw err;
  }
}

async function putS3Stream(
  key: string,
  stream: ReadableType,
  contentType: string,
  maxBytes: number
): Promise<number> {
  const state: ByteCountState = { written: 0 };
  const limited = Readable.from(limitStreamBytes(stream, maxBytes, state));
  const upload = new Upload({
    client: getS3Client(),
    params: {
      Bucket: env.STORAGE_BUCKET!,
      Key: key,
      Body: limited,
      ContentType: contentType
    }
  });
  await upload.done();
  return state.written;
}

/** S3/R2 object storage — env yoqilmagan bo‘lsa lokal disk. Buffer.concat yo‘q. */
export async function storagePut(
  prefix: string,
  filename: string,
  stream: ReadableType,
  contentType: string,
  maxBytes: number
): Promise<StoragePutResult> {
  const key = objectKey(prefix, filename);
  const bytes = isObjectStorageEnabled()
    ? await putS3Stream(key, stream, contentType, maxBytes)
    : await putLocalStream(key, stream, maxBytes);
  return {
    key,
    bytes,
    url: isObjectStorageEnabled() ? publicUrlForKey(key) : undefined
  };
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
    await unlink(p).catch(() => undefined);
  }
}

export function isRemoteObjectStorageEnabled(): boolean {
  return isObjectStorageEnabled();
}
