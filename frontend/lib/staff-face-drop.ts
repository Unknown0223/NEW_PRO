/** Telegram / Explorer drag-drop: MIME yoki kengaytma bo‘sh bo‘lishi mumkin. */

const ACCEPT_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/pjpeg",
  "image/gif",
  "image/bmp"
]);

function hasImageExtension(name: string): boolean {
  return /\.(jpe?g|png|webp|gif|bmp)$/i.test(name);
}

/** JPEG / PNG / WebP magic bytes. */
export function sniffImageMime(buf: ArrayBuffer): string | null {
  const b = new Uint8Array(buf);
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    b.length >= 12 &&
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  ) {
    return "image/webp";
  }
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  if (b.length >= 2 && b[0] === 0x42 && b[1] === 0x4d) return "image/bmp";
  return null;
}

export function isLikelyImageFile(file: File): boolean {
  if (ACCEPT_MIME.has(file.type)) return true;
  if (file.type.startsWith("image/")) return true;
  if (hasImageExtension(file.name)) return true;
  if (!file.type || file.type === "application/octet-stream") return true;
  return false;
}

export async function ensureImageFile(file: File): Promise<File | null> {
  if (ACCEPT_MIME.has(file.type) && hasImageExtension(file.name)) return file;
  try {
    const buf = await file.arrayBuffer();
    if (buf.byteLength < 24) return null;
    const mime = sniffImageMime(buf);
    if (!mime) {
      if (ACCEPT_MIME.has(file.type) || file.type.startsWith("image/")) return file;
      if (hasImageExtension(file.name)) return file;
      return null;
    }
    const ext =
      mime === "image/png"
        ? "png"
        : mime === "image/webp"
          ? "webp"
          : mime === "image/gif"
            ? "gif"
            : mime === "image/bmp"
              ? "bmp"
              : "jpg";
    const name =
      file.name && hasImageExtension(file.name) ? file.name : `telegram-photo.${ext}`;
    return new File([buf], name, { type: mime, lastModified: file.lastModified || Date.now() });
  } catch {
    return isLikelyImageFile(file) ? file : null;
  }
}

function firstHttpOrBlobUrl(text: string): string | null {
  const m = text.match(/(?:https?:\/\/|blob:)[^\s"'<>]+/i);
  return m?.[0]?.replace(/&amp;/g, "&") ?? null;
}

async function fileFromUrl(url: string): Promise<File | null> {
  try {
    if (url.startsWith("blob:") || /^https?:\/\//i.test(url)) {
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      const buf = await blob.arrayBuffer();
      const sniffed = sniffImageMime(buf);
      const mime = sniffed ?? (blob.type.startsWith("image/") ? blob.type : null);
      if (!mime) return null;
      const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
      return new File([buf], `drop-photo.${ext}`, { type: mime });
    }
  } catch {
    /* CORS / file:// / tg:// */
  }
  return null;
}

function getAsString(item: DataTransferItem): Promise<string> {
  return new Promise((resolve) => {
    try {
      item.getAsString((s) => resolve(s ?? ""));
    } catch {
      resolve("");
    }
  });
}

type FileSystemFileEntryLike = {
  isFile: boolean;
  file: (ok: (f: File) => void, err?: (e: Error) => void) => void;
};

async function fileFromWebkitEntry(item: DataTransferItem): Promise<File | null> {
  const anyItem = item as DataTransferItem & {
    webkitGetAsEntry?: () => FileSystemFileEntryLike | null;
  };
  const entry = anyItem.webkitGetAsEntry?.();
  if (!entry || !entry.isFile) return null;
  const file = await new Promise<File | null>((resolve) => {
    entry.file(
      (f) => resolve(f),
      () => resolve(null)
    );
  });
  if (!file) return null;
  return ensureImageFile(file);
}

/**
 * DataTransfer dan rasm File — Telegram Desktop (bo‘sh MIME), Explorer, brauzer.
 */
export async function pickImageFileFromDataTransfer(
  dt: DataTransfer | null
): Promise<File | null> {
  if (!dt) return null;

  const files = Array.from(dt.files ?? []);
  for (const f of files) {
    if (!isLikelyImageFile(f)) continue;
    const ok = await ensureImageFile(f);
    if (ok) return ok;
  }

  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind === "file") {
      const fromEntry = await fileFromWebkitEntry(item);
      if (fromEntry) return fromEntry;
      const f = item.getAsFile();
      if (f && isLikelyImageFile(f)) {
        const ok = await ensureImageFile(f);
        if (ok) return ok;
      }
    }
  }

  // String formats — async getAsString (Telegram HTML/URI)
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind !== "string") continue;
    const t = (item.type || "").toLowerCase();
    if (!t.includes("html") && !t.includes("uri") && t !== "text/plain") continue;
    const text = await getAsString(item);
    const url = firstHttpOrBlobUrl(text) || firstHttpOrBlobUrl(text.match(/src=["']([^"']+)["']/i)?.[1] ?? "");
    if (url) {
      const fromUrl = await fileFromUrl(url);
      if (fromUrl) return fromUrl;
    }
  }

  const uriList = dt.getData("text/uri-list") || "";
  const html = dt.getData("text/html") || "";
  const plain = dt.getData("text/plain") || "";
  const url =
    firstHttpOrBlobUrl(uriList) ||
    firstHttpOrBlobUrl(html.match(/src=["']([^"']+)["']/i)?.[1] ?? "") ||
    firstHttpOrBlobUrl(plain);
  if (url) {
    const fromUrl = await fileFromUrl(url);
    if (fromUrl) return fromUrl;
  }

  if (files[0]) return ensureImageFile(files[0]);
  return null;
}

export async function pickImageFileFromClipboard(
  items: DataTransferItemList | null
): Promise<File | null> {
  if (!items) return null;
  for (const item of Array.from(items)) {
    if (item.kind === "file") {
      const f = item.getAsFile();
      if (f) {
        const ok = await ensureImageFile(f);
        if (ok) return ok;
      }
    }
  }
  return null;
}

/** navigator.clipboard.read() — Telegram «Копировать» → Вставить. */
export async function pickImageFileFromClipboardApi(): Promise<File | null> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.read) return null;
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find((t) => t.startsWith("image/"));
      if (!imageType) continue;
      const blob = await item.getType(imageType);
      const buf = await blob.arrayBuffer();
      const sniffed = sniffImageMime(buf);
      const mime = sniffed ?? (blob.type.startsWith("image/") ? blob.type : imageType);
      if (!mime.startsWith("image/")) continue;
      const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
      return new File([buf], `clipboard-photo.${ext}`, { type: mime });
    }
  } catch {
    /* permission denied */
  }
  return null;
}

/** Server limiti ~900KB binary — Telegram clipboard ko‘pincha kattaroq. */
const FACE_UPLOAD_MAX_EDGE = 1280;
const FACE_UPLOAD_JPEG_QUALITY = 0.85;
const FACE_UPLOAD_MAX_BYTES = 750_000;

/**
 * Etalon yuklash uchun JPEG ga siqish (canvas).
 * Muvaffaqiyatsiz bo‘lsa — asl fayl.
 */
export async function compressImageForFaceUpload(file: File): Promise<File> {
  if (typeof window === "undefined" || typeof document === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, FACE_UPLOAD_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    let quality = FACE_UPLOAD_JPEG_QUALITY;
    let blob: Blob | null = null;
    for (let i = 0; i < 6; i++) {
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
      );
      if (!blob) break;
      if (blob.size <= FACE_UPLOAD_MAX_BYTES) break;
      quality = Math.max(0.45, quality - 0.1);
    }
    if (!blob || blob.size < 64) return file;
    return new File([blob], "face-reference.jpg", {
      type: "image/jpeg",
      lastModified: Date.now()
    });
  } catch {
    return file;
  }
}
